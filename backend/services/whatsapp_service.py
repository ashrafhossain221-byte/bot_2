"""WhatsApp Cloud API (Meta) integration."""
import httpx
import logging
from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from utils.encryption import decrypt

logger = logging.getLogger(__name__)

WA_API_BASE = "https://graph.facebook.com/v19.0"


def _get_token_and_phone(db: Session) -> tuple[str, str]:
    s = db.get(BotSettings, 1)
    if not s:
        raise RuntimeError("Bot settings not configured")
    token = decrypt(s.whatsapp_access_token) if s.whatsapp_access_token else ""
    phone_id = s.whatsapp_phone_number_id or ""
    if not token or not phone_id:
        raise RuntimeError("WhatsApp credentials not configured in Settings")
    return token, phone_id


def send_text(db: Session, to: str, message: str) -> dict:
    """Send a plain text WhatsApp message."""
    token, phone_id = _get_token_and_phone(db)
    url = f"{WA_API_BASE}/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": message},
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, json=payload, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code not in (200, 201):
        logger.error("WhatsApp send failed %s: %s", resp.status_code, resp.text)
        raise RuntimeError(f"WhatsApp API error {resp.status_code}: {resp.text}")
    return resp.json()


def verify_webhook(verify_token: str, hub_verify_token: str, hub_challenge: str) -> str | None:
    """Return hub_challenge if tokens match, else None."""
    if verify_token == hub_verify_token:
        return hub_challenge
    return None


def parse_incoming(payload: dict) -> list[dict]:
    """
    Extract incoming messages from WhatsApp webhook payload.
    Returns list of dicts: {from, name, type, text, media_id, phone_number_id}
    """
    results = []
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                phone_number_id = value.get("metadata", {}).get("phone_number_id", "")
                contacts = {c["wa_id"]: c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}
                for msg in value.get("messages", []):
                    results.append({
                        "from": msg.get("from", ""),
                        "name": contacts.get(msg.get("from", ""), ""),
                        "type": msg.get("type", "text"),
                        "text": msg.get("text", {}).get("body", "") if msg.get("type") == "text" else "",
                        "media_id": (msg.get("image") or msg.get("audio") or msg.get("document") or {}).get("id"),
                        "phone_number_id": phone_number_id,
                    })
    except Exception as e:
        logger.warning("WhatsApp parse error: %s", e)
    return results


def download_media(db: Session, media_id: str) -> bytes:
    """Download a WhatsApp media file by ID."""
    token, _ = _get_token_and_phone(db)
    with httpx.Client(timeout=30) as client:
        meta = client.get(f"{WA_API_BASE}/{media_id}", headers={"Authorization": f"Bearer {token}"})
        meta.raise_for_status()
        url = meta.json()["url"]
        resp = client.get(url, headers={"Authorization": f"Bearer {token}"})
        resp.raise_for_status()
    return resp.content
