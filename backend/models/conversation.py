import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from core.database import Base


class Channel(str, enum.Enum):
    website = "website"
    telegram = "telegram"
    whatsapp = "whatsapp"
    facebook = "facebook"
    instagram = "instagram"


class ConversationStage(str, enum.Enum):
    NEW = "NEW"
    LEAD = "LEAD"
    HOT_LEAD = "HOT_LEAD"
    CUSTOMER = "CUSTOMER"
    REPEAT_CUSTOMER = "REPEAT_CUSTOMER"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel = Column(SAEnum(Channel), nullable=False)
    external_user_id = Column(String(255), nullable=False, index=True)
    stage = Column(SAEnum(ConversationStage), default=ConversationStage.NEW, nullable=False)
    user_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")

    def __repr__(self):
        return f"<Conversation {self.id} [{self.channel}] stage={self.stage}>"
