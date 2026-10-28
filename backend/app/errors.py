"""Application errors and consistent API error envelopes."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class NotFoundError(AppError):
    def __init__(self, resource: str = "Resource") -> None:
        super().__init__(404, "not_found", f"{resource} was not found.")


class DocumentError(AppError):
    """A document could not be validated or read."""


class AIServiceError(AppError):
    """Base class for safe, user-facing AI integration failures."""


def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return payload


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = []
        for item in exc.errors():
            location = ".".join(str(part) for part in item.get("loc", []) if part != "body")
            details.append(
                {
                    "field": location or "request",
                    "message": item.get("msg", "Invalid value"),
                }
            )
        return JSONResponse(
            status_code=422,
            content=error_payload(
                "validation_error",
                "Some of the submitted values are invalid.",
                details,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        message = (
            "The requested resource was not found."
            if exc.status_code == 404
            else str(exc.detail)
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(code, message),
        )
