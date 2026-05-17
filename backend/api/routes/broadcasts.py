"""Broadcast messaging API."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.broadcast_service import create_broadcast, get_broadcast, list_broadcasts, send_broadcast

router = APIRouter()


class BroadcastCreate(BaseModel):
    name: str
    message: str
    channel: str = "all"
    target_stage: Optional[str] = None
    target_persona: Optional[str] = None


def _broadcast_dict(b) -> dict:
    return {
        "id": str(b.id),
        "name": b.name,
        "message": b.message,
        "channel": b.channel,
        "target_stage": b.target_stage,
        "target_persona": b.target_persona,
        "status": b.status.value,
        "sent_count": b.sent_count,
        "failed_count": b.failed_count,
        "total_recipients": b.total_recipients,
        "error_log": b.error_log,
        "created_at": b.created_at.isoformat() if b.created_at else None,
        "updated_at": b.updated_at.isoformat() if b.updated_at else None,
    }


@router.get("")
def list_broadcasts_route(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    broadcasts, total = list_broadcasts(db, skip=skip, limit=limit)
    return {"broadcasts": [_broadcast_dict(b) for b in broadcasts], "total": total}


@router.get("/{broadcast_id}")
def get_broadcast_route(broadcast_id: str, db: Session = Depends(get_db)):
    b = get_broadcast(db, broadcast_id)
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return _broadcast_dict(b)


@router.post("", status_code=201)
def create_broadcast_route(body: BroadcastCreate, db: Session = Depends(get_db)):
    b = create_broadcast(db, body.model_dump())
    return _broadcast_dict(b)


@router.post("/{broadcast_id}/send")
def send_broadcast_route(broadcast_id: str, db: Session = Depends(get_db)):
    try:
        result = send_broadcast(db, broadcast_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Broadcast send failed: {e}")
