"""Analytics and local data reset tests."""

from __future__ import annotations


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


def submit_answers(client, quiz: dict, fake_ai, correct: int, total: int) -> dict:
    correct_by_id = {
        question.id: question.correct_index
        for question in fake_ai.last_quiz.questions
    }
    answers = []
    for index, question in enumerate(quiz["questions"]):
        correct_index = correct_by_id[question["id"]]
        selected = correct_index if index < correct else (correct_index + 1) % 4
        answers.append({"question_id": question["id"], "selected_index": selected})
    response = client.post(
        f"/api/quizzes/{quiz['id']}/submit",
        json={"answers": answers, "duration_seconds": 30},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["score"] == correct
    assert body["total_questions"] == total
    return body


def test_empty_analytics_is_honest(client):
    overview = client.get("/api/analytics/overview")
    assert overview.status_code == 200
    body = overview.json()
    assert body["total_materials"] == 0
    assert body["total_quizzes"] == 0
    assert body["total_attempts"] == 0
    assert body["average_score"] is None
    assert body["performance"] == []
    assert body["recent_attempts"] == []

    topics = client.get("/api/analytics/topics")
    assert topics.status_code == 200
    assert topics.json() == {"topics": [], "total_topics": 0}


def test_analytics_are_rebuilt_from_stored_attempts(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    submit_answers(client, quiz, fake_ai, correct=3, total=5)

    overview = client.get("/api/analytics/overview").json()
    assert overview["total_materials"] == 1
    assert overview["total_quizzes"] == 1
    assert overview["total_attempts"] == 1
    assert overview["average_score"] == 60.0
    assert overview["total_questions_answered"] == 5
    assert overview["total_questions_correct"] == 3
    assert len(overview["performance"]) == 1
    assert overview["performance"][0]["accuracy"] == 60.0
    assert overview["recent_attempts"][0]["quiz_title"] == "Normalization practice"
    assert overview["recent_materials"][0]["title"] == "Database normalization"

    topics = client.get("/api/analytics/topics").json()
    assert topics["total_topics"] == 1
    topic = topics["topics"][0]
    assert topic["topic"] == "Normalization"
    assert topic["questions_attempted"] == 5
    assert topic["questions_correct"] == 3
    assert topic["accuracy"] == 60.0
    assert topic["strength"] == "developing"


def test_deleting_a_material_removes_its_analytics(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    submit_answers(client, quiz, fake_ai, correct=4, total=5)

    assert client.delete(f"/api/materials/{material['id']}").status_code == 204

    overview = client.get("/api/analytics/overview").json()
    assert overview["total_materials"] == 0
    assert overview["total_quizzes"] == 0
    assert overview["total_attempts"] == 0
    assert client.get("/api/analytics/topics").json()["topics"] == []


def test_reset_requires_exact_confirmation(client):
    response = client.post("/api/settings/reset", json={"confirm": "delete"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_reset_clears_all_local_data(client, material, fake_ai):
    quiz = generate_quiz(client, material["id"])
    submit_answers(client, quiz, fake_ai, correct=2, total=5)

    response = client.post("/api/settings/reset", json={"confirm": "DELETE"})
    assert response.status_code == 200
    deleted = response.json()["deleted"]
    assert deleted["materials"] == 1
    assert deleted["quizzes"] == 1
    assert deleted["attempts"] == 1
    assert deleted["topics"] == 1

    assert client.get("/api/materials").json() == []
    overview = client.get("/api/analytics/overview").json()
    assert overview["total_materials"] == 0
    assert overview["total_attempts"] == 0


def test_settings_endpoint_reports_limits_and_never_returns_api_key(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    body = response.json()
    assert body["app_name"] == "StudyLens AI"
    assert body["environment"] == "test"
    assert body["ai"]["configured"] is False
    assert body["limits"]["max_pdf_pages"] == 500
    assert body["deployment_warning"]
    assert "api_key" not in response.text.lower()
