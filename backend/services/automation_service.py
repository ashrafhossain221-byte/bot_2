"""
Automation Service — Phase 5
Triggers flows and seeds the four default automation flows on startup.
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.lead import Lead
from models.automation import AutomationFlow, AutomationTrigger, ScheduledMessage, ScheduledMessageStatus

logger = logging.getLogger(__name__)

HOT_LEAD_SCORE_THRESHOLD = 7.0


# ─── Default flows seeded on first startup ────────────────────────────────────

DEFAULT_FLOWS = [
    {
        "name": "Lead No-Reply Follow-up",
        "trigger": AutomationTrigger.no_reply_24h,
        "is_default": True,
        "steps": [
            {
                "delay_hours": 0,
                "message": "Hi {name}! We noticed you reached out earlier. Can we help you with anything? 😊",
            },
            {
                "delay_hours": 48,
                "message": "Hi {name}! Just following up — we'd love to assist you. Any questions we can answer?",
            },
            {
                "delay_hours": 120,
                "message": "Hi {name}! This is our last follow-up. Feel free to reach out anytime — we're always here!",
            },
        ],
    },
    {
        "name": "Hot Lead Fast-Track",
        "trigger": AutomationTrigger.hot_lead,
        "is_default": True,
        "steps": [
            {
                "delay_hours": 0,
                "message": "Hi {name}! We see you're very interested 🔥 Let us help you right now — what would you like to know?",
            },
            {
                "delay_hours": 6,
                "message": "Hi {name}! Still thinking about it? We can answer any questions and make the process easy for you.",
            },
        ],
    },
    {
        "name": "Post Purchase Welcome Series",
        "trigger": AutomationTrigger.post_purchase,
        "is_default": True,
        "steps": [
            {
                "delay_hours": 0,
                "message": "🎉 Thank you for your purchase, {name}! We're preparing your order and will keep you updated.",
            },
            {
                "delay_hours": 24,
                "message": "Hi {name}! How is everything? We hope you're happy with your experience so far!",
            },
            {
                "delay_hours": 72,
                "message": "Hi {name}! Would you like to share your experience? Your feedback means a lot to us ⭐",
            },
            {
                "delay_hours": 336,
                "message": "Hi {name}! It's been 2 weeks since your purchase. Hope everything is great! Come back anytime 😊",
            },
        ],
    },
    {
        "name": "Lead Captured Welcome",
        "trigger": AutomationTrigger.lead_captured,
        "is_default": True,
        "steps": [
            {
                "delay_hours": 0,
                "message": "Hi {name}! Thanks for reaching out 👋 We've saved your contact and will be in touch soon!",
            },
        ],
    },
]


def seed_default_flows(db: Session):
    """Called on startup. Seeds default flows only if none exist yet."""
    existing_count = db.query(AutomationFlow).count()
    if existing_count > 0:
        return
    for f in DEFAULT_FLOWS:
        flow = AutomationFlow(
            name=f["name"],
            trigger=f["trigger"],
            steps=f["steps"],
            is_active=True,
            is_default=f.get("is_default", False),
        )
        db.add(flow)
    db.commit()
    logger.info("Seeded %d default automation flows", len(DEFAULT_FLOWS))


def _render_message(template: str, lead: Lead) -> str:
    """Substitute {name} and other placeholders in message templates."""
    return template.format(
        name=lead.name or "there",
        phone=lead.phone or "",
        email=lead.email or "",
        channel=lead.channel,
    )


def trigger_flow(db: Session, lead: Lead, trigger: AutomationTrigger):
    """
    Find all active flows matching the trigger.
    For each flow, schedule its steps — unless already triggered for this lead.
    """
    flows = db.query(AutomationFlow).filter_by(trigger=trigger, is_active=True).all()
    if not flows:
        return

    for flow in flows:
        # Skip if this flow already has pending/sent messages for this lead
        already = (
            db.query(ScheduledMessage)
            .filter_by(lead_id=lead.id, flow_id=flow.id)
            .filter(ScheduledMessage.status.in_([
                ScheduledMessageStatus.pending,
                ScheduledMessageStatus.sent,
            ]))
            .first()
        )
        if already:
            continue

        steps = flow.steps or []
        for step in steps:
            delay_hours = step.get("delay_hours", 0)
            raw_message = step.get("message", "")
            rendered = _render_message(raw_message, lead)
            scheduled_at = datetime.utcnow() + timedelta(hours=delay_hours)

            sched = ScheduledMessage(
                lead_id=lead.id,
                flow_id=flow.id,
                channel=lead.channel,
                message=rendered,
                scheduled_at=scheduled_at,
                status=ScheduledMessageStatus.pending,
            )
            db.add(sched)

        logger.info("Triggered flow %r for lead %s (%d steps)", flow.name, lead.id, len(steps))

    db.commit()


def cancel_pending_for_lead(db: Session, lead_id: str):
    """Cancel all pending scheduled messages for a lead (e.g. on stage upgrade)."""
    db.query(ScheduledMessage).filter_by(
        lead_id=lead_id, status=ScheduledMessageStatus.pending
    ).update({"status": ScheduledMessageStatus.cancelled})
    db.commit()


def check_and_fire_triggers(db: Session, lead: Lead, prev_score: float, prev_stage: str):
    """
    Called after every message. Compares old vs new lead state
    and fires the appropriate automation trigger if conditions are met.
    """
    from models.lead import LeadStage

    # hot_lead trigger: score just crossed threshold
    if lead.intent_score >= HOT_LEAD_SCORE_THRESHOLD and prev_score < HOT_LEAD_SCORE_THRESHOLD:
        trigger_flow(db, lead, AutomationTrigger.hot_lead)

    # lead_captured trigger: contact was just saved
    has_contact = bool(lead.phone or lead.email)
    had_no_contact = prev_stage == LeadStage.NEW.value and has_contact
    if had_no_contact and lead.stage.value in (LeadStage.LEAD.value, LeadStage.HOT_LEAD.value):
        trigger_flow(db, lead, AutomationTrigger.lead_captured)

    # post_purchase trigger: just became a customer
    if lead.stage.value == LeadStage.CUSTOMER.value and prev_stage != LeadStage.CUSTOMER.value:
        cancel_pending_for_lead(db, str(lead.id))   # cancel old follow-ups
        trigger_flow(db, lead, AutomationTrigger.post_purchase)
