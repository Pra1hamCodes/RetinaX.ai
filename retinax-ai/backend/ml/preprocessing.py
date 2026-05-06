"""Unified retinal-fundus preprocessing.

This module is the single source of truth for image preprocessing across
training, inference, and any offline tooling. Three normalization variants
are exposed because the three models in our ensemble were trained against
different statistics:

  - Teachable Machine multiclass model    -> (x / 127.0) - 1
  - Custom binary CNN (trained here)      -> x / 255
  - EfficientNet (ImageNet transfer)      -> ImageNet mean/std

The geometric pipeline (border crop, CLAHE, resize) is identical for every
variant.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Final, Literal

import cv2
import numpy as np

logger = logging.getLogger(__name__)

DEFAULT_INPUT_SIZE: Final[int] = 224
IMAGENET_MEAN: Final[np.ndarray] = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD: Final[np.ndarray] = np.array([0.229, 0.224, 0.225], dtype=np.float32)

NormVariant = Literal["zero_one", "neg_one_one", "imagenet"]


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def load_bgr(path: str | Path) -> np.ndarray:
    """Load an image from disk as a BGR uint8 array."""
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not decode image at {path}")
    return img


# ---------------------------------------------------------------------------
# Geometric pipeline
# ---------------------------------------------------------------------------

def crop_black_borders(img_bgr: np.ndarray, tol: int = 7) -> np.ndarray:
    """Crop the dark, near-circular fundus mask away from its surrounding black box.

    Algorithm:
      1. Convert to grayscale.
      2. Threshold above `tol` to find any non-black pixel.
      3. Take the largest contour's bounding rect and crop to it.
      4. If no contour is found (rare for valid fundus), return input unchanged.
    """
    if img_bgr.ndim != 3:
        raise ValueError("Expected BGR image with 3 channels")

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, tol, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return img_bgr

    largest = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest)
    if w == 0 or h == 0:
        return img_bgr

    return img_bgr[y : y + h, x : x + w]


def apply_clahe(img_bgr: np.ndarray, clip_limit: float = 2.0, tile: int = 8) -> np.ndarray:
    """Contrast-Limited Adaptive Histogram Equalization on the L* channel only."""
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
    l_eq = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l_eq, a, b)), cv2.COLOR_LAB2BGR)


def resize_square(img_bgr: np.ndarray, size: int) -> np.ndarray:
    return cv2.resize(img_bgr, (size, size), interpolation=cv2.INTER_AREA)


def geometric_pipeline(img_bgr: np.ndarray, size: int = DEFAULT_INPUT_SIZE) -> np.ndarray:
    """Steps 1-5 of the spec: crop, resize, CLAHE, RGB. Returns float32 [0,255]."""
    img_bgr = crop_black_borders(img_bgr)
    img_bgr = resize_square(img_bgr, size)
    img_bgr = apply_clahe(img_bgr)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    return img_rgb.astype(np.float32)


# ---------------------------------------------------------------------------
# Normalization variants
# ---------------------------------------------------------------------------

def normalize(img_rgb_float: np.ndarray, variant: NormVariant) -> np.ndarray:
    """Normalize a float32 RGB array. Input must be in [0,255]."""
    if variant == "zero_one":
        return img_rgb_float / 255.0

    if variant == "neg_one_one":
        return (img_rgb_float / 127.0) - 1.0

    if variant == "imagenet":
        x = img_rgb_float / 255.0
        return ((x - IMAGENET_MEAN) / IMAGENET_STD).astype(np.float32)

    raise ValueError(f"Unknown normalization variant: {variant}")


# ---------------------------------------------------------------------------
# Public preprocessing entry points (one per model)
# ---------------------------------------------------------------------------

def preprocess_for_custom_cnn(
    image_or_path: str | Path | np.ndarray, size: int = DEFAULT_INPUT_SIZE
) -> np.ndarray:
    """Pipeline used by the trained-from-scratch binary and multi-class CNNs."""
    img = _coerce_to_bgr(image_or_path)
    rgb = geometric_pipeline(img, size=size)
    return normalize(rgb, "zero_one")


def preprocess_for_teachable_machine(
    image_or_path: str | Path | np.ndarray, size: int = DEFAULT_INPUT_SIZE
) -> np.ndarray:
    """Pipeline matching Google Teachable Machine's expected (x/127)-1 range."""
    img = _coerce_to_bgr(image_or_path)
    rgb = geometric_pipeline(img, size=size)
    return normalize(rgb, "neg_one_one")


def preprocess_for_efficientnet(
    image_or_path: str | Path | np.ndarray, size: int = DEFAULT_INPUT_SIZE
) -> np.ndarray:
    """Pipeline used by the EfficientNet transfer-learning model."""
    img = _coerce_to_bgr(image_or_path)
    rgb = geometric_pipeline(img, size=size)
    return normalize(rgb, "imagenet")


def preprocess_all_variants(
    image_or_path: str | Path | np.ndarray, size: int = DEFAULT_INPUT_SIZE
) -> dict[str, np.ndarray]:
    """Run the geometric pipeline once and emit all three normalized tensors.

    Returns dict with keys: 'cnn', 'teachable_machine', 'efficientnet'.
    Each value has shape (1, H, W, 3) ready for `model.predict`.
    """
    img = _coerce_to_bgr(image_or_path)
    rgb = geometric_pipeline(img, size=size)
    return {
        "cnn": np.expand_dims(normalize(rgb, "zero_one"), axis=0),
        "teachable_machine": np.expand_dims(normalize(rgb, "neg_one_one"), axis=0),
        "efficientnet": np.expand_dims(normalize(rgb, "imagenet"), axis=0),
    }


def _coerce_to_bgr(image_or_path: str | Path | np.ndarray) -> np.ndarray:
    if isinstance(image_or_path, np.ndarray):
        if image_or_path.ndim != 3 or image_or_path.shape[2] != 3:
            raise ValueError("Image array must be HxWx3 BGR")
        return image_or_path
    return load_bgr(image_or_path)
