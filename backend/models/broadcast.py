import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Enum as SAEnum, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class BroadcastStatus(str, enum.Enum):
    draft = "draft"
    sending = "sending"
    sent = "sent"
    failed = "failed"


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    channel = Column(String(50), nullable=False)   # telegram, whatsapp, all
    target_stage = Column(String(50), nullable=True)  # null = all stages
    target_persona = Column(String(50), nullable=True)
    status = Column(SAEnum(BroadcastStatus), nullable=False, default=BroadcastStatus.draft)
    sent_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    total_recipients = Column(Integer, nullable=False, default=0)
    error_log = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
