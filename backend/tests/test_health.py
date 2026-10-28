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


def test_root_metadata(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["documentation"] == "/api/docs"
