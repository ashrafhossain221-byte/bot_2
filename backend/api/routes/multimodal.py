"""
Multimodal Route — Phase 4
POST /api/multimodal/upload

Accepts a file upload from the website chat widget.
Detects file type, extracts content, runs behavior engine, returns AI reply.
"""
import uuid
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config.settings import get_settings
from core.database import get_db
from models.conversation import Channel
from models.message import MessageRole, MessageType
from services.conversation_service import (
    get_or_create_conversation,
    add_message,
    get_history,
)
from services.ai_service import get_ai_reply
from services.behavior_engine import analyze
from services.automation_service import check_and_fire_triggers
from services.lead_service import get_or_create_lead, apply_behavior
from services import voice_service, image_service, document_service

logger = logging.getLogger(__name__)
router = APIRouter()

# MIME type → category
_VOICE_MIMES = {"audio/ogg", "audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "audio/flac", "audio/x-wav"}
_IMAGE_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/tiff"}
_DOC_MIMES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain", "text/csv", "text/markdown",
    "application/json", "text/xml", "application/xml",
}
_DOC_EXTS = {".pdf", ".docx", ".doc", ".txt", ".csv", ".md", ".log", ".json", ".xml"}


class UploadResponse(BaseModel):
    reply: str
    session_id: str
    conversation_id: str
    file_type: str          # "voice" | "image" | "document"
    extracted_text: str
    intent_score: float
    persona: str


@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    session_id: str = Form(default=""),
    user_name: str = Form(default=""),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    content = await file.read()

    if len(content) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_BYTES // (1024*1024)} MB limit")

    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    sid = session_id.strip() or str(uuid.uuid4())
    filename = file.filename or "upload"
    mime = (file.content_type or "").lower().split(";")[0].strip()
    ext = Path(filename).suffix.lower()

    # ── Detect type and extract ──────────────────────────────────────────────
    if mime in _VOICE_MIMES or ext in {".ogg", ".mp3", ".wav", ".webm", ".m4a", ".flac"}:
        file_type = "voice"
        extracted = voice_service.transcribe(content, filename, db)
        user_text = f"[Voice message transcription]: {extracted}"
        msg_type = MessageType.voice

    elif mime in _IMAGE_MIMES or ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
        file_type = "image"
        extracted = image_service.extract_text(content)
        user_text = f"[Image received — OCR text]: {extracted}"
        msg_type = MessageType.image

    elif mime in _DOC_MIMES or ext in _DOC_EXTS:
        file_type = "document"
        extracted = document_service.extract_text(content, filename)
        user_text = f"[Document received: {filename}]\n{extracted}"
        msg_type = MessageType.document

    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {mime or ext}")

    # ── Conversation + behavior + AI ─────────────────────────────────────────
    conversation = get_or_create_conversation(
        db=db,
        external_user_id=sid,
        channel=Channel.website,
        user_name=user_name.strip() or None,
    )

    history = get_history(db, conversation)
    behavior = analyze(extracted, history)
    lead = get_or_create_lead(db, conversation)
    prev_score = lead.intent_score
    prev_stage = lead.stage.value
    lead = apply_behavior(db, lead, behavior)
    check_and_fire_triggers(db, lead, prev_score, prev_stage)

    add_message(db, conversation, MessageRole.user, user_text, msg_type)

    context = f"The user sent a {file_type}. Extracted content:\n{extracted}"
    reply = get_ai_reply(db=db, history=history, user_message=extracted, extra_context=context, persona=lead.persona)
    add_message(db, conversation, MessageRole.assistant, reply)

    return UploadResponse(
        reply=reply,
        session_id=sid,
        conversation_id=str(conversation.id),
        file_type=file_type,
        extracted_text=extracted,
        intent_score=lead.intent_score,
        persona=lead.persona.value,
    )
