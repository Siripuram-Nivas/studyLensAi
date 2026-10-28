"""SQLAlchemy models for StudyLens AI."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, UTCDateTime


def new_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    # JSON array of {"page": int | null, "text": str}
    pages_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    truncated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extraction_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now, onupdate=utc_now
    )

    sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(
        back_populates="material", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_study_materials_created_at", "created_at"),)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    material_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("study_materials.id", ondelete="CASCADE"), nullable=False
    )
    session_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    detail: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now
    )

    material: Mapped[StudyMaterial] = relationship(back_populates="sessions")

    __table_args__ = (Index("ix_study_sessions_created_at", "created_at"),)


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    material_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("study_materials.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    # JSON array of full questions, including correct_index and explanation.
    question_data: Mapped[str] = mapped_column(Text, nullable=False)
    num_questions: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="intermediate")
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now
    )

    material: Mapped[StudyMaterial] = relationship(back_populates="quizzes")
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    quiz_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False
    )
    # JSON: {"answers": [...], "ai_feedback": {...} | null}
    answers: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now
    )

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")

    __table_args__ = (Index("ix_quiz_attempts_created_at", "created_at"),)


class TopicPerformance(Base):
    __tablename__ = "topic_performance"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    topic: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    questions_attempted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    questions_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime, nullable=False, default=utc_now, onupdate=utc_now
    )

    @property
    def accuracy(self) -> float:
        if self.questions_attempted == 0:
            return 0.0
        return round(self.questions_correct / self.questions_attempted * 100, 1)
