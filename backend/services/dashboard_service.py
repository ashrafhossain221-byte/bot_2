"""
Dashboard Service — Phase 3
Single-query aggregation that powers the CRM overview page.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from models.conversation import Conversation, Channel, ConversationStage
from models.message import Message, MessageRole
from models.lead import Lead, LeadStage, Persona
from models.order import Order, OrderStatus


def get_dashboard(db: Session) -> dict:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    # ── Conversation counts ──────────────────────────────────────────────────
    total_conversations = db.query(func.count(Conversation.id)).scalar() or 0
    new_today = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.created_at >= today_start)
        .scalar() or 0
    )
    new_this_week = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.created_at >= week_start)
        .scalar() or 0
    )

    # ── Message counts ───────────────────────────────────────────────────────
    total_messages = db.query(func.count(Message.id)).scalar() or 0
    user_messages = (
        db.query(func.count(Message.id))
        .filter(Message.role == MessageRole.user)
        .scalar() or 0
    )

    # ── Lead funnel ──────────────────────────────────────────────────────────
    stage_rows = (
        db.query(Lead.stage, func.count(Lead.id))
        .group_by(Lead.stage)
        .all()
    )
    funnel = {s.value: 0 for s in LeadStage}
    for stage, count in stage_rows:
        funnel[stage.value] = count

    total_leads = sum(funnel.values())
    hot_leads = funnel.get("HOT_LEAD", 0)
    customers = funnel.get("CUSTOMER", 0) + funnel.get("REPEAT_CUSTOMER", 0)

    # ── Channel breakdown ────────────────────────────────────────────────────
    channel_rows = (
        db.query(Conversation.channel, func.count(Conversation.id))
        .group_by(Conversation.channel)
        .all()
    )
    by_channel = {ch.value: cnt for ch, cnt in channel_rows}

    # ── Persona breakdown ────────────────────────────────────────────────────
    persona_rows = (
        db.query(Lead.persona, func.count(Lead.id))
        .group_by(Lead.persona)
        .all()
    )
    by_persona = {p.value: cnt for p, cnt in persona_rows}

    # ── Daily conversation trend (last 7 days) ───────────────────────────────
    trend = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        count = (
            db.query(func.count(Conversation.id))
            .filter(Conversation.created_at >= day, Conversation.created_at < day_end)
            .scalar() or 0
        )
        trend.append({"date": day.strftime("%b %d"), "conversations": count})

    # ── Recent conversations ─────────────────────────────────────────────────
    recent_convs = (
        db.query(Conversation)
        .order_by(desc(Conversation.updated_at))
        .limit(10)
        .all()
    )
    recent = []
    for conv in recent_convs:
        last_msg = (
            db.query(Message)
            .filter_by(conversation_id=conv.id)
            .order_by(desc(Message.created_at))
            .first()
        )
        lead = db.query(Lead).filter_by(conversation_id=conv.id).first()
        recent.append({
            "id": str(conv.id),
            "channel": conv.channel.value,
            "user_name": conv.user_name,
            "stage": conv.stage.value,
            "updated_at": conv.updated_at.isoformat(),
            "last_message": last_msg.content[:80] if last_msg else "",
            "last_message_role": last_msg.role.value if last_msg else "",
            "intent_score": lead.intent_score if lead else 0.0,
            "persona": lead.persona.value if lead else "general",
            "lead_stage": lead.stage.value if lead else "NEW",
        })

    # ── Hot leads panel ──────────────────────────────────────────────────────
    hot_lead_rows = (
        db.query(Lead)
        .filter(Lead.stage == LeadStage.HOT_LEAD)
        .order_by(desc(Lead.intent_score))
        .limit(5)
        .all()
    )
    hot_list = []
    for hl in hot_lead_rows:
        conv = db.query(Conversation).filter_by(id=hl.conversation_id).first()
        hot_list.append({
            "lead_id": str(hl.id),
            "conversation_id": str(hl.conversation_id),
            "name": hl.name,
            "phone": hl.phone,
            "channel": hl.channel,
            "intent_score": hl.intent_score,
            "persona": hl.persona.value,
            "updated_at": hl.updated_at.isoformat(),
        })

    # ── Order stats ──────────────────────────────────────────────────────────
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    orders_new = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.new).scalar() or 0
    orders_dispatched = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.dispatched).scalar() or 0
    orders_delivered = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.delivered).scalar() or 0
    revenue = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_([OrderStatus.delivered, OrderStatus.dispatched])
    ).scalar() or 0.0

    return {
        "overview": {
            "total_conversations": total_conversations,
            "new_today": new_today,
            "new_this_week": new_this_week,
            "total_messages": total_messages,
            "user_messages": user_messages,
            "total_leads": total_leads,
            "hot_leads": hot_leads,
            "customers": customers,
            "total_orders": total_orders,
            "orders_new": orders_new,
            "orders_dispatched": orders_dispatched,
            "orders_delivered": orders_delivered,
            "revenue": float(revenue),
        },
        "funnel": funnel,
        "by_channel": by_channel,
        "by_persona": by_persona,
        "trend": trend,
        "recent_conversations": recent,
        "hot_leads_panel": hot_list,
    }
