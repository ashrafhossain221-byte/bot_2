from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List, Any

from core.database import get_db
from models.automation import AutomationFlow, ScheduledMessage, AutomationTrigger, ScheduledMessageStatus

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class FlowStep(BaseModel):
    delay_hours: int
    message: str


class FlowOut(BaseModel):
    id: str
    name: str
    trigger: str
    steps: List[Any]
    is_active: bool
    is_default: bool
    created_at: str

    @classmethod
    def from_orm(cls, f: AutomationFlow) -> "FlowOut":
        return cls(
            id=str(f.id),
            name=f.name,
            trigger=f.trigger.value,
            steps=f.steps or [],
            is_active=f.is_active,
            is_default=f.is_default,
            created_at=f.created_at.isoformat(),
        )


class FlowCreateRequest(BaseModel):
    name: str
    trigger: str
    steps: List[FlowStep]
    is_active: bool = True


class FlowUpdateRequest(BaseModel):
    name: Optional[str] = None
    steps: Optional[List[FlowStep]] = None
    is_active: Optional[bool] = None


class ScheduledMsgOut(BaseModel):
    id: str
    lead_id: str
    flow_id: str
    flow_name: str
    channel: str
    message: str
    scheduled_at: str
    status: str
    sent_at: Optional[str]
    error_message: Optional[str]

    @classmethod
    def from_orm(cls, m: ScheduledMessage) -> "ScheduledMsgOut":
        return cls(
            id=str(m.id),
            lead_id=str(m.lead_id),
            flow_id=str(m.flow_id),
            flow_name=m.flow.name if m.flow else "—",
            channel=m.channel,
            message=m.message,
            scheduled_at=m.scheduled_at.isoformat(),
            status=m.status.value,
            sent_at=m.sent_at.isoformat() if m.sent_at else None,
            error_message=m.error_message,
        )


# ─── Flow endpoints ───────────────────────────────────────────────────────────

@router.get("/flows", response_model=List[FlowOut])
def list_flows(db: Session = Depends(get_db)):
    flows = db.query(AutomationFlow).order_by(AutomationFlow.is_default.desc(), AutomationFlow.created_at).all()
    return [FlowOut.from_orm(f) for f in flows]


@router.post("/flows", response_model=FlowOut)
def create_flow(body: FlowCreateRequest, db: Session = Depends(get_db)):
    try:
        trigger = AutomationTrigger(body.trigger)
    except ValueError:
        raise HTTPException(400, f"Invalid trigger. Valid: {[t.value for t in AutomationTrigger]}")
    flow = AutomationFlow(
        name=body.name,
        trigger=trigger,
        steps=[s.model_dump() for s in body.steps],
        is_active=body.is_active,
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return FlowOut.from_orm(flow)


@router.patch("/flows/{flow_id}", response_model=FlowOut)
def update_flow(flow_id: str, body: FlowUpdateRequest, db: Session = Depends(get_db)):
    flow = db.query(AutomationFlow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(404, "Flow not found")
    if body.name is not None:
        flow.name = body.name
    if body.steps is not None:
        flow.steps = [s.model_dump() for s in body.steps]
    if body.is_active is not None:
        flow.is_active = body.is_active
    db.commit()
    db.refresh(flow)
    return FlowOut.from_orm(flow)


@router.delete("/flows/{flow_id}")
def delete_flow(flow_id: str, db: Session = Depends(get_db)):
    flow = db.query(AutomationFlow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(404, "Flow not found")
    if flow.is_default:
        raise HTTPException(400, "Cannot delete a default flow. Deactivate it instead.")
    db.delete(flow)
    db.commit()
    return {"status": "deleted"}


# ─── Scheduled messages endpoints ────────────────────────────────────────────

@router.get("/queue")
def list_queue(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(ScheduledMessage)
    if status:
        q = q.filter(ScheduledMessage.status == status)
    total = q.count()
    msgs = q.order_by(ScheduledMessage.scheduled_at).offset(skip).limit(limit).all()
    return {
        "messages": [ScheduledMsgOut.from_orm(m) for m in msgs],
        "total": total,
    }


@router.get("/stats")
def automation_stats(db: Session = Depends(get_db)):
    total_flows = db.query(func.count(AutomationFlow.id)).scalar() or 0
    active_flows = db.query(func.count(AutomationFlow.id)).filter_by(is_active=True).scalar() or 0

    status_rows = (
        db.query(ScheduledMessage.status, func.count(ScheduledMessage.id))
        .group_by(ScheduledMessage.status)
        .all()
    )
    by_status = {s.value: c for s, c in status_rows}

    trigger_rows = (
        db.query(AutomationFlow.trigger, func.count(ScheduledMessage.id))
        .join(ScheduledMessage, ScheduledMessage.flow_id == AutomationFlow.id, isouter=True)
        .group_by(AutomationFlow.trigger)
        .all()
    )
    by_trigger = {t.value: c for t, c in trigger_rows}

    return {
        "total_flows": total_flows,
        "active_flows": active_flows,
        "messages_pending": by_status.get("pending", 0),
        "messages_sent": by_status.get("sent", 0),
        "messages_failed": by_status.get("failed", 0),
        "messages_cancelled": by_status.get("cancelled", 0),
        "by_trigger": by_trigger,
    }
