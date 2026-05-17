from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime

from core.database import Base


class BotSettings(Base):
    """Single-row settings table. Always use id=1."""
    __tablename__ = "bot_settings"

    id = Column(Integer, primary_key=True, default=1)

    # AI Provider — open connection, works with any OpenAI-compatible API
    api_key = Column(Text, nullable=True)           # stored encrypted
    provider_name = Column(String(100), default="groq")
    api_endpoint = Column(String(500), default="https://api.groq.com/openai/v1")
    model_name = Column(String(200), default="llama-3.3-70b-versatile")

    # Bot Identity
    bot_name = Column(String(100), default="BotCore")
    gender = Column(String(20), default="neutral")   # male, female, neutral
    tone = Column(String(50), default="friendly")    # friendly, formal, casual, professional
    reply_language = Column(String(50), default="auto")  # auto, en, bn, etc.
    reply_length = Column(String(20), default="medium")  # short, medium, long

    # Business Info
    business_name = Column(String(200), nullable=True)
    business_type = Column(String(200), nullable=True)
    custom_instructions = Column(Text, nullable=True)

    # Telegram
    telegram_bot_token = Column(Text, nullable=True)  # stored encrypted
    telegram_webhook_url = Column(String(500), nullable=True)

    # WhatsApp (Meta Cloud API)
    whatsapp_access_token = Column(Text, nullable=True)   # encrypted
    whatsapp_phone_number_id = Column(String(100), nullable=True)
    whatsapp_verify_token = Column(String(200), nullable=True)

    # Facebook
    facebook_page_token = Column(Text, nullable=True)    # encrypted
    facebook_page_id = Column(String(100), nullable=True)
    facebook_verify_token = Column(String(200), nullable=True)
    facebook_app_secret = Column(Text, nullable=True)    # encrypted, for signature verify

    # Instagram (uses Facebook Graph API)
    instagram_access_token = Column(Text, nullable=True)  # encrypted
    instagram_account_id = Column(String(100), nullable=True)

    # Comment auto-reply
    comment_auto_reply = Column(String(10), nullable=False, default="off")  # off, dm, comment

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<BotSettings provider={self.provider_name} model={self.model_name}>"
