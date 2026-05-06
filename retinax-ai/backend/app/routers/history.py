import uuid
from datetime import date, datetime, time, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.dependencies import CurrentUser, DBSession
from app.models import Prediction
from app.schemas.prediction import HistoryPage, PredictionOut

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=HistoryPage)
def list_history(
    user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    severity: int | None = Query(None, ge=0, le=4),
    date_from: date | None = None,
    date_to: date | None = None,
) -> HistoryPage:
    stmt = select(Prediction).where(Prediction.user_id == user.id)

    if severity is not None:
        stmt = stmt.where(Prediction.severity_class == severity)
    if date_from is not None:
        stmt = stmt.where(Prediction.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to is not None:
        stmt = stmt.where(Prediction.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    rows = db.execute(
        stmt.order_by(Prediction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    ).scalars().all()

    return HistoryPage(
        items=[PredictionOut.model_validate(r) for r in rows],
        page=page,
        per_page=per_page,
        total=total,
    )


@router.get("/{prediction_id}", response_model=PredictionOut)
def get_one(prediction_id: uuid.UUID, user: CurrentUser, db: DBSession) -> PredictionOut:
    record = db.get(Prediction, prediction_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    return PredictionOut.model_validate(record)


@router.delete("/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_one(prediction_id: uuid.UUID, user: CurrentUser, db: DBSession) -> None:
    record = db.get(Prediction, prediction_id)
    if record is None or record.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Prediction not found")
    db.delete(record)
    db.commit()


# Aggregations for the Evaluation page
@router.get("/_stats/summary")
def stats_summary(user: CurrentUser, db: DBSession) -> dict:
    by_class = db.execute(
        select(Prediction.severity_class, func.count())
        .where(Prediction.user_id == user.id)
        .group_by(Prediction.severity_class)
    ).all()
    return {
        "total": sum(c for _, c in by_class),
        "by_severity": {int(k): int(v) for k, v in by_class},
    }


HistoryRouter = Annotated[APIRouter, router]
