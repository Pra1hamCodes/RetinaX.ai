"""Inference orchestration for the RetinaX AI ensemble.

Loads up to three Keras models exactly once per worker process:
  - binary_cnn         : DR / No-DR gate (sigmoid output, optional)
  - multiclass_cnn     : 5-class custom CNN (optional)
  - efficientnet       : EfficientNet-B0 transfer model (optional)
  - teachable_machine  : the extracted Teachable Machine 5-class model (always present)

The Teachable Machine model is used as a permanent fallback so the system
can serve real predictions immediately, before any custom models are
trained. Once `train_binary.py`, `train_multiclass.py`, and
`train_efficientnet.py` produce weights, the ensemble lights them up
automatically.

Usage:
    service = InferenceService.get()       # singleton
    result = service.predict("/path/to/fundus.jpg")
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from tensorflow.keras.models import load_model

from app.config import get_settings
from app.schemas.prediction import SEVERITY_LABELS, PredictionResult, ProbabilityMap
from app.services import storage_service
from ml.gradcam import compute_heatmap, find_last_conv_layer, overlay_heatmap
from ml.preprocessing import (
    DEFAULT_INPUT_SIZE,
    geometric_pipeline,
    load_bgr,
    normalize,
    preprocess_for_custom_cnn,
    preprocess_for_efficientnet,
    preprocess_for_teachable_machine,
)

logger = logging.getLogger(__name__)
settings = get_settings()


RECOMMENDATIONS: dict[int, str] = {
    0: (
        "No diabetic retinopathy detected. Continue annual diabetic eye screenings "
        "and maintain glycemic control."
    ),
    1: (
        "Mild non-proliferative DR detected. Schedule a follow-up retinal exam in "
        "6-12 months and tighten blood-glucose, blood-pressure, and lipid control."
    ),
    2: (
        "Moderate non-proliferative DR detected. Refer to an ophthalmologist within "
        "1-3 months for a dilated fundus exam and OCT."
    ),
    3: (
        "Severe non-proliferative DR detected. Urgent ophthalmology referral "
        "(within weeks). Risk of progression to proliferative disease is high."
    ),
    4: (
        "Proliferative DR detected. EMERGENT referral to a retinal specialist for "
        "evaluation and likely pan-retinal photocoagulation or anti-VEGF therapy."
    ),
}


@dataclass
class _Models:
    binary: Optional[object] = None
    multiclass: Optional[object] = None
    efficientnet: Optional[object] = None
    teachable: Optional[object] = None
    teachable_last_conv: Optional[object] = None        # Conv2D layer object
    multi_last_conv: Optional[object] = None
    efficientnet_last_conv: Optional[object] = None


class InferenceService:
    """Thread-safe singleton wrapping the ensemble."""

    _instance: "InferenceService | None" = None
    _instance_lock = threading.Lock()

    def __init__(self) -> None:
        self._predict_lock = threading.Lock()
        self._models = _Models()
        self._version = "init"
        self._load_all()

    # ---------- Singleton ----------

    @classmethod
    def get(cls) -> "InferenceService":
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ---------- Loading ----------

    def _load_all(self) -> None:
        models_dir: Path = settings.ml_models_dir
        version_parts: list[str] = []

        # Teachable Machine (extracted asset; always present)
        tm_path = models_dir / "teachable_machine_multiclass.h5"
        if tm_path.exists():
            try:
                self._models.teachable = load_model(tm_path, compile=False)
                self._models.teachable_last_conv = find_last_conv_layer(self._models.teachable)
                version_parts.append("tm@" + tm_path.stat().st_mtime.__int__().__str__())
                logger.info("Loaded Teachable Machine model from %s", tm_path)
            except Exception:
                logger.exception("Failed to load Teachable Machine model")
        else:
            logger.warning("Teachable Machine model missing at %s", tm_path)

        # Optional trained models
        binary_path = models_dir / "binary_cnn.h5"
        if binary_path.exists():
            try:
                self._models.binary = load_model(binary_path, compile=False)
                version_parts.append("bin@" + str(int(binary_path.stat().st_mtime)))
                logger.info("Loaded binary CNN from %s", binary_path)
            except Exception:
                logger.exception("Failed to load binary CNN")

        multi_path = models_dir / "multiclass_cnn.h5"
        if multi_path.exists():
            try:
                self._models.multiclass = load_model(multi_path, compile=False)
                self._models.multi_last_conv = find_last_conv_layer(self._models.multiclass)
                version_parts.append("multi@" + str(int(multi_path.stat().st_mtime)))
                logger.info("Loaded multiclass CNN from %s", multi_path)
            except Exception:
                logger.exception("Failed to load multiclass CNN")

        eff_path = models_dir / "efficientnet.h5"
        if eff_path.exists():
            try:
                self._models.efficientnet = load_model(eff_path, compile=False)
                self._models.efficientnet_last_conv = find_last_conv_layer(self._models.efficientnet)
                version_parts.append("eff@" + str(int(eff_path.stat().st_mtime)))
                logger.info("Loaded EfficientNet from %s", eff_path)
            except Exception:
                logger.exception("Failed to load EfficientNet")

        if not (self._models.teachable or self._models.multiclass or self._models.efficientnet):
            raise RuntimeError(
                "No multi-class model available. Place a model at "
                f"{models_dir} (teachable_machine_multiclass.h5, multiclass_cnn.h5, "
                "or efficientnet.h5)."
            )

        self._version = "+".join(version_parts) or "unknown"
        logger.info("InferenceService ready (version=%s)", self._version)

    # ---------- Public ----------

    def predict(self, image_path: str | Path, save_artifacts: bool = True) -> PredictionResult:
        start = time.perf_counter()
        image_path = Path(image_path)

        bgr = load_bgr(image_path)

        # Geometric pipeline once; produce normalized inputs lazily per model.
        rgb = geometric_pipeline(bgr, size=DEFAULT_INPUT_SIZE)

        with self._predict_lock:                       # TF graph isn't thread-safe by default
            p_dr, binary_probs = self._run_binary(rgb)
            multi_probs = self._run_multiclass(rgb)
            eff_probs = self._run_efficientnet(rgb)

            final = self._ensemble(binary_probs, multi_probs, eff_probs)
            severity_class = int(np.argmax(final))

            # Pick the best available model for Grad-CAM (prefer the heavyweight)
            heatmap_model, heatmap_input, last_conv = self._select_for_gradcam(rgb)
            heatmap, _ = compute_heatmap(
                heatmap_model, heatmap_input, class_index=severity_class, last_conv_layer=last_conv
            )

        original_url = storage_service.public_url_for(image_path)
        heatmap_url: str | None = None
        if save_artifacts:
            heatmap_path = self._persist_heatmap(bgr, heatmap)
            heatmap_url = storage_service.public_url_for(heatmap_path)

        result = PredictionResult(
            severity_class=severity_class,
            severity_label=SEVERITY_LABELS[severity_class],
            confidence=float(final[severity_class]),
            confidence_binary=float(p_dr),
            probabilities=ProbabilityMap(
                no_dr=float(final[0]),
                mild=float(final[1]),
                moderate=float(final[2]),
                severe=float(final[3]),
                proliferative=float(final[4]),
            ),
            original_image_url=original_url,
            heatmap_url=heatmap_url,
            recommendation=RECOMMENDATIONS[severity_class],
            model_version=self._version,
        )
        logger.info(
            "predict[%s] -> class=%s conf=%.3f in %.1f ms",
            image_path.name,
            severity_class,
            result.confidence,
            (time.perf_counter() - start) * 1000.0,
        )
        return result

    # ---------- Stage runners ----------

    def _run_binary(self, rgb: np.ndarray) -> tuple[float, np.ndarray]:
        """Return (p_dr, soft 5-vector over classes for the ensemble)."""
        if self._models.binary is None:
            return 0.5, np.array([0.5, 0.125, 0.125, 0.125, 0.125], dtype=np.float32)

        x = np.expand_dims(normalize(rgb, "zero_one"), axis=0)
        out = self._models.binary.predict(x, verbose=0)
        # Support both sigmoid (1 unit) and softmax (2 units)
        if out.shape[-1] == 1:
            p_dr = float(out[0][0])
        else:
            p_dr = float(out[0][1])

        # Spread the binary verdict across the 5-class space:
        # No-DR mass goes to class 0, DR mass is split uniformly across 1-4.
        soft = np.array(
            [1.0 - p_dr, p_dr / 4, p_dr / 4, p_dr / 4, p_dr / 4],
            dtype=np.float32,
        )
        return p_dr, soft

    def _run_multiclass(self, rgb: np.ndarray) -> np.ndarray:
        # Prefer the trained multiclass CNN over the Teachable Machine fallback.
        if self._models.multiclass is not None:
            x = np.expand_dims(normalize(rgb, "zero_one"), axis=0)
            return self._models.multiclass.predict(x, verbose=0)[0].astype(np.float32)

        if self._models.teachable is not None:
            x = np.expand_dims(normalize(rgb, "neg_one_one"), axis=0)
            return self._models.teachable.predict(x, verbose=0)[0].astype(np.float32)

        # Should never happen — _load_all() raises if neither is present.
        return np.array([0.2, 0.2, 0.2, 0.2, 0.2], dtype=np.float32)

    def _run_efficientnet(self, rgb: np.ndarray) -> np.ndarray | None:
        if self._models.efficientnet is None:
            return None
        x = np.expand_dims(normalize(rgb, "imagenet"), axis=0)
        return self._models.efficientnet.predict(x, verbose=0)[0].astype(np.float32)

    # ---------- Ensemble ----------

    def _ensemble(
        self,
        binary_probs: np.ndarray,
        multi_probs: np.ndarray,
        eff_probs: np.ndarray | None,
    ) -> np.ndarray:
        # Renormalize weights based on which models are present.
        w_b = settings.ml_ensemble_w_binary if self._models.binary is not None else 0.0
        w_m = settings.ml_ensemble_w_multi
        w_e = settings.ml_ensemble_w_effnet if eff_probs is not None else 0.0

        total = w_b + w_m + w_e
        if total <= 0:
            return multi_probs / max(multi_probs.sum(), 1e-9)

        w_b, w_m, w_e = w_b / total, w_m / total, w_e / total

        agg = w_m * multi_probs + w_b * binary_probs
        if eff_probs is not None:
            agg = agg + w_e * eff_probs

        agg = np.clip(agg, 0.0, None)
        
        # **Class separation enhancement (CONSERVATIVE)**: Only disambiguate Moderate vs Proliferative
        # when we have very high confidence it's a serious DR case AND they're close in confidence.
        # This prevents false positives on No DR images.
        if self._models.multiclass is None:  # No custom multiclass, using Teachable Machine
            no_dr_conf = agg[0]
            moderate_conf = agg[2]
            prolif_conf = agg[4]
            dr_confidence = binary_probs[1]
            
            # Only boost Proliferative if ALL conditions are met:
            # 1. No-DR confidence is very low (< 0.2) - not a No DR image
            # 2. DR confidence is very high (> 0.75) - definitely has DR
            # 3. Moderate and Proliferative are both reasonably high (> 0.15)
            # 4. Moderate is slightly higher than Proliferative (but close)
            # This prevents boosting for low-confidence predictions or No DR images
            if (no_dr_conf < 0.2 and dr_confidence > 0.75 and 
                moderate_conf > 0.15 and prolif_conf > 0.15 and
                moderate_conf > prolif_conf and moderate_conf < 0.5):
                # Conservative transfer: only 8% instead of 15%
                transfer = moderate_conf * 0.08
                agg[2] = moderate_conf - transfer
                agg[4] = prolif_conf + transfer
        
        s = agg.sum()
        return (agg / s) if s > 0 else multi_probs

    # ---------- Grad-CAM target selection ----------

    def _select_for_gradcam(self, rgb: np.ndarray):
        if self._models.efficientnet is not None:
            return (
                self._models.efficientnet,
                np.expand_dims(normalize(rgb, "imagenet"), axis=0),
                self._models.efficientnet_last_conv,
            )
        if self._models.multiclass is not None:
            return (
                self._models.multiclass,
                np.expand_dims(normalize(rgb, "zero_one"), axis=0),
                self._models.multi_last_conv,
            )
        return (
            self._models.teachable,
            np.expand_dims(normalize(rgb, "neg_one_one"), axis=0),
            self._models.teachable_last_conv,
        )

    # ---------- Artifact persistence ----------

    def _persist_heatmap(self, original_bgr: np.ndarray, heatmap: np.ndarray) -> Path:
        # Resize the original to model input size for a clean overlay
        canvas = cv2.resize(original_bgr, (DEFAULT_INPUT_SIZE, DEFAULT_INPUT_SIZE), interpolation=cv2.INTER_AREA)
        overlay = overlay_heatmap(canvas, heatmap)
        out_path = settings.heatmap_dir / f"{uuid.uuid4().hex}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(out_path), overlay)
        return out_path
