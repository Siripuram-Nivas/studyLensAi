"""Quiz generation, answer secrecy, grading and persistence tests."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.errors import AppError
from app.models import Quiz, QuizAttempt
from app.services.ai.base import AIInvalidResponseError
from app.services.ai.schemas import GeneratedQuestion
from app.services.quiz_engine import grade_answers


def generate_quiz(client, material_id: str, count: int = 5) -> dict:
    response = client.post(
        "/api/quizzes/generate",
        json={
            "material_id": material_id,
            "num_questions": count,
            "difficulty": "intermediate",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_quiz_response_never_includes_answers(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    assert quiz["num_questions"] == 5
    assert len(quiz["questions"]) == 5
    for question in quiz["questions"]:
        assert set(question.keys()) == {"id", "question", "options", "concept"}
        assert len(question["options"]) == 4
        assert "correct_index" not in question
        assert "explanation" not in question

    fetched = client.get(f"/api/quizzes/{quiz['id']}")
    assert fetched.status_code == 200
    assert "correct_index" not in fetched.text
    assert "explanation" not in fetched.text


def test_submit_grades_on_server_and_persists_attempt(client, app, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    questions = fake_ai.last_quiz.questions
    answers = []
    for index, question in enumerate(questions):
        selected = question.correct_index
        if index >= 3:
            selected = (selected + 1) % 4
        answers.append(
            {"question_id": question.id, "selected_index": selected}
        )

    response = client.post(
        f"/api/quizzes/{quiz['id']}/submit",
        json={"answers": answers, "duration_seconds": 42},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["score"] == 3
    assert body["total_questions"] == 5
    assert body["percentage"] == 60.0
    assert len(body["graded_answers"]) == 5
    assert sum(1 for item in body["graded_answers"] if item["is_correct"]) == 3
    assert all("correct_index" in item for item in body["graded_answers"])
    assert body["duration_seconds"] == 42
    assert body["ai_feedback"]["summary"]

    with app.state.session_factory() as db:
        assert db.scalar(select(func.count()).select_from(QuizAttempt)) == 1
        assert db.scalar(select(func.count()).select_from(Quiz)) == 1
        attempt = db.scalars(select(QuizAttempt)).one()
        assert attempt.score == 3


def test_grading_is_deterministic_for_known_answers():
    questions = [
        GeneratedQuestion(
            id="q1",
            question="Which normal form removes partial dependencies?",
            options=["1NF", "2NF", "3NF", "BCNF"],
            correct_index=1,
            explanation="2NF removes partial dependencies on a composite key.",
            concept="Normalization",
        ),
        GeneratedQuestion(
            id="q2",
            question="What does normalization primarily reduce?",
            options=["Redundancy", "Latency", "Storage cost of indexes", "CPU clocks"],
            correct_index=0,
            explanation="Normalization reduces redundant data.",
            concept="Normalization",
        ),
    ]
    graded = grade_answers(
        questions,
        [
            {"question_id": "q1", "selected_index": 1},
            {"question_id": "q2", "selected_index": 2},
        ],
    )
    assert [item["is_correct"] for item in graded] == [True, False]
    assert graded[0]["correct_index"] == 1
    assert graded[1]["correct_index"] == 0


def test_client_cannot_supply_correctness_flags(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    answers = [
        {
            "question_id": question["id"],
            "selected_index": 0,
            "is_correct": True,
            "score": 5,
            "correct_index": 0,
        }
        for question in quiz["questions"]
    ]
    # Extra fields are ignored by the request schema; the server recomputes.
    response = client.post(
        f"/api/quizzes/{quiz['id']}/submit", json={"answers": answers}
    )
    assert response.status_code == 200
    body = response.json()
    recomputed = sum(1 for item in body["graded_answers"] if item["is_correct"])
    assert body["score"] == recomputed
    assert body["score"] != 5 or body["total_questions"] == 5


@pytest.mark.parametrize(
    "mutation, code",
    [
        (lambda answers: answers[:-1], "incomplete_answers"),
        (
            lambda answers: [
                *answers[:-1],
                {"question_id": "not-in-quiz", "selected_index": 1},
            ],
            "unknown_question",
        ),
        (
            lambda answers: [
                {"question_id": answers[0]["question_id"], "selected_index": 1},
                {"question_id": answers[0]["question_id"], "selected_index": 2},
                *answers[1:],
            ],
            "duplicate_answer",
        ),
    ],
)
def test_invalid_submissions_are_rejected(
    client, material, fake_ai, mutation, code
):
    quiz = generate_quiz(client, material["id"])
    answers = [
        {"question_id": question["id"], "selected_index": 0}
        for question in quiz["questions"]
    ]
    response = client.post(
        f"/api/quizzes/{quiz['id']}/submit", json={"answers": mutation(answers)}
    )
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == code


def test_grade_answers_rejects_missing_and_duplicate():
    question = GeneratedQuestion(
        id="q1",
        question="A valid question about normalization?",
        options=["A", "B", "C", "D"],
        correct_index=0,
        explanation="Because A is correct.",
        concept="Normalization",
    )
    with pytest.raises(AppError) as missing:
        grade_answers([question], [])
    assert missing.value.code == "incomplete_answers"

    with pytest.raises(AppError) as duplicate:
        grade_answers(
            [question],
            [
                {"question_id": "q1", "selected_index": 0},
                {"question_id": "q1", "selected_index": 1},
            ],
        )
    assert duplicate.value.code == "duplicate_answer"


def test_quiz_generation_requires_configured_ai(client, material):
    response = client.post(
        "/api/quizzes/generate",
        json={
            "material_id": material["id"],
            "num_questions": 5,
            "difficulty": "beginner",
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "ai_not_configured"


def test_quiz_generation_failure_is_reported(client, material, fake_ai):
    fake_ai.error = AIInvalidResponseError("The provider returned malformed JSON.")
    response = client.post(
        "/api/quizzes/generate",
        json={
            "material_id": material["id"],
            "num_questions": 5,
            "difficulty": "beginner",
        },
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_invalid_response"


def test_missing_quiz_returns_404(client):
    response = client.get("/api/quizzes/00000000-0000-4000-8000-000000000000")
    assert response.status_code == 404


def test_attempts_endpoint_lists_persisted_attempts(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    answers = [
        {"question_id": question.id, "selected_index": question.correct_index}
        for question in fake_ai.last_quiz.questions
    ]
    submit = client.post(f"/api/quizzes/{quiz['id']}/submit", json={"answers": answers})
    assert submit.status_code == 200

    attempts = client.get("/api/quizzes/attempts")
    assert attempts.status_code == 200
    body = attempts.json()
    assert len(body) == 1
    assert body[0]["score"] == 5
    assert body[0]["percentage"] == 100.0
