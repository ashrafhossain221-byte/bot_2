import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, JSON, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_name = Column(String(200), nullable=False)
    subdomain = Column(String(100), nullable=True, unique=True)
    plan = Column(String(50), nullable=False, default="starter")   # starter, pro, enterprise
    api_keys = Column(JSON, nullable=True)   # encrypted keys per provider
    channel_tokens = Column(JSON, nullable=True)  # whatsapp/fb/ig tokens per tenant
    settings = Column(JSON, nullable=True)   # bot_name, tone, language, etc.
    is_active = Column(Boolean, nullable=False, default=True)
    contact_email = Column(String(200), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    monthly_message_limit = Column(String(20), nullable=False, default="1000")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
