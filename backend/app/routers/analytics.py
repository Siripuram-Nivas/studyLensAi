"""Analytics endpoints backed by stored quiz attempts."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AnalyticsOverview, TopicsResponse
from app.services.analytics import get_overview, get_topics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def overview(db: Session = Depends(get_db)) -> AnalyticsOverview:
    return get_overview(db)


@router.get("/topics", response_model=TopicsResponse)
def topics(db: Session = Depends(get_db)) -> TopicsResponse:
    return get_topics(db)
