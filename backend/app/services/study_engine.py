"""Genuine AI study operations, grounded in extracted material."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Generic, TypeVar

from app.config import Settings
from app.services.ai.base import AIProvider
from app.services.ai.schemas import (
    AnswerFeedbackOutput,
    ConceptsOutput,
    ExplanationOutput,
    SummaryOutput,
    WeakTopicsOutput,
)
from app.services.ai.prompts import (
    SYSTEM_PROMPT,
    chunk_notes_prompt,
    concepts_prompt,
    explanation_prompt,
    reduce_summary_prompt,
    summary_prompt,
)
from app.services.ai.schemas import ChunkNotes
from app.services.text_processing import (
    Chunk,
    Page,
    allowed_pages,
    chunk_pages,
    filter_pages,
    format_context,
    sample_chunks,
    select_relevant_chunks,
    verify_excerpt,
)

logger = logging.getLogger(__name__)

MAX_MAP_CHUNKS = 5

T = TypeVar("T")


@dataclass
class GenerationMeta:
    provider: str
    model: str
    included_pages: list[int] = field(default_factory=list)
    truncated: bool = False
    warnings: list[str] = field(default_factory=list)


@dataclass
class StudyResult(Generic[T]):
    result: T
    meta: GenerationMeta


def material_chunks(pages: list[Page], max_chars: int = 5_000) -> list[Chunk]:
    return chunk_pages(pages, max_chars=max_chars)


def _fit_chunks(chunks: list[Chunk], max_chars: int) -> list[Chunk]:
    """Bound the context. If needed, truncate chunks evenly rather than silently
    sampling only the start of a long document."""
    total = sum(chunk.length for chunk in chunks)
    if total <= max_chars:
        return chunks
    per_chunk = max(max_chars // max(len(chunks), 1), 800)
    fitted: list[Chunk] = []
    for chunk in chunks:
        if chunk.length <= per_chunk:
            fitted.append(chunk)
        else:
            cut = chunk.text[:per_chunk]
            boundary = max(cut.rfind(". "), cut.rfind("\n"))
            if boundary > per_chunk // 2:
                cut = cut[: boundary + 1]
            fitted.append(Chunk(index=chunk.index, page=chunk.page, text=cut.strip()))
    total = 0
    result: list[Chunk] = []
    for chunk in fitted:
        if result and total + chunk.length > max_chars:
            break
        result.append(chunk)
        total += chunk.length
    return result or [fitted[0]]


async def generate_summary(
    provider: AIProvider,
    pages: list[Page],
    settings: Settings,
    *,
    difficulty: str = "intermediate",
    focus: str | None = None,
) -> StudyResult[SummaryOutput]:
    chunks = material_chunks(pages, max_chars=max(2_500, settings.ai_max_input_chars // 3))
    if not chunks:
        raise ValueError("No material chunks")
    max_chars = settings.ai_max_input_chars
    total = sum(chunk.length for chunk in chunks)
    warnings: list[str] = []
    truncated = False

    if total <= max_chars:
        context_chunks = chunks
        context = format_context(context_chunks)
        result = await provider.generate_structured_output(
            summary_prompt(
                context=context,
                allowed_pages=allowed_pages(context_chunks),
                difficulty=difficulty,
                focus=focus,
            ),
            SummaryOutput,
            system=SYSTEM_PROMPT,
            max_tokens=1_800,
        )
        pages_used = allowed_pages(context_chunks)
    else:
        # Map-reduce coverage for longer documents. Bounded to slice count so a
        # huge PDF never produces an unbounded number of model calls.
        map_chunks = _spread_chunks(chunks, MAX_MAP_CHUNKS)
        per_chunk_budget = max(1_500, max_chars // len(map_chunks))
        notes_blocks: list[str] = []
        pages_used: set[int] = set()
        for chunk in map_chunks:
            fitted = _fit_chunks([chunk], per_chunk_budget)[0]
            context = format_context([fitted])
            notes = await provider.generate_structured_output(
                chunk_notes_prompt(context=context, page=chunk.page),
                ChunkNotes,
                system=SYSTEM_PROMPT,
                max_tokens=700,
            )
            label = f"Page {chunk.page}" if chunk.page is not None else "Excerpt"
            terms = ", ".join(notes.key_terms[:10])
            notes_blocks.append(
                f"{label}:\n{notes.notes}" + (f"\nKey terms: {terms}" if terms else "")
            )
            if chunk.page is not None:
                pages_used.add(chunk.page)

        if len(chunks) > len(map_chunks):
            truncated = True
            warnings.append(
                f"This document was summarised from {len(map_chunks)} evenly spaced sections; "
                "not every paragraph was sent to the model."
            )

        notes_context = "\n\n---\n\n".join(notes_blocks)
        result = await provider.generate_structured_output(
            reduce_summary_prompt(
                notes=notes_context,
                allowed_pages=sorted(pages_used),
                difficulty=difficulty,
                focus=focus,
            ),
            SummaryOutput,
            system=SYSTEM_PROMPT,
            max_tokens=1_800,
        )
        pages_used_list = sorted(pages_used)

    allowed = set(allowed_pages(chunks))
    result.source_pages = filter_pages(result.source_pages, allowed)
    meta = GenerationMeta(
        provider=provider.name,
        model=provider.model,
        included_pages=(
            sorted(pages_used) if isinstance(pages_used, set) else pages_used
        ),
        truncated=truncated,
        warnings=warnings,
    )
    return StudyResult(result=result, meta=meta)


def _spread_chunks(chunks: list[Chunk], limit: int) -> list[Chunk]:
    if len(chunks) <= limit:
        return chunks
    step = (len(chunks) - 1) / (limit - 1)
    return [chunks[round(i * step)] for i in range(limit)]


async def explain_concept(
    provider: AIProvider,
    pages: list[Page],
    settings: Settings,
    *,
    concept: str,
    difficulty: str = "intermediate",
    learning_goal: str | None = None,
) -> StudyResult[ExplanationOutput]:
    chunks = material_chunks(pages, max_chars=max(2_500, settings.ai_max_input_chars // 3))
    selected = select_relevant_chunks(
        chunks,
        f"{concept} {learning_goal or ''}".strip(),
        max_chars=settings.ai_max_input_chars,
        limit=6,
    )
    selected = _fit_chunks(selected, settings.ai_max_input_chars)
    result = await provider.generate_structured_output(
        explanation_prompt(
            concept=concept,
            context=format_context(selected),
            allowed_pages=allowed_pages(selected),
            difficulty=difficulty,
            learning_goal=learning_goal,
        ),
        ExplanationOutput,
        system=SYSTEM_PROMPT,
        max_tokens=1_800,
    )
    allowed = set(allowed_pages(chunks))
    result.source_pages = filter_pages(result.source_pages, allowed)
    if not result.grounded:
        result.source_pages = []
    return StudyResult(
        result=result,
        meta=GenerationMeta(
            provider=provider.name,
            model=provider.model,
            included_pages=allowed_pages(selected),
            truncated=sum(chunk.length for chunk in chunks) > settings.ai_max_input_chars,
        ),
    )


async def extract_key_concepts(
    provider: AIProvider,
    pages: list[Page],
    settings: Settings,
) -> StudyResult[ConceptsOutput]:
    chunks = material_chunks(pages, max_chars=max(2_500, settings.ai_max_input_chars // 3))
    selected = _fit_chunks(
        sample_chunks(chunks, max_chars=settings.ai_max_input_chars, max_chunks=6),
        settings.ai_max_input_chars,
    )
    result = await provider.generate_structured_output(
        concepts_prompt(
            context=format_context(selected),
            allowed_pages=allowed_pages(selected),
        ),
        ConceptsOutput,
        system=SYSTEM_PROMPT,
        max_tokens=2_000,
    )

    # Verify excerpts and pages against the actual extracted text. Anything the
    # model made up is removed rather than rendered as a quotation.
    for concept in result.concepts:
        verified_excerpt, actual_page = verify_excerpt(concept.excerpt, pages)
        concept.excerpt = verified_excerpt
        concept.page = actual_page
        if verified_excerpt is None:
            concept.page = None
    return StudyResult(
        result=result,
        meta=GenerationMeta(
            provider=provider.name,
            model=provider.model,
            included_pages=allowed_pages(selected),
            truncated=len(selected) < len(chunks),
        ),
    )


async def evaluate_answers(
    provider: AIProvider,
    *,
    quiz_title: str,
    score: int,
    total: int,
    incorrect: list[dict[str, str]],
) -> AnswerFeedbackOutput:
    """AI-generated explanatory feedback. Grading itself stays deterministic."""
    from app.services.ai.prompts import answer_feedback_prompt

    lines = []
    for item in incorrect[:15]:
        lines.append(
            f"- id={item['id']} | concept={item['concept']} | "
            f"question={item['question']} | student chose={item['selected']} | "
            f"correct={item['correct']} | explanation={item['explanation']}"
        )
    result = await provider.generate_structured_output(
        answer_feedback_prompt(
            quiz_title=quiz_title,
            score=score,
            total=total,
            incorrect="\n".join(lines),
        ),
        AnswerFeedbackOutput,
        system=SYSTEM_PROMPT,
        max_tokens=1_200,
    )
    valid_ids = {item["id"] for item in incorrect}
    result.question_feedback = {
        key: value
        for key, value in result.question_feedback.items()
        if key in valid_ids
    }
    return result


async def identify_weak_topics(
    provider: AIProvider,
    *,
    graded: list[dict[str, object]],
) -> WeakTopicsOutput:
    """AI prioritisation of weak topics, restricted to real topic labels."""
    from app.services.ai.prompts import weak_topics_prompt

    aggregates: dict[str, tuple[int, int]] = {}
    for item in graded:
        concept = str(item["concept"])
        attempted, correct = aggregates.get(concept, (0, 0))
        delta = 1 if item["is_correct"] else 0
        aggregates[concept] = (attempted + 1, correct + delta)
    if not aggregates:
        return WeakTopicsOutput(topics=[])

    lines = [
        f"- {concept}: {correct}/{attempted} correct"
        for concept, (attempted, correct) in sorted(aggregates.items())
    ]
    result = await provider.generate_structured_output(
        weak_topics_prompt(results="\n".join(lines)),
        WeakTopicsOutput,
        system=SYSTEM_PROMPT,
        max_tokens=900,
    )

    known = {concept.casefold(): concept for concept in aggregates}
    filtered = []
    for topic in result.topics:
        canonical = known.get(topic.topic.casefold())
        if canonical is None:
            continue
        attempted, correct = aggregates[canonical]
        if correct >= attempted:
            # Never label a fully correct topic as weak.
            continue
        topic.topic = canonical
        filtered.append(topic)
    result.topics = filtered
    return result
