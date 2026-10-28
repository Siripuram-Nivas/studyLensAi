"""Unit tests for text normalisation, chunking, retrieval and quote checks."""

from __future__ import annotations

from app.services.text_processing import (
    Page,
    allowed_pages,
    chunk_pages,
    filter_pages,
    format_context,
    normalize_text,
    sample_chunks,
    select_relevant_chunks,
    verify_excerpt,
)


def test_normalize_text_preserves_paragraphs_and_collapses_spaces():
    raw = "  First   line\twith spaces.\r\n\r\n\r\n\r\nSecond   paragraph.  "
    assert normalize_text(raw) == "First line with spaces.\n\nSecond paragraph."


def test_chunk_pages_retains_page_numbers_and_splits_on_budget():
    pages = [
        Page(page=1, text="Alpha paragraph. " * 10),
        Page(page=2, text="Beta paragraph.\n\nGamma paragraph."),
    ]
    chunks = chunk_pages(pages, max_chars=80)

    assert len(chunks) >= 2
    assert {chunk.page for chunk in chunks} == {1, 2}
    assert all(chunk.length <= 80 for chunk in chunks)
    assert [chunk.index for chunk in chunks] == list(range(len(chunks)))


def test_chunk_pages_skips_blank_pages():
    chunks = chunk_pages(
        [Page(page=1, text="   "), Page(page=2, text="Real content")],
        max_chars=100,
    )
    assert len(chunks) == 1
    assert chunks[0].page == 2
    assert chunks[0].text == "Real content"


def test_select_relevant_chunks_prefers_query_overlap_and_keeps_order():
    chunks = chunk_pages(
        [
            Page(page=1, text="Relational algebra uses selection and projection operators."),
            Page(page=2, text="Normalization removes redundancy from relational tables."),
            Page(page=3, text="Indexes speed up lookups but add write cost."),
        ],
        max_chars=200,
    )
    selected = select_relevant_chunks(chunks, "normalization redundancy", max_chars=56)

    assert [chunk.page for chunk in selected] == [2]


def test_sample_chunks_respects_budget_and_covers_the_document():
    pages = [Page(page=index, text=f"Page {index} content " * 20) for index in range(1, 11)]
    chunks = chunk_pages(pages, max_chars=300)
    sampled = sample_chunks(chunks, max_chars=900, max_chunks=4)

    assert sampled
    assert sum(chunk.length for chunk in sampled) <= 900
    assert sampled[0].index < sampled[-1].index


def test_verify_excerpt_accepts_real_quote_and_reports_page():
    pages = [
        Page(page=1, text="Normalization reduces redundancy in relational databases."),
        Page(page=2, text="Indexes improve lookup performance."),
    ]
    excerpt, page = verify_excerpt("  normalization   REDUCES redundancy  ", pages)
    assert excerpt == "normalization   REDUCES redundancy"
    assert page == 1


def test_verify_excerpt_rejects_fabricated_or_too_short_quotes():
    pages = [Page(page=1, text="Normalization reduces redundancy.")]
    assert verify_excerpt("A sentence that is not in the document.", pages) == (None, None)
    assert verify_excerpt("no", pages) == (None, None)
    assert verify_excerpt(None, pages) == (None, None)


def test_page_helpers():
    chunks = chunk_pages(
        [
            Page(page=3, text="Third page content"),
            Page(page=1, text="First page content"),
        ],
        max_chars=100,
    )
    assert allowed_pages(chunks) == [1, 3]
    assert filter_pages([3, 2, 1, 3], {1, 3}) == [1, 3]

    context = format_context(chunks)
    assert "[Page 3]" in context
    assert "[Page 1]" in context
