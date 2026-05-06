import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import auth, history, metrics, predict


def _configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
        stream=sys.stdout,
    )


def create_app() -> FastAPI:
    settings = get_settings()
    _configure_logging(settings.log_level)

    app = FastAPI(
        title="RetinaX AI",
        version="1.0.0",
        description="Production-grade Diabetic Retinopathy Detection Platform.",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Static files when not behind nginx (local dev convenience).
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.heatmap_dir.mkdir(parents=True, exist_ok=True)
    app.mount(
        settings.storage_public_base_url,
        StaticFiles(directory=str(settings.storage_local_dir)),
        name="storage",
    )

    api_prefix = settings.api_v1_prefix
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(predict.router, prefix=api_prefix)
    app.include_router(history.router, prefix=api_prefix)
    app.include_router(metrics.router, prefix=api_prefix)

    @app.get(f"{api_prefix}/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "version": app.version,
            "environment": settings.environment,
            "mode": "standalone" if settings.standalone_mode else "celery",
        }

    if settings.standalone_mode:
        @app.on_event("startup")
        def _bootstrap_db() -> None:
            from app.database import Base, engine
            from app.models import Prediction, User                # noqa: F401

            Base.metadata.create_all(engine)
            logging.getLogger(__name__).info(
                "Standalone mode: ensured SQLite schema at %s", settings.database_url
            )

        @app.on_event("startup")
        def _warm_inference() -> None:
            # Warm the ensemble at startup so the first request doesn't pay the
            # ~10s TF graph-load cost on the request thread.
            from ml.inference_service import InferenceService

            InferenceService.get()

    return app


app = create_app()
