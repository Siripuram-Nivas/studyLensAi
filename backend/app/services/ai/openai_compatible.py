"""OpenAI-compatible chat completion provider.

This adapter deliberately uses only the widely implemented
`POST /chat/completions` contract. JSON mode and image input are optional and
must be enabled explicitly, because "OpenAI-compatible" servers do not all
implement every feature.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.services.ai.base import (
    AIAuthError,
    AIInvalidResponseError,
    AIProvider,
    AIProviderError,
    AIRateLimitError,
    AIStatus,
    AITimeoutError,
    AIUnavailableError,
    AIVisionNotSupportedError,
    T,
)

logger = logging.getLogger(__name__)

_JSON_INSTRUCTION = (
    "Return exactly one JSON object and nothing else. Do not wrap it in Markdown "
    "fences. It must conform to this JSON Schema:\n{schema}"
)


def _extract_json(raw: str) -> Any:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Some models add a sentence before the object. Locate the outermost
    # object without attempting to repair arbitrary text.
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise json.JSONDecodeError("No JSON object found", text, 0)


class OpenAICompatibleProvider(AIProvider):
    def __init__(self, settings: Settings) -> None:
        self.name = settings.ai_provider
        self.model = settings.ai_model.strip()
        self.base_url = settings.resolved_ai_base_url
        self.api_key = settings.ai_api_key.strip()
        self.timeout_seconds = settings.ai_timeout_seconds
        self.max_output_tokens = settings.ai_max_output_tokens
        self.temperature = settings.ai_temperature
        self.json_mode = settings.ai_json_mode
        self.supports_vision = settings.ai_vision_enabled
        self.supports_structured_output = True
        self._timeout = httpx.Timeout(
            settings.ai_timeout_seconds,
            connect=min(10.0, settings.ai_timeout_seconds),
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    @staticmethod
    def _safe_detail(response: httpx.Response) -> str:
        # Provider error bodies can be long and may echo request data. Only the
        # status and a short, sanitized hint are surfaced.
        try:
            body = response.json()
            if isinstance(body, dict):
                message = body.get("error", {}).get("message") or body.get("message")
                if isinstance(message, str):
                    return message[:180]
        except (ValueError, AttributeError):
            pass
        return response.reason_phrase[:180]

    async def _chat(
        self,
        messages: list[dict[str, Any]],
        *,
        max_tokens: int | None,
        temperature: float | None,
        json_mode: bool,
    ) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature if temperature is None else temperature,
            "max_tokens": max_tokens or self.max_output_tokens,
            "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        url = f"{self.base_url}/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.post(url, headers=self._headers(), json=payload)

                # Some compatible servers reject response_format even though
                # they can return JSON when instructed. Retry once without it.
                if (
                    json_mode
                    and response.status_code == 400
                    and "response_format" in response.text.lower()
                ):
                    payload.pop("response_format", None)
                    response = await client.post(
                        url, headers=self._headers(), json=payload
                    )
        except httpx.TimeoutException as exc:
            logger.warning("AI request timed out provider=%s model=%s", self.name, self.model)
            raise AITimeoutError() from exc
        except httpx.HTTPError as exc:
            logger.warning(
                "AI request failed provider=%s model=%s error=%s",
                self.name,
                self.model,
                type(exc).__name__,
            )
            raise AIUnavailableError() from exc

        if response.status_code in (401, 403):
            raise AIAuthError()
        if response.status_code == 429:
            raise AIRateLimitError()
        if response.status_code >= 400:
            logger.warning(
                "AI provider error status=%s provider=%s model=%s detail=%s",
                response.status_code,
                self.name,
                self.model,
                self._safe_detail(response),
            )
            raise AIProviderError(response.status_code)

        try:
            body = response.json()
            choice = body["choices"][0]
            content = choice.get("message", {}).get("content")
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise AIInvalidResponseError("The response did not contain a message.") from exc

        if isinstance(content, list):
            content = "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") in ("text", "output_text")
            )
        if not isinstance(content, str) or not content.strip():
            raise AIInvalidResponseError("The response message was empty.")
        return content

    async def generate_text(
        self,
        prompt: str,
        *,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> str:
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        return await self._chat(
            messages,
            max_tokens=max_tokens,
            temperature=temperature,
            json_mode=False,
        )

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
        schema_json = json.dumps(schema.model_json_schema(), separators=(",", ":"))
        instruction = _JSON_INSTRUCTION.format(schema=schema_json)
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": f"{prompt}\n\n{instruction}"})

        last_error = ""
        raw = ""
        for attempt in range(1, max_attempts + 1):
            raw = await self._chat(
                messages,
                max_tokens=max_tokens,
                temperature=temperature,
                json_mode=self.json_mode,
            )
            try:
                data = _extract_json(raw)
                return schema.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                last_error = str(exc)[:400]
                logger.warning(
                    "Invalid structured AI output provider=%s model=%s attempt=%s",
                    self.name,
                    self.model,
                    attempt,
                )
                if attempt < max_attempts:
                    messages = [
                        *messages,
                        {"role": "assistant", "content": raw[:6_000]},
                        {
                            "role": "user",
                            "content": (
                                "That response was invalid. Fix it and return only a "
                                "single JSON object matching the schema. Validation "
                                f"problem: {last_error}"
                            ),
                        },
                    ]

        raise AIInvalidResponseError("Please retry the request.")

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        prompt: str,
        *,
        system: str | None = None,
    ) -> str:
        if not self.supports_vision:
            raise AIVisionNotSupportedError()

        import base64

        encoded = base64.b64encode(image_bytes).decode("ascii")
        messages: list[dict[str, Any]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append(
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                    },
                ],
            }
        )
        return await self._chat(
            messages,
            max_tokens=self.max_output_tokens,
            temperature=0.0,
            json_mode=False,
        )

    async def health_check(self) -> AIStatus:
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                response = await client.get(
                    f"{self.base_url}/models", headers=self._headers()
                )
        except httpx.TimeoutException:
            return AIStatus(
                configured=True,
                status="unreachable",
                provider=self.name,
                model=self.model,
                base_url=self.base_url,
                reachable=False,
                detail="The provider did not answer the model status check in time.",
                supports_vision=self.supports_vision,
            )
        except httpx.HTTPError as exc:
            return AIStatus(
                configured=True,
                status="unreachable",
                provider=self.name,
                model=self.model,
                base_url=self.base_url,
                reachable=False,
                detail=f"Connection failed ({type(exc).__name__}). Check AI_BASE_URL and that the server is running.",
                supports_vision=self.supports_vision,
            )

        latency = int((time.perf_counter() - started) * 1000)
        if response.status_code in (401, 403):
            return AIStatus(
                configured=True,
                status="auth_error",
                provider=self.name,
                model=self.model,
                base_url=self.base_url,
                reachable=True,
                latency_ms=latency,
                detail="The provider is reachable but rejected the API key.",
                supports_vision=self.supports_vision,
            )
        if response.status_code != 200:
            return AIStatus(
                configured=True,
                status="error",
                provider=self.name,
                model=self.model,
                base_url=self.base_url,
                reachable=True,
                latency_ms=latency,
                detail=(
                    "The provider is reachable, but the /models status endpoint "
                    f"returned HTTP {response.status_code}."
                ),
                supports_vision=self.supports_vision,
            )

        model_available: bool | None = None
        detail = "Provider reachable. Model listing was not readable."
        try:
            body = response.json()
            items = body.get("data") if isinstance(body, dict) else None
            if isinstance(items, list):
                ids = {
                    str(item.get("id", ""))
                    for item in items
                    if isinstance(item, dict) and item.get("id")
                }
                model_available = self.model in ids
                if model_available:
                    detail = "Provider reachable and the configured model is available."
                else:
                    detail = (
                        "Provider reachable, but the configured model was not listed. "
                        "Verify AI_MODEL or pull the model on the server."
                    )
        except ValueError:
            detail = "Provider reachable, but the model listing was not valid JSON."

        status = "ready" if model_available else ("model_missing" if model_available is False else "ready")
        if model_available is None:
            status = "degraded"
        return AIStatus(
            configured=True,
            status=status,
            provider=self.name,
            model=self.model,
            base_url=self.base_url,
            reachable=True,
            model_available=model_available,
            latency_ms=latency,
            detail=detail,
            supports_vision=self.supports_vision,
        )


class DisabledProvider(AIProvider):
    """Sentinel used when AI is disabled; never performs network calls."""

    name = "disabled"
    model = ""
    supports_vision = False

    async def generate_text(self, *_args: Any, **_kwargs: Any) -> str:
        raise AIUnavailableError("AI is disabled (AI_PROVIDER=disabled).")

    async def generate_structured_output(self, *_args: Any, **_kwargs: Any) -> Any:
        raise AIUnavailableError("AI is disabled (AI_PROVIDER=disabled).")

    async def analyze_image(self, *_args: Any, **_kwargs: Any) -> str:
        raise AIUnavailableError("AI is disabled (AI_PROVIDER=disabled).")

    async def health_check(self) -> AIStatus:
        return AIStatus(
            configured=False,
            status="unconfigured",
            provider="disabled",
            model="",
            base_url="",
            detail="AI is disabled by configuration.",
            supports_structured_output=False,
        )
