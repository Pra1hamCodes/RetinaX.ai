from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "retinax",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.celery_app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=180,
    task_soft_time_limit=150,
    worker_max_tasks_per_child=64,            # mitigate any TF memory drift
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
)

# Lazy-load TF in the worker process only — avoids the FastAPI master forking TF.
@celery_app.on_after_finalize.connect
def _warmup_models(sender, **_) -> None:  # noqa: D401
    from ml.inference_service import InferenceService  # local import: TF only in workers

    InferenceService.get()
