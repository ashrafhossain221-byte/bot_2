import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base


class KnowledgeDoc(Base):
    """A source document uploaded to the knowledge base."""
    __tablename__ = "knowledge_docs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    file_type = Column(String(20), nullable=False, default="text")  # pdf, docx, txt, url, manual
    source_name = Column(String(500), nullable=True)  # original filename or URL
    content_preview = Column(Text, nullable=True)     # first 500 chars
    chunk_count = Column(Integer, nullable=False, default=0)
    token_estimate = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    embed_model = Column(String(100), nullable=True)  # which model produced the embeddings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")
