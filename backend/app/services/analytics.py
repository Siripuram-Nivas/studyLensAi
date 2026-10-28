"""Analytics derived only from stored materials, quizzes and attempts."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Quiz, QuizAttempt, StudyMaterial, StudySession, TopicPerformance
from app.schemas import (
    AnalyticsOverview,
    AttemptListItem,
    MaterialMini,
    PerformancePoint,
    SessionItem,
    TopicStat,
    TopicsResponse,
)


def _attempt_payload(attempt: QuizAttempt) -> dict[str, object]:
    try:
        payload = json.loads(attempt.answers)
    except (ValueError, TypeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def rebuild_topic_performance(db: Session) -> None:
    """Recompute aggregates from attempts so deletes never leave stale topics."""
    db.execute(delete(TopicPerformance))
    attempts = db.scalars(select(QuizAttempt)).all()
    totals: dict[str, list[int]] = {}
    for attempt in attempts:
        payload = _attempt_payload(attempt)
        graded = payload.get("graded", [])
        if not isinstance(graded, list):
            continue
        for item in graded:
            if not isinstance(item, dict):
                continue
            concept = str(item.get("concept", "")).strip()
            if not concept:
                continue
            bucket = totals.setdefault(concept[:200], [0, 0])
            bucket[0] += 1
            if item.get("is_correct") is True:
                bucket[1] += 1
    for topic, (attempted, correct) in totals.items():
        db.add(
            TopicPerformance(
                topic=topic,
                questions_attempted=attempted,
                questions_correct=correct,
            )
        )
    db.flush()


def _material_title_map(db: Session, material_ids: set[str]) -> dict[str, str]:
    if not material_ids:
        return {}
    rows = db.execute(
        select(StudyMaterial.id, StudyMaterial.title).where(
            StudyMaterial.id.in_(material_ids)
        )
    ).all()
    return {row.id: row.title for row in rows}


def attempt_list_item(
    attempt: QuizAttempt, quiz: Quiz, material_title: str
) -> AttemptListItem:
    return AttemptListItem(
        id=attempt.id,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        material_id=quiz.material_id,
        material_title=material_title,
        score=attempt.score,
        total_questions=attempt.total_questions,
        percentage=attempt.percentage,
        created_at=attempt.created_at,
    )


def get_overview(db: Session) -> AnalyticsOverview:
    total_materials = db.scalar(select(func.count()).select_from(StudyMaterial)) or 0
    total_quizzes = db.scalar(select(func.count()).select_from(Quiz)) or 0
    total_attempts = db.scalar(select(func.count()).select_from(QuizAttempt)) or 0
    completed_sessions = (
        db.scalar(
            select(func.count())
            .select_from(StudySession)
            .where(StudySession.status == "completed")
        )
        or 0
    )
    total_score = db.scalar(select(func.coalesce(func.sum(QuizAttempt.score), 0))) or 0
    total_questions = (
        db.scalar(select(func.coalesce(func.sum(QuizAttempt.total_questions), 0))) or 0
    )
    average = (
        round(float(total_score) / float(total_questions) * 100, 1)
        if total_questions
        else None
    )

    recent_attempt_rows = db.execute(
        select(QuizAttempt, Quiz, StudyMaterial)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(StudyMaterial, Quiz.material_id == StudyMaterial.id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(6)
    ).all()
    recent_attempts = [
        attempt_list_item(attempt, quiz, material.title)
        for attempt, quiz, material in recent_attempt_rows
    ]

    performance_rows = db.execute(
        select(QuizAttempt, Quiz)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .order_by(QuizAttempt.created_at.asc())
        .limit(100)
    ).all()
    performance = [
        PerformancePoint(
            attempt_id=attempt.id,
            label=attempt.created_at.strftime("%b %d"),
            accuracy=attempt.percentage,
            score=attempt.score,
            total=attempt.total_questions,
            created_at=attempt.created_at,
        )
        for attempt, _quiz in performance_rows[-30:]
    ]

    session_rows = db.execute(
        select(StudySession, StudyMaterial)
        .join(StudyMaterial, StudySession.material_id == StudyMaterial.id)
        .order_by(StudySession.created_at.desc())
        .limit(8)
    ).all()
    recent_sessions = [
        SessionItem(
            id=session.id,
            material_id=session.material_id,
            material_title=material.title,
            session_type=session.session_type,
            status=session.status,
            detail=session.detail,
            created_at=session.created_at,
        )
        for session, material in session_rows
    ]

    materials = db.scalars(
        select(StudyMaterial).order_by(StudyMaterial.created_at.desc()).limit(4)
    ).all()
    recent_materials = [
        MaterialMini(
            id=material.id,
            title=material.title,
            content_type=material.content_type,
            word_count=material.word_count,
            created_at=material.created_at,
        )
        for material in materials
    ]

    return AnalyticsOverview(
        total_materials=total_materials,
        total_quizzes=total_quizzes,
        total_attempts=total_attempts,
        completed_sessions=completed_sessions,
        average_score=average,
        total_questions_answered=int(total_questions),
        total_questions_correct=int(total_score),
        performance=performance,
        recent_attempts=recent_attempts,
        recent_sessions=recent_sessions,
        recent_materials=recent_materials,
    )


def get_topics(db: Session) -> TopicsResponse:
    rows = db.scalars(
        select(TopicPerformance).order_by(TopicPerformance.topic.asc())
    ).all()
    topics: list[TopicStat] = []
    for row in rows:
        if row.questions_attempted == 0:
            continue
        accuracy = round(
            row.questions_correct / row.questions_attempted * 100, 1
        )
        strength = (
            "strong" if accuracy >= 80 else "developing" if accuracy >= 50 else "weak"
        )
        topics.append(
            TopicStat(
                topic=row.topic,
                questions_attempted=row.questions_attempted,
                questions_correct=row.questions_correct,
                accuracy=accuracy,
                strength=strength,
            )
        )
    topics.sort(key=lambda item: (item.accuracy, -item.questions_attempted))
    return TopicsResponse(topics=topics, total_topics=len(topics))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
