"""Knowledge Base API — upload, list, search, delete documents."""
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.knowledge_service import (
    ingest_text, ingest_file, list_docs, get_doc,
    delete_doc, toggle_doc, search, format_rag_context,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _doc_dict(doc) -> dict:
    return {
        "id": str(doc.id),
        "title": doc.title,
        "file_type": doc.file_type,
        "source_name": doc.source_name,
        "content_preview": doc.content_preview,
        "chunk_count": doc.chunk_count,
        "token_estimate": doc.token_estimate,
        "is_active": doc.is_active,
        "embed_model": doc.embed_model,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.get("")
def list_documents(db: Session = Depends(get_db)):
    docs = list_docs(db)
    return {"documents": [_doc_dict(d) for d in docs], "total": len(docs)}


@router.get("/search/query")
def search_knowledge(q: str, top_k: int = 5, db: Session = Depends(get_db)):
    """Test RAG retrieval — returns top matching chunks for a query."""
    chunks = search(db, q, top_k=top_k)
    return {
        "query": q,
        "results": chunks,
        "context_preview": format_rag_context(chunks)[:500] if chunks else "",
    }


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a PDF, DOCX, or TXT file as a knowledge base document."""
    file_bytes = await file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 20 MB)")
    try:
        doc = ingest_file(db, file_bytes, file.filename or "upload", title=title)
        return _doc_dict(doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Knowledge ingest error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to process document")


class TextIngestRequest(BaseModel):
    title: str
    content: str
    file_type: str = "manual"


@router.post("/text", status_code=201)
def ingest_text_route(body: TextIngestRequest, db: Session = Depends(get_db)):
    """Manually add text content to the knowledge base."""
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    try:
        doc = ingest_text(db, body.title, body.content, file_type=body.file_type)
        return _doc_dict(doc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{doc_id}/toggle")
def toggle_document(doc_id: str, active: bool, db: Session = Depends(get_db)):
    doc = toggle_doc(db, doc_id, active)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_dict(doc)


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    if not delete_doc(db, doc_id):
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{doc_id}")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = get_doc(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_dict(doc)
