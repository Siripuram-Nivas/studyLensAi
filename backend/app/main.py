"""FastAPI application factory and entry point."""

from __future__ import annotations

import logging
from collections.abc import Generator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app import __version__
from app.config import Settings, get_settings
from app.database import (
    create_engine_for_url,
    create_session_factory,
    get_db,
    init_database,
)
from app.errors import error_payload, install_exception_handlers
from app.routers import analytics, health, materials, quizzes, settings as settings_router, study

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("studylens")

DESCRIPTION = """
StudyLens AI turns PDFs, images and pasted notes into grounded study explanations,
key concepts and multiple-choice quizzes. Quiz grading happens deterministically on
the server; AI is used only for generating and explaining study content.

This API is single-user by design and has no authentication layer.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = create_engine_for_url(settings.database_url)
    init_database(engine)
    session_factory = create_session_factory(engine)

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=DESCRIPTION,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory

    def database_session() -> Generator[Session, None, None]:
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = database_session

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
    )

    @app.middleware("http")
    async def secure_headers(request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                # Allow form overhead on top of the file-size limit.
                if int(content_length) > settings.upload_limit_bytes + 2 * 1024 * 1024:
                    return JSONResponse(
                        status_code=413,
                        content=error_payload(
                            "request_too_large",
                            "The request body is larger than the allowed size.",
                        ),
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content=error_payload("invalid_request", "Invalid Content-Length header."),
                )
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if request.url.path.startswith(settings.api_prefix):
            response.headers["Cache-Control"] = "no-store"
        return response

    install_exception_handlers(app)

    api_prefix = settings.api_prefix
    app.include_router(health.router, prefix=api_prefix)
    app.include_router(materials.router, prefix=api_prefix)
    app.include_router(study.router, prefix=api_prefix)
    app.include_router(quizzes.router, prefix=api_prefix)
    app.include_router(analytics.router, prefix=api_prefix)
    app.include_router(settings_router.router, prefix=api_prefix)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_payload(
                "internal_error",
                "An unexpected server error occurred. No document content was logged.",
            ),
        )

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": __version__,
            "documentation": f"{api_prefix}/docs",
            "health": f"{api_prefix}/health",
        }

    logger.info(
        "StudyLens API configured provider=%s model=%s ai_configured=%s",
        settings.ai_provider,
        settings.ai_model or "(none)",
        settings.ai_configured,
    )
    return app


app = create_app()
