import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default="BDT")
    stock = Column(Integer, nullable=False, default=0)
    sku = Column(String(100), nullable=True, unique=True)
    category = Column(String(100), nullable=True)
    variants = Column(JSON, nullable=True)  # [{"size": "M", "color": "red", "price": 500}]
    images = Column(JSON, nullable=True)    # ["url1", "url2"]
    is_active = Column(Boolean, nullable=False, default=True)
    keywords = Column(JSON, nullable=True)  # for catalog search matching
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
