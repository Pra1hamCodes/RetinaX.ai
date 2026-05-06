# RetinaX AI

Production-grade Diabetic Retinopathy Detection Platform — FastAPI backend +
React/Vite frontend + ensemble Keras pipeline + Grad‑CAM explainability,
all wired through Docker Compose, Postgres, Redis/Celery, and Nginx.

> **Disclaimer.** This system is research-grade. It is **not** an FDA-cleared
> medical device. Predictions are advisory only and must be confirmed by a
> licensed ophthalmologist before any clinical decision.

---

## Architecture at a glance

```
┌──────────┐   /             ┌────────────┐
│  Browser │──── Nginx :80 ──┤ Vite (5173)│  React 19 + TS + Tailwind v4
└──────────┘                 └────────────┘
     │ /api/v1/*
     ▼
┌────────────┐    enqueue    ┌────────────┐    persist     ┌──────────┐
│ FastAPI    │───── Redis ───│ Celery     │──── ORM ──────│ Postgres │
│ uvicorn    │               │ worker     │                └──────────┘
│  /predict  │   InferenceService loads:                         ▲
│  /history  │     ├─ Binary CNN  (sigmoid)                      │
│  /auth     │     ├─ Multiclass CNN  (softmax)                  │
│  /metrics  │     ├─ EfficientNet-B0/B4  (transfer)             │
└────────────┘     └─ Grad-CAM on the strongest available model  │
                                                                 │
                   /storage  ◄── Nginx serves uploads + heatmaps ┘
```

Three preprocessing variants live in [`backend/ml/preprocessing.py`](backend/ml/preprocessing.py)
because each branch was trained against different statistics. Skipping this
detail produces silently-broken inference; see
[`backend/ml/EXTRACTION_NOTES.md`](backend/ml/EXTRACTION_NOTES.md).

---

## Repository layout

```
retinax-ai/
├── frontend/         React 19 + Vite + Tailwind v4 + Three.js + Recharts + Framer + GSAP
├── backend/
│   ├── app/          FastAPI app (routers, services, ORM, schemas, Celery)
│   ├── ml/           preprocessing · gradcam · inference_service · training/
│   ├── alembic/      Database migrations
│   └── tests/        Pytest
├── nginx/            Reverse proxy config
├── docker-compose.yml          dev
├── docker-compose.prod.yml     prod overlay
└── .env.example
```

---

## Prerequisites

- Docker Desktop 24+ (or Docker Engine 24+ on Linux)
- ~6 GB free RAM (TensorFlow alone is hefty)
- The fundus dataset at `../dataset/colored_images/` and `../dataset/train.csv`
  (the APTOS 2019 Kaggle layout — five folders: `No_DR`, `Mild`, `Moderate`,
  `Severe`, `Proliferate_DR`)

---

## First-time setup

```powershell
# from retinax-ai/
copy .env.example .env

# edit .env and set a strong JWT secret:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up --build -d
docker compose logs -f backend          # wait until "Application startup complete"
```

The first start runs `alembic upgrade head` automatically. The Vite container
runs `npm install` on first boot — give it 60–90 seconds.

Open <http://localhost> — the navbar will say **RetinaX AI**.

---

## Populating real evaluation metrics

The Evaluation page reads JSON files written by the training scripts. Two paths:

### A. Quick — bootstrap with the extracted Teachable Machine model

Produces real metrics on a real held-out test split using the model that
shipped with the legacy folder. Useful for verifying the entire pipeline end
to end before committing to multi-hour training.

```powershell
docker compose exec backend python -m ml.training.seed_metrics
```

### B. Real training (the production path)

```powershell
# Binary DR-vs-No-DR gate
docker compose exec backend python -m ml.training.train_binary --epochs 20

# 5-class severity CNN, trained from scratch
docker compose exec backend python -m ml.training.train_multiclass --epochs 30

# EfficientNet-B0 transfer learning (use B4 on a GPU host)
docker compose exec backend python -m ml.training.train_efficientnet \
    --variant B0 --epochs-frozen 10 --epochs-finetune 10
```

Each script writes:
- a `.h5` weights file under `backend/ml/models/`
- a metrics JSON under `backend/ml/metrics/`
- a checkpoint folder during training (best-by-val-accuracy)

The InferenceService picks the new weights up on the next worker restart:

```powershell
docker compose restart worker
```

---

## API surface

| Verb | Path                              | Description                                     |
|------|-----------------------------------|-------------------------------------------------|
| GET  | `/api/v1/health`                  | Liveness probe                                  |
| POST | `/api/v1/auth/signup`             | Email + password + display_name                 |
| POST | `/api/v1/auth/login`              | Sets `retinax_access` httpOnly cookie           |
| POST | `/api/v1/auth/logout`             | Clears the auth cookie                          |
| GET  | `/api/v1/auth/me`                 | Current user profile                            |
| POST | `/api/v1/predict`                 | Multipart upload → returns `{ task_id }`        |
| GET  | `/api/v1/predict/{task_id}`       | `pending` / `complete` / `failed`               |
| GET  | `/api/v1/history`                 | Paginated, filterable user history (auth)       |
| GET  | `/api/v1/history/{id}`            | Single record                                   |
| DEL  | `/api/v1/history/{id}`            | Delete one of your own records                  |
| GET  | `/api/v1/metrics/training`        | All training metrics JSON for the Evaluation pg |
| GET  | `/api/v1/metrics/dataset`         | Live class distribution from disk               |

OpenAPI docs at <http://localhost/api/docs> when `ENVIRONMENT=development`.

---

## Frontend pages

| Route          | Purpose                                                                   |
|----------------|---------------------------------------------------------------------------|
| `/`            | Marketing landing — hero video, 3D eye, GSAP scroll, CTA banner           |
| `/detect`      | The diagnostic suite — drop a fundus image, see graded result + Grad-CAM  |
| `/dashboard`   | Auth-gated history table, filter bar, modal viewer                        |
| `/approach`    | Methodology — six-step pipeline timeline                                  |
| `/evaluation`  | Live training/validation curves, confusion matrix, ROC, metrics table     |
| `/dataset`     | Class distribution bar chart, augmentation notes, dataset stats           |
| `/login` / `/signup` | Auth forms                                                          |

---

## Tests

```powershell
# inside the backend container
docker compose exec backend pytest -q
```

`tests/test_preprocessing.py` runs without TF and validates the geometric +
normalization pipeline on synthetic fundi. `tests/test_health.py` smoke-tests
the FastAPI app against an in-process TestClient.

---

## Production deployment

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The prod overlay:
- Builds the frontend with `npm run build` and serves the static bundle from Nginx
- Switches uvicorn to 4 workers
- Bumps Celery concurrency to 4
- Exposes 80/443 only

In production set in `.env`:
- `ENVIRONMENT=production`
- `JWT_COOKIE_SECURE=true`
- `BACKEND_CORS_ORIGINS=https://your.domain`
- a long, random `JWT_SECRET_KEY`
- managed Postgres / Redis URLs (don't run those in containers for real workloads)

Add HTTPS termination at Nginx (LetsEncrypt) or in front of it (ALB / Cloudflare).

---

## Operational runbook (essentials)

- **Logs**: `docker compose logs -f backend worker frontend nginx postgres redis`
- **DB shell**: `docker compose exec postgres psql -U retinax retinax`
- **Migrate**: `docker compose exec backend alembic upgrade head`
- **Reset uploads**: `docker compose exec backend find storage -type f -delete`
- **Re-warm models**: `docker compose restart worker`

---

## Why three normalization variants?

Documented at length in [`backend/ml/EXTRACTION_NOTES.md`](backend/ml/EXTRACTION_NOTES.md).
Short version: the Teachable Machine model expects `(x/127)-1`; our custom
CNNs expect `x/255`; EfficientNet expects ImageNet mean/std. Mixing them up
silently degrades accuracy. The single source of truth is `preprocessing.py`,
used identically at training and inference time.

---

## License

Internal / research use only. The APTOS 2019 dataset is licensed separately
by Kaggle and the Aravind Eye Hospital — comply with their terms of use.
