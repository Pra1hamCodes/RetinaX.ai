"""Bootstrap real evaluation metrics using the extracted Teachable Machine model.

This is what populates the Evaluation page on a fresh deploy — before anyone
runs `train_binary.py` / `train_multiclass.py` / `train_efficientnet.py`. It
runs the already-trained Teachable Machine model on a stratified hold-out
split of the dataset and writes a real `multiclass.json` metrics file.

The numbers it produces are honest: real model · real data · real test split.
They will be replaced once you train your own custom multiclass CNN.

Usage (inside the running backend container):
    docker compose exec backend python -m ml.training.seed_metrics
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
from tensorflow.keras.models import load_model

from app.config import get_settings
from ml.preprocessing import normalize
from ml.training.common import compute_classification_metrics, write_metrics_json
from ml.training.dataset import load_split

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--model",
        default=None,
        help="Path to the multiclass H5. Defaults to the extracted Teachable Machine model.",
    )
    args = p.parse_args()

    settings = get_settings()

    model_path = Path(args.model) if args.model else settings.ml_models_dir / "teachable_machine_multiclass.h5"
    if not model_path.exists():
        raise FileNotFoundError(f"No model at {model_path}")

    logger.info("Loading multiclass model from %s", model_path)
    model = load_model(model_path, compile=False)

    # The Teachable Machine model uses (x/127)-1; trained custom CNNs use x/255.
    is_teachable_machine = "teachable_machine" in model_path.name.lower()
    variant = "neg_one_one" if is_teachable_machine else "zero_one"

    logger.info("Loading dataset from %s", settings.ml_data_dir)
    _, _, test = load_split(settings.ml_data_dir, image_size=settings.ml_input_size)
    Xte = np.empty_like(test.X)
    for i in range(test.X.shape[0]):
        Xte[i] = normalize(test.X[i], variant)        # type: ignore[arg-type]

    logger.info("Predicting %d test images…", Xte.shape[0])
    proba = model.predict(Xte, batch_size=32, verbose=2)
    pred = np.argmax(proba, axis=1)

    metrics = compute_classification_metrics(test.y, pred, proba, n_classes=5)
    metrics["classes"] = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
    metrics["seed_source"] = model_path.name
    metrics["note"] = (
        "Bootstrap metrics from the extracted Teachable Machine model. Replace by running "
        "`python -m ml.training.train_multiclass` to train a model from scratch."
    )

    write_metrics_json(settings.ml_metrics_dir, "multiclass", metrics)
    logger.info(
        "Done. accuracy=%.3f kappa=%.3f f1=%.3f",
        metrics["accuracy"],
        metrics["kappa"],
        metrics["f1_weighted"],
    )


if __name__ == "__main__":
    main()
