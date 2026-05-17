from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.lead import Lead, LeadStage, Persona
from models.conversation import Conversation, Channel
from services.behavior_engine import BehaviorResult

HOT_LEAD_THRESHOLD = 7.0


def get_or_create_lead(db: Session, conversation: Conversation) -> Lead:
    lead = db.query(Lead).filter_by(conversation_id=conversation.id).first()
    if not lead:
        lead = Lead(
            conversation_id=conversation.id,
            channel=conversation.channel.value,
            stage=LeadStage.NEW,
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)
    return lead


def apply_behavior(db: Session, lead: Lead, result: BehaviorResult) -> Lead:
    """Update lead from a BehaviorResult, advancing stage when warranted."""
    changed = False

    # Persona: upgrade if new one is stronger (higher intent score associated)
    _persona_rank = {
        Persona.general: 0,
        Persona.price_sensitive: 1,
        Persona.trust_seeker: 1,
        Persona.fast_buyer: 2,
        Persona.ready_to_buy: 3,
    }
    if _persona_rank.get(result.persona, 0) > _persona_rank.get(lead.persona, 0):
        lead.persona = result.persona
        changed = True

    # Intent score: keep the highest seen
    if result.intent_score > lead.intent_score:
        lead.intent_score = result.intent_score
        changed = True

    # Contact extraction
    if result.extracted_name and not lead.name:
        lead.name = result.extracted_name
        changed = True
    if result.extracted_phone and not lead.phone:
        lead.phone = result.extracted_phone
        changed = True
    if result.extracted_email and not lead.email:
        lead.email = result.extracted_email
        changed = True

    # Stage promotion logic
    has_contact = bool(lead.phone or lead.email)
    current_stage = lead.stage

    if current_stage == LeadStage.NEW:
        if has_contact:
            lead.stage = LeadStage.LEAD
            changed = True
        elif lead.intent_score >= HOT_LEAD_THRESHOLD:
            lead.stage = LeadStage.HOT_LEAD
            changed = True
    elif current_stage == LeadStage.LEAD:
        if lead.intent_score >= HOT_LEAD_THRESHOLD:
            lead.stage = LeadStage.HOT_LEAD
            changed = True

    if changed:
        db.commit()
        db.refresh(lead)

    return lead


def mark_customer(db: Session, lead: Lead) -> Lead:
    if lead.stage == LeadStage.CUSTOMER:
        lead.stage = LeadStage.REPEAT_CUSTOMER
    else:
        lead.stage = LeadStage.CUSTOMER
    db.commit()
    db.refresh(lead)
    return lead


def get_leads(
    db: Session,
    stage: str | None = None,
    persona: str | None = None,
    channel: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Lead], int]:
    q = db.query(Lead)
    if stage:
        q = q.filter(Lead.stage == stage)
    if persona:
        q = q.filter(Lead.persona == persona)
    if channel:
        q = q.filter(Lead.channel == channel)
    total = q.count()
    leads = q.order_by(desc(Lead.intent_score), desc(Lead.updated_at)).offset(skip).limit(limit).all()
    return leads, total


def get_lead_by_conversation(db: Session, conversation_id: str) -> Lead | None:
    return db.query(Lead).filter_by(conversation_id=conversation_id).first()
