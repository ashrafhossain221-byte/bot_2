"""Comment Management API — list, filter, manually reply to social comments."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from core.database import get_db
from models.comment_event import CommentEvent, CommentPlatform
from services import facebook_service, instagram_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _comment_dict(c: CommentEvent) -> dict:
    return {
        "id": str(c.id),
        "platform": c.platform.value,
        "post_id": c.post_id,
        "comment_id": c.comment_id,
        "user_id": c.user_id,
        "user_name": c.user_name,
        "content": c.content,
        "handled": c.handled,
        "auto_replied": c.auto_replied,
        "reply_message": c.reply_message,
        "conversation_id": str(c.conversation_id) if c.conversation_id else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("")
def list_comments(
    platform: Optional[str] = None,
    handled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(CommentEvent).order_by(desc(CommentEvent.created_at))
    if platform:
        try:
            q = q.filter(CommentEvent.platform == CommentPlatform(platform))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid platform: {platform}")
    if handled is not None:
        q = q.filter(CommentEvent.handled == handled)
    total = q.count()
    comments = q.offset(skip).limit(limit).all()
    return {
        "comments": [_comment_dict(c) for c in comments],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/stats")
def comment_stats(db: Session = Depends(get_db)):
    total = db.query(CommentEvent).count()
    handled = db.query(CommentEvent).filter(CommentEvent.handled == True).count()
    unhandled = total - handled
    auto_replied = db.query(CommentEvent).filter(CommentEvent.auto_replied == True).count()
    by_platform = {}
    for platform in CommentPlatform:
        by_platform[platform.value] = db.query(CommentEvent).filter(
            CommentEvent.platform == platform
        ).count()
    return {
        "total": total,
        "handled": handled,
        "unhandled": unhandled,
        "auto_replied": auto_replied,
        "by_platform": by_platform,
    }


class ManualReplyRequest(BaseModel):
    message: str
    reply_mode: str = "dm"   # "dm" | "comment"


@router.post("/{comment_id}/reply")
def reply_to_comment(
    comment_id: str,
    body: ManualReplyRequest,
    db: Session = Depends(get_db),
):
    """Manually send a reply to a social comment from the admin UI."""
    event = db.query(CommentEvent).filter(CommentEvent.id == comment_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Comment not found")

    try:
        if event.platform.value == "facebook":
            if body.reply_mode == "comment":
                facebook_service.reply_to_comment(db, event.comment_id, body.message)
            else:
                facebook_service.send_dm_from_comment(db, event.user_id, body.message)
        else:  # instagram
            if body.reply_mode == "comment":
                instagram_service.reply_to_comment(db, event.comment_id, body.message)
            else:
                instagram_service.send_dm(db, event.user_id, body.message)

        event.handled = True
        event.reply_message = body.message
        db.commit()
        return {"status": "sent", "comment": _comment_dict(event)}

    except Exception as e:
        logger.error("Manual comment reply failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to send reply: {e}")


@router.patch("/{comment_id}/mark-handled")
def mark_handled(comment_id: str, db: Session = Depends(get_db)):
    event = db.query(CommentEvent).filter(CommentEvent.id == comment_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Comment not found")
    event.handled = True
    db.commit()
    return _comment_dict(event)
