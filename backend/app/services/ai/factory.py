"""Provider factory and FastAPI dependency."""

from __future__ import annotations

from fastapi import Request

from app.config import Settings
from app.services.ai.base import AINotConfiguredError, AIProvider
from app.services.ai.openai_compatible import DisabledProvider, OpenAICompatibleProvider


def build_ai_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "disabled":
        return DisabledProvider()
    if not settings.ai_configured:
        return DisabledProvider()
    return OpenAICompatibleProvider(settings)


def get_ai_provider(request: Request) -> AIProvider:
    settings: Settings = request.app.state.settings
    provider = build_ai_provider(settings)
    if isinstance(provider, DisabledProvider):
        raise AINotConfiguredError(
            "No AI provider is configured. Set AI_PROVIDER, AI_MODEL and "
            "AI_BASE_URL on the backend, then restart it. See Settings for guidance."
        )
    return provider


def get_optional_ai_provider(request: Request) -> AIProvider:
    """Return the provider or the disabled sentinel.

    Used for optional enhancements (quiz feedback) so deterministic grading is
    never blocked by an AI outage.
    """
    settings: Settings = request.app.state.settings
    return build_ai_provider(settings)
