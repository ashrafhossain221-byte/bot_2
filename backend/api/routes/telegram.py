import logging
import httpx
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.conversation import Channel
from models.message import MessageRole, MessageType
from services.conversation_service import (
    get_or_create_conversation,
    add_message,
    get_history,
)
from services.ai_service import get_ai_reply
from services.telegram_service import send_message, set_webhook, delete_webhook
from services.settings_service import get_decrypted_telegram_token, update_settings
from services.behavior_engine import analyze
from services.lead_service import get_or_create_lead, apply_behavior
from services.automation_service import check_and_fire_triggers
from services.context_service import build_reply_context
from services import voice_service, image_service, document_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _download_tg_file(token: str, file_id: str) -> tuple[bytes, str]:
    """Download a file from Telegram and return (bytes, filename)."""
    with httpx.Client(timeout=30) as client:
        # Step 1: resolve file path
        info = client.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}")
        info.raise_for_status()
        file_path = info.json()["result"]["file_path"]
        filename = file_path.split("/")[-1]

        # Step 2: download content
        content = client.get(f"https://api.telegram.org/file/bot{token}/{file_path}")
        content.raise_for_status()
        return content.content, filename


def _handle_message(
    db: Session,
    chat_id: str,
    user_name: str | None,
    user_text: str,
    extracted_text: str,
    msg_type: MessageType,
    extra_context: str | None = None,
):
    """Common logic for all message types: save, detect behavior, get AI reply, send back."""
    conversation = get_or_create_conversation(
        db=db,
        external_user_id=chat_id,
        channel=Channel.telegram,
        user_name=user_name,
    )

    history = get_history(db, conversation)
    behavior = analyze(extracted_text, history)

    if behavior.extracted_name and not conversation.user_name:
        conversation.user_name = behavior.extracted_name
        db.commit()

    lead = get_or_create_lead(db, conversation)
    prev_score = lead.intent_score
    prev_stage = lead.stage.value
    lead = apply_behavior(db, lead, behavior)
    check_and_fire_triggers(db, lead, prev_score, prev_stage)

    add_message(db, conversation, MessageRole.user, user_text, msg_type)

    # Language + RAG + product context
    ctx = build_reply_context(db, extracted_text)

    reply = get_ai_reply(
        db=db,
        history=history,
        user_message=extracted_text,
        extra_context=extra_context,
        persona=lead.persona,
        **ctx,
    )
    add_message(db, conversation, MessageRole.assistant, reply)
    send_message(db, chat_id, reply)


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}

    chat_id = str(message["chat"]["id"])
    from_info = message.get("from", {})
    first_name = from_info.get("first_name", "")
    last_name = from_info.get("last_name", "")
    user_name = " ".join(filter(None, [first_name, last_name])) or None

    token = get_decrypted_telegram_token(db)

    # ── Text ────────────────────────────────────────────────────────────────
    if text := message.get("text", "").strip():
        _handle_message(db, chat_id, user_name, text, text, MessageType.text)
        return {"ok": True}

    # ── Voice / Audio ────────────────────────────────────────────────────────
    voice = message.get("voice") or message.get("audio")
    if voice and token:
        try:
            file_bytes, filename = _download_tg_file(token, voice["file_id"])
            transcript = voice_service.transcribe(file_bytes, filename, db)
            user_text = f"[Voice message]: {transcript}"
            _handle_message(
                db, chat_id, user_name, user_text, transcript, MessageType.voice,
                extra_context=f"User sent a voice message. Transcript: {transcript}",
            )
        except Exception as e:
            logger.error("Telegram voice error: %s", e)
            send_message(db, chat_id, "Sorry, I couldn't process your voice message.")
        return {"ok": True}

    # ── Photo ────────────────────────────────────────────────────────────────
    photos = message.get("photo")
    if photos and token:
        try:
            # Use the highest-resolution photo (last in array)
            file_id = photos[-1]["file_id"]
            file_bytes, filename = _download_tg_file(token, file_id)
            ocr_text = image_service.extract_text(file_bytes)
            caption = message.get("caption", "")
            combined = f"{caption}\n{ocr_text}".strip() if caption else ocr_text
            user_text = f"[Image received]\nCaption: {caption}\nOCR text: {ocr_text}"
            _handle_message(
                db, chat_id, user_name, user_text, combined, MessageType.image,
                extra_context=f"User sent an image. Caption: {caption or 'none'}. OCR text: {ocr_text}",
            )
        except Exception as e:
            logger.error("Telegram photo error: %s", e)
            send_message(db, chat_id, "Sorry, I couldn't process your image.")
        return {"ok": True}

    # ── Document ─────────────────────────────────────────────────────────────
    doc = message.get("document")
    if doc and token:
        try:
            filename = doc.get("file_name", "document")
            file_bytes, _ = _download_tg_file(token, doc["file_id"])
            extracted = document_service.extract_text(file_bytes, filename)
            caption = message.get("caption", "")
            combined = f"{caption}\n{extracted}".strip() if caption else extracted
            user_text = f"[Document: {filename}]\n{extracted}"
            _handle_message(
                db, chat_id, user_name, user_text, combined, MessageType.document,
                extra_context=f"User sent a document ({filename}). Content:\n{extracted}",
            )
        except Exception as e:
            logger.error("Telegram document error: %s", e)
            send_message(db, chat_id, "Sorry, I couldn't read your document.")
        return {"ok": True}

    # ── Unsupported (sticker, location, etc.) ────────────────────────────────
    return {"ok": True}


class WebhookSetupRequest(BaseModel):
    webhook_url: str


@router.post("/setup-webhook")
def setup_webhook(body: WebhookSetupRequest, db: Session = Depends(get_db)):
    token = get_decrypted_telegram_token(db)
    if not token:
        raise HTTPException(status_code=400, detail="Telegram bot token not configured")
    result = set_webhook(token, body.webhook_url)
    update_settings(db, {"telegram_webhook_url": body.webhook_url})
    return result


@router.delete("/webhook")
def remove_webhook(db: Session = Depends(get_db)):
    token = get_decrypted_telegram_token(db)
    if not token:
        raise HTTPException(status_code=400, detail="Telegram bot token not configured")
    return delete_webhook(token)
