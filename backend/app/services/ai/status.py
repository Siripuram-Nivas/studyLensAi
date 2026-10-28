"""Cached, real AI connectivity checks for the status endpoint."""

from __future__ import annotations

import hashlib
import time

from app.config import Settings
from app.services.ai.base import AIProvider, AIStatus
from app.services.ai.factory import build_ai_provider

_cache: dict[str, tuple[float, AIStatus]] = {}


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
    provider: AIProvider = build_ai_provider(settings)
    if provider.name == "disabled":
        return await provider.health_check()

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
