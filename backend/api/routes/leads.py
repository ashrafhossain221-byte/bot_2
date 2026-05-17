from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import uuid as _uuid

from core.database import get_db
from models.lead import Lead, LeadStage, Persona
from services.lead_service import get_leads, get_lead_by_conversation

router = APIRouter()


class LeadOut(BaseModel):
    id: str
    conversation_id: str
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    channel: str
    stage: str
    persona: str
    intent_score: float
    created_at: str
    updated_at: str

    @classmethod
    def from_orm(cls, lead: Lead) -> "LeadOut":
        return cls(
            id=str(lead.id),
            conversation_id=str(lead.conversation_id),
            name=lead.name,
            phone=lead.phone,
            email=lead.email,
            channel=lead.channel,
            stage=lead.stage.value,
            persona=lead.persona.value,
            intent_score=lead.intent_score,
            created_at=lead.created_at.isoformat(),
            updated_at=lead.updated_at.isoformat(),
        )


class LeadsResponse(BaseModel):
    leads: list[LeadOut]
    total: int
    skip: int
    limit: int


@router.get("", response_model=LeadsResponse)
def list_leads(
    stage: Optional[str] = Query(None, description="Filter by stage"),
    persona: Optional[str] = Query(None, description="Filter by persona"),
    channel: Optional[str] = Query(None, description="Filter by channel"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    leads, total = get_leads(db, stage=stage, persona=persona, channel=channel, skip=skip, limit=limit)
    return LeadsResponse(
        leads=[LeadOut.from_orm(l) for l in leads],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/stats")
def lead_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from models.lead import Lead as LeadModel

    stage_counts = (
        db.query(LeadModel.stage, func.count(LeadModel.id))
        .group_by(LeadModel.stage)
        .all()
    )
    persona_counts = (
        db.query(LeadModel.persona, func.count(LeadModel.id))
        .group_by(LeadModel.persona)
        .all()
    )
    channel_counts = (
        db.query(LeadModel.channel, func.count(LeadModel.id))
        .group_by(LeadModel.channel)
        .all()
    )
    hot_leads = db.query(func.count(LeadModel.id)).filter(LeadModel.stage == LeadStage.HOT_LEAD).scalar()
    avg_score = db.query(func.avg(LeadModel.intent_score)).scalar() or 0.0

    return {
        "by_stage": {s.value: c for s, c in stage_counts},
        "by_persona": {p.value: c for p, c in persona_counts},
        "by_channel": {ch: c for ch, c in channel_counts},
        "hot_leads": hot_leads,
        "avg_intent_score": round(float(avg_score), 2),
        "total": sum(c for _, c in stage_counts),
    }


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    lead = db.query(Lead).filter_by(id=lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadOut.from_orm(lead)
