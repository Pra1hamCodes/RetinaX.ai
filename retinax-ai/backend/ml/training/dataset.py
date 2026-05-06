"""APTOS / colored_images dataset loader.

The on-disk layout is:

    <data_dir>/
        No_DR/
        Mild/
        Moderate/
        Severe/
        Proliferate_DR/

Every JPG is loaded once, run through the unified geometric pipeline, and
returned as float32 RGB tensors. Three normalization variants are
materialised on demand to share work across the binary / multiclass /
EfficientNet trainers.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split

from ml.preprocessing import (
    DEFAULT_INPUT_SIZE,
    geometric_pipeline,
    load_bgr,
    normalize,
)

logger = logging.getLogger(__name__)

# Folder name -> integer class ID
CLASS_FOLDERS: dict[str, int] = {
    "No_DR": 0,
    "Mild": 1,
    "Moderate": 2,
    "Severe": 3,
    "Proliferate_DR": 4,
}


@dataclass
class FundusSplit:
    X: np.ndarray              # float32, shape (N, H, W, 3), in [0,255]
    y: np.ndarray              # int64, shape (N,)
    paths: list[Path]


def discover_files(data_dir: Path) -> list[tuple[Path, int]]:
    rows: list[tuple[Path, int]] = []
    for folder, class_id in CLASS_FOLDERS.items():
        cls_dir = data_dir / folder
        if not cls_dir.is_dir():
            logger.warning("Class folder missing: %s", cls_dir)
            continue
        for p in sorted(cls_dir.iterdir()):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                rows.append((p, class_id))
    return rows


def load_split(
    data_dir: Path,
    image_size: int = DEFAULT_INPUT_SIZE,
    val_size: float = 0.15,
    test_size: float = 0.15,
    seed: int = 42,
) -> tuple[FundusSplit, FundusSplit, FundusSplit]:
    """Load and stratify-split the dataset. Images are returned in [0,255] float32."""
    rows = discover_files(data_dir)
    if not rows:
        raise RuntimeError(f"No fundus images found under {data_dir}")

    paths = [r[0] for r in rows]
    labels = np.array([r[1] for r in rows], dtype=np.int64)

    train_idx, temp_idx = train_test_split(
        np.arange(len(rows)),
        test_size=val_size + test_size,
        stratify=labels,
        random_state=seed,
    )
    rel_test = test_size / (val_size + test_size)
    val_idx, test_idx = train_test_split(
        temp_idx,
        test_size=rel_test,
        stratify=labels[temp_idx],
        random_state=seed,
    )

    def _load(idx: np.ndarray) -> FundusSplit:
        imgs = np.empty((len(idx), image_size, image_size, 3), dtype=np.float32)
        ys = np.empty(len(idx), dtype=np.int64)
        out_paths: list[Path] = []
        for i, k in enumerate(idx):
            path = paths[k]
            try:
                bgr = load_bgr(path)
                imgs[i] = geometric_pipeline(bgr, size=image_size)
            except Exception:
                logger.exception("Failed to load %s — using zeros", path)
                imgs[i] = 0
            ys[i] = labels[k]
            out_paths.append(path)
            if (i + 1) % 250 == 0:
                logger.info("  loaded %d/%d", i + 1, len(idx))
        return FundusSplit(X=imgs, y=ys, paths=out_paths)

    logger.info("Loading train split (%d images)…", len(train_idx))
    train = _load(train_idx)
    logger.info("Loading val split (%d images)…", len(val_idx))
    val = _load(val_idx)
    logger.info("Loading test split (%d images)…", len(test_idx))
    test = _load(test_idx)
    return train, val, test


def normalize_split(split: FundusSplit, variant: str) -> np.ndarray:
    out = np.empty_like(split.X)
    for i in range(split.X.shape[0]):
        out[i] = normalize(split.X[i], variant)  # type: ignore[arg-type]
    return out


def class_distribution(y: np.ndarray) -> dict[int, int]:
    return {int(c): int(n) for c, n in zip(*np.unique(y, return_counts=True))}
