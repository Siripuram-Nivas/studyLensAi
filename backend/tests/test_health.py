"""Health and AI configuration status tests."""

from __future__ import annotations


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["ai_configured"] is False


def test_ai_status_is_unconfigured_without_credentials(client):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["status"] == "unconfigured"
    assert body["provider"] == "disabled"
    assert body["model"] == ""
    assert "disabled" in body["detail"].lower()
    assert body["supports_structured_output"] is False


def test_ai_status_reports_missing_model(client, app):
    app.state.settings = app.state.settings.model_copy(
        update={
            "ai_provider": "openai_compatible",
            "ai_model": "",
            "ai_base_url": "",
        }
    )

    response = client.get("/api/ai/status")

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["status"] == "unconfigured"
    assert body["provider"] == "openai_compatible"
    assert body["model"] == ""
    assert "AI_MODEL" in body["detail"]


def test_root_metadata(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["documentation"] == "/api/docs"
