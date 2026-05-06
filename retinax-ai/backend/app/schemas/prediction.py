import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Authoritative class label set used end-to-end (DB, API, frontend).
SEVERITY_LABELS: tuple[str, ...] = (
    "No DR",
    "Mild",
    "Moderate",
    "Severe",
    "Proliferative DR",
)


class ProbabilityMap(BaseModel):
    no_dr: float = Field(ge=0.0, le=1.0)
    mild: float = Field(ge=0.0, le=1.0)
    moderate: float = Field(ge=0.0, le=1.0)
    severe: float = Field(ge=0.0, le=1.0)
    proliferative: float = Field(ge=0.0, le=1.0)


class PredictionResult(BaseModel):
    """The shape returned by the inference service and persisted to the DB."""

    severity_class: int = Field(ge=0, le=4)
    severity_label: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_binary: float = Field(ge=0.0, le=1.0)
    probabilities: ProbabilityMap
    original_image_url: str
    heatmap_url: str | None = None
    recommendation: str
    model_version: str


class PredictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    original_image_url: str
    heatmap_url: str | None
    severity_class: int
    severity_label: str
    confidence_binary: float
    probabilities: dict
    model_version: str
    created_at: datetime


class TaskAcceptedResponse(BaseModel):
    task_id: str


class TaskStatusResponse(BaseModel):
    status: Literal["pending", "complete", "failed"]
    result: PredictionResult | None = None
    error: str | None = None


class HistoryPage(BaseModel):
    items: list[PredictionOut]
    page: int
    per_page: int
    total: int
