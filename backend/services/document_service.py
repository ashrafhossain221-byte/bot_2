"""
Document Service — Phase 4
Extracts text from PDF, DOCX, TXT, and CSV files.
All libraries are free and run locally — no API key needed.

  PDF  — PyMuPDF (pip install pymupdf)
  DOCX — python-docx (pip install python-docx)
  TXT  — plain read
  CSV  — csv stdlib
"""
import io
import csv
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_CHARS = 4000  # truncate to keep AI context reasonable


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Dispatch to the right extractor based on file extension.
    Returns the extracted text or a descriptive fallback.
    """
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".pdf":
            text = _pdf(file_bytes)
        elif ext in (".docx", ".doc"):
            text = _docx(file_bytes)
        elif ext == ".csv":
            text = _csv(file_bytes)
        elif ext in (".txt", ".md", ".log", ".json", ".xml", ".html"):
            text = _plaintext(file_bytes)
        else:
            return f"[Document received: {filename} — unsupported format for text extraction]"

        text = text.strip()
        if len(text) > MAX_CHARS:
            text = text[:MAX_CHARS] + f"\n…[truncated — {len(text)} total chars]"
        return text if text else f"[Document received: {filename} — no text extracted]"
    except Exception as e:
        logger.error("Document extraction error for %s: %s", filename, e)
        return f"[Document received: {filename} — extraction failed: {type(e).__name__}]"


def _pdf(data: bytes) -> str:
    try:
        import fitz  # PyMuPDF  # type: ignore
    except ImportError:
        return "[PDF received — install pymupdf for PDF extraction]"

    doc = fitz.open(stream=data, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    return "\n\n".join(pages)


def _docx(data: bytes) -> str:
    try:
        from docx import Document  # type: ignore
    except ImportError:
        return "[DOCX received — install python-docx for Word extraction]"

    doc = Document(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def _csv(data: bytes) -> str:
    try:
        text = data.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(text))
        rows = []
        for i, row in enumerate(reader):
            rows.append(" | ".join(row))
            if i >= 50:  # limit preview to 50 rows
                rows.append(f"…[{sum(1 for _ in reader)} more rows]")
                break
        return "\n".join(rows)
    except Exception as e:
        return f"[CSV parsing error: {e}]"


def _plaintext(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")
