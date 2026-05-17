import httpx
import logging
from sqlalchemy.orm import Session
from services.settings_service import get_decrypted_telegram_token

logger = logging.getLogger(__name__)


def send_message(db: Session, chat_id: int | str, text: str) -> bool:
    token = get_decrypted_telegram_token(db)
    if not token:
        logger.warning("Telegram token not configured")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error("Telegram sendMessage error: %s", str(e))
        return False


def set_webhook(token: str, webhook_url: str) -> dict:
    url = f"https://api.telegram.org/bot{token}/setWebhook"
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, json={"url": webhook_url})
        return resp.json()


def delete_webhook(token: str) -> dict:
    url = f"https://api.telegram.org/bot{token}/deleteWebhook"
    with httpx.Client(timeout=15) as client:
        resp = client.post(url)
        return resp.json()
