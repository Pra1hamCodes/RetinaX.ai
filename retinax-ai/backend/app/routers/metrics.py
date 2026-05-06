"""Metrics and dataset stats — surfaces what `train_*.py` writes to disk."""

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/metrics", tags=["metrics"])
settings = get_settings()


def _load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        logger.warning("Could not decode %s", path)
        return None


@router.get("/training")
def training_metrics() -> dict[str, dict | None]:
    """Aggregate metrics for binary, multiclass, and EfficientNet runs."""
    base = settings.ml_metrics_dir
    return {
        "binary": _load_json(base / "binary.json"),
        "multiclass": _load_json(base / "multiclass.json"),
        "efficientnet": _load_json(base / "efficientnet.json"),
    }


@router.get("/dataset")
def dataset_stats() -> dict:
    """Real class distribution computed from the on-disk dataset."""
    data_dir = settings.ml_data_dir
    folders = ["No_DR", "Mild", "Moderate", "Severe", "Proliferate_DR"]
    labels = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
    counts: dict[str, int] = {}
    for folder, label in zip(folders, labels):
        d = data_dir / folder
        if d.is_dir():
            counts[label] = sum(
                1 for p in d.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
            )
        else:
            counts[label] = 0
    total = sum(counts.values())
    if total == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return {
        "total": total,
        "classes": [
            {"label": label, "count": n, "percentage": round(n / total * 100, 2)}
            for label, n in counts.items()
        ],
        "source": "APTOS 2019 Blindness Detection (Kaggle)",
        "image_size": settings.ml_input_size,
        "split_ratio": {"train": 0.70, "val": 0.15, "test": 0.15},
    }
