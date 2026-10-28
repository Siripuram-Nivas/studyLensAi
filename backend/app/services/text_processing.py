"""Text normalisation, page-aware chunking and lightweight retrieval."""

from __future__ import annotations

import re
from dataclasses import dataclass

_WHITESPACE_RE = re.compile(r"[ \t\f\v\u00a0]+")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
_TOKEN_RE = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9+\-#]{2,}")

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "you",
    "are", "was", "were", "have", "has", "had", "not", "but", "can", "could",
    "will", "would", "about", "which", "what", "when", "where", "how", "why",
    "their", "there", "than", "then", "them", "these", "those", "also", "using",
    "used", "use", "its", "itself", "may", "might", "should", "more", "most",
    "some", "such", "only", "other", "each", "both", "between", "through",
    "study", "material", "concept", "explain", "summary",
}


def normalize_text(raw: str) -> str:
    """Normalise whitespace without flattening meaningful paragraphs."""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = _WHITESPACE_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    return text.strip()


def normalize_for_match(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def count_words(text: str) -> int:
    return len(text.split())


@dataclass(frozen=True)
class Page:
    page: int | None
    text: str


@dataclass(frozen=True)
class Chunk:
    index: int
    page: int | None
    text: str

    @property
    def length(self) -> int:
        return len(self.text)


def _split_long(text: str, max_chars: int) -> list[str]:
    """Split an oversized paragraph on whitespace, never mid-word if possible."""
    pieces: list[str] = []
    remaining = text.strip()
    while len(remaining) > max_chars:
        window = remaining[:max_chars]
        split_at = window.rfind("\n\n")
        if split_at < max_chars // 2:
            split_at = window.rfind(". ")
        if split_at < max_chars // 2:
            split_at = window.rfind(" ")
        if split_at < max_chars // 3:
            split_at = max_chars
        pieces.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        pieces.append(remaining)
    return pieces


def chunk_pages(pages: list[Page], max_chars: int = 5_000) -> list[Chunk]:
    """Chunk material while retaining the source page for each chunk."""
    chunks: list[Chunk] = []
    index = 0
    for page in pages:
        if not page.text.strip():
            continue
        buffer = ""
        paragraphs = re.split(r"\n\s*\n", page.text)
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            candidates = (
                _split_long(paragraph, max_chars)
                if len(paragraph) > max_chars
                else [paragraph]
            )
            for candidate in candidates:
                separator = "\n\n" if buffer else ""
                if buffer and len(buffer) + len(separator) + len(candidate) > max_chars:
                    chunks.append(Chunk(index=index, page=page.page, text=buffer.strip()))
                    index += 1
                    buffer = candidate
                else:
                    buffer = f"{buffer}{separator}{candidate}"
        if buffer.strip():
            chunks.append(Chunk(index=index, page=page.page, text=buffer.strip()))
            index += 1
    return chunks


def allowed_pages(chunks: list[Chunk]) -> list[int]:
    return sorted({chunk.page for chunk in chunks if chunk.page is not None})


def format_context(chunks: list[Chunk]) -> str:
    blocks: list[str] = []
    for chunk in chunks:
        if chunk.page is not None:
            blocks.append(f"[Page {chunk.page}]\n{chunk.text}")
        else:
            blocks.append(f"[Excerpt]\n{chunk.text}")
    return "\n\n---\n\n".join(blocks)


def _terms(text: str) -> set[str]:
    return {
        token.casefold()
        for token in _TOKEN_RE.findall(text)
        if token.casefold() not in STOPWORDS
    }


def select_relevant_chunks(
    chunks: list[Chunk], query: str, max_chars: int, limit: int = 6
) -> list[Chunk]:
    """Select chunks using a small, deterministic lexical relevance score.

    A real embedding index is overkill for single-document study sessions, and
    this keeps retrieval dependency-free and fully testable.
    """
    if not chunks:
        return []
    query_terms = _terms(query)
    scored: list[tuple[float, Chunk]] = []
    for chunk in chunks:
        chunk_terms = _terms(chunk.text)
        overlap = len(query_terms & chunk_terms)
        mentions = sum(chunk.text.casefold().count(term) for term in query_terms)
        score = overlap * 4 + min(mentions, 12)
        scored.append((score, chunk))

    scored.sort(key=lambda item: (-item[0], item[1].index))
    selected: list[Chunk] = []
    total = 0
    for score, chunk in scored:
        if len(selected) >= limit:
            break
        if total + chunk.length > max_chars and selected:
            continue
        selected.append(chunk)
        total += chunk.length
        if total >= max_chars:
            break
    if not selected:
        selected = [chunks[0]]
    return sorted(selected, key=lambda chunk: chunk.index)


def sample_chunks(chunks: list[Chunk], max_chars: int, max_chunks: int = 8) -> list[Chunk]:
    """Take an even spread across the document within a character budget."""
    if not chunks:
        return []
    if sum(chunk.length for chunk in chunks) <= max_chars:
        return chunks

    if len(chunks) <= max_chunks:
        selected = chunks
    else:
        step = (len(chunks) - 1) / (max_chunks - 1)
        indices = sorted({round(i * step) for i in range(max_chunks)})
        selected = [chunks[i] for i in indices]

    result: list[Chunk] = []
    total = 0
    for chunk in selected:
        if result and total + chunk.length > max_chars:
            continue
        result.append(chunk)
        total += chunk.length
    return result or [chunks[0]]


def verify_excerpt(
    excerpt: str | None, pages: list[Page]
) -> tuple[str | None, int | None]:
    """Keep a quote only if it actually appears in the extracted material.

    Returns (verified_excerpt, actual_page). This prevents the UI from showing
    invented quotations or fabricated page citations.
    """
    if not excerpt or len(excerpt.strip()) < 3:
        return None, None
    normalized_excerpt = normalize_for_match(excerpt)
    if len(normalized_excerpt) < 3:
        return None, None
    for page in pages:
        if normalized_excerpt in normalize_for_match(page.text):
            return excerpt.strip(), page.page
    return None, None


def filter_pages(pages: list[int], allowed: set[int]) -> list[int]:
    return sorted({page for page in pages if page in allowed})
