"""Train the 5-class severity CNN from scratch."""

from __future__ import annotations

import argparse
import logging

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


def build_model(input_shape: tuple[int, int, int], n_classes: int = 5) -> Model:
    inputs = Input(shape=input_shape)

    x = Conv2D(32, 3, padding="same", activation="relu")(inputs)
    x = BatchNormalization()(x)
    x = Conv2D(32, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(64, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = Conv2D(64, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(128, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = Conv2D(128, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D()(x)

    x = Conv2D(256, 3, padding="same", activation="relu")(x)
    x = BatchNormalization()(x)
    x = GlobalAveragePooling2D()(x)

    x = Dense(256, activation="relu")(x)
    x = Dropout(0.5)(x)
    outputs = Dense(n_classes, activation="softmax")(x)

    return Model(inputs, outputs, name="multiclass_cnn")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--epochs", type=int, default=30)
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

    classes = np.arange(5)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=train.y)
    cw_dict = {int(c): float(w) for c, w in zip(classes, weights)}
    logger.info("Multiclass class weights: %s", cw_dict)

    model = build_model((settings.ml_input_size, settings.ml_input_size, 3))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    history = model.fit(
        Xtr, train.y,
        validation_data=(Xva, val.y),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=cw_dict,
        callbacks=make_callbacks(out_models / "multiclass_ckpt", monitor="val_accuracy"),
        verbose=2,
    )

    proba = model.predict(Xte, verbose=0)
    pred = np.argmax(proba, axis=1)
    metrics = compute_classification_metrics(test.y, pred, proba, n_classes=5)
    metrics["history"] = serialise_keras_history(history)
    metrics["class_weights"] = cw_dict
    metrics["classes"] = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
    write_metrics_json(settings.ml_metrics_dir, "multiclass", metrics)

    final_path = out_models / "multiclass_cnn.h5"
    model.save(final_path)
    logger.info("Saved multiclass CNN to %s", final_path)


if __name__ == "__main__":
    main()
