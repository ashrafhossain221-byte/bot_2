import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from core.database import Base


class LeadStage(str, enum.Enum):
    NEW = "NEW"
    LEAD = "LEAD"
    HOT_LEAD = "HOT_LEAD"
    CUSTOMER = "CUSTOMER"
    REPEAT_CUSTOMER = "REPEAT_CUSTOMER"


class Persona(str, enum.Enum):
    price_sensitive = "price_sensitive"
    trust_seeker = "trust_seeker"
    fast_buyer = "fast_buyer"
    ready_to_buy = "ready_to_buy"
    general = "general"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    channel = Column(String(50), nullable=False, default="website")

    stage = Column(SAEnum(LeadStage), default=LeadStage.NEW, nullable=False)
    persona = Column(SAEnum(Persona), default=Persona.general, nullable=False)
    intent_score = Column(Float, default=0.0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", backref="lead", uselist=False)

    def __repr__(self):
        return f"<Lead {self.id} stage={self.stage} persona={self.persona} score={self.intent_score}>"
