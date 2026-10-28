"""Study material ingestion endpoints."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import AppError, DocumentError
from app.schemas import MaterialDetail, MaterialListItem, MaterialTextCreate
from app.services.ai.factory import build_ai_provider
from app.services.analytics import rebuild_topic_performance
from app.services.documents import (
    extract_image_with_ocr,
    extract_image_with_vision,
    extract_pdf,
    extract_text_material,
    ocr_engine_available,
    validate_upload,
)
from app.services.materials import (
    create_material,
    get_material,
    list_materials,
    to_detail,
    to_list_item,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/materials", tags=["materials"])


@router.post(
    "/upload",
    response_model=MaterialDetail,
    status_code=status.HTTP_201_CREATED,
)
async def upload_material(
    request: Request,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> MaterialDetail:
    settings = request.app.state.settings
    if title is not None:
        title = title.strip()
        if not title:
            raise AppError(422, "invalid_title", "The title cannot be empty.")
        if len(title) > 200:
            raise AppError(422, "invalid_title", "The title is limited to 200 characters.")

    data = await file.read(settings.upload_limit_bytes + 1)
    if len(data) > settings.upload_limit_bytes:
        raise DocumentError(
            413,
            "file_too_large",
            f"The file exceeds the {settings.max_upload_mb} MB upload limit.",
        )

    kind, safe_name = validate_upload(
        file.filename, file.content_type, data, settings
    )

    if kind == "pdf":
        extracted = extract_pdf(data, settings)
    else:
        mime = (file.content_type or "").split(";")[0].strip().lower()
        if mime not in ("image/png", "image/jpeg", "image/jpg"):
            mime = "image/png" if safe_name.lower().endswith(".png") else "image/jpeg"
        provider = build_ai_provider(settings)
        if ocr_engine_available():
            extracted = extract_image_with_ocr(data, settings)
        elif provider.supports_vision:
            extracted = await extract_image_with_vision(data, mime, provider, settings)
        else:
            raise DocumentError(
                422,
                "ocr_unavailable",
                (
                    "Image OCR is not available on this server, and the configured "
                    "model does not accept images. Install Tesseract + pytesseract, "
                    "enable a vision model, or paste the text instead."
                ),
            )

    effective_title = title or Path(safe_name).stem[:200] or "Untitled study material"
    material = create_material(
        db,
        extracted=extracted,
        title=effective_title,
        original_filename=safe_name,
    )
    logger.info("Material created id=%s type=%s chars=%s", material.id, material.content_type, len(material.extracted_text))
    return to_detail(material)


@router.post("/text", response_model=MaterialDetail, status_code=status.HTTP_201_CREATED)
def create_text_material(
    payload: MaterialTextCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> MaterialDetail:
    settings = request.app.state.settings
    extracted = extract_text_material(payload.text, settings)
    material = create_material(
        db,
        extracted=extracted,
        title=payload.title.strip(),
        original_filename=None,
    )
    return to_detail(material)


@router.get("", response_model=list[MaterialListItem])
def get_materials(db: Session = Depends(get_db)) -> list[MaterialListItem]:
    return [to_list_item(material) for material in list_materials(db)]


@router.get("/{material_id}", response_model=MaterialDetail)
def get_material_detail(
    material_id: UUID, db: Session = Depends(get_db)
) -> MaterialDetail:
    return to_detail(get_material(db, str(material_id)))


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(
    material_id: UUID, db: Session = Depends(get_db)
) -> Response:
    material = get_material(db, str(material_id))
    db.delete(material)
    db.flush()
    rebuild_topic_performance(db)
    db.commit()
    logger.info("Material deleted id=%s", material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
