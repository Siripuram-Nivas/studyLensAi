"""Study engine endpoint tests using a mocked provider."""

from __future__ import annotations

from sqlalchemy import select

from app.models import StudySession
from app.services.ai.base import AIAuthError, AITimeoutError
from tests.conftest import make_pdf


def test_summary_uses_configured_provider(client, material, fake_ai):
    response = client.post(
        f"/api/materials/{material['id']}/summary",
        json={"difficulty": "beginner", "focus": "normal forms"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["material_id"] == material["id"]
    assert body["result"]["overview"]
    assert body["result"]["main_points"]
    assert body["generation"]["provider"] == "fake"
    assert body["generation"]["model"] == "fake-test-model"
    # Pasted text has no page labels, so invented page citations are filtered.
    assert body["result"]["source_pages"] == []
    assert "SummaryOutput" in fake_ai.structured_calls


def test_pdf_summary_keeps_valid_page_citation(client, fake_ai):
    upload = client.post(
        "/api/materials/upload",
        files={
            "file": (
                "normalization.pdf",
                make_pdf(
                    "Normalization reduces redundancy in relational databases and improves "
                    "data integrity for students designing schemas."
                ),
                "application/pdf",
            )
        },
    )
    assert upload.status_code == 201
    material_id = upload.json()["id"]

    response = client.post(
        f"/api/materials/{material_id}/summary", json={"difficulty": "intermediate"}
    )
    assert response.status_code == 200
    assert response.json()["result"]["source_pages"] == [1]


def test_explanation_endpoint(client, material, fake_ai):
    response = client.post(
        f"/api/materials/{material['id']}/explain",
        json={
            "concept": "Normalization",
            "difficulty": "beginner",
            "learning_goal": "mid-semester exam",
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["concept"] == "Normalization"
    assert result["grounded"] is True
    assert result["source_pages"] == []


def test_concepts_verifies_quotes(client, material, fake_ai):
    response = client.post(f"/api/materials/{material['id']}/concepts", json={})
    assert response.status_code == 200, response.text
    concepts = response.json()["result"]["concepts"]
    assert concepts[0]["excerpt"]
    assert concepts[0]["page"] is None


def test_concepts_drops_fabricated_quotes(client, material, fake_ai):
    fake_ai.concept_excerpt = "This sentence does not exist in the material at all."
    response = client.post(f"/api/materials/{material['id']}/concepts", json={})
    assert response.status_code == 200
    concept = response.json()["result"]["concepts"][0]
    assert concept["excerpt"] is None
    assert concept["page"] is None


def test_ai_not_configured_returns_clear_error(client, material):
    response = client.post(
        f"/api/materials/{material['id']}/summary", json={"difficulty": "beginner"}
    )
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "ai_not_configured"
    assert "AI_PROVIDER" in error["message"] or "provider" in error["message"].lower()


def test_ai_timeout_returns_504_and_records_failed_session(
    client, app, material, fake_ai
):
    fake_ai.error = AITimeoutError()
    response = client.post(
        f"/api/materials/{material['id']}/summary", json={"difficulty": "beginner"}
    )
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "ai_timeout"

    with app.state.session_factory() as db:
        sessions = db.scalars(select(StudySession)).all()
    assert any(
        session.session_type == "summary" and session.status == "failed"
        for session in sessions
    )


def test_ai_auth_failure_is_safe(client, material, fake_ai):
    fake_ai.error = AIAuthError()
    response = client.post(
        f"/api/materials/{material['id']}/summary", json={"difficulty": "beginner"}
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_auth_error"
    assert "test-key" not in response.text


def test_missing_material_returns_404(client, fake_ai):
    response = client.post(
        "/api/materials/00000000-0000-4000-8000-000000000000/summary",
        json={"difficulty": "beginner"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_malformed_material_id_returns_422(client, fake_ai):
    response = client.post(
        "/api/materials/not-a-uuid/summary", json={"difficulty": "beginner"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
