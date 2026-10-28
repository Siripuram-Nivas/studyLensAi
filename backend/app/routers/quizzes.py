"""Quiz generation, retrieval and submission endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError, AIServiceError
from app.models import Quiz, QuizAttempt
from app.schemas import (
    AnswerFeedbackOutput,
    AttemptListItem,
    AttemptResponse,
    GenerationInfo,
    GradedAnswer,
    QuizGenerateRequest,
    QuizResponse,
    QuizSubmitRequest,
    WeakTopicItem,
)
from app.services.ai.base import AIProvider
from app.services.ai.factory import get_ai_provider, get_optional_ai_provider
from app.services.ai.schemas import GeneratedQuestion, GeneratedQuiz
from app.services.analytics import attempt_list_item, rebuild_topic_performance
from app.services.materials import get_material, pages_for_material, record_session
from app.services.quiz_engine import generate_quiz, grade_answers, quiz_to_public
from app.services.study_engine import evaluate_answers, identify_weak_topics

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quizzes", tags=["quizzes"])


def _load_questions(quiz: Quiz) -> list[GeneratedQuestion]:
    try:
        raw = json.loads(quiz.question_data)
        parsed = GeneratedQuiz(
            title=quiz.title,
            questions=[GeneratedQuestion.model_validate(item) for item in raw],
        )
        return parsed.questions
    except (ValueError, TypeError, ValidationError) as exc:
        logger.error("Stored quiz data is invalid quiz_id=%s", quiz.id)
        raise AppError(
            500,
            "quiz_data_invalid",
            "This quiz's stored questions are unreadable. Please generate a new quiz.",
        ) from exc


def _error_text(prefix: str, exc: BaseException) -> str:
    if isinstance(exc, AIServiceError):
        return f"{prefix}: {exc.message}"
    return f"{prefix}: the AI provider request failed unexpectedly."


@router.post("/generate", response_model=QuizResponse, status_code=201)
async def create_quiz(
    payload: QuizGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_ai_provider),
) -> QuizResponse:
    settings = request.app.state.settings
    material = get_material(db, str(payload.material_id))
    try:
        outcome = await generate_quiz(
            provider,
            pages_for_material(material),
            settings,
            num_questions=payload.num_questions,
            difficulty=payload.difficulty,
            focus=payload.focus,
        )
    except AppError as exc:
        record_session(
            db,
            material_id=material.id,
            session_type="quiz_generation",
            status="failed",
            detail=exc.code,
        )
        raise
    except Exception:
        record_session(
            db,
            material_id=material.id,
            session_type="quiz_generation",
            status="failed",
            detail="internal_error",
        )
        raise

    quiz = Quiz(
        material_id=material.id,
        title=outcome.quiz.title[:300],
        question_data=json.dumps(
            [question.model_dump() for question in outcome.quiz.questions]
        ),
        num_questions=len(outcome.quiz.questions),
        difficulty=payload.difficulty,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    record_session(db, material_id=material.id, session_type="quiz_generation")
    logger.info("Quiz generated id=%s material=%s questions=%s", quiz.id, material.id, quiz.num_questions)
    return QuizResponse(
        **quiz_to_public(
            quiz_id=quiz.id,
            material_id=material.id,
            material_title=material.title,
            title=quiz.title,
            difficulty=quiz.difficulty,
            questions=outcome.quiz.questions,
            created_at=quiz.created_at,
        )
    )


@router.get("/attempts", response_model=list[AttemptListItem])
def list_attempts(
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[AttemptListItem]:
    rows = db.execute(
        select(QuizAttempt, Quiz)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(limit)
    ).all()
    material_ids = {quiz.material_id for _attempt, quiz in rows}
    titles: dict[str, str] = {}
    if material_ids:
        from app.models import StudyMaterial

        material_rows = db.execute(
            select(StudyMaterial.id, StudyMaterial.title).where(
                StudyMaterial.id.in_(material_ids)
            )
        ).all()
        titles = {row.id: row.title for row in material_rows}
    return [
        attempt_list_item(attempt, quiz, titles.get(quiz.material_id, "Study material"))
        for attempt, quiz in rows
    ]


@router.get("/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: UUID, db: Session = Depends(get_db)) -> QuizResponse:
    quiz = db.get(Quiz, str(quiz_id))
    if quiz is None:
        raise AppError(404, "not_found", "Quiz was not found.")
    material = get_material(db, quiz.material_id)
    questions = _load_questions(quiz)
    return QuizResponse(
        **quiz_to_public(
            quiz_id=quiz.id,
            material_id=material.id,
            material_title=material.title,
            title=quiz.title,
            difficulty=quiz.difficulty,
            questions=questions,
            created_at=quiz.created_at,
        )
    )


@router.post("/{quiz_id}/submit", response_model=AttemptResponse)
async def submit_quiz(
    quiz_id: UUID,
    payload: QuizSubmitRequest,
    db: Session = Depends(get_db),
    provider: AIProvider = Depends(get_optional_ai_provider),
) -> AttemptResponse:
    quiz = db.get(Quiz, str(quiz_id))
    if quiz is None:
        raise AppError(404, "not_found", "Quiz was not found.")
    material = get_material(db, quiz.material_id)
    questions = _load_questions(quiz)
    graded = grade_answers(
        questions,
        [answer.model_dump() for answer in payload.answers],
    )
    score = sum(1 for item in graded if item["is_correct"])
    total = len(questions)
    percentage = round(score / total * 100, 1) if total else 0.0

    incorrect = [
        {
            "id": str(item["question_id"]),
            "concept": str(item["concept"]),
            "question": str(item["question"]),
            "selected": str(item["options"][int(item["selected_index"])]),  # type: ignore[index]
            "correct": str(item["options"][int(item["correct_index"])]),  # type: ignore[index]
            "explanation": str(item["explanation"]),
        }
        for item in graded
        if not item["is_correct"]
    ]

    feedback: AnswerFeedbackOutput | None = None
    weak_topics: list[WeakTopicItem] | None = None
    feedback_error: str | None = None
    weak_topics_error: str | None = None

    if provider.name != "disabled":
        feedback_result, topics_result = await asyncio.gather(
            evaluate_answers(
                provider,
                quiz_title=quiz.title,
                score=score,
                total=total,
                incorrect=incorrect,
            ),
            identify_weak_topics(provider, graded=graded),
            return_exceptions=True,
        )
        if isinstance(feedback_result, BaseException):
            logger.warning("Quiz feedback generation failed type=%s", type(feedback_result).__name__)
            feedback_error = _error_text("AI feedback unavailable", feedback_result)
        else:
            feedback = feedback_result

        if isinstance(topics_result, BaseException):
            logger.warning("Weak topic generation failed type=%s", type(topics_result).__name__)
            weak_topics_error = _error_text(
                "AI weak-topic analysis unavailable", topics_result
            )
        else:
            weak_topics = topics_result.topics
    else:
        feedback_error = "AI feedback is unavailable because no provider is configured."

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        answers=json.dumps(
            {
                "graded": graded,
                "ai_feedback": feedback.model_dump() if feedback else None,
                "weak_topics": (
                    [topic.model_dump() for topic in weak_topics] if weak_topics else []
                ),
            }
        ),
        score=score,
        total_questions=total,
        percentage=percentage,
        duration_seconds=payload.duration_seconds,
    )
    db.add(attempt)
    db.flush()
    rebuild_topic_performance(db)
    db.commit()
    db.refresh(attempt)
    record_session(db, material_id=material.id, session_type="quiz_attempt")
    logger.info("Quiz submitted quiz_id=%s attempt_id=%s score=%s/%s", quiz.id, attempt.id, score, total)

    return AttemptResponse(
        attempt_id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        material_id=material.id,
        score=score,
        total_questions=total,
        percentage=percentage,
        graded_answers=[GradedAnswer(**item) for item in graded],
        ai_feedback=feedback,
        feedback_error=feedback_error,
        weak_topics=weak_topics,
        weak_topics_error=weak_topics_error,
        created_at=attempt.created_at,
        duration_seconds=attempt.duration_seconds,
    )
