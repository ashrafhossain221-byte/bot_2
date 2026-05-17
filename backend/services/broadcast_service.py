"""Broadcast messaging service — sends a message to a filtered segment of leads."""
import logging
from sqlalchemy.orm import Session
from models.broadcast import Broadcast, BroadcastStatus
from models.lead import Lead
from models.conversation import Conversation, Channel

logger = logging.getLogger(__name__)


def create_broadcast(db: Session, data: dict) -> Broadcast:
    b = Broadcast(**data)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def get_broadcast(db: Session, broadcast_id: str) -> Broadcast | None:
    return db.query(Broadcast).filter(Broadcast.id == broadcast_id).first()


def list_broadcasts(db: Session, skip: int = 0, limit: int = 50) -> tuple[list[Broadcast], int]:
    q = db.query(Broadcast).order_by(Broadcast.created_at.desc())
    total = q.count()
    return q.offset(skip).limit(limit).all(), total


def _get_target_leads(db: Session, broadcast: Broadcast) -> list[Lead]:
    q = db.query(Lead)
    if broadcast.target_stage:
        q = q.filter(Lead.stage == broadcast.target_stage)
    if broadcast.target_persona:
        q = q.filter(Lead.persona == broadcast.target_persona)
    return q.all()


def send_broadcast(db: Session, broadcast_id: str) -> dict:
    """Send a broadcast immediately. Returns send stats."""
    broadcast = get_broadcast(db, broadcast_id)
    if not broadcast:
        raise ValueError("Broadcast not found")
    if broadcast.status == BroadcastStatus.sent:
        raise ValueError("Broadcast already sent")

    broadcast.status = BroadcastStatus.sending
    db.commit()

    leads = _get_target_leads(db, broadcast)
    broadcast.total_recipients = len(leads)
    sent = 0
    failed = 0
    errors = []

    for lead in leads:
        conv = db.query(Conversation).filter(Conversation.id == lead.conversation_id).first()
        if not conv:
            continue
        try:
            _dispatch_to_channel(db, conv.channel.value, conv.external_user_id, broadcast.message)
            sent += 1
        except Exception as e:
            failed += 1
            errors.append({"lead_id": str(lead.id), "error": str(e)})
            logger.warning("Broadcast dispatch failed for lead %s: %s", lead.id, e)

    broadcast.sent_count = sent
    broadcast.failed_count = failed
    broadcast.status = BroadcastStatus.sent if failed == 0 else BroadcastStatus.failed
    broadcast.error_log = errors or None
    db.commit()
    db.refresh(broadcast)
    return {"sent": sent, "failed": failed, "total": len(leads)}


def _dispatch_to_channel(db: Session, channel: str, external_user_id: str, message: str) -> None:
    if channel == "telegram":
        from services.telegram_service import send_message
        send_message(db, external_user_id, message)
    elif channel == "whatsapp":
        from services import whatsapp_service
        whatsapp_service.send_text(db, external_user_id, message)
    elif channel == "facebook":
        from services import facebook_service
        facebook_service.send_messenger_text(db, external_user_id, message)
    elif channel == "instagram":
        from services import instagram_service
        instagram_service.send_dm(db, external_user_id, message)
    else:
        raise ValueError(f"Cannot push broadcast to channel '{channel}'")
