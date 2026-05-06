"""Train the binary DR / No-DR gate.

Run from the backend/ root:
    python -m ml.training.train_binary --epochs 20 --batch-size 32

Output: backend/ml/models/binary_cnn.h5  +  backend/ml/metrics/binary.json
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras import Input, Model
from tensorflow.keras.layers import (
    BatchNormalization,
    Conv2D,
    Dense,
    Dropout,
    GlobalAveragePooling2D,
    MaxPooling2D,
)

from app.config import get_settings
from ml.training.common import (
    compute_classification_metrics,
    make_callbacks,
    serialise_keras_history,
    write_metrics_json,
)
from ml.training.dataset import load_split, normalize_split

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")


def build_model(input_shape: tuple[int, int, int]) -> Model:
    inputs = Input(shape=input_shape)
    x = Conv2D(32, 3, padding="same", activation="relu")(inputs)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(64, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(128, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(256, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = GlobalAveragePooling2D()(x)

    x = Dense(128, activation="relu")(x)
    x = Dropout(0.4)(x)
    outputs = Dense(1, activation="sigmoid")(x)

    return Model(inputs, outputs, name="binary_cnn")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=1e-3)
    args = p.parse_args()

    settings = get_settings()
    out_models = settings.ml_models_dir
    out_metrics = settings.ml_metrics_dir
    out_models.mkdir(parents=True, exist_ok=True)

    train, val, test = load_split(settings.ml_data_dir, image_size=settings.ml_input_size)
    Xtr = normalize_split(train, "zero_one")
    Xva = normalize_split(val, "zero_one")
    Xte = normalize_split(test, "zero_one")

    ytr_b = (train.y >= 1).astype(np.float32)
    yva_b = (val.y >= 1).astype(np.float32)
    yte_b = (test.y >= 1).astype(np.float32)

    cw = compute_class_weight(class_weight="balanced", classes=np.array([0, 1]), y=ytr_b)
    cw_dict = {0: float(cw[0]), 1: float(cw[1])}
    logger.info("Binary class weights: %s", cw_dict)

    model = build_model((settings.ml_input_size, settings.ml_input_size, 3))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr),
        loss="binary_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
    )

    history = model.fit(
        Xtr, ytr_b,
        validation_data=(Xva, yva_b),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=cw_dict,
        callbacks=make_callbacks(out_models / "binary_ckpt", monitor="val_auc"),
        verbose=2,
    )

    proba = model.predict(Xte, verbose=0).ravel()
    pred = (proba >= 0.5).astype(np.int64)
    metrics = compute_classification_metrics(
        yte_b.astype(np.int64),
        pred,
        np.stack([1 - proba, proba], axis=1),
        n_classes=2,
    )
    metrics["history"] = serialise_keras_history(history)
    metrics["class_weights"] = cw_dict
    metrics["classes"] = ["No DR", "DR"]
    write_metrics_json(out_metrics, "binary", metrics)

    final_path = out_models / "binary_cnn.h5"
    model.save(final_path)
    logger.info("Saved binary CNN to %s", final_path)


if __name__ == "__main__":
    main()
