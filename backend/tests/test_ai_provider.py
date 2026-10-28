"""AI provider adapter tests that never touch the network."""

from __future__ import annotations

import asyncio

import httpx

from app.config import Settings
from app.services.ai.base import AIStatus
from app.services.ai.openai_compatible import (
    OpenAICompatibleProvider,
    _normalize_model_id,
)


def _settings(**overrides) -> Settings:
    values = {
        "ai_provider": "openai_compatible",
        "ai_model": "gemini-3.8-flash",
        "ai_base_url": "https://example.test/v1",
        "ai_api_key": "test-key",
    }
    values.update(overrides)
    return Settings(**values)


class _FakeClient:
    def __init__(self, response: httpx.Response) -> None:
        self._response = response

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *exc_info: object) -> bool:
        return False

    async def get(
        self, url: str, headers: dict[str, str] | None = None
    ) -> httpx.Response:
        return self._response


def _health_check(monkeypatch, payload: dict) -> AIStatus:
    response = httpx.Response(
        200,
        json=payload,
        request=httpx.Request("GET", "https://example.test/v1/models"),
    )
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda *args, **kwargs: _FakeClient(response)
    )
    provider = OpenAICompatibleProvider(_settings())
    return asyncio.run(provider.health_check())


def test_model_id_prefix_is_normalized():
    assert _normalize_model_id("models/Gemini-3.8-Flash") == "gemini-3.8-flash"
    assert _normalize_model_id(" gemini-3.8-flash ") == "gemini-3.8-flash"


def test_health_check_accepts_gemini_prefixed_model_ids(monkeypatch):
    status = _health_check(
        monkeypatch,
        {"data": [{"id": "models/gemini-3.8-flash"}, {"id": "models/gemini-3.5-flash"}]},
    )

    assert status.status == "ready"
    assert status.model_available is True
    assert status.reachable is True


def test_health_check_reports_a_model_that_is_not_listed(monkeypatch):
    status = _health_check(
        monkeypatch,
        {"data": [{"id": "models/gemini-3.5-flash"}]},
    )

    assert status.status == "model_missing"
    assert status.model_available is False
    assert "AI_MODEL" in status.detail
