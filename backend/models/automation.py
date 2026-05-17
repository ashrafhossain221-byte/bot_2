import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum

from core.database import Base


class AutomationTrigger(str, enum.Enum):
    lead_captured = "lead_captured"     # contact (phone/email) first saved
    hot_lead = "hot_lead"               # intent_score crosses HOT_LEAD_THRESHOLD
    post_purchase = "post_purchase"     # stage becomes CUSTOMER
    no_reply_24h = "no_reply_24h"       # no user reply for 24h


class ScheduledMessageStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    cancelled = "cancelled"


class AutomationFlow(Base):
    __tablename__ = "automation_flows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    trigger = Column(SAEnum(AutomationTrigger), nullable=False, index=True)
    # steps: list of {"delay_hours": int, "message": str}
    steps = Column(JSONB, nullable=False, default=list)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scheduled_messages = relationship("ScheduledMessage", back_populates="flow", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AutomationFlow {self.name!r} trigger={self.trigger} active={self.is_active}>"


class ScheduledMessage(Base):
    __tablename__ = "scheduled_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    flow_id = Column(UUID(as_uuid=True), ForeignKey("automation_flows.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    status = Column(SAEnum(ScheduledMessageStatus), default=ScheduledMessageStatus.pending, nullable=False, index=True)
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    flow = relationship("AutomationFlow", back_populates="scheduled_messages")
    lead = relationship("Lead", backref="scheduled_messages")

    def __repr__(self):
        return f"<ScheduledMessage {self.id} status={self.status} at={self.scheduled_at}>"
