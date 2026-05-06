import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models._compat import GUID, JSONColumn


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    original_image_url: Mapped[str] = mapped_column(Text, nullable=False)
    heatmap_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    severity_class: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    severity_label: Mapped[str] = mapped_column(String(40), nullable=False)
    confidence_binary: Mapped[float] = mapped_column(Float, nullable=False)
    probabilities: Mapped[dict] = mapped_column(JSONColumn(), nullable=False)

    model_version: Mapped[str] = mapped_column(String(60), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user: Mapped["User | None"] = relationship(back_populates="predictions")  # noqa: F821
