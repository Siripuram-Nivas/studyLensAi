"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings.

    Secrets are read from the environment (or a local .env file) and are never
    exposed through API responses. See the project README for a setup guide.
    """

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "StudyLens AI"
    environment: str = "development"
    api_prefix: str = "/api"

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'studylens.db').as_posix()}"

    # Comma-separated list of allowed browser origins.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI provider configuration.
    # "openai_compatible" works with any hosted or self-hosted server exposing
    # the OpenAI /chat/completions contract. "ollama" is a convenience preset
    # for Ollama's OpenAI-compatible endpoint. "disabled" turns off AI calls.
    ai_provider: str = "openai_compatible"
    ai_model: str = ""
    ai_base_url: str = ""
    ai_api_key: str = ""
    ai_timeout_seconds: float = 60.0
    ai_max_output_tokens: int = 2000
    ai_max_input_chars: int = 12_000
    ai_temperature: float = 0.2
    ai_json_mode: bool = True
    # Only enable when the configured model actually accepts image inputs.
    ai_vision_enabled: bool = False
    ai_status_cache_seconds: int = 20

    max_upload_mb: int = 10
    max_text_chars: int = 200_000
    max_pdf_pages: int = 500
    max_extracted_chars: int = 400_000
    min_text_chars: int = 40

    @field_validator("ai_provider")
    @classmethod
    def _validate_provider(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"openai_compatible", "ollama", "disabled"}
        if normalized not in allowed:
            raise ValueError(
                "AI_PROVIDER must be one of: openai_compatible, ollama, disabled"
            )
        return normalized

    @field_validator("ai_timeout_seconds", "ai_temperature")
    @classmethod
    def _positive_numbers(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Value must be greater than zero")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def resolved_ai_base_url(self) -> str:
        if self.ai_base_url.strip():
            return self.ai_base_url.strip().rstrip("/")
        if self.ai_provider == "ollama":
            return "http://localhost:11434/v1"
        if self.ai_provider == "openai_compatible":
            return "https://api.openai.com/v1"
        return ""

    @property
    def ai_configured(self) -> bool:
        return bool(
            self.ai_provider != "disabled"
            and self.ai_model.strip()
            and self.resolved_ai_base_url
        )

    @property
    def ai_requires_key(self) -> bool:
        # Local and self-hosted OpenAI-compatible servers often run without a
        # key. We do not demand one up-front, but a hosted service will report
        # an authentication error through the real health check.
        return self.ai_provider == "openai_compatible" and self.ai_base_url.strip() == ""

    @property
    def upload_limit_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
