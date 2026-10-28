"""Pydantic schemas used to validate structured AI output.

These schemas are deliberately strict enough to catch unusable model output,
but not so strict that a reasonable answer is rejected for cosmetic reasons.
Every response is validated before it is stored or rendered.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class DefinitionItem(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    definition: str = Field(min_length=3, max_length=1_200)


class SummaryOutput(BaseModel):
    overview: str = Field(min_length=20, max_length=3_000)
    main_points: list[str] = Field(min_length=1, max_length=10)
    definitions: list[DefinitionItem] = Field(default_factory=list, max_length=12)
    key_takeaways: list[str] = Field(default_factory=list, max_length=10)
    source_pages: list[int] = Field(default_factory=list, max_length=50)


class ExplanationOutput(BaseModel):
    concept: str = Field(min_length=1, max_length=200)
    explanation: str = Field(min_length=20, max_length=4_000)
    example: str = Field(min_length=5, max_length=2_000)
    misconception: str | None = Field(default=None, max_length=2_000)
    grounded: bool = True
    source_pages: list[int] = Field(default_factory=list, max_length=50)


class KeyConcept(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    definition: str = Field(min_length=3, max_length=1_200)
    excerpt: str | None = Field(default=None, max_length=1_000)
    page: int | None = None


class ConceptsOutput(BaseModel):
    concepts: list[KeyConcept] = Field(min_length=1, max_length=12)


class GeneratedQuestion(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    question: str = Field(min_length=8, max_length=1_000)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=5, max_length=1_500)
    concept: str = Field(min_length=1, max_length=200)

    @field_validator("options")
    @classmethod
    def _distinct_options(cls, options: list[str]) -> list[str]:
        cleaned = [option.strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("Every answer option must be non-empty")
        if len({option.casefold() for option in cleaned}) != len(cleaned):
            raise ValueError("Answer options must be distinct")
        return cleaned


class GeneratedQuiz(BaseModel):
    title: str = Field(min_length=3, max_length=300)
    questions: list[GeneratedQuestion] = Field(min_length=1, max_length=15)

    @field_validator("questions")
    @classmethod
    def _unique_ids(cls, questions: list[GeneratedQuestion]) -> list[GeneratedQuestion]:
        ids = [question.id for question in questions]
        if len(ids) != len(set(ids)):
            raise ValueError("Question ids must be unique")
        return questions


class AnswerFeedbackOutput(BaseModel):
    summary: str = Field(min_length=10, max_length=2_000)
    study_tip: str = Field(min_length=5, max_length=1_000)
    question_feedback: dict[str, str] = Field(default_factory=dict)


class WeakTopicItem(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=3, max_length=1_000)
    suggestion: str = Field(min_length=3, max_length=1_000)


class WeakTopicsOutput(BaseModel):
    topics: list[WeakTopicItem] = Field(default_factory=list, max_length=8)


class ChunkNotes(BaseModel):
    notes: str = Field(min_length=20, max_length=3_000)
    key_terms: list[str] = Field(default_factory=list, max_length=15)


class ImageTranscription(BaseModel):
    text: str = Field(min_length=1, max_length=40_000)
