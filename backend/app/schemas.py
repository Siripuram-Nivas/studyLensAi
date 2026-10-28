"""API request and response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.ai.schemas import (
    AnswerFeedbackOutput,
    ConceptsOutput,
    ExplanationOutput,
    SummaryOutput,
    WeakTopicItem,
)

Difficulty = Literal["beginner", "intermediate", "advanced"]


class PageOut(BaseModel):
    page: int | None
    text: str


class MaterialListItem(BaseModel):
    id: str
    title: str
    original_filename: str | None
    content_type: str
    word_count: int
    truncated: bool
    preview: str
    created_at: datetime
    updated_at: datetime


class MaterialDetail(MaterialListItem):
    extracted_text: str
    pages: list[PageOut]
    extraction_note: str | None


class MaterialTextCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=40, max_length=400_000)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("The title cannot be empty.")
        return cleaned


class StudyRequest(BaseModel):
    difficulty: Difficulty = "intermediate"
    focus: str | None = Field(default=None, max_length=500)


class ExplainRequest(BaseModel):
    concept: str = Field(min_length=2, max_length=300)
    difficulty: Difficulty = "intermediate"
    learning_goal: str | None = Field(default=None, max_length=500)


class GenerationInfo(BaseModel):
    provider: str
    model: str
    included_pages: list[int] = Field(default_factory=list)
    truncated: bool = False
    warnings: list[str] = Field(default_factory=list)


class SummaryResponse(BaseModel):
    material_id: str
    result: SummaryOutput
    generation: GenerationInfo
    generated_at: datetime


class ExplanationResponse(BaseModel):
    material_id: str
    result: ExplanationOutput
    generation: GenerationInfo
    generated_at: datetime


class ConceptsResponse(BaseModel):
    material_id: str
    result: ConceptsOutput
    generation: GenerationInfo
    generated_at: datetime


class QuizGenerateRequest(BaseModel):
    material_id: UUID
    num_questions: Literal[5, 10, 15] = 5
    difficulty: Difficulty = "intermediate"
    focus: str | None = Field(default=None, max_length=300)


class QuizQuestionPublic(BaseModel):
    id: str
    question: str
    options: list[str]
    concept: str


class QuizResponse(BaseModel):
    id: str
    material_id: str
    material_title: str
    title: str
    difficulty: str
    num_questions: int
    questions: list[QuizQuestionPublic]
    created_at: datetime


class AnswerSubmission(BaseModel):
    question_id: str = Field(min_length=1, max_length=64)
    selected_index: int = Field(ge=0, le=3)


class QuizSubmitRequest(BaseModel):
    answers: list[AnswerSubmission] = Field(min_length=1, max_length=15)
    duration_seconds: int | None = Field(default=None, ge=0, le=86_400)


class GradedAnswer(BaseModel):
    question_id: str
    question: str
    options: list[str]
    selected_index: int
    correct_index: int
    is_correct: bool
    explanation: str
    concept: str


class AttemptResponse(BaseModel):
    attempt_id: str
    quiz_id: str
    quiz_title: str
    material_id: str
    score: int
    total_questions: int
    percentage: float
    graded_answers: list[GradedAnswer]
    ai_feedback: AnswerFeedbackOutput | None = None
    feedback_error: str | None = None
    weak_topics: list[WeakTopicItem] | None = None
    weak_topics_error: str | None = None
    created_at: datetime
    duration_seconds: int | None = None


class AttemptListItem(BaseModel):
    id: str
    quiz_id: str
    quiz_title: str
    material_id: str
    material_title: str
    score: int
    total_questions: int
    percentage: float
    created_at: datetime


class SessionItem(BaseModel):
    id: str
    material_id: str
    material_title: str
    session_type: str
    status: str
    detail: str | None
    created_at: datetime


class MaterialMini(BaseModel):
    id: str
    title: str
    content_type: str
    word_count: int
    created_at: datetime


class PerformancePoint(BaseModel):
    attempt_id: str
    label: str
    accuracy: float
    score: int
    total: int
    created_at: datetime


class AnalyticsOverview(BaseModel):
    total_materials: int
    total_quizzes: int
    total_attempts: int
    completed_sessions: int
    average_score: float | None
    total_questions_answered: int
    total_questions_correct: int
    performance: list[PerformancePoint]
    recent_attempts: list[AttemptListItem]
    recent_sessions: list[SessionItem]
    recent_materials: list[MaterialMini]


class TopicStat(BaseModel):
    topic: str
    questions_attempted: int
    questions_correct: int
    accuracy: float
    strength: Literal["strong", "developing", "weak"]


class TopicsResponse(BaseModel):
    topics: list[TopicStat]
    total_topics: int


class AIStatusOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    configured: bool
    status: str
    provider: str
    model: str
    base_url: str
    reachable: bool | None = None
    model_available: bool | None = None
    latency_ms: int | None = None
    detail: str
    supports_vision: bool
    supports_structured_output: bool
    checked_at: str


class DataCounts(BaseModel):
    materials: int
    quizzes: int
    attempts: int
    sessions: int
    topics: int


class SettingsInfo(BaseModel):
    app_name: str
    environment: str
    ai: AIStatusOut
    data: DataCounts
    privacy_notes: list[str]
    deployment_warning: str
    max_upload_mb: int
    limits: dict[str, int]


class ResetDataRequest(BaseModel):
    confirm: Literal["DELETE"]


class ResetDataResponse(BaseModel):
    deleted: DataCounts


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    database: Literal["ok", "error"]
    ai_configured: bool


class MessageResponse(BaseModel):
    message: str


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
