"""Material ingestion and validation tests."""

from __future__ import annotations

from datetime import datetime

from tests.conftest import make_pdf, make_png

TEXT = (
    "Normalization organizes columns and tables in a relational database to reduce "
    "redundancy and improve data integrity. First normal form requires atomic values."
)


def test_create_text_material(client):
    response = client.post(
        "/api/materials/text",
        json={"title": "Normalization notes", "text": TEXT},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Normalization notes"
    assert body["content_type"] == "text"
    assert body["original_filename"] is None
    assert "Normalization" in body["extracted_text"]
    assert body["pages"][0]["page"] is None
    assert body["word_count"] > 10

    # Timestamps must be timezone-aware so browsers do not shift them by the
    # server's UTC offset when rendering relative times.
    created = datetime.fromisoformat(body["created_at"].replace("Z", "+00:00"))
    assert created.tzinfo is not None


def test_reject_short_text(client):
    response = client.post(
        "/api/materials/text",
        json={"title": "Too short", "text": "Not enough material"},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert any("text" in detail["field"] for detail in error["details"])


def test_reject_blank_title(client):
    response = client.post(
        "/api/materials/text",
        json={"title": "   ", "text": TEXT},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_upload_valid_pdf_extracts_pages(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("lecture.pdf", make_pdf(TEXT), "application/pdf")},
        data={"title": "Lecture PDF"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["content_type"] == "pdf"
    assert body["original_filename"] == "lecture.pdf"
    assert body["pages"][0]["page"] == 1
    assert "Normalization" in body["extracted_text"]


def test_upload_blank_pdf_is_rejected_with_ocr_guidance(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("scanned.pdf", make_pdf(""), "application/pdf")},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "pdf_no_extractable_text"
    assert "scanned" in error["message"].lower()


def test_reject_unsupported_extension(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("notes.txt", b"plain text notes", "text/plain")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_file_type"


def test_reject_empty_file(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "empty_file"


def test_reject_mismatched_file_signature(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("fake.pdf", make_png(), "application/pdf")},
    )
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "invalid_file_signature"


def test_reject_oversized_file(client, settings):
    oversized = b"%PDF-" + b"0" * (settings.upload_limit_bytes + 1)
    response = client.post(
        "/api/materials/upload",
        files={"file": ("huge.pdf", oversized, "application/pdf")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_image_without_ocr_or_vision_is_rejected_honestly(client, monkeypatch):
    monkeypatch.setattr("app.routers.materials.ocr_engine_available", lambda: False)
    response = client.post(
        "/api/materials/upload",
        files={"file": ("notes.png", make_png(), "image/png")},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "ocr_unavailable"
    assert "paste" in error["message"].lower()


def test_list_detail_and_delete_material(client, material):
    listing = client.get("/api/materials")
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert "extracted_text" not in listing.json()[0]

    detail = client.get(f"/api/materials/{material['id']}")
    assert detail.status_code == 200
    assert detail.json()["extracted_text"] == material["extracted_text"]

    deleted = client.delete(f"/api/materials/{material['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/materials/{material['id']}").status_code == 404
    assert client.get("/api/materials").json() == []


def test_missing_and_malformed_material_ids(client):
    malformed = client.get("/api/materials/not-a-uuid")
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_error"

    missing = client.get("/api/materials/00000000-0000-4000-8000-000000000000")
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"


def test_title_defaults_to_filename(client):
    response = client.post(
        "/api/materials/upload",
        files={"file": ("signals-notes.pdf", make_pdf(TEXT), "application/pdf")},
    )
    assert response.status_code == 201
    assert response.json()["title"] == "signals-notes"
