"""WhatsApp Cloud API webhook — receive and respond to WhatsApp messages."""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from config.settings import get_settings
from models.conversation import Conversation, Channel, ConversationStage
from models.message import Message, MessageRole, MessageType
from services.whatsapp_service import parse_incoming, send_text, verify_webhook
from services.behavior_engine import analyze
from services.lead_service import get_or_create_lead, apply_behavior
from services.automation_service import check_and_fire_triggers
from services.ai_service import get_ai_reply
from services.context_service import build_reply_context

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_or_create_conv(db: Session, sender_id: str, name: str | None) -> Conversation:
    conv = db.query(Conversation).filter_by(channel=Channel.whatsapp, external_user_id=sender_id).first()
    if not conv:
        conv = Conversation(
            channel=Channel.whatsapp,
            external_user_id=sender_id,
            user_name=name or None,
            stage=ConversationStage.NEW,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    elif name and not conv.user_name:
        conv.user_name = name
        db.commit()
    return conv


@router.get("/webhook")
def whatsapp_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    settings = get_settings()
    result = verify_webhook(
        verify_token=settings.WHATSAPP_VERIFY_TOKEN,
        hub_verify_token=hub_verify_token or "",
        hub_challenge=hub_challenge or "",
    )
    if result is None:
        raise HTTPException(status_code=403, detail="Verification token mismatch")
    return int(result)


@router.post("/webhook")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    messages = parse_incoming(payload)
    for msg in messages:
        if msg["type"] != "text" or not msg["text"]:
            continue
        _handle_text(db, msg["from"], msg["name"], msg["text"])

    return {"status": "ok"}


def _handle_text(db: Session, sender_id: str, name: str | None, text: str) -> None:
    try:
        conv = _get_or_create_conv(db, sender_id, name)

        from services.conversation_service import get_history, add_message
        history = get_history(db, conv)
        behavior = analyze(text, history)

        if behavior.extracted_name and not conv.user_name:
            conv.user_name = behavior.extracted_name
            db.commit()

        lead = get_or_create_lead(db, conv)
        prev_score = lead.intent_score
        prev_stage = lead.stage.value
        lead = apply_behavior(db, lead, behavior)
        check_and_fire_triggers(db, lead, prev_score, prev_stage)

        add_message(db, conv, MessageRole.user, text)

        ctx = build_reply_context(db, text)
        reply = get_ai_reply(db=db, history=history, user_message=text, persona=lead.persona, **ctx)
        add_message(db, conv, MessageRole.assistant, reply)
        send_text(db, sender_id, reply)

    except Exception as e:
        logger.error("WhatsApp handler error for %s: %s", sender_id, e)
