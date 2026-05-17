from sqlalchemy.orm import Session
from models.conversation import Conversation, Channel, ConversationStage
from models.message import Message, MessageRole, MessageType


def get_or_create_conversation(
    db: Session,
    external_user_id: str,
    channel: Channel,
    user_name: str | None = None,
) -> Conversation:
    conv = (
        db.query(Conversation)
        .filter_by(external_user_id=external_user_id, channel=channel)
        .first()
    )
    if not conv:
        conv = Conversation(
            external_user_id=external_user_id,
            channel=channel,
            user_name=user_name,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
    elif user_name and not conv.user_name:
        conv.user_name = user_name
        db.commit()
    return conv


def add_message(
    db: Session,
    conversation: Conversation,
    role: MessageRole,
    content: str,
    message_type: MessageType = MessageType.text,
) -> Message:
    msg = Message(
        conversation_id=conversation.id,
        role=role,
        content=content,
        message_type=message_type,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def get_history(db: Session, conversation: Conversation, limit: int = 20) -> list[dict]:
    """Return last N messages formatted for the AI."""
    messages = (
        db.query(Message)
        .filter_by(conversation_id=conversation.id)
        .filter(Message.role != MessageRole.system)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"role": m.role.value, "content": m.content} for m in reversed(messages)]


def update_stage(db: Session, conversation: Conversation, stage: ConversationStage):
    conversation.stage = stage
    db.commit()
