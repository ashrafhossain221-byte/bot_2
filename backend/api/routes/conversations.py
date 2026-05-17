from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from core.database import get_db
from models.conversation import Conversation, Channel, ConversationStage
from models.message import Message
from models.lead import Lead

router = APIRouter()


def _conv_to_dict(conv: Conversation, db: Session) -> dict:
    lead = db.query(Lead).filter_by(conversation_id=conv.id).first()
    last_msg = (
        db.query(Message)
        .filter_by(conversation_id=conv.id)
        .order_by(desc(Message.created_at))
        .first()
    )
    msg_count = db.query(Message).filter_by(conversation_id=conv.id).count()
    return {
        "id": str(conv.id),
        "channel": conv.channel.value,
        "external_user_id": conv.external_user_id,
        "user_name": conv.user_name,
        "stage": conv.stage.value,
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
        "message_count": msg_count,
        "last_message": last_msg.content[:80] if last_msg else "",
        "last_message_role": last_msg.role.value if last_msg else "",
        "last_message_at": last_msg.created_at.isoformat() if last_msg else None,
        "lead": {
            "id": str(lead.id),
            "name": lead.name,
            "phone": lead.phone,
            "email": lead.email,
            "stage": lead.stage.value,
            "persona": lead.persona.value,
            "intent_score": lead.intent_score,
        } if lead else None,
    }


@router.get("")
def list_conversations(
    channel: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search user name or external_user_id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Conversation)
    if channel:
        q = q.filter(Conversation.channel == channel)
    if stage:
        q = q.filter(Conversation.stage == stage)
    if search:
        like = f"%{search}%"
        q = q.filter(
            Conversation.user_name.ilike(like)
            | Conversation.external_user_id.ilike(like)
        )
    total = q.count()
    convs = q.order_by(desc(Conversation.updated_at)).offset(skip).limit(limit).all()
    return {
        "conversations": [_conv_to_dict(c, db) for c in convs],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter_by(id=conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _conv_to_dict(conv, db)


@router.get("/{conversation_id}/messages")
def get_messages(
    conversation_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter_by(id=conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = (
        db.query(Message)
        .filter_by(conversation_id=conversation_id)
        .order_by(Message.created_at)
        .offset(skip)
        .limit(limit)
        .all()
    )
    total = db.query(Message).filter_by(conversation_id=conversation_id).count()
    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role.value,
                "content": m.content,
                "message_type": m.message_type.value,
                "created_at": m.created_at.isoformat(),
            }
            for m in msgs
        ],
        "total": total,
    }
