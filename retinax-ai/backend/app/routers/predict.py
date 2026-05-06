"""Predict router.

Two execution modes share one HTTP contract:

  * **Production / compose mode** (default): the request is enqueued into
    Celery. The poll endpoint asks Redis for task status.
  * **Standalone mode** (`STANDALONE_MODE=true`): inference runs on the
    request thread, the result is stashed in an in-process dict, and the
    poll endpoint returns it directly. No Redis / no Celery needed.

The frontend can't tell which mode is active — both look like "submit task,
poll until complete".
"""

from __future__ import annotations

import logging
import threading
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.dependencies import DBSession, OptionalUser
from app.schemas.prediction import PredictionResult, TaskAcceptedResponse, TaskStatusResponse
from app.services import storage_service
from app.services.storage_service import StorageError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["predict"])
settings = get_settings()


# ---------------------------------------------------------------------------
# In-process result store (standalone mode)
# ---------------------------------------------------------------------------

_LOCAL_RESULTS: dict[str, dict[str, Any]] = {}
_LOCAL_RESULTS_LOCK = threading.Lock()


def _persist_result(
    db,
    user_id: uuid.UUID | None,
    result: PredictionResult,
) -> uuid.UUID:
    """Insert a Prediction row and return its UUID."""
    from app.models import Prediction

    row = Prediction(
        user_id=user_id,
        original_image_url=result.original_image_url,
        heatmap_url=result.heatmap_url,
        severity_class=result.severity_class,
        severity_label=result.severity_label,
        confidence_binary=result.confidence_binary,
        probabilities=result.probabilities.model_dump(),
        model_version=result.model_version,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("", response_model=TaskAcceptedResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_prediction(
    user: OptionalUser,
    db: DBSession,
    image: UploadFile = File(...),
) -> TaskAcceptedResponse:
    if not image.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    try:
        saved = storage_service.save_upload(image.filename, image.file)
    except StorageError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    user_id = user.id if user else None

    if settings.standalone_mode:
        # Run inference inline. Cheap when only the Teachable Machine model is
        # loaded; the same flow scales identically once the trained models are
        # added to ml/models/.
        from ml.inference_service import InferenceService

        try:
            result = InferenceService.get().predict(saved)
        except Exception as exc:                          # noqa: BLE001
            logger.exception("Standalone inference failed")
            task_id = uuid.uuid4().hex
            with _LOCAL_RESULTS_LOCK:
                _LOCAL_RESULTS[task_id] = {"status": "failed", "error": str(exc)}
            return TaskAcceptedResponse(task_id=task_id)

        try:
            _persist_result(db, user_id, result)
        except Exception:                                  # noqa: BLE001
            logger.exception("Could not persist standalone prediction; returning result anyway")

        task_id = uuid.uuid4().hex
        with _LOCAL_RESULTS_LOCK:
            _LOCAL_RESULTS[task_id] = {
                "status": "complete",
                "result": result.model_dump(),
            }
        logger.info("Standalone inference task %s -> class %d", task_id, result.severity_class)
        return TaskAcceptedResponse(task_id=task_id)

    # Production path — Celery
    from app.celery_app.tasks import run_inference

    async_result = run_inference.delay(str(saved), str(user_id) if user_id else None)
    logger.info("Queued Celery inference task %s for user %s", async_result.id, user_id)
    return TaskAcceptedResponse(task_id=async_result.id)


@router.get("/{task_id}", response_model=TaskStatusResponse)
async def get_prediction(task_id: str) -> TaskStatusResponse:
    if settings.standalone_mode:
        with _LOCAL_RESULTS_LOCK:
            stored = _LOCAL_RESULTS.get(task_id)
        if stored is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Unknown task")
        if stored["status"] == "failed":
            return TaskStatusResponse(status="failed", error=stored.get("error", "Inference failed"))
        return TaskStatusResponse(
            status="complete",
            result=PredictionResult.model_validate(stored["result"]),
        )

    # Production / Celery path
    from celery.result import AsyncResult

    from app.celery_app.celery import celery_app

    res: AsyncResult = AsyncResult(task_id, app=celery_app)
    if res.state in {"PENDING", "STARTED", "RECEIVED", "RETRY"}:
        return TaskStatusResponse(status="pending")
    if res.state == "SUCCESS":
        payload: Any = res.result
        if not isinstance(payload, dict):
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Malformed task result")
        payload = {k: v for k, v in payload.items() if k != "id"}
        return TaskStatusResponse(status="complete", result=PredictionResult.model_validate(payload))
    if res.state == "FAILURE":
        return TaskStatusResponse(status="failed", error=str(res.result))
    return TaskStatusResponse(status="pending")
