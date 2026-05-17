"""Instagram Messaging & comment integration via Facebook Graph API."""
import httpx
import logging
from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from utils.encryption import decrypt

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


def _get_creds(db: Session) -> tuple[str, str]:
    s = db.get(BotSettings, 1)
    if not s:
        raise RuntimeError("Bot settings not configured")
    token = decrypt(s.instagram_access_token) if s.instagram_access_token else ""
    account_id = s.instagram_account_id or ""
    if not token:
        raise RuntimeError("Instagram access token not configured in Settings")
    return token, account_id


def parse_instagram_events(payload: dict) -> list[dict]:
    """
    Extract Instagram DM messages from webhook payload.
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
        logger.warning("Instagram parse error: %s", e)
    return results


def parse_comment_events(payload: dict) -> list[dict]:
    """Extract Instagram comment events."""
    results = []
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") in ("comments", "live_comments"):
                    val = change.get("value", {})
                    results.append({
                        "post_id": val.get("media", {}).get("id", ""),
                        "comment_id": val.get("id", ""),
                        "user_id": val.get("from", {}).get("id", ""),
                        "user_name": val.get("from", {}).get("username", ""),
                        "content": val.get("text", ""),
                    })
    except Exception as e:
        logger.warning("Instagram comment parse error: %s", e)
    return results


def send_dm(db: Session, recipient_id: str, message: str) -> dict:
    token, account_id = _get_creds(db)
    url = f"{GRAPH_BASE}/{account_id}/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message},
    }
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, json=payload, params={"access_token": token})
    if resp.status_code not in (200, 201):
        logger.error("Instagram DM failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Instagram API error {resp.status_code}")
    return resp.json()


def reply_to_comment(db: Session, comment_id: str, message: str) -> dict:
    token, _ = _get_creds(db)
    url = f"{GRAPH_BASE}/{comment_id}/replies"
    with httpx.Client(timeout=15) as client:
        resp = client.post(url, params={"access_token": token, "message": message})
    if resp.status_code not in (200, 201):
        logger.error("Instagram comment reply failed: %s %s", resp.status_code, resp.text)
        raise RuntimeError(f"Instagram comment API error {resp.status_code}")
    return resp.json()
