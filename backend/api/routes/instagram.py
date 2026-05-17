"""Instagram DM & comment webhook handler (via Facebook Graph API)."""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from config.settings import get_settings
from models.conversation import Conversation, Channel, ConversationStage
from models.message import MessageRole
from services.instagram_service import parse_instagram_events, parse_comment_events, send_dm
from services.comment_service import handle_comment
from services.behavior_engine import analyze
from services.lead_service import get_or_create_lead, apply_behavior
from services.automation_service import check_and_fire_triggers
from services.ai_service import get_ai_reply
from services.context_service import build_reply_context

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_or_create_conv(db: Session, sender_id: str) -> Conversation:
    conv = db.query(Conversation).filter_by(channel=Channel.instagram, external_user_id=sender_id).first()
    if not conv:
        conv = Conversation(
            channel=Channel.instagram,
            external_user_id=sender_id,
            stage=ConversationStage.NEW,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


@router.get("/webhook")
def instagram_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    settings = get_settings()
    # Instagram uses same app as Facebook — share verify token
    result = settings.FACEBOOK_VERIFY_TOKEN == (hub_verify_token or "")
    if not result:
        raise HTTPException(status_code=403, detail="Verification failed")
    return int(hub_challenge or "0")


@router.post("/webhook")
async def instagram_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    for event in parse_instagram_events(payload):
        if event["text"]:
            _handle_dm(db, event["sender_id"], event["text"])

    for comment in parse_comment_events(payload):
        handle_comment(
            db=db, platform="instagram",
            post_id=comment["post_id"], comment_id=comment["comment_id"],
            user_id=comment["user_id"], user_name=comment.get("user_name"),
            content=comment["content"],
        )

    return {"status": "ok"}


def _handle_dm(db: Session, sender_id: str, text: str) -> None:
    try:
        conv = _get_or_create_conv(db, sender_id)
        from services.conversation_service import get_history, add_message
        history = get_history(db, conv)
        behavior = analyze(text, history)

        lead = get_or_create_lead(db, conv)
        prev_score = lead.intent_score
        prev_stage = lead.stage.value
        lead = apply_behavior(db, lead, behavior)
        check_and_fire_triggers(db, lead, prev_score, prev_stage)

        add_message(db, conv, MessageRole.user, text)

        ctx = build_reply_context(db, text)
        reply = get_ai_reply(db=db, history=history, user_message=text, persona=lead.persona, **ctx)
        add_message(db, conv, MessageRole.assistant, reply)
        send_dm(db, sender_id, reply)

    except Exception as e:
        logger.error("Instagram DM handler error for %s: %s", sender_id, e)
