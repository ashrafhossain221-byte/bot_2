"""Facebook Messenger & comment integration via Graph API."""
import hmac
import hashlib
import httpx
import logging
from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from utils.encryption import decrypt

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _get_creds(db: Session) -> tuple[str, str, str]:
    s = db.get(BotSettings, 1)
    if not s:
        raise RuntimeError("Bot settings not configured")
    token = decrypt(s.facebook_page_token) if s.facebook_page_token else ""
    page_id = s.facebook_page_id or ""
    secret = decrypt(s.facebook_app_secret) if s.facebook_app_secret else ""
    if not token:
        raise RuntimeError("Facebook page token not configured in Settings")
    return token, page_id, secret


def verify_webhook(verify_token: str, expected_token: str, hub_challenge: str) -> str | None:
    if verify_token == expected_token:
        return hub_challenge
    return None


def verify_signature(payload_bytes: bytes, signature_header: str, app_secret: str) -> bool:
    """Verify X-Hub-Signature-256 header from Facebook."""
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), payload_bytes, hashlib.sha256).hexdigest()  # noqa: E501
    return hmac.compare_digest(expected, signature_header[7:])


def parse_messenger_events(payload: dict) -> list[dict]:
    """
    Extract Messenger messages from webhook payload.
    Returns list of {sender_id, text, attachments, mid}
    """
    results = []
    try:
        for entry in payload.get("entry", []):
            for msg_event in entry.get("messaging", []):
                sender = msg_event.get("sender", {}).get("id", "")
                message = msg_event.get("message", {})
                results.append({
                    "sender_id": sender,
                    "text": message.get("text", ""),
                    "attachments": message.get("attachments", []),
                    "mid": message.get("mid", ""),
                })
    except Exception as e:
        logger.warning("Facebook parse error: %s", e)
    return results


def parse_comment_events(payload: dict) -> list[dict]:
    """Extract comment events for auto-reply."""
    results = []
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") == "feed":
                    val = change.get("value", {})
                    if val.get("item") == "comment" and val.get("verb") in ("add", "edited"):
                        results.append({
                            "post_id": val.get("post_id", ""),
                            "comment_id": val.get("comment_id", ""),
                            "user_id": val.get("from", {}).get("id", ""),
                            "user_name": val.get("from", {}).get("name", ""),
                            "content": val.get("message", ""),
                        })
    except Exception as e:
        logger.warning("Facebook comment parse error: %s", e)
    return results


def send_messenger_text(db: Session, recipient_id: str, message: str) -> dict:
    token, _, _ = _get_creds(db)
    url = f"{GRAPH_BASE}/me/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message},
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, json=payload, params={"access_token": token})
    if resp.status_code not in (200, 201):
        logger.error("FB Messenger send failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Facebook API error {resp.status_code}")
    return resp.json()


def reply_to_comment(db: Session, comment_id: str, message: str) -> dict:
    token, _, _ = _get_creds(db)
    url = f"{GRAPH_BASE}/{comment_id}/comments"
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, params={"access_token": token, "message": message})
    if resp.status_code not in (200, 201):
        logger.error("FB comment reply failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Facebook comment API error {resp.status_code}")
    return resp.json()


def send_dm_from_comment(db: Session, user_id: str, message: str) -> dict:
    """Send Messenger DM in response to a comment."""
    return send_messenger_text(db, user_id, message)
