"""
Comment auto-reply service.
Handles incoming social comments, runs behavior analysis,
generates AI reply, and sends back via DM or comment reply.
"""
import logging
from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from models.comment_event import CommentEvent, CommentPlatform
from models.conversation import Conversation, Channel, ConversationStage
from models.message import Message, MessageRole, MessageType
from services.behavior_engine import analyze
from services.ai_service import get_ai_reply
from services.automation_service import check_and_fire_triggers
from services.lead_service import get_or_create_lead, apply_behavior
from services import facebook_service, instagram_service

logger = logging.getLogger(__name__)


def _ensure_conversation(db: Session, platform: str, user_id: str, user_name: str | None) -> Conversation:
    channel_map = {"facebook": Channel.facebook, "instagram": Channel.instagram}
    channel = channel_map.get(platform, Channel.facebook)
    conv = db.query(Conversation).filter_by(channel=channel, external_user_id=user_id).first()
    if not conv:
        conv = Conversation(
            channel=channel,
            external_user_id=user_id,
            user_name=user_name,
            stage=ConversationStage.NEW,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


def handle_comment(
    db: Session,
    platform: str,
    post_id: str,
    comment_id: str,
    user_id: str,
    user_name: str | None,
    content: str,
) -> None:
    """Process a social comment: persist, analyze, auto-reply if enabled."""
    # Deduplicate
    existing = db.query(CommentEvent).filter_by(comment_id=comment_id).first()
    if existing:
        return

    event = CommentEvent(
        platform=CommentPlatform(platform),
        post_id=post_id,
        comment_id=comment_id,
        user_id=user_id,
        user_name=user_name,
        content=content,
    )
    db.add(event)
    db.commit()

    settings = db.get(BotSettings, 1)
    auto_reply_mode = getattr(settings, "comment_auto_reply", "off") if settings else "off"
    if auto_reply_mode == "off":
        return

    try:
        conv = _ensure_conversation(db, platform, user_id, user_name)
        behavior = analyze(content)
        lead = get_or_create_lead(db, conv)

        prev_score = lead.intent_score
        prev_stage = lead.stage.value
        lead = apply_behavior(db, lead, behavior)
        check_and_fire_triggers(db, lead, prev_score, prev_stage)

        history = [{"role": "user", "content": content}]
        reply = get_ai_reply(db, history, content, persona=behavior.persona)

        # Save to conversation
        db.add(Message(conversation_id=conv.id, role=MessageRole.user, content=content, message_type=MessageType.text))
        db.add(Message(conversation_id=conv.id, role=MessageRole.assistant, content=reply, message_type=MessageType.text))
        db.commit()

        if auto_reply_mode == "dm":
            if platform == "facebook":
                facebook_service.send_dm_from_comment(db, user_id, reply)
            else:
                instagram_service.send_dm(db, user_id, reply)
        elif auto_reply_mode == "comment":
            if platform == "facebook":
                facebook_service.reply_to_comment(db, comment_id, reply)
            else:
                instagram_service.reply_to_comment(db, comment_id, reply)

        event.handled = True
        event.auto_replied = True
        event.reply_message = reply
        event.conversation_id = conv.id
        db.commit()

    except Exception as e:
        logger.error("Comment auto-reply failed for %s/%s: %s", platform, comment_id, e)
