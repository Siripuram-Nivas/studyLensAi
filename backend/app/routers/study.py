"""AI study operations: summary, explanation and key concepts."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError
from app.schemas import (
    ConceptsResponse,
    ExplainRequest,
    ExplanationResponse,
    GenerationInfo,
    StudyRequest,
    SummaryResponse,
)
from app.services.ai.base import AIProvider
from app.services.ai.factory import get_ai_provider
from app.services.materials import get_material, pages_for_material, record_session
from app.services.study_engine import (
    explain_concept,
    extract_key_concepts,
    generate_summary,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/materials", tags=["study"])


def _generation_info(meta) -> GenerationInfo:
    return GenerationInfo(
        provider=meta.provider,
        model=meta.model,
        included_pages=meta.included_pages,
        truncated=meta.truncated,
        warnings=meta.warnings,
    )


@router.post("/{material_id}/summary", response_model=SummaryResponse)
async def create_summary(
    material_id: UUID,
    payload: StudyRequest,
    request: Request,
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_ai_provider),
) -> SummaryResponse:
    settings = request.app.state.settings
    material = get_material(db, str(material_id))
    try:
        outcome = await generate_summary(
            provider,
            pages_for_material(material),
            settings,
            difficulty=payload.difficulty,
            focus=payload.focus,
        )
    except AppError as exc:
        record_session(
            db,
            material_id=material.id,
            session_type="summary",
            status="failed",
            detail=exc.code,
        )
        raise
    except Exception:
        record_session(
            db,
            material_id=material.id,
            session_type="summary",
            status="failed",
            detail="internal_error",
        )
        raise

    record_session(db, material_id=material.id, session_type="summary")
    return SummaryResponse(
        material_id=material.id,
        result=outcome.result,
        generation=_generation_info(outcome.meta),
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/{material_id}/explain", response_model=ExplanationResponse)
async def explain(
    material_id: UUID,
    payload: ExplainRequest,
    request: Request,
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_ai_provider),
) -> ExplanationResponse:
    settings = request.app.state.settings
    material = get_material(db, str(material_id))
    try:
        outcome = await explain_concept(
            provider,
            pages_for_material(material),
            settings,
            concept=payload.concept,
            difficulty=payload.difficulty,
            learning_goal=payload.learning_goal,
        )
    except AppError as exc:
        record_session(
            db,
            material_id=material.id,
            session_type="explanation",
            status="failed",
            detail=exc.code,
        )
        raise
    except Exception:
        record_session(
            db,
            material_id=material.id,
            session_type="explanation",
            status="failed",
            detail="internal_error",
        )
        raise

    record_session(db, material_id=material.id, session_type="explanation")
    return ExplanationResponse(
        material_id=material.id,
        result=outcome.result,
        generation=_generation_info(outcome.meta),
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/{material_id}/concepts", response_model=ConceptsResponse)
async def concepts(
    material_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_ai_provider),
) -> ConceptsResponse:
    settings = request.app.state.settings
    material = get_material(db, str(material_id))
    try:
        outcome = await extract_key_concepts(
            provider, pages_for_material(material), settings
        )
    except AppError as exc:
        record_session(
            db,
            material_id=material.id,
            session_type="concepts",
            status="failed",
            detail=exc.code,
        )
        raise
    except Exception:
        record_session(
            db,
            material_id=material.id,
            session_type="concepts",
            status="failed",
            detail="internal_error",
        )
        raise

    record_session(db, material_id=material.id, session_type="concepts")
    return ConceptsResponse(
        material_id=material.id,
        result=outcome.result,
        generation=_generation_info(outcome.meta),
        generated_at=datetime.now(timezone.utc),
    )
