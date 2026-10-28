"""Cached, real AI connectivity checks for the status endpoint."""

from __future__ import annotations

import hashlib
import time

from app.config import Settings
from app.services.ai.base import AIStatus
from app.services.ai.factory import build_ai_provider

_cache: dict[str, tuple[float, AIStatus]] = {}


def _unconfigured_status(settings: Settings) -> AIStatus:
    """Describe what is missing without pretending a network check ran."""
    if settings.ai_provider == "disabled":
        detail = (
            "AI is disabled (AI_PROVIDER=disabled). Set AI_PROVIDER to "
            "openai_compatible or ollama to enable it."
        )
    else:
        missing: list[str] = []
        if not settings.ai_model.strip():
            missing.append("AI_MODEL")
        if not settings.resolved_ai_base_url:
            missing.append("AI_BASE_URL")
        if missing:
            detail = (
                f"AI is not configured. Set {' and '.join(missing)} on the backend, "
                "then restart the server."
            )
        else:
            detail = "AI is not configured."

    return AIStatus(
        configured=False,
        status="unconfigured",
        provider=settings.ai_provider,
        model=settings.ai_model,
        base_url=settings.resolved_ai_base_url,
        detail=detail,
        supports_vision=settings.ai_vision_enabled,
        supports_structured_output=False,
    )


def _cache_key(settings: Settings) -> str:
    key_material = "|".join(
        [
            settings.ai_provider,
            settings.ai_model,
            settings.resolved_ai_base_url,
            settings.ai_vision_enabled.__str__(),
            hashlib.sha256(settings.ai_api_key.encode("utf-8")).hexdigest()[:12],
        ]
    )
    return hashlib.sha256(key_material.encode("utf-8")).hexdigest()


async def get_ai_status(settings: Settings, *, force: bool = False) -> AIStatus:
    if not settings.ai_configured:
        return _unconfigured_status(settings)

    provider = build_ai_provider(settings)
    cache_key = _cache_key(settings)
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if not force and cached and now - cached[0] < settings.ai_status_cache_seconds:
        return cached[1]

    status = await provider.health_check()
    _cache[cache_key] = (now, status)
    return status


def clear_status_cache() -> None:
    _cache.clear()
