from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.settings_service import get_settings, update_settings

router = APIRouter()


class SettingsResponse(BaseModel):
    provider_name: str
    api_endpoint: str
    model_name: str
    api_key_set: bool
    bot_name: str
    gender: str
    tone: str
    reply_language: str
    reply_length: str
    business_name: Optional[str]
    business_type: Optional[str]
    custom_instructions: Optional[str]
    telegram_bot_token_set: bool
    telegram_webhook_url: Optional[str]
    # Phase 6 channels
    whatsapp_configured: bool
    whatsapp_phone_number_id: Optional[str]
    facebook_configured: bool
    facebook_page_id: Optional[str]
    instagram_configured: bool
    instagram_account_id: Optional[str]
    comment_auto_reply: str


class SettingsUpdateRequest(BaseModel):
    # AI Provider
    api_key: Optional[str] = None
    provider_name: Optional[str] = None
    api_endpoint: Optional[str] = None
    model_name: Optional[str] = None

    # Bot Identity
    bot_name: Optional[str] = None
    gender: Optional[str] = None
    tone: Optional[str] = None
    reply_language: Optional[str] = None
    reply_length: Optional[str] = None

    # Business
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    custom_instructions: Optional[str] = None

    # Telegram
    telegram_bot_token: Optional[str] = None
    telegram_webhook_url: Optional[str] = None

    # WhatsApp
    whatsapp_access_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_verify_token: Optional[str] = None

    # Facebook
    facebook_page_token: Optional[str] = None
    facebook_page_id: Optional[str] = None
    facebook_verify_token: Optional[str] = None
    facebook_app_secret: Optional[str] = None

    # Instagram
    instagram_access_token: Optional[str] = None
    instagram_account_id: Optional[str] = None

    # Comment auto-reply
    comment_auto_reply: Optional[str] = None


@router.get("", response_model=SettingsResponse)
def read_settings(db: Session = Depends(get_db)):
    row = get_settings(db)
    return SettingsResponse(
        provider_name=row.provider_name or "groq",
        api_endpoint=row.api_endpoint or "https://api.groq.com/openai/v1",
        model_name=row.model_name or "llama-3.3-70b-versatile",
        api_key_set=bool(row.api_key),
        bot_name=row.bot_name or "BotCore",
        gender=row.gender or "neutral",
        tone=row.tone or "friendly",
        reply_language=row.reply_language or "auto",
        reply_length=row.reply_length or "medium",
        business_name=row.business_name,
        business_type=row.business_type,
        custom_instructions=row.custom_instructions,
        telegram_bot_token_set=bool(row.telegram_bot_token),
        telegram_webhook_url=row.telegram_webhook_url,
        whatsapp_configured=bool(row.whatsapp_access_token),
        whatsapp_phone_number_id=row.whatsapp_phone_number_id,
        facebook_configured=bool(row.facebook_page_token),
        facebook_page_id=row.facebook_page_id,
        instagram_configured=bool(row.instagram_access_token),
        instagram_account_id=row.instagram_account_id,
        comment_auto_reply=row.comment_auto_reply or "off",
    )


@router.patch("")
def patch_settings(body: SettingsUpdateRequest, db: Session = Depends(get_db)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_settings(db, data)
    return {"status": "updated"}
