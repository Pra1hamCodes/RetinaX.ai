"""Shared training helpers: metrics dump, history serialization, plot saving."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)

logger = logging.getLogger(__name__)


def compute_classification_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
    n_classes: int = 5,
) -> dict:
    """Return a JSON-serialisable bundle of classification metrics."""
    metrics: dict = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_weighted": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "kappa": float(cohen_kappa_score(y_true, y_pred, weights="quadratic")),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=list(range(n_classes))).tolist(),
    }

    if y_proba is not None and y_proba.ndim == 2 and y_proba.shape[1] == n_classes:
        roc: dict[str, dict[str, list[float] | float]] = {}
        for cls in range(n_classes):
            y_bin = (y_true == cls).astype(int)
            if y_bin.sum() == 0 or y_bin.sum() == len(y_bin):
                continue
            fpr, tpr, _ = roc_curve(y_bin, y_proba[:, cls])
            try:
                auc = float(roc_auc_score(y_bin, y_proba[:, cls]))
            except ValueError:
                auc = float("nan")
            roc[str(cls)] = {"fpr": fpr.tolist(), "tpr": tpr.tolist(), "auc": auc}
        metrics["roc"] = roc

    return metrics


def serialise_keras_history(history) -> dict:
    """Convert a tf.keras History.history dict into JSON-friendly lists."""
    return {k: [float(v) for v in vals] for k, vals in history.history.items()}


def write_metrics_json(out_dir: Path, name: str, payload: dict) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {"generated_at": datetime.now(timezone.utc).isoformat(), **payload}
    out_path = out_dir / f"{name}.json"
    out_path.write_text(json.dumps(payload, indent=2))
    logger.info("Metrics written to %s", out_path)
    return out_path


def make_callbacks(
    out_dir: Path,
    monitor: str = "val_accuracy",
    patience_es: int = 6,
    patience_lr: int = 3,
):
    from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

    out_dir.mkdir(parents=True, exist_ok=True)
    return [
        EarlyStopping(monitor=monitor, mode="max", patience=patience_es, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor=monitor, mode="max", factor=0.5, patience=patience_lr, min_lr=1e-6, verbose=1),
        ModelCheckpoint(filepath=str(out_dir / "best.h5"), monitor=monitor, mode="max", save_best_only=True, verbose=0),
    ]
