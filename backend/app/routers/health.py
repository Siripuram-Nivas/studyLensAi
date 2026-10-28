"""Health and AI status endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.database import get_db
from app.schemas import AIStatusOut, HealthResponse
from app.services.ai.status import get_ai_status

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(request: Request, db: Session = Depends(get_db)) -> HealthResponse:
    database_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database_status = "error"
    settings = request.app.state.settings
    return HealthResponse(
        status="ok" if database_status == "ok" else "degraded",
        app=settings.app_name,
        version=__version__,
        database=database_status,  # type: ignore[arg-type]
        ai_configured=settings.ai_configured,
    )


@router.get("/ai/status", response_model=AIStatusOut)
async def ai_status(
    request: Request,
    refresh: bool = Query(default=False),
) -> AIStatusOut:
    settings = request.app.state.settings
    status = await get_ai_status(settings, force=refresh)
    data = status.to_dict()
    data["checked_at"] = status.checked_at.isoformat()
    return AIStatusOut(**data)
