"""Pure-python tests for the preprocessing module.

These have no FastAPI / DB / TF dependencies — runnable on any host with
opencv-python-headless + numpy installed.
"""

from __future__ import annotations

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")

from ml.preprocessing import (  # noqa: E402  (after importorskip)
    DEFAULT_INPUT_SIZE,
    apply_clahe,
    crop_black_borders,
    geometric_pipeline,
    normalize,
    preprocess_all_variants,
)


def _fake_fundus(size: int = 512, pad: int = 64) -> np.ndarray:
    """Build a synthetic fundus: red disc centered on a black canvas."""
    img = np.zeros((size, size, 3), dtype=np.uint8)
    cv2.circle(img, (size // 2, size // 2), (size // 2) - pad, (40, 40, 200), -1)
    return img


def test_crop_black_borders_removes_padding() -> None:
    img = _fake_fundus()
    cropped = crop_black_borders(img)
    # Crop should be tight on the disc, well below the original 512 size.
    assert cropped.shape[0] < img.shape[0]
    assert cropped.shape[1] < img.shape[1]
    # Mean brightness rises after cropping black margin.
    assert cropped.mean() > img.mean()


def test_crop_returns_input_when_all_black() -> None:
    black = np.zeros((128, 128, 3), dtype=np.uint8)
    out = crop_black_borders(black)
    assert out.shape == black.shape


def test_clahe_changes_contrast() -> None:
    img = _fake_fundus()
    eq = apply_clahe(img)
    assert eq.shape == img.shape
    # CLAHE should not be a no-op on a non-uniform image.
    assert not np.array_equal(eq, img)


def test_geometric_pipeline_output_shape() -> None:
    img = _fake_fundus()
    rgb = geometric_pipeline(img, size=DEFAULT_INPUT_SIZE)
    assert rgb.shape == (DEFAULT_INPUT_SIZE, DEFAULT_INPUT_SIZE, 3)
    assert rgb.dtype == np.float32
    assert rgb.min() >= 0.0
    assert rgb.max() <= 255.0


def test_normalize_imagenet_centers_to_zero() -> None:
    img = np.full((4, 4, 3), 127.5, dtype=np.float32)
    out = normalize(img, "imagenet")
    # Roughly centered around zero (channel means subtracted).
    assert abs(out.mean()) < 0.5


def test_normalize_neg_one_one_range() -> None:
    img = np.array([[[0, 127.5, 255]]], dtype=np.float32)
    out = normalize(img, "neg_one_one")
    np.testing.assert_allclose(out, [[[-1.0, 0.0039370078, 1.0078740158]]], rtol=1e-5)


def test_preprocess_all_variants_returns_three_batches() -> None:
    img = _fake_fundus()
    bundles = preprocess_all_variants(img)
    assert set(bundles.keys()) == {"cnn", "teachable_machine", "efficientnet"}
    for v in bundles.values():
        assert v.shape == (1, DEFAULT_INPUT_SIZE, DEFAULT_INPUT_SIZE, 3)
        assert v.dtype == np.float32
