"""Grad-CAM for Keras models.

Implements Selvaraju et al. (2017). Works with both Sequential and Functional
models, and tolerates nested submodels (the Teachable Machine MobileNet wraps
its convs inside two nested `Sequential`s) by walking the layer graph and
returning the actual `Conv2D` layer object rather than its (potentially
ambiguous) name.
"""

from __future__ import annotations

import logging
from typing import Tuple

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras import Model
from tensorflow.keras.layers import Conv2D, Layer

logger = logging.getLogger(__name__)


def find_last_conv_layer(model: Model) -> Layer:
    """Return the last layer of `model` whose output is a 4D spatial tensor.

    For Grad-CAM we need a layer whose output has shape (B, H, W, C). On a
    plain functional CNN this is naturally the deepest `Conv2D`; on the
    Teachable Machine MobileNet the deepest Conv2D lives inside a nested
    `Sequential` and isn't directly reachable from the outer graph, so we
    instead pick the deepest **top-level** layer with a 4D output (typically
    the MobileNet backbone submodel) — same Grad-CAM target, fewer graph
    headaches.
    """
    last_top_4d: Layer | None = None
    last_inner_conv: Layer | None = None

    for layer in model.layers:
        try:
            shape = layer.output_shape
        except (AttributeError, RuntimeError):
            shape = None
        if isinstance(shape, tuple) and len(shape) == 4:
            last_top_4d = layer

    if last_top_4d is not None:
        return last_top_4d

    # Fallback — walk into submodels for a Conv2D
    def _walk(m: Model) -> None:
        nonlocal last_inner_conv
        for layer in m.layers:
            if isinstance(layer, Conv2D):
                last_inner_conv = layer
            sub_layers = getattr(layer, "layers", None)
            if isinstance(sub_layers, list):
                _walk(layer)

    _walk(model)
    if last_inner_conv is None:
        raise ValueError("No 4D-output layer found in model")
    return last_inner_conv


def compute_heatmap(
    model: Model,
    image: np.ndarray,
    class_index: int | None = None,
    last_conv_layer: Layer | str | None = None,  # noqa: ARG001 — kept for API stability
) -> Tuple[np.ndarray, int]:
    """Compute a Grad-CAM heatmap for `image`.

    The implementation does **not** rebuild the Keras graph (`Model(inputs=,
    outputs=)`) because that approach silently breaks when the network nests
    sub-Sequentials — the case for the Teachable Machine MobileNet we ship.
    Instead we replay the forward pass layer-by-layer inside a gradient tape,
    keeping a handle on the deepest 4D feature map. This works for plain
    Sequential, Functional, and arbitrarily nested models.

    Args:
      model: A Keras model.
      image: Preprocessed input shaped (H, W, 3) or (1, H, W, 3).
      class_index: Class to attribute against. Defaults to argmax.
      last_conv_layer: Ignored (kept so callers don't break). The deepest 4D
        tensor encountered during the forward pass is always used.

    Returns:
      (heatmap_uint8, predicted_class_index) where the heatmap is a uint8
      array shaped (H, W) in [0, 255].
    """
    if image.ndim == 3:
        image = np.expand_dims(image, axis=0)

    img_tensor = tf.convert_to_tensor(image, dtype=tf.float32)

    state: dict[str, tf.Tensor | None] = {"last_4d": None}

    def _forward(layer, x, tape):
        """Recursively replay the layer on `x`, tracking the deepest 4D tensor."""
        # Sequential nesting (Teachable Machine wraps backbones inside Sequentials).
        # Functional submodels (e.g. MobileNet) are called as a unit — that's
        # what produced their training-time outputs.
        sub_layers = getattr(layer, "layers", None)
        if (
            isinstance(sub_layers, list)
            and len(sub_layers) > 0
            and type(layer).__name__ == "Sequential"
        ):
            for sub in sub_layers:
                x = _forward(sub, x, tape)
            return x

        x = layer(x, training=False)
        tape.watch(x)
        if x.shape.rank == 4:
            state["last_4d"] = x
        return x

    with tf.GradientTape() as tape:
        x: tf.Tensor = img_tensor
        for layer in model.layers:
            x = _forward(layer, x, tape)
        predictions = x

        last_4d = state["last_4d"]
        if last_4d is None:
            raise RuntimeError("No 4D activation captured during forward pass")

        if class_index is None:
            class_index = int(tf.argmax(predictions[0]).numpy())
        loss = predictions[:, class_index]

    grads = tape.gradient(loss, last_4d)
    if grads is None:
        raise RuntimeError("Grad-CAM gradients are None")

    pooled = tf.reduce_mean(grads, axis=(0, 1, 2))                   # (C,)
    conv_out = last_4d[0]                                             # (h, w, c)
    heatmap = tf.tensordot(conv_out, pooled, axes=([2], [0]))         # (h, w)
    heatmap = tf.nn.relu(heatmap)

    max_val = tf.reduce_max(heatmap)
    if max_val > 0:
        heatmap = heatmap / max_val

    heatmap_np = (heatmap.numpy() * 255.0).astype(np.uint8)

    target_size = (image.shape[2], image.shape[1])                   # (W, H)
    heatmap_np = cv2.resize(heatmap_np, target_size, interpolation=cv2.INTER_LINEAR)
    return heatmap_np, class_index


def overlay_heatmap(
    original_bgr: np.ndarray,
    heatmap: np.ndarray,
    alpha: float = 0.45,
    colormap: int = cv2.COLORMAP_JET,
) -> np.ndarray:
    """Blend a single-channel heatmap onto a BGR image. Returns uint8 BGR."""
    if original_bgr.shape[:2] != heatmap.shape[:2]:
        heatmap = cv2.resize(
            heatmap,
            (original_bgr.shape[1], original_bgr.shape[0]),
            interpolation=cv2.INTER_LINEAR,
        )
    color = cv2.applyColorMap(heatmap, colormap)
    return cv2.addWeighted(color, alpha, original_bgr, 1 - alpha, 0)


def _find_layer_by_name(model: Model, name: str) -> Layer:
    """Walk nested submodels to find a layer by name. Raises ValueError on miss."""
    found: Layer | None = None

    def _walk(m: Model) -> None:
        nonlocal found
        for layer in m.layers:
            if found is not None:
                return
            if layer.name == name:
                found = layer
                return
            sub_layers = getattr(layer, "layers", None)
            if isinstance(sub_layers, list):
                _walk(layer)

    _walk(model)
    if found is None:
        raise ValueError(f"No layer named {name!r} in model graph")
    return found
