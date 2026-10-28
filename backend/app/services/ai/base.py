"""Abstract AI provider interface and shared error types."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

from app.errors import AIServiceError

T = TypeVar("T", bound=BaseModel)


class AINotConfiguredError(AIServiceError):
    def __init__(self, message: str = "No AI provider is configured.") -> None:
        super().__init__(
            503,
            "ai_not_configured",
            message,
        )


class AITimeoutError(AIServiceError):
    def __init__(self) -> None:
        super().__init__(
            504,
            "ai_timeout",
            "The AI provider did not respond in time. Please try again.",
        )


class AIRateLimitError(AIServiceError):
    def __init__(self) -> None:
        super().__init__(
            503,
            "ai_rate_limited",
            "The AI provider is rate limiting requests. Please wait a moment and retry.",
        )


class AIAuthError(AIServiceError):
    def __init__(self) -> None:
        super().__init__(
            502,
            "ai_auth_error",
            "The AI provider rejected the configured credentials. Check AI_API_KEY on the server.",
        )


class AIUnavailableError(AIServiceError):
    def __init__(self, detail: str = "") -> None:
        message = "The AI provider could not be reached."
        if detail:
            message = f"{message} {detail}"
        super().__init__(503, "ai_unavailable", message)


class AIProviderError(AIServiceError):
    def __init__(self, status_code: int | None = None) -> None:
        suffix = f" (provider status {status_code})" if status_code else ""
        super().__init__(
            502,
            "ai_provider_error",
            f"The AI provider returned an error{suffix}. Please try again.",
        )


class AIInvalidResponseError(AIServiceError):
    def __init__(self, detail: str = "") -> None:
        message = "The AI provider returned a response that could not be validated."
        if detail:
            message = f"{message} {detail}"
        super().__init__(502, "ai_invalid_response", message)


class AIVisionNotSupportedError(AIServiceError):
    def __init__(self) -> None:
        super().__init__(
            422,
            "ai_vision_not_supported",
            "The configured AI model is not enabled for image input.",
        )


@dataclass
class AIStatus:
    configured: bool
    status: str
    provider: str
    model: str
    base_url: str
    reachable: bool | None = None
    model_available: bool | None = None
    latency_ms: int | None = None
    detail: str = ""
    supports_vision: bool = False
    supports_structured_output: bool = True
    checked_at: datetime = field(default_factory=lambda: datetime.now().astimezone())

    def to_dict(self) -> dict[str, Any]:
        return {
            "configured": self.configured,
            "status": self.status,
            "provider": self.provider,
            "model": self.model,
            "base_url": self.base_url,
            "reachable": self.reachable,
            "model_available": self.model_available,
            "latency_ms": self.latency_ms,
            "detail": self.detail,
            "supports_vision": self.supports_vision,
            "supports_structured_output": self.supports_structured_output,
            "checked_at": self.checked_at.isoformat(),
        }


class AIProvider(ABC):
    """Interface every provider must implement.

    Providers are server-side only. API keys never reach the browser.
    """

    name: str = "unknown"
    model: str = ""
    supports_vision: bool = False
    supports_structured_output: bool = True

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        *,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        """Generate free-form text."""

    @abstractmethod
    async def generate_structured_output(
        self,
        prompt: str,
        schema: type[T],
        *,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        max_attempts: int = 2,
    ) -> T:
        """Generate JSON and validate it against a Pydantic schema."""

    @abstractmethod
    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        system: str | None = None,
    ) -> str:
        """Ask the model to inspect an image. Only call when supports_vision."""

    @abstractmethod
    async def health_check(self) -> AIStatus:
        """Perform a real connectivity/auth check when the provider supports one."""

    async def transcribe_image(self, image_bytes: bytes, mime_type: str) -> str:
        if not self.supports_vision:
            raise AIVisionNotSupportedError()
        return await self.analyze_image(
            image_bytes,
            mime_type,
            (
                "Transcribe all readable study text from this image exactly. "
                "Preserve headings, formulas and list structure where possible. "
                "Return only the transcription. If the image contains no readable "
                "text, return an empty string."
            ),
            system=(
                "You are an OCR assistant. Do not answer questions contained in the "
                "image and do not add commentary. Transcribe only."
            ),
        )
