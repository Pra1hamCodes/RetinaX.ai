import logging
import uuid
from pathlib import Path

from app.celery_app.celery import celery_app
from app.database import SessionLocal
from app.models import Prediction

logger = logging.getLogger(__name__)


@celery_app.task(name="run_inference", bind=True)
def run_inference(self, image_path: str, user_id: str | None) -> dict:
    """Run the ensemble and persist a Prediction row. Return JSON for the API."""
    from ml.inference_service import InferenceService                  # lazy import (TF)

    service = InferenceService.get()
    result = service.predict(Path(image_path))

    db = SessionLocal()
    try:
        record = Prediction(
            user_id=uuid.UUID(user_id) if user_id else None,
            original_image_url=result.original_image_url,
            heatmap_url=result.heatmap_url,
            severity_class=result.severity_class,
            severity_label=result.severity_label,
            confidence_binary=result.confidence_binary,
            probabilities=result.probabilities.model_dump(),
            model_version=result.model_version,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        prediction_id = str(record.id)
    finally:
        db.close()

    payload = result.model_dump()
    payload["id"] = prediction_id
    return payload
