"""Train the EfficientNet-B0 transfer-learning head.

We deliberately default to B0 instead of B4 because B4 is impractical without a
GPU. Pass `--variant B4` (or B3, B2, etc.) on a GPU host to scale up.
"""

from __future__ import annotations

import argparse
import logging

import numpy as np
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight
from tensorflow.keras import Model
from tensorflow.keras.applications import (
    EfficientNetB0,
    EfficientNetB1,
    EfficientNetB2,
    EfficientNetB3,
    EfficientNetB4,
)
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D, Input

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

VARIANTS = {
    "B0": EfficientNetB0,
    "B1": EfficientNetB1,
    "B2": EfficientNetB2,
    "B3": EfficientNetB3,
    "B4": EfficientNetB4,
}


def build_model(variant: str, input_size: int, n_classes: int = 5) -> Model:
    if variant not in VARIANTS:
        raise ValueError(f"Unknown EfficientNet variant: {variant}")

    backbone = VARIANTS[variant](
        include_top=False,
        weights="imagenet",
        input_shape=(input_size, input_size, 3),
    )
    backbone.trainable = False                       # stage 1: frozen backbone

    inputs = Input(shape=(input_size, input_size, 3))
    x = backbone(inputs, training=False)
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation="relu")(x)
    x = Dropout(0.4)(x)
    outputs = Dense(n_classes, activation="softmax")(x)
    return Model(inputs, outputs, name=f"efficientnet_{variant.lower()}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--variant", choices=list(VARIANTS), default="B0")
    p.add_argument("--epochs-frozen", type=int, default=10)
    p.add_argument("--epochs-finetune", type=int, default=10)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr-frozen", type=float, default=1e-3)
    p.add_argument("--lr-finetune", type=float, default=1e-5)
    args = p.parse_args()

    settings = get_settings()
    out_models = settings.ml_models_dir
    out_metrics = settings.ml_metrics_dir
    out_models.mkdir(parents=True, exist_ok=True)

    train, val, test = load_split(settings.ml_data_dir, image_size=settings.ml_input_size)
    Xtr = normalize_split(train, "imagenet")
    Xva = normalize_split(val, "imagenet")
    Xte = normalize_split(test, "imagenet")

    classes = np.arange(5)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=train.y)
    cw_dict = {int(c): float(w) for c, w in zip(classes, weights)}
    logger.info("EfficientNet class weights: %s", cw_dict)

    model = build_model(args.variant, settings.ml_input_size)

    # ---- Stage 1: train head only ----
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr_frozen),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    history_frozen = model.fit(
        Xtr, train.y,
        validation_data=(Xva, val.y),
        epochs=args.epochs_frozen,
        batch_size=args.batch_size,
        class_weight=cw_dict,
        callbacks=make_callbacks(out_models / "efficientnet_ckpt_frozen", monitor="val_accuracy"),
        verbose=2,
    )

    # ---- Stage 2: unfreeze the last 30% of the backbone and fine-tune ----
    backbone = model.layers[1]
    cutoff = int(len(backbone.layers) * 0.7)
    for layer in backbone.layers[:cutoff]:
        layer.trainable = False
    for layer in backbone.layers[cutoff:]:
        # BatchNorm layers stay frozen for stability
        if not layer.__class__.__name__.startswith("BatchNorm"):
            layer.trainable = True

    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.lr_finetune),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    history_ft = model.fit(
        Xtr, train.y,
        validation_data=(Xva, val.y),
        epochs=args.epochs_finetune,
        batch_size=args.batch_size,
        class_weight=cw_dict,
        callbacks=make_callbacks(out_models / "efficientnet_ckpt_ft", monitor="val_accuracy"),
        verbose=2,
    )

    proba = model.predict(Xte, verbose=0)
    pred = np.argmax(proba, axis=1)
    metrics = compute_classification_metrics(test.y, pred, proba, n_classes=5)
    metrics["history"] = {
        "frozen": serialise_keras_history(history_frozen),
        "finetune": serialise_keras_history(history_ft),
    }
    metrics["class_weights"] = cw_dict
    metrics["variant"] = args.variant
    metrics["classes"] = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"]
    write_metrics_json(out_metrics, "efficientnet", metrics)

    final_path = out_models / "efficientnet.h5"
    model.save(final_path)
    logger.info("Saved EfficientNet to %s", final_path)


if __name__ == "__main__":
    main()
