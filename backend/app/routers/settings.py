"""Settings, privacy information and local data management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Quiz, QuizAttempt, StudyMaterial, StudySession, TopicPerformance
from app.schemas import (
    AIStatusOut,
    DataCounts,
    ResetDataRequest,
    ResetDataResponse,
    SettingsInfo,
)
from app.services.ai.status import get_ai_status

router = APIRouter(prefix="/settings", tags=["settings"])


def _counts(db: Session) -> DataCounts:
    def count(model) -> int:
        return int(db.scalar(select(func.count()).select_from(model)) or 0)

    return DataCounts(
        materials=count(StudyMaterial),
        quizzes=count(Quiz),
        attempts=count(QuizAttempt),
        sessions=count(StudySession),
        topics=count(TopicPerformance),
    )


@router.get("", response_model=SettingsInfo)
async def get_settings_info(request: Request, refresh: bool = False) -> SettingsInfo:
    settings = request.app.state.settings
    status = await get_ai_status(settings, force=refresh)
    data = status.to_dict()
    ai = AIStatusOut(
        **{**data, "checked_at": status.checked_at.isoformat()}
    )

    # Counts use a short-lived session created from the app factory.
    session_factory = request.app.state.session_factory
    with session_factory() as db:
        counts = _counts(db)

    return SettingsInfo(
        app_name=settings.app_name,
        environment=settings.environment,
        ai=ai,
        data=counts,
        privacy_notes=[
            "Extracted study text, quizzes and attempts are stored in a local SQLite database.",
            "Your study text is sent to the configured AI provider only when you request "
            "a summary, explanation, key concepts or quiz.",
            "API keys are read from server environment variables and are never returned "
            "to the browser.",
            "Original PDF and image uploads are processed in memory; the raw files are not "
            "saved or served publicly.",
            "Deleting a material removes its extracted text, quizzes and quiz attempts.",
        ],
        deployment_warning=(
            "This build has no user accounts or authentication. Use it locally or on a "
            "trusted single-user deployment. Do not expose it publicly with private study "
            "data until authentication and per-user data isolation are added."
        ),
        max_upload_mb=settings.max_upload_mb,
        limits={
            "max_pdf_pages": settings.max_pdf_pages,
            "max_text_chars": settings.max_text_chars,
            "max_extracted_chars": settings.max_extracted_chars,
            "ai_max_input_chars": settings.ai_max_input_chars,
        },
    )


@router.post("/reset", response_model=ResetDataResponse)
def reset_data(payload: ResetDataRequest, db: Session = Depends(get_db)) -> ResetDataResponse:
    if payload.confirm != "DELETE":
        # Enforced by the Literal type as well; kept as defence in depth.
        from app.errors import AppError

        raise AppError(422, "confirmation_required", "Type DELETE to confirm.")
    deleted = _counts(db)
    db.execute(delete(TopicPerformance))
    db.execute(delete(QuizAttempt))
    db.execute(delete(Quiz))
    db.execute(delete(StudySession))
    db.execute(delete(StudyMaterial))
    db.commit()
    return ResetDataResponse(deleted=deleted)
