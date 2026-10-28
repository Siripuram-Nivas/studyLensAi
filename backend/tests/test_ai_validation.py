"""Validation tests for structured AI output and provider JSON parsing."""

from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.services.ai.openai_compatible import _extract_json
from app.services.ai.schemas import (
    GeneratedQuestion,
    GeneratedQuiz,
    SummaryOutput,
    WeakTopicsOutput,
)


def test_extract_json_accepts_plain_object():
    assert _extract_json('{"overview": "ok"}') == {"overview": "ok"}


def test_extract_json_strips_markdown_fence():
    raw = '```json\n{"overview": "ok", "main_points": ["a"]}\n```'
    assert _extract_json(raw) == {"overview": "ok", "main_points": ["a"]}


def test_extract_json_recovers_object_after_prose():
    raw = 'Here is the result:\n{"overview": "ok"}\nThanks!'
    assert _extract_json(raw) == {"overview": "ok"}


def test_extract_json_rejects_non_json():
    with pytest.raises(json.JSONDecodeError):
        _extract_json("The model refused to answer.")


def test_summary_schema_requires_meaningful_overview():
    with pytest.raises(ValidationError):
        SummaryOutput(overview="Too short", main_points=["A point"])


def test_quiz_schema_rejects_duplicate_options():
    with pytest.raises(ValidationError):
        GeneratedQuestion(
            id="q1",
            question="Which normal form removes partial dependencies?",
            options=["2NF", "2NF", "3NF", "BCNF"],
            correct_index=0,
            explanation="2NF removes partial dependencies.",
            concept="Normalization",
        )


def test_quiz_schema_rejects_out_of_range_answer_index():
    with pytest.raises(ValidationError):
        GeneratedQuestion(
            id="q1",
            question="Which normal form removes partial dependencies?",
            options=["1NF", "2NF", "3NF", "BCNF"],
            correct_index=4,
            explanation="2NF removes partial dependencies.",
            concept="Normalization",
        )


def test_quiz_schema_rejects_duplicate_question_ids():
    question = GeneratedQuestion(
        id="q1",
        question="Which normal form removes partial dependencies?",
        options=["1NF", "2NF", "3NF", "BCNF"],
        correct_index=1,
        explanation="2NF removes partial dependencies.",
        concept="Normalization",
    )
    with pytest.raises(ValidationError):
        GeneratedQuiz(title="Normalization quiz", questions=[question, question])


def test_weak_topics_output_accepts_empty_list():
    parsed = WeakTopicsOutput.model_validate({"topics": []})
    assert parsed.topics == []
