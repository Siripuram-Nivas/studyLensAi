"""Test doubles for the AI provider.

These are used only in tests. No test result in this repository is presented as
live-model verification.
"""

from __future__ import annotations

import re
from typing import Any

from app.services.ai.base import AIProvider, AIStatus, T
from app.services.ai.schemas import (
    AnswerFeedbackOutput,
    ChunkNotes,
    ConceptsOutput,
    ExplanationOutput,
    GeneratedQuestion,
    GeneratedQuiz,
    KeyConcept,
    SummaryOutput,
    WeakTopicItem,
    WeakTopicsOutput,
)


class FakeAIProvider(AIProvider):
    name = "fake"
    model = "fake-test-model"
    supports_vision = False
    supports_structured_output = True

    def __init__(self) -> None:
        self.error: Exception | None = None
        self.structured_calls: list[str] = []
        self.prompts: list[str] = []
        self.last_quiz: GeneratedQuiz | None = None
        self.concept_excerpt = "Normalization organizes columns and tables in a relational database"
        self.source_pages = [1]

    async def generate_text(self, *_args: Any, **_kwargs: Any) -> str:
        if self.error:
            raise self.error
        return "fake generated text"

    async def analyze_image(self, *_args: Any, **_kwargs: Any) -> str:
        if self.error:
            raise self.error
        return "Normalization notes transcribed from an image for testing purposes."

    async def health_check(self) -> AIStatus:
        return AIStatus(
            configured=True,
            status="ready",
            provider=self.name,
            model=self.model,
            base_url="http://fake.invalid/v1",
            reachable=True,
            model_available=True,
            latency_ms=1,
            detail="Fake provider ready for tests.",
            supports_vision=self.supports_vision,
        )

    async def generate_structured_output(
        self,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        max_attempts: int = 2,
    ) -> T:
        self.structured_calls.append(schema.__name__)
        self.prompts.append(prompt)
        if self.error:
            raise self.error

        if schema is SummaryOutput:
            return SummaryOutput(  # type: ignore[return-value]
                overview=(
                    "The material explains database normalization and why it reduces "
                    "redundancy while improving integrity."
                ),
                main_points=[
                    "Normalization organizes data into related tables.",
                    "First normal form requires atomic column values.",
                    "Normal forms reduce update anomalies.",
                ],
                definitions=[
                    {
                        "term": "Normalization",
                        "definition": "A design process that reduces redundancy in relational databases.",
                    }
                ],
                key_takeaways=["Choose a normal form based on integrity needs."],
                source_pages=self.source_pages,
            )

        if schema is ExplanationOutput:
            return ExplanationOutput(  # type: ignore[return-value]
                concept="Normalization",
                explanation=(
                    "Normalization is the process of structuring relational tables so that "
                    "each fact is stored once. This limits update anomalies and keeps data consistent."
                ),
                example=(
                    "A student address repeated in every enrollment row can be moved to a "
                    "students table and referenced by id."
                ),
                misconception="Normalization does not always make queries faster.",
                grounded=True,
                source_pages=self.source_pages,
            )

        if schema is ConceptsOutput:
            return ConceptsOutput(  # type: ignore[return-value]
                concepts=[
                    KeyConcept(
                        name="Normalization",
                        definition="Structuring tables to reduce redundancy.",
                        excerpt=self.concept_excerpt,
                        page=1,
                    )
                ]
            )

        if schema is ChunkNotes:
            return ChunkNotes(  # type: ignore[return-value]
                notes=(
                    "This excerpt discusses normalization, functional dependencies, and "
                    "the motivation for reducing redundancy in relational tables."
                ),
                key_terms=["normalization", "redundancy", "functional dependency"],
            )

        if schema is GeneratedQuiz:
            match = re.search(r"Create exactly (\d+) multiple-choice", prompt)
            requested = int(match.group(1)) if match else 5
            questions = []
            for index in range(requested):
                questions.append(
                    GeneratedQuestion(
                        id=f"model-{index + 1}",
                        question=(
                            f"What is the main benefit of database normalization "
                            f"described in this material (item {index + 1})?"
                        ),
                        options=[
                            "Reduced redundancy",
                            "Faster hardware",
                            "More duplicate rows",
                            "Fewer tables than possible",
                        ],
                        correct_index=index % 4 if index % 4 != 2 else 0,
                        explanation=(
                            "The material states that normalization reduces redundancy and "
                            "improves data integrity."
                        ),
                        concept="Normalization",
                    )
                )
            quiz = GeneratedQuiz(title="Normalization practice", questions=questions)
            self.last_quiz = quiz
            return quiz  # type: ignore[return-value]

        if schema is AnswerFeedbackOutput:
            return AnswerFeedbackOutput(  # type: ignore[return-value]
                summary="You understand the core definition but missed some applications.",
                study_tip="Re-read the section on update anomalies and try a schema example.",
                question_feedback={
                    "q1": "Review why redundancy causes update anomalies.",
                },
            )

        if schema is WeakTopicsOutput:
            return WeakTopicsOutput(  # type: ignore[return-value]
                topics=[
                    WeakTopicItem(
                        topic="Normalization",
                        reason="This concept had incorrect answers in the attempt.",
                        suggestion="Redraw a table in 1NF, 2NF and 3NF and compare the dependencies.",
                    )
                ]
            )

        raise AssertionError(f"Unexpected schema requested: {schema.__name__}")
