# EXTRACTION_NOTES

This document is a complete inventory of every artifact discovered in the two
legacy folders that previously sat at the project root, what was kept, where
it was relocated to inside `retinax-ai/backend/ml/`, and the rationale for
each decision. After this extraction the legacy folders were deleted.

Source folders (now removed):
- `eyenet-master/`           — EyeNet Kaggle DR challenge research repo (Keras 1.x era).
- `diabetic-retinopathy-master/` — Django demo app wrapping a Teachable Machine model.

---

## 1. `eyenet-master/`

### 1.1 What was found

| Path                                          | Type                  | Disposition |
|-----------------------------------------------|-----------------------|-------------|
| `src/cnn.py`                                  | Binary CNN trainer (Keras 1, multi-GPU). Treats DR>=1 as positive. | Copied → `legacy_reference/eyenet_cnn_binary.py`. |
| `src/cnn_multi.py`                            | 5-class CNN trainer.  | Copied → `legacy_reference/eyenet_cnn_multiclass.py`. |
| `src/cnn_class.py`                            | Earlier draft of the binary CNN. | Not copied — duplicate of `cnn.py`. |
| `src/preprocess_images.py`                    | Drops images whose mean pixel value is 0 (pitch-black scans). | Copied → `legacy_reference/eyenet_preprocess.py`. |
| `src/resize_images.py`                        | Center-crops 1800x1800 then resizes to 256x256. | Copied → `legacy_reference/eyenet_resize.py`. |
| `src/rotate_images.py`                        | Class-balancing augmentation: rotations (90/120/180/270) + horizontal mirror for DR images, single mirror for No-DR. | Copied → `legacy_reference/eyenet_augment.py`. |
| `src/image_to_array.py`                       | Bulk-converts JPEG folder to a single `.npy` tensor. | Copied → `legacy_reference/eyenet_image_to_array.py`. |
| `src/reconcile_labels.py`                     | Joins augmented filenames back to their original labels. | Copied → `legacy_reference/eyenet_reconcile_labels.py`. |
| `src/eda.py`                                  | Class-distribution exploratory plots. | Copied → `legacy_reference/eyenet_eda.py`. |
| `src/Graph/events.out.tfevents.1507653516...` | Stale 2017 TensorBoard log. | Discarded — older than the runtime we target. |
| `labels/trainLabels.csv`                      | Original Kaggle EyePACS labels: `image,level` for 35,127 images. | Copied → `models/eyenet_kaggle_labels.csv` (kept for reproducibility / future EyePACS expansion). |
| `labels/trainLabels_master.csv`               | Same data minus pitch-black images. | Discarded — derivable from the original. |
| `labels/trainLabels_master_256{,_v2}.csv`     | Same data after augmentation (~106k rows). | Discarded — augmentation is now deterministic in `preprocessing.py`. |
| `data/sample/*.jpeg`                          | 10 raw fundus images (Kaggle sample). | Discarded — overlaps with our APTOS dataset under `dataset/colored_images/`. |
| `images/eda/*`, `images/readme/*`             | EDA plots and README assets. | Discarded — Evaluation page renders new plots from real metrics. |
| `docker/Dockerfile`, `docker/requirements.txt`| 2017-era Keras/TF1 image. | Discarded — incompatible with FastAPI + TF 2.15. |
| `LICENSE`, `README.md`, `.gitignore`          | Repo metadata. | Discarded. |
| `src/download_data.sh`                        | Bash script to pull EyePACS from Kaggle. | Discarded — APTOS dataset already extracted to `dataset/`. |

### 1.2 Reusable knowledge captured into the new pipeline

The following design decisions in `eyenet-master` were re-implemented (modernized,
tested, and parameterised) inside `retinax-ai/backend/ml/`:

- **Black-border / pitch-black detection.** The legacy mean-pixel test is now
  replaced by an OpenCV threshold + contour-bbox crop in `preprocessing.py`
  (handles partial black borders, not just fully black scans).
- **Class-balanced augmentation.** Rather than physically duplicating files
  on disk, `training/train_*.py` uses `tf.keras.preprocessing.image.ImageDataGenerator`
  with rotation/flip ranges and `class_weight='balanced'` (the legacy intent).
- **Class weights** are computed via `sklearn.utils.class_weight.compute_class_weight`
  (same approach as `cnn_multi.py`).
- **256x256 vs 224x224.** Legacy used 256. We standardize on **224x224** because
  the extracted Teachable Machine model and EfficientNet-B0/B4 ImageNet weights
  expect 224. Documented in `preprocessing.py`.

---

## 2. `diabetic-retinopathy-master/`

A Django web app (1 app, 1 view) that wrapped a Teachable Machine model for a
demo UI. We discard the Django code entirely because the new backend is FastAPI;
we keep the trained model.

### 2.1 What was found

| Path                                                                 | Type | Disposition |
|----------------------------------------------------------------------|------|-------------|
| `diab_retina_app/keras_model.h5`                                     | Teachable Machine MobileNet, 5-class softmax, 224x224, normalization `(x/127.0) - 1`. **2.46 MB.** | Copied → `models/teachable_machine_multiclass.h5`. Used as the multi-class arm of the ensemble. |
| `diab_retina_app/model/converted_keras/keras_model.h5`               | Identical SHA to the one above. | Skipped — same file. |
| `diab_retina_app/model/converted_keras/labels.txt`                   | `0 no_dir / 1 mild / 2 moderate / 3 sever / 4 proliferative`. | Copied → `models/teachable_machine_labels.txt`. Spelling normalised in `inference_service.py` (`no_dir`→`No DR`, `sever`→`Severe`). |
| `diab_retina_app/model/converted_savedmodel/model.savedmodel/`       | TF SavedModel form of the same Teachable Machine model. | Copied → `models/teachable_machine_savedmodel/`. Kept as a backup — we load the H5 form by default. |
| `diab_retina_app/process.py`                                         | Inference glue: PIL resize, `(x/127)-1` normalize, argmax, matplotlib bar chart. | Copied → `legacy_reference/django_process.py`. **Replaced** by `inference_service.py` (proper Grad-CAM, ensemble, no matplotlib in request path). |
| `diab_retina_app/views.py`, `urls.py`, `models.py`, `apps.py`, etc.  | Django boilerplate. | Discarded — replaced by FastAPI routers. |
| `diab_retina_app/migrations/*`                                       | Empty Django migrations init. | Discarded — replaced by Alembic. |
| `diab_retina_app/test/*.jpeg`                                        | 19 manually-classified test fundus images (one per class, filenames like `0 (1).jpeg`, `4 (256).jpeg`). | Discarded — duplicated by class-balanced holdout split from `dataset/colored_images/`. |
| `diab_retina_app/output/graph.png`                                   | A single matplotlib bar chart from a one-off prediction. | Discarded — replaced by interactive Recharts on the Evaluation page. |
| `evaluation_results/predictions_visualization.png`                   | Confusion-matrix-style grid, hard-coded. | Copied → `metrics/legacy_predictions_visualization.png` for archival. The Evaluation page reads JSON metrics produced by training, not this image. |
| `templates/index.html`, `db.sqlite3`, `manage.py`, `diabetic_retinopathy/*` | Django scaffolding. | Discarded. |

### 2.2 Critical preprocessing fact extracted

The Teachable Machine model in `keras_model.h5` was **not** trained with
ImageNet mean/std normalization. It was trained with Teachable Machine's
default `(pixel / 127.0) - 1` (range `[-1, 1]`). This is an important
incompatibility: feeding it ImageNet-normalised tensors would produce
nonsense.

The shared `preprocessing.py` therefore exposes three explicit modes:

```python
preprocess_for_teachable_machine(image)  # (x/127) - 1
preprocess_for_custom_cnn(image)         # x / 255
preprocess_for_efficientnet(image)       # ImageNet mean/std
```

The ensemble in `inference_service.py` calls each variant per model. This
correctness fix was the main motivation for keeping the legacy script as a
reference rather than discarding it silently.

---

## 3. Final inventory after extraction

```
retinax-ai/backend/ml/
├── EXTRACTION_NOTES.md                       (this file)
├── models/
│   ├── teachable_machine_multiclass.h5       (2.46 MB, 5-class)
│   ├── teachable_machine_labels.txt
│   ├── teachable_machine_savedmodel/         (SavedModel backup of same)
│   └── eyenet_kaggle_labels.csv              (35,127 EyePACS labels for future use)
├── metrics/
│   └── legacy_predictions_visualization.png  (archival only)
└── legacy_reference/                          (read-only — DO NOT import at runtime)
    ├── eyenet_cnn_binary.py
    ├── eyenet_cnn_multiclass.py
    ├── eyenet_preprocess.py
    ├── eyenet_resize.py
    ├── eyenet_augment.py
    ├── eyenet_image_to_array.py
    ├── eyenet_reconcile_labels.py
    ├── eyenet_eda.py
    └── django_process.py
```

After this file was written, `eyenet-master/` and `diabetic-retinopathy-master/`
were deleted. The runtime project (`backend/`, `frontend/`, `nginx/`, etc.)
contains zero references to those original paths — verified by
`grep -r "eyenet-master\|diabetic-retinopathy-master" retinax-ai/`.
