"""Extract text from PDF and DOCX files for AI analysis."""
from __future__ import annotations

import io
import logging
from typing import BinaryIO

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file: BinaryIO, max_pages: int = 200) -> list[dict]:
    """Extract text from PDF, returning list of {page, text} dicts."""
    import pdfplumber

    pages = []
    try:
        with pdfplumber.open(file) as pdf:
            for i, page in enumerate(pdf.pages[:max_pages]):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append({"page": i + 1, "text": text.strip()})
    except Exception as e:
        logger.error("PDF extraction error: %s", e)
        raise ValueError(f"Nie udało się odczytać pliku PDF: {e}")
    return pages


def extract_text_from_docx(file: BinaryIO) -> list[dict]:
    """Extract text from DOCX, returning list of {paragraph_index, text, style} dicts."""
    from docx import Document

    paragraphs = []
    try:
        doc = Document(file)
        for i, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if text:
                style_name = para.style.name if para.style else ""
                paragraphs.append({
                    "index": i,
                    "text": text,
                    "style": style_name,
                })
    except Exception as e:
        logger.error("DOCX extraction error: %s", e)
        raise ValueError(f"Nie udało się odczytać pliku DOCX: {e}")
    return paragraphs


def prepare_document_text(
    filename: str,
    file: BinaryIO,
    max_chars: int = 60_000,
) -> tuple[str, dict]:
    """Extract and prepare text from uploaded document.

    Returns:
        (text_content, metadata) where metadata includes page/paragraph counts.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        pages = extract_text_from_pdf(file)
        full_text = "\n\n".join(
            f"--- Strona {p['page']} ---\n{p['text']}" for p in pages
        )
        meta = {
            "format": "pdf",
            "total_pages": len(pages),
            "total_chars": len(full_text),
        }
    elif ext in ("docx", "doc"):
        paragraphs = extract_text_from_docx(file)
        full_text = "\n".join(p["text"] for p in paragraphs)
        meta = {
            "format": "docx",
            "total_paragraphs": len(paragraphs),
            "total_chars": len(full_text),
        }
    else:
        raise ValueError(f"Nieobsługiwany format pliku: .{ext}. Obsługiwane: .pdf, .docx")

    # Truncate if too long
    truncated = False
    if len(full_text) > max_chars:
        full_text = full_text[:max_chars]
        truncated = True
        meta["truncated"] = True
        meta["truncated_at_chars"] = max_chars

    if not full_text.strip():
        raise ValueError("Dokument jest pusty lub nie udało się wyekstrahować tekstu.")

    meta["extracted_chars"] = len(full_text)
    return full_text, meta


def prepare_chunked_document(
    filename: str,
    file: BinaryIO,
    chunk_size: int = 12_000,
    max_chunks: int = 50,
) -> tuple[list[str], dict]:
    """Extract text and split into chunks for multi-pass AI analysis.

    Returns:
        (chunks, metadata) where chunks[0] is always the beginning of the document.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        pages = extract_text_from_pdf(file)
        page_texts = [
            f"--- Strona {p['page']} ---\n{p['text']}" for p in pages
        ]
        meta = {"format": "pdf", "total_pages": len(pages)}
    elif ext in ("docx", "doc"):
        paragraphs = extract_text_from_docx(file)
        page_texts = [p["text"] for p in paragraphs]
        meta = {"format": "docx", "total_paragraphs": len(paragraphs)}
    else:
        raise ValueError(f"Nieobsługiwany format: .{ext}")

    # Build chunks
    chunks: list[str] = []
    current_chunk = ""
    for text in page_texts:
        if len(current_chunk) + len(text) + 2 > chunk_size and current_chunk:
            chunks.append(current_chunk)
            current_chunk = text
            if len(chunks) >= max_chunks:
                break
        else:
            current_chunk = current_chunk + "\n\n" + text if current_chunk else text

    if current_chunk and len(chunks) < max_chunks:
        chunks.append(current_chunk)

    meta["chunks"] = len(chunks)
    meta["total_chars"] = sum(len(c) for c in chunks)
    return chunks, meta
