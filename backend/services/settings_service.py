from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from utils.encryption import encrypt, decrypt


def get_settings(db: Session) -> BotSettings:
    """Always returns the single settings row, creating it if missing."""
    row = db.query(BotSettings).filter_by(id=1).first()
    if not row:
        row = BotSettings(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_decrypted_api_key(db: Session) -> str:
    row = get_settings(db)
    return decrypt(row.api_key) if row.api_key else ""


def get_decrypted_telegram_token(db: Session) -> str:
    row = get_settings(db)
    return decrypt(row.telegram_bot_token) if row.telegram_bot_token else ""


_ENCRYPTED_FIELDS = {
    "api_key", "telegram_bot_token",
    "whatsapp_access_token", "facebook_page_token", "facebook_app_secret",
    "instagram_access_token",
}


def update_settings(db: Session, data: dict) -> BotSettings:
    row = get_settings(db)
    for field in _ENCRYPTED_FIELDS:
        if field in data and data[field]:
            data[field] = encrypt(data[field])
    for k, v in data.items():
        if hasattr(row, k):
            setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return row
