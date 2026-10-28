"""Shared pytest fixtures."""

from __future__ import annotations

import io
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.main import create_app
from app.services.ai.factory import get_ai_provider, get_optional_ai_provider
from tests.fakes import FakeAIProvider


def make_pdf(text: str) -> bytes:
    """Build a small, valid one-page PDF with extractable text."""
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 18 Tf 72 720 Td ({safe}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    pdf = b"%PDF-1.4\n"
    offsets: list[int] = []
    for index, body in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += f"{index} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode()
    pdf += b"0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref}\n%%EOF\n"
    ).encode()
    return pdf


def make_png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color="white").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{(tmp_path / 'studylens-test.db').as_posix()}",
        ai_provider="disabled",
        ai_model="",
        ai_base_url="",
        ai_api_key="",
        ai_timeout_seconds=5,
        ai_status_cache_seconds=0,
        environment="test",
    )


@pytest.fixture()
def app(settings: Settings):
    application = create_app(settings)
    yield application
    application.state.engine.dispose()


@pytest.fixture()
def client(app) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture()
def fake_ai(app) -> FakeAIProvider:
    provider = FakeAIProvider()
    app.dependency_overrides[get_ai_provider] = lambda: provider
    app.dependency_overrides[get_optional_ai_provider] = lambda: provider
    return provider


@pytest.fixture()
def material(client) -> dict:
    response = client.post(
        "/api/materials/text",
        json={
            "title": "Database normalization",
            "text": (
                "Normalization organizes columns and tables in a relational database to "
                "reduce redundancy and improve data integrity. First normal form requires "
                "atomic values. Second normal form removes partial dependencies."
            ),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
