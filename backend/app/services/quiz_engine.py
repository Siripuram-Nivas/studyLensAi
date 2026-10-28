"""Quiz generation and deterministic, server-side grading."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.config import Settings
from app.errors import AppError
from app.services.ai.base import AIInvalidResponseError, AIProvider
from app.services.ai.prompts import SYSTEM_PROMPT, quiz_prompt
from app.services.ai.schemas import GeneratedQuestion, GeneratedQuiz
from app.services.study_engine import GenerationMeta
from app.services.text_processing import (
    Chunk,
    Page,
    allowed_pages,
    chunk_pages,
    format_context,
    sample_chunks,
)

logger = logging.getLogger(__name__)


@dataclass
class QuizResult:
    quiz: GeneratedQuiz
    meta: GenerationMeta = field(default_factory=lambda: GenerationMeta(provider="", model=""))


def _fit(chunks: list[Chunk], max_chars: int) -> list[Chunk]:
    total = sum(chunk.length for chunk in chunks)
    if total <= max_chars:
        return chunks
    per = max(max_chars // max(len(chunks), 1), 800)
    fitted: list[Chunk] = []
    for chunk in chunks:
        if chunk.length <= per:
            fitted.append(chunk)
        else:
            cut = chunk.text[:per]
            boundary = max(cut.rfind(". "), cut.rfind("\n"))
            text = cut[: boundary + 1] if boundary > per // 2 else cut
            fitted.append(Chunk(index=chunk.index, page=chunk.page, text=text.strip()))
    result: list[Chunk] = []
    total = 0
    for chunk in fitted:
        if result and total + chunk.length > max_chars:
            break
        result.append(chunk)
        total += chunk.length
    return result or [fitted[0]]


async def generate_quiz(
    provider: AIProvider,
    pages: list[Page],
    settings: Settings,
    *,
    num_questions: int,
    difficulty: str,
    focus: str | None = None,
) -> QuizResult:
    chunks = chunk_pages(pages, max_chars=max(2_500, settings.ai_max_input_chars // 3))
    selected = _fit(
        sample_chunks(chunks, max_chars=settings.ai_max_input_chars, max_chunks=6),
        settings.ai_max_input_chars,
    )
    context = format_context(selected)
    allowed = allowed_pages(selected)
    prompt = quiz_prompt(
        context=context,
        allowed_pages=allowed,
        num_questions=num_questions,
        difficulty=difficulty,
        focus=focus,
    )

    last_count = 0
    for attempt in range(1, 3):
        try:
            quiz = await provider.generate_structured_output(
                prompt,
                GeneratedQuiz,
                system=SYSTEM_PROMPT,
                max_tokens=min(5_000, 450 + num_questions * 330),
            )
        except AIInvalidResponseError:
            if attempt == 2:
                raise
            prompt = (
                quiz_prompt(
                    context=context,
                    allowed_pages=allowed,
                    num_questions=num_questions,
                    difficulty=difficulty,
                    focus=focus,
                )
                + "\n\nThe previous response could not be parsed. Return valid JSON only."
            )
            continue

        last_count = len(quiz.questions)
        if last_count == num_questions:
            # Re-key ids to guarantee uniqueness independent of model output.
            normalized = [
                question.model_copy(update={"id": f"q{index + 1}"})
                for index, question in enumerate(quiz.questions)
            ]
            quiz.questions = normalized
            return QuizResult(
                quiz=quiz,
                meta=GenerationMeta(
                    provider=provider.name,
                    model=provider.model,
                    included_pages=allowed,
                    truncated=len(selected) < len(chunks)
                    or sum(chunk.length for chunk in selected) < sum(
                        chunk.length for chunk in chunks
                    ),
                    warnings=(
                        [
                            "The material was longer than the model context limit. "
                            "The quiz is grounded in evenly selected sections."
                        ]
                        if len(selected) < len(chunks)
                        else []
                    ),
                ),
            )
        if attempt == 1:
            prompt = (
                quiz_prompt(
                    context=context,
                    allowed_pages=allowed,
                    num_questions=num_questions,
                    difficulty=difficulty,
                    focus=focus,
                )
                + f"\n\nThe previous response contained {last_count} questions. "
                f"Return exactly {num_questions} questions."
            )

    raise AIInvalidResponseError(
        f"The model returned {last_count} questions instead of {num_questions}. "
        "Try fewer questions or a shorter material."
    )


def public_questions(quiz: GeneratedQuiz) -> list[dict[str, object]]:
    return [
        {
            "id": question.id,
            "question": question.question,
            "options": question.options,
            "concept": question.concept,
        }
        for question in quiz.questions
    ]


def grade_answers(
    questions: list[GeneratedQuestion],
    submitted: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Grade entirely on the server. Client-supplied correctness is ignored."""
    submitted_map: dict[str, int] = {}
    for answer in submitted:
        question_id = str(answer["question_id"])
        if question_id in submitted_map:
            raise AppError(
                422,
                "duplicate_answer",
                "Each question can only be answered once.",
                {"question_id": question_id},
            )
        submitted_map[question_id] = int(answer["selected_index"])

    valid_ids = {question.id for question in questions}
    unknown = sorted(set(submitted_map) - valid_ids)
    if unknown:
        raise AppError(
            422,
            "unknown_question",
            "The submission contains a question that is not part of this quiz.",
            {"question_ids": unknown[:10]},
        )

    missing = [question.id for question in questions if question.id not in submitted_map]
    if missing:
        raise AppError(
            422,
            "incomplete_answers",
            "Please answer every question before submitting.",
            {"missing_question_ids": missing[:15]},
        )

    graded: list[dict[str, object]] = []
    for question in questions:
        selected = submitted_map[question.id]
        graded.append(
            {
                "question_id": question.id,
                "question": question.question,
                "options": question.options,
                "selected_index": selected,
                "correct_index": question.correct_index,
                "is_correct": selected == question.correct_index,
                "explanation": question.explanation,
                "concept": question.concept,
            }
        )
    return graded


def quiz_to_public(
    *,
    quiz_id: str,
    material_id: str,
    material_title: str,
    title: str,
    difficulty: str,
    questions: list[GeneratedQuestion],
    created_at,
) -> dict[str, object]:
    return {
        "id": quiz_id,
        "material_id": material_id,
        "material_title": material_title,
        "title": title,
        "difficulty": difficulty,
        "num_questions": len(questions),
        "questions": public_questions(GeneratedQuiz(title=title, questions=questions)),
        "created_at": created_at,
    }
