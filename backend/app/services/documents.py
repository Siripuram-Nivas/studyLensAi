"""Study material ingestion: validation, PDF extraction and OCR."""

from __future__ import annotations

import hashlib
import io
import logging
import shutil
from dataclasses import dataclass, field
from pathlib import Path

try:  # PyMuPDF gives the best speed/layout handling when available.
    import fitz  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - exercised only on environments without PyMuPDF
    fitz = None  # type: ignore[assignment]
from PIL import Image, UnidentifiedImageError

from app.config import Settings
from app.errors import DocumentError
from app.services.ai.base import AIProvider, AIVisionNotSupportedError
from app.services.text_processing import Page, count_words, normalize_text

logger = logging.getLogger(__name__)

PDF = "pdf"
IMAGE = "image"
TEXT = "text"

ALLOWED_EXTENSIONS = {".pdf": PDF, ".png": IMAGE, ".jpg": IMAGE, ".jpeg": IMAGE}
ALLOWED_MIME_TYPES = {
    "application/pdf": PDF,
    "image/png": IMAGE,
    "image/jpeg": IMAGE,
    "image/jpg": IMAGE,
    "application/octet-stream": None,
    "binary/octet-stream": None,
    "": None,
}
MAX_IMAGE_PIXELS = 40_000_000


@dataclass
class ExtractedDocument:
    text: str
    pages: list[Page]
    content_type: str
    word_count: int
    truncated: bool = False
    note: str | None = None
    original_filename: str | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()


def sanitize_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    name = Path(filename.replace("\\", "/")).name
    name = "".join(ch for ch in name if ch.isprintable()).strip()
    return name[:255] or None


def sniff_kind(data: bytes) -> str | None:
    if data.startswith(b"%PDF-"):
        return PDF
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return IMAGE
    if data.startswith(b"\xff\xd8\xff"):
        return IMAGE
    return None


def validate_upload(
    filename: str | None, content_type: str | None, data: bytes, settings: Settings
) -> tuple[str, str]:
    """Validate extension, MIME type, magic bytes and size.

    Returns (kind, safe_filename). Nothing is written to disk.
    """
    safe_name = sanitize_filename(filename)
    if not safe_name:
        raise DocumentError(400, "invalid_filename", "The uploaded file needs a filename.")

    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise DocumentError(
            415,
            "unsupported_file_type",
            "Only PDF, PNG and JPEG files are supported. You can also paste text.",
        )

    mime = (content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED_MIME_TYPES:
        raise DocumentError(
            415,
            "unsupported_file_type",
            "The uploaded file type is not supported. Use PDF, PNG or JPEG.",
        )
    if ALLOWED_MIME_TYPES[mime] is not None and ALLOWED_MIME_TYPES[mime] != ALLOWED_EXTENSIONS[extension]:
        raise DocumentError(
            415,
            "file_type_mismatch",
            "The file extension and MIME type do not match.",
        )

    if not data:
        raise DocumentError(400, "empty_file", "The uploaded file is empty.")
    if len(data) > settings.upload_limit_bytes:
        raise DocumentError(
            413,
            "file_too_large",
            f"The file exceeds the {settings.max_upload_mb} MB upload limit.",
        )

    kind = sniff_kind(data)
    expected_kind = ALLOWED_EXTENSIONS[extension]
    if kind != expected_kind or kind is None:
        raise DocumentError(
            415,
            "invalid_file_signature",
            "The file content does not match its extension. The upload may be corrupt.",
        )
    return kind, safe_name


def _truncate_pages(
    pages: list[Page], max_chars: int
) -> tuple[list[Page], bool]:
    total = 0
    kept: list[Page] = []
    for page in pages:
        remaining = max_chars - total
        if remaining <= 0:
            return kept, True
        if len(page.text) > remaining:
            kept.append(Page(page=page.page, text=page.text[:remaining].rstrip()))
            return kept, True
        kept.append(page)
        total += len(page.text)
    return kept, False


def _extract_pdf_pages(data: bytes, settings: Settings) -> list[Page]:
    if fitz is not None:
        return _extract_pdf_pages_fitz(data, settings)
    return _extract_pdf_pages_pypdf(data, settings)


def _extract_pdf_pages_fitz(data: bytes, settings: Settings) -> list[Page]:
    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:  # PyMuPDF raises several internal exception types
        logger.info("PDF open failed: %s", type(exc).__name__)
        raise DocumentError(
            422, "invalid_pdf", "The PDF could not be opened. It may be corrupt."
        ) from exc

    try:
        if document.needs_pass:
            raise DocumentError(
                422,
                "encrypted_pdf",
                "This PDF is password protected. Remove the password or paste the text instead.",
            )
        if document.page_count == 0:
            raise DocumentError(422, "empty_pdf", "The PDF contains no pages.")
        if document.page_count > settings.max_pdf_pages:
            raise DocumentError(
                422,
                "pdf_too_long",
                f"The PDF has {document.page_count} pages, above the {settings.max_pdf_pages}-page limit.",
            )

        pages: list[Page] = []
        for page_number, page in enumerate(document, start=1):
            try:
                raw = page.get_text("text")
            except Exception:
                raw = ""
            cleaned = normalize_text(raw)
            if cleaned:
                pages.append(Page(page=page_number, text=cleaned))
        return pages
    finally:
        document.close()


def _extract_pdf_pages_pypdf(data: bytes, settings: Settings) -> list[Page]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - requirements include pypdf
        raise DocumentError(
            500,
            "pdf_support_missing",
            "PDF extraction is not installed on the server. Install backend requirements.",
        ) from exc

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise DocumentError(
                422,
                "encrypted_pdf",
                "This PDF is password protected. Remove the password or paste the text instead.",
            )
        if len(reader.pages) == 0:
            raise DocumentError(422, "empty_pdf", "The PDF contains no pages.")
        if len(reader.pages) > settings.max_pdf_pages:
            raise DocumentError(
                422,
                "pdf_too_long",
                f"The PDF has {len(reader.pages)} pages, above the {settings.max_pdf_pages}-page limit.",
            )
        pages: list[Page] = []
        for page_number, page in enumerate(reader.pages, start=1):
            try:
                raw = page.extract_text() or ""
            except Exception:
                raw = ""
            cleaned = normalize_text(raw)
            if cleaned:
                pages.append(Page(page=page_number, text=cleaned))
        return pages
    except DocumentError:
        raise
    except Exception as exc:
        logger.info("PDF open failed: %s", type(exc).__name__)
        raise DocumentError(
            422, "invalid_pdf", "The PDF could not be opened. It may be corrupt."
        ) from exc


def extract_pdf(data: bytes, settings: Settings) -> ExtractedDocument:
    pages = _extract_pdf_pages(data, settings)

    combined = "\n\n".join(page.text for page in pages).strip()
    if len(combined) < settings.min_text_chars:
        raise DocumentError(
            422,
            "pdf_no_extractable_text",
            (
                "No readable text could be extracted from this PDF. It is probably a "
                "scanned image. Paste the text, upload a clear PNG/JPEG when OCR is "
                "available, or use a text-based PDF."
            ),
        )

    pages, truncated = _truncate_pages(pages, settings.max_extracted_chars)
    combined = "\n\n".join(page.text for page in pages).strip()
    note = None
    warnings: list[str] = []
    if truncated:
        note = (
            "The document was longer than the safe extraction limit; only the "
            "beginning is stored. Some later content is not searchable."
        )
        warnings.append(note)

    return ExtractedDocument(
        text=combined,
        pages=pages,
        content_type=PDF,
        word_count=count_words(combined),
        truncated=truncated,
        note=note,
        warnings=warnings,
    )


def ocr_engine_available() -> bool:
    try:
        import pytesseract  # noqa: F401
    except ImportError:
        return False
    return shutil.which("tesseract") is not None


def _validate_image(data: bytes) -> None:
    try:
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            if width * height > MAX_IMAGE_PIXELS:
                raise DocumentError(
                    413,
                    "image_too_large",
                    "The image dimensions are too large to process safely.",
                )
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            image.load()
    except DocumentError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise DocumentError(
            422, "invalid_image", "The image could not be read. It may be corrupt."
        ) from exc


def extract_image_with_ocr(data: bytes, settings: Settings) -> ExtractedDocument:
    """Run local Tesseract OCR. Raises if the engine is unavailable."""
    _validate_image(data)
    try:
        import pytesseract
        from PIL import Image as PILImage
    except ImportError as exc:
        raise DocumentError(
            422,
            "ocr_unavailable",
            "Local OCR is not installed on the server.",
        ) from exc

    with PILImage.open(io.BytesIO(data)) as image:
        text = pytesseract.image_to_string(image)

    cleaned = normalize_text(text)
    if len(cleaned) < settings.min_text_chars:
        raise DocumentError(
            422,
            "ocr_no_text",
            (
                "OCR ran but found too little readable text. Try a clearer image, "
                "a text-based PDF, or paste the text directly."
            ),
        )
    pages = [Page(page=1, text=cleaned)]
    if len(cleaned) > settings.max_extracted_chars:
        cleaned = cleaned[: settings.max_extracted_chars]
        pages = [Page(page=1, text=cleaned)]
        note = "The OCR text exceeded the safe extraction limit and was truncated."
        return ExtractedDocument(
            text=cleaned,
            pages=pages,
            content_type=IMAGE,
            word_count=count_words(cleaned),
            truncated=True,
            note=note,
            warnings=[note],
        )
    return ExtractedDocument(
        text=cleaned,
        pages=pages,
        content_type=IMAGE,
        word_count=count_words(cleaned),
    )


async def extract_image_with_vision(
    data: bytes, mime_type: str, provider: AIProvider, settings: Settings
) -> ExtractedDocument:
    """Transcribe an image with a vision-capable model (only when enabled)."""
    _validate_image(data)
    if not provider.supports_vision:
        raise AIVisionNotSupportedError()
    try:
        raw = await provider.transcribe_image(data, mime_type)
    except AIVisionNotSupportedError:
        raise
    except Exception:
        logger.warning("Vision transcription failed")
        raise
    cleaned = normalize_text(raw)
    if len(cleaned) < settings.min_text_chars:
        raise DocumentError(
            422,
            "vision_no_text",
            (
                "The vision model did not return enough readable text. Check that the "
                "image is clear and contains study notes."
            ),
        )
    if len(cleaned) > settings.max_extracted_chars:
        cleaned = cleaned[: settings.max_extracted_chars]
        note = "The transcribed text exceeded the safe extraction limit and was truncated."
        return ExtractedDocument(
            text=cleaned,
            pages=[Page(page=1, text=cleaned)],
            content_type=IMAGE,
            word_count=count_words(cleaned),
            truncated=True,
            note=note,
            warnings=[note],
        )
    return ExtractedDocument(
        text=cleaned,
        pages=[Page(page=1, text=cleaned)],
        content_type=IMAGE,
        word_count=count_words(cleaned),
    )


def extract_text_material(raw_text: str, settings: Settings) -> ExtractedDocument:
    cleaned = normalize_text(raw_text)
    if len(cleaned) < settings.min_text_chars:
        raise DocumentError(
            422,
            "text_too_short",
            f"Please provide at least {settings.min_text_chars} characters of study material.",
        )
    if len(cleaned) > settings.max_text_chars:
        raise DocumentError(
            413,
            "text_too_long",
            f"Pasted text is limited to {settings.max_text_chars:,} characters.",
        )
    pages = [Page(page=None, text=cleaned)]
    return ExtractedDocument(
        text=cleaned,
        pages=pages,
        content_type=TEXT,
        word_count=count_words(cleaned),
    )
