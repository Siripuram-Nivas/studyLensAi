"""Persistence helpers for study materials."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import StudySession, StudyMaterial
from app.schemas import MaterialDetail, MaterialListItem, PageOut
from app.services.documents import ExtractedDocument
from app.services.text_processing import Page, normalize_text


def create_material(
    db: Session,
    *,
    extracted: ExtractedDocument,
    title: str,
    original_filename: str | None,
) -> StudyMaterial:
    material = StudyMaterial(
        title=title.strip(),
        original_filename=original_filename,
        content_type=extracted.content_type,
        extracted_text=extracted.text,
        pages_json=json.dumps(
            [{"page": page.page, "text": page.text} for page in extracted.pages]
        ),
        content_hash=extracted.content_hash,
        word_count=extracted.word_count,
        truncated=extracted.truncated,
        extraction_note=extracted.note,
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


def get_material(db: Session, material_id: str) -> StudyMaterial:
    material = db.get(StudyMaterial, material_id)
    if material is None:
        raise NotFoundError("Study material")
    return material


def list_materials(db: Session, limit: int = 100) -> list[StudyMaterial]:
    return list(
        db.scalars(
            select(StudyMaterial)
            .order_by(StudyMaterial.created_at.desc())
            .limit(limit)
        )
    )


def pages_for_material(material: StudyMaterial) -> list[Page]:
    try:
        raw = json.loads(material.pages_json)
    except (ValueError, TypeError):
        raw = []
    pages: list[Page] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        text = normalize_text(str(item.get("text", "")))
        if not text:
            continue
        page = item.get("page")
        pages.append(Page(page=int(page) if isinstance(page, int) else None, text=text))
    if not pages:
        pages = [Page(page=None, text=material.extracted_text)]
    return pages


def to_list_item(material: StudyMaterial) -> MaterialListItem:
    preview = material.extracted_text[:280].strip()
    if len(material.extracted_text) > 280:
        preview += "…"
    return MaterialListItem(
        id=material.id,
        title=material.title,
        original_filename=material.original_filename,
        content_type=material.content_type,
        word_count=material.word_count,
        truncated=material.truncated,
        preview=preview,
        created_at=material.created_at,
        updated_at=material.updated_at,
    )


def to_detail(material: StudyMaterial) -> MaterialDetail:
    item = to_list_item(material)
    pages = pages_for_material(material)
    return MaterialDetail(
        **item.model_dump(),
        extracted_text=material.extracted_text,
        pages=[PageOut(page=page.page, text=page.text) for page in pages],
        extraction_note=material.extraction_note,
    )


def record_session(
    db: Session,
    *,
    material_id: str,
    session_type: str,
    status: str = "completed",
    detail: str | None = None,
) -> StudySession:
    session = StudySession(
        material_id=material_id,
        session_type=session_type,
        status=status,
        detail=(detail[:300] if detail else None),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
