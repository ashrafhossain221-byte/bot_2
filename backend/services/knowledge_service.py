"""
Knowledge Base & RAG Service — Phase 7

Chunking strategy: ~400 token chunks, 50 token overlap, paragraph-aware.
Embedding strategy (in priority order):
  1. sentence-transformers (local, free) if installed
  2. OpenAI-compatible /embeddings endpoint (uses saved API key + provider)
  3. Keyword/TF-IDF cosine fallback (no extra deps, always works)

Retrieval: cosine similarity over all active chunks in PostgreSQL.
Works without pgvector — fine up to ~5,000 chunks.
"""
import re
import math
import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.knowledge_doc import KnowledgeDoc
from models.knowledge_chunk import KnowledgeChunk

logger = logging.getLogger(__name__)

# ─── Chunking ─────────────────────────────────────────────────────────────────

CHUNK_SIZE = 400      # tokens (approx — we use word count × 1.3)
CHUNK_OVERLAP = 50

def _approx_tokens(text: str) -> int:
    return max(1, int(len(text.split()) * 1.3))


def _split_chunks(text: str) -> list[str]:
    """Split text into overlapping chunks, respecting paragraph boundaries."""
    # Normalise whitespace
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    paragraphs = text.split("\n\n")

    chunks: list[str] = []
    current_words: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_words = para.split()
        para_tokens = _approx_tokens(para)

        if current_tokens + para_tokens > CHUNK_SIZE and current_words:
            chunks.append(" ".join(current_words))
            # Keep overlap
            overlap_words = current_words[-CHUNK_OVERLAP:] if len(current_words) > CHUNK_OVERLAP else current_words[:]
            current_words = overlap_words
            current_tokens = _approx_tokens(" ".join(current_words))

        current_words.extend(para_words)
        current_tokens += para_tokens

    if current_words:
        chunks.append(" ".join(current_words))

    return [c for c in chunks if c.strip()]


# ─── Embedding ────────────────────────────────────────────────────────────────

_EMBED_MODEL_NAME = "unknown"


def _embed_sentence_transformers(texts: list[str]) -> list[list[float]]:
    from sentence_transformers import SentenceTransformer  # type: ignore
    model = SentenceTransformer("all-MiniLM-L6-v2")
    return model.encode(texts, show_progress_bar=False).tolist()


def _embed_api(db: Session, texts: list[str]) -> list[list[float]]:
    import httpx
    from services.settings_service import get_settings, get_decrypted_api_key
    settings = get_settings(db)
    api_key = get_decrypted_api_key(db)
    endpoint = (settings.api_endpoint or "https://api.groq.com/openai/v1").rstrip("/")
    # Use text-embedding-3-small or provider-specific model
    embed_model = "text-embedding-3-small"
    with httpx.Client(timeout=60) as client:
        resp = client.post(
            f"{endpoint}/embeddings",
            json={"input": texts, "model": embed_model},
            headers={"Authorization": f"Bearer {api_key}"},
        )
    resp.raise_for_status()
    data = resp.json()
    return [item["embedding"] for item in data["data"]]


def _tfidf_vector(text: str, vocab: dict[str, int]) -> list[float]:
    """Simple TF-IDF-style sparse vector as dense list."""
    words = re.findall(r"\w+", text.lower())
    tf: dict[str, float] = {}
    for w in words:
        tf[w] = tf.get(w, 0) + 1
    n = len(words) or 1
    vec = [0.0] * len(vocab)
    for w, count in tf.items():
        if w in vocab:
            vec[vocab[w]] = count / n
    return vec


def _embed_keyword(texts: list[str]) -> list[list[float]]:
    """Keyword overlap fallback — no external deps."""
    # Build shared vocabulary from all texts
    all_words = set()
    for t in texts:
        all_words.update(re.findall(r"\w+", t.lower()))
    stopwords = {
        "the","a","an","is","in","on","at","to","for","of","and","or","but","it",
        "this","that","are","was","be","been","with","by","from","as","not","i",
        "you","we","they","he","she","its","their","our","my","your",
    }
    vocab_words = sorted(all_words - stopwords)[:500]
    vocab = {w: i for i, w in enumerate(vocab_words)}
    return [_tfidf_vector(t, vocab) for t in texts]


def get_embeddings(db: Session, texts: list[str]) -> tuple[list[list[float]], str]:
    """Return (embeddings, model_name). Falls through three strategies."""
    global _EMBED_MODEL_NAME
    # 1. sentence-transformers
    try:
        vecs = _embed_sentence_transformers(texts)
        _EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
        return vecs, "all-MiniLM-L6-v2"
    except ImportError:
        pass
    except Exception as e:
        logger.warning("sentence-transformers failed: %s", e)

    # 2. OpenAI-compatible /embeddings API
    try:
        vecs = _embed_api(db, texts)
        _EMBED_MODEL_NAME = "api-embeddings"
        return vecs, "api-embeddings"
    except Exception as e:
        logger.warning("API embeddings failed: %s — using keyword fallback", e)

    # 3. Keyword fallback
    vecs = _embed_keyword(texts)
    return vecs, "keyword-tfidf"


# ─── Cosine Similarity ────────────────────────────────────────────────────────

def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ─── Public API ───────────────────────────────────────────────────────────────

def ingest_text(
    db: Session,
    title: str,
    text: str,
    file_type: str = "text",
    source_name: Optional[str] = None,
) -> KnowledgeDoc:
    """Chunk text, embed, save to DB. Returns the KnowledgeDoc."""
    chunks = _split_chunks(text)
    if not chunks:
        raise ValueError("Document produced no text chunks")

    doc = KnowledgeDoc(
        title=title,
        file_type=file_type,
        source_name=source_name,
        content_preview=text[:500],
        chunk_count=len(chunks),
        token_estimate=_approx_tokens(text),
    )
    db.add(doc)
    db.flush()  # get doc.id

    # Embed in batches of 32
    batch_size = 32
    all_embeddings: list[list[float]] = []
    embed_model_name = "unknown"
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        vecs, model_name = get_embeddings(db, batch)
        all_embeddings.extend(vecs)
        embed_model_name = model_name

    doc.embed_model = embed_model_name

    for idx, (chunk_text, embedding) in enumerate(zip(chunks, all_embeddings)):
        chunk = KnowledgeChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=chunk_text,
            token_count=_approx_tokens(chunk_text),
            embedding=embedding,
        )
        db.add(chunk)

    db.commit()
    db.refresh(doc)
    return doc


def ingest_file(db: Session, file_bytes: bytes, filename: str, title: Optional[str] = None) -> KnowledgeDoc:
    """Extract text from uploaded file and ingest."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    if ext == "pdf":
        import fitz  # pymupdf
        doc_fitz = fitz.open(stream=file_bytes, filetype="pdf")
        text = "\n\n".join(page.get_text() for page in doc_fitz)
        file_type = "pdf"
    elif ext in ("docx", "doc"):
        import io
        from docx import Document as DocxDocument
        text = "\n\n".join(p.text for p in DocxDocument(io.BytesIO(file_bytes)).paragraphs if p.text.strip())
        file_type = "docx"
    elif ext == "csv":
        text = file_bytes.decode("utf-8", errors="replace")
        file_type = "csv"
    else:
        text = file_bytes.decode("utf-8", errors="replace")
        file_type = "txt"

    return ingest_text(db, title or filename, text, file_type=file_type, source_name=filename)


def search(db: Session, query: str, top_k: int = 5, doc_id: Optional[str] = None) -> list[dict]:
    """
    Retrieve top-k chunks most relevant to query.
    Returns list of dicts: {chunk_id, doc_title, content, score}
    """
    # Get query embedding
    q_vecs, _ = get_embeddings(db, [query])
    q_vec = q_vecs[0]

    # Load active chunks
    q = db.query(KnowledgeChunk).join(KnowledgeDoc).filter(KnowledgeDoc.is_active == True)
    if doc_id:
        q = q.filter(KnowledgeChunk.document_id == doc_id)
    chunks = q.all()

    if not chunks:
        return []

    # Score by cosine similarity (keyword fallback: rebuild vocab from all chunks)
    # If embeddings are keyword-based we need consistent vocab — recompute
    first_embed = chunks[0].embedding
    if first_embed and len(first_embed) <= 500:
        # Likely keyword-tfidf — rebuild vocab and recompute query vector
        all_texts = [c.content for c in chunks] + [query]
        all_vecs, _ = _embed_keyword.__wrapped__(all_texts) if hasattr(_embed_keyword, "__wrapped__") else (None, None)
        if all_vecs is None:
            all_vecs = _embed_keyword(all_texts)
        q_vec = all_vecs[-1]
        chunk_vecs = all_vecs[:-1]
        scored = [
            (_cosine(q_vec, chunk_vecs[i]), chunks[i])
            for i in range(len(chunks))
        ]
    else:
        scored = [
            (_cosine(q_vec, c.embedding) if c.embedding else 0.0, c)
            for c in chunks
        ]

    scored.sort(key=lambda x: -x[0])
    results = []
    for score, chunk in scored[:top_k]:
        if score < 0.05:
            break
        results.append({
            "chunk_id": str(chunk.id),
            "doc_id": str(chunk.document_id),
            "doc_title": chunk.document.title if chunk.document else "",
            "content": chunk.content,
            "score": round(score, 4),
        })
    return results


def format_rag_context(chunks: list[dict], max_chars: int = 2000) -> str:
    """Format retrieved chunks into a context block for the AI system prompt."""
    if not chunks:
        return ""
    lines = ["[KNOWLEDGE BASE]"]
    total = 0
    for c in chunks:
        entry = f"[{c['doc_title']}]: {c['content']}"
        if total + len(entry) > max_chars:
            break
        lines.append(entry)
        total += len(entry)
    lines.append("Use the above knowledge to answer accurately. Do not make up information not found there.")
    return "\n".join(lines)


def list_docs(db: Session) -> list[KnowledgeDoc]:
    return db.query(KnowledgeDoc).order_by(desc(KnowledgeDoc.created_at)).all()


def get_doc(db: Session, doc_id: str) -> Optional[KnowledgeDoc]:
    return db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()


def delete_doc(db: Session, doc_id: str) -> bool:
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        return False
    db.delete(doc)
    db.commit()
    return True


def toggle_doc(db: Session, doc_id: str, is_active: bool) -> Optional[KnowledgeDoc]:
    doc = db.query(KnowledgeDoc).filter(KnowledgeDoc.id == doc_id).first()
    if not doc:
        return None
    doc.is_active = is_active
    db.commit()
    db.refresh(doc)
    return doc
