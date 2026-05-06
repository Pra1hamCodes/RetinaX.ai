# Diabetic Retinopathy — RetinaX AI

This workspace has been consolidated into a single production-grade app: **RetinaX AI**.

The two legacy folders (`eyenet-master/`, `diabetic-retinopathy-master/`) were
read, mined for assets, documented in
[`retinax-ai/backend/ml/EXTRACTION_NOTES.md`](retinax-ai/backend/ml/EXTRACTION_NOTES.md),
and then removed. All useful artifacts now live inside `retinax-ai/`.

## Contents

```
.
├── retinax-ai/        ← the application (frontend, backend, ML pipeline, infra)
├── dataset/           ← APTOS 2019 fundus images + labels (kept as-is)
└── README.md          ← this file
```

## Quick start

Full setup, run, training, and deployment instructions live in
[`retinax-ai/README.md`](retinax-ai/README.md). The short version:

```powershell
cd retinax-ai
copy .env.example .env       # then fill in JWT_SECRET_KEY
docker compose up --build -d
# open http://localhost
```

## Frontend-only run (no backend)

If you don't have Docker but do have Node 20+:

```powershell
cd retinax-ai/frontend
npm install
npm run dev                  # serves http://localhost:5173
```

API calls fail until the backend stack is up — but the routes, layout,
animations, and 3D eye render correctly.

## What's where

| Path                                                            | What it is                                                     |
|-----------------------------------------------------------------|----------------------------------------------------------------|
| [retinax-ai/frontend/](retinax-ai/frontend/)                    | React 19 + Vite + Tailwind v4 + Three.js + Recharts            |
| [retinax-ai/backend/app/](retinax-ai/backend/app/)              | FastAPI + Celery + SQLAlchemy + Pydantic v2                    |
| [retinax-ai/backend/ml/](retinax-ai/backend/ml/)                | Preprocessing, Grad-CAM, ensemble inference, training scripts  |
| [retinax-ai/backend/ml/models/](retinax-ai/backend/ml/models/)  | Extracted Teachable Machine model + room for trained `.h5`     |
| [retinax-ai/backend/alembic/](retinax-ai/backend/alembic/)      | DB migrations                                                  |
| [retinax-ai/nginx/nginx.conf](retinax-ai/nginx/nginx.conf)      | Reverse proxy                                                  |
| [dataset/colored_images/](dataset/)                             | 3,662 fundus images across 5 severity classes                  |

## Disclaimer

Research-grade. **Not** an FDA-cleared medical device. Predictions are
advisory and require ophthalmologist confirmation before any clinical use.
