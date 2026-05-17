"""
Celery Tasks — Phase 5
Periodic tasks that drive the automation engine.
"""
import logging
from datetime import datetime, timedelta

from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="tasks.automation_tasks.send_due_messages", bind=True, max_retries=3)
def send_due_messages(self):
    """
    Runs every 60 seconds.
    Finds all ScheduledMessages where scheduled_at <= now and status == pending,
    sends them via the appropriate channel, marks them sent/failed.
    """
    from core.database import SessionLocal
    from models.automation import ScheduledMessage, ScheduledMessageStatus
    from sqlalchemy import and_

    db = SessionLocal()
    try:
        due = (
            db.query(ScheduledMessage)
            .filter(
                and_(
                    ScheduledMessage.status == ScheduledMessageStatus.pending,
                    ScheduledMessage.scheduled_at <= datetime.utcnow(),
                )
            )
            .all()
        )

        for msg in due:
            try:
                _dispatch(db, msg)
                msg.status = ScheduledMessageStatus.sent
                msg.sent_at = datetime.utcnow()
                logger.info("Sent scheduled message %s (channel=%s)", msg.id, msg.channel)
            except Exception as exc:
                msg.status = ScheduledMessageStatus.failed
                msg.error_message = str(exc)[:500]
                logger.error("Failed to send scheduled message %s: %s", msg.id, exc)
            db.commit()

        return {"processed": len(due)}
    finally:
        db.close()


@celery_app.task(name="tasks.automation_tasks.check_no_reply_leads", bind=True, max_retries=2)
def check_no_reply_leads(self):
    """
    Runs every 30 minutes.
    Finds leads whose last user message was > 24h ago with no bot follow-up
    and triggers the no_reply_24h automation flow.
    """
    from core.database import SessionLocal
    from models.conversation import Conversation
    from models.message import Message, MessageRole
    from models.lead import Lead
    from models.automation import ScheduledMessage, ScheduledMessageStatus, AutomationTrigger
    from services.automation_service import trigger_flow
    from sqlalchemy import desc, and_

    db = SessionLocal()
    triggered = 0
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)

        # Find all leads with at least one message
        leads = db.query(Lead).all()

        for lead in leads:
            conv = db.query(Conversation).filter_by(id=lead.conversation_id).first()
            if not conv:
                continue

            # Last message in the conversation
            last_msg = (
                db.query(Message)
                .filter_by(conversation_id=conv.id)
                .order_by(desc(Message.created_at))
                .first()
            )

            if not last_msg:
                continue

            # Only trigger if last message is FROM the user (bot hasn't replied yet)
            if last_msg.role != MessageRole.user:
                continue

            # Only trigger if that message is older than 24h
            if last_msg.created_at > cutoff:
                continue

            # Check if we already triggered no_reply_24h for this lead recently
            existing = (
                db.query(ScheduledMessage)
                .filter(
                    and_(
                        ScheduledMessage.lead_id == lead.id,
                        ScheduledMessage.status.in_([
                            ScheduledMessageStatus.pending,
                            ScheduledMessageStatus.sent,
                        ]),
                    )
                )
                .join(ScheduledMessage.flow)
                .filter_by(trigger=AutomationTrigger.no_reply_24h)
                .first()
            )
            if existing:
                continue

            trigger_flow(db, lead, AutomationTrigger.no_reply_24h)
            triggered += 1

        return {"leads_triggered": triggered}
    finally:
        db.close()


def _dispatch(db, msg):
    """Send a ScheduledMessage via the right channel."""
    from models.lead import Lead
    from models.conversation import Conversation
    from models.message import Message, MessageRole, MessageType
    from services.telegram_service import send_message as tg_send

    lead = db.query(Lead).filter_by(id=msg.lead_id).first()
    if not lead:
        raise ValueError(f"Lead {msg.lead_id} not found")

    conv = db.query(Conversation).filter_by(id=lead.conversation_id).first()
    if not conv:
        raise ValueError(f"Conversation for lead {msg.lead_id} not found")

    if msg.channel == "telegram":
        tg_send(db, conv.external_user_id, msg.message)
    elif msg.channel == "whatsapp":
        from services.whatsapp_service import send_text as wa_send
        wa_send(db, conv.external_user_id, msg.message)
    elif msg.channel == "facebook":
        from services.facebook_service import send_messenger_text as fb_send
        fb_send(db, conv.external_user_id, msg.message)
    elif msg.channel == "instagram":
        from services.instagram_service import send_dm as ig_send
        ig_send(db, conv.external_user_id, msg.message)
    else:
        # Website: save as assistant message in conversation history.
        # Widget will display it next time user opens the chat.
        pass

    # Always persist the outbound message in the conversation history
    bot_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.assistant,
        content=msg.message,
        message_type=MessageType.text,
    )
    db.add(bot_msg)
    # don't commit here — caller commits after updating status
