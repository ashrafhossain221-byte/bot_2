import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from models.conversation import Channel
from models.message import MessageRole
from services.conversation_service import (
    get_or_create_conversation,
    add_message,
    get_history,
)
from services.ai_service import get_ai_reply
from services.behavior_engine import analyze
from services.lead_service import get_or_create_lead, apply_behavior
from services.automation_service import check_and_fire_triggers
from services.context_service import build_reply_context

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    user_name: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    conversation_id: str
    intent_score: float
    persona: str


@router.post("/message", response_model=ChatResponse)
def send_message(body: ChatRequest, db: Session = Depends(get_db)):
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = body.session_id or str(uuid.uuid4())

    conversation = get_or_create_conversation(
        db=db,
        external_user_id=session_id,
        channel=Channel.website,
        user_name=body.user_name,
    )

    history = get_history(db, conversation)

    # — Behavior detection —
    behavior = analyze(body.message, history)

    # Capture user name from conversation if extracted
    if behavior.extracted_name and not conversation.user_name:
        conversation.user_name = behavior.extracted_name
        db.commit()

    # Update lead record
    lead = get_or_create_lead(db, conversation)
    prev_score = lead.intent_score
    prev_stage = lead.stage.value
    lead = apply_behavior(db, lead, behavior)

    # Fire automation triggers based on state change
    check_and_fire_triggers(db, lead, prev_score, prev_stage)

    add_message(db, conversation, MessageRole.user, body.message)

    # — Language + RAG + product context —
    ctx = build_reply_context(db, body.message)

    reply = get_ai_reply(
        db=db,
        history=history,
        user_message=body.message,
        persona=lead.persona,
        **ctx,
    )
    add_message(db, conversation, MessageRole.assistant, reply)

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        conversation_id=str(conversation.id),
        intent_score=lead.intent_score,
        persona=lead.persona.value,
    )
