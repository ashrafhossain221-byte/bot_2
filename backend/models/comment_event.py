import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Enum as SAEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class CommentPlatform(str, enum.Enum):
    facebook = "facebook"
    instagram = "instagram"


class CommentEvent(Base):
    __tablename__ = "comment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform = Column(SAEnum(CommentPlatform), nullable=False)
    post_id = Column(String(200), nullable=False)
    comment_id = Column(String(200), nullable=False, unique=True)
    user_id = Column(String(200), nullable=False)
    user_name = Column(String(200), nullable=True)
    content = Column(Text, nullable=False)
    handled = Column(Boolean, nullable=False, default=False)
    auto_replied = Column(Boolean, nullable=False, default=False)
    reply_message = Column(Text, nullable=True)
    conversation_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
