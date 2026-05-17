"""
Analytics Service — Phase 7
Provides time-series and aggregated metrics for the analytics dashboard.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from models.conversation import Conversation, Channel
from models.message import Message, MessageRole
from models.lead import Lead, LeadStage, Persona
from models.order import Order, OrderStatus


def get_analytics(db: Session, days: int = 30) -> dict:
    now = datetime.utcnow()
    start = now - timedelta(days=days)

    # ── Daily message volume (last N days) ───────────────────────────────────
    daily_messages = []
    daily_conversations = []
    daily_leads = []
    daily_orders = []

    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day + timedelta(days=1)

        msgs = db.query(func.count(Message.id)).filter(
            and_(Message.created_at >= day, Message.created_at < day_end,
                 Message.role == MessageRole.user)
        ).scalar() or 0

        convs = db.query(func.count(Conversation.id)).filter(
            and_(Conversation.created_at >= day, Conversation.created_at < day_end)
        ).scalar() or 0

        leads = db.query(func.count(Lead.id)).filter(
            and_(Lead.created_at >= day, Lead.created_at < day_end)
        ).scalar() or 0

        orders = db.query(func.count(Order.id)).filter(
            and_(Order.created_at >= day, Order.created_at < day_end)
        ).scalar() or 0

        label = day.strftime("%b %d")
        daily_messages.append({"date": label, "value": msgs})
        daily_conversations.append({"date": label, "value": convs})
        daily_leads.append({"date": label, "value": leads})
        daily_orders.append({"date": label, "value": orders})

    # ── Channel breakdown over period ────────────────────────────────────────
    channel_rows = (
        db.query(Conversation.channel, func.count(Conversation.id))
        .filter(Conversation.created_at >= start)
        .group_by(Conversation.channel)
        .all()
    )
    by_channel = {ch.value: cnt for ch, cnt in channel_rows}

    # ── Lead stage funnel (current) ──────────────────────────────────────────
    stage_rows = db.query(Lead.stage, func.count(Lead.id)).group_by(Lead.stage).all()
    funnel = {s.value: 0 for s in LeadStage}
    for stage, count in stage_rows:
        funnel[stage.value] = count

    # ── Conversion rate ──────────────────────────────────────────────────────
    total_leads = sum(funnel.values())
    converted = funnel.get("CUSTOMER", 0) + funnel.get("REPEAT_CUSTOMER", 0)
    conversion_rate = round(converted / total_leads * 100, 1) if total_leads else 0.0

    # ── Average intent score ─────────────────────────────────────────────────
    avg_intent = db.query(func.avg(Lead.intent_score)).scalar() or 0.0

    # ── Response rate (conversations with ≥1 bot reply / total) ─────────────
    total_convs = db.query(func.count(Conversation.id)).scalar() or 0
    convs_with_reply = (
        db.query(func.count(func.distinct(Message.conversation_id)))
        .filter(Message.role == MessageRole.assistant)
        .scalar() or 0
    )
    response_rate = round(convs_with_reply / total_convs * 100, 1) if total_convs else 0.0

    # ── Order revenue by day ─────────────────────────────────────────────────
    daily_revenue = []
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day + timedelta(days=1)
        rev = db.query(func.sum(Order.total_amount)).filter(
            and_(
                Order.created_at >= day, Order.created_at < day_end,
                Order.status.in_([OrderStatus.delivered, OrderStatus.dispatched]),
            )
        ).scalar() or 0.0
        daily_revenue.append({"date": day.strftime("%b %d"), "value": float(rev)})

    # ── Total revenue ────────────────────────────────────────────────────────
    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_([OrderStatus.delivered, OrderStatus.dispatched])
    ).scalar() or 0.0

    # ── Top personas ─────────────────────────────────────────────────────────
    persona_rows = db.query(Lead.persona, func.count(Lead.id)).group_by(Lead.persona).all()
    by_persona = {p.value: cnt for p, cnt in persona_rows}

    # ── Hot lead conversion (HOT_LEAD → CUSTOMER rate) ──────────────────────
    hot_total = funnel.get("HOT_LEAD", 0) + converted
    hot_conversion = round(converted / hot_total * 100, 1) if hot_total else 0.0

    # ── Messages per conversation (avg) ──────────────────────────────────────
    msg_per_conv = round(
        (db.query(func.count(Message.id)).scalar() or 0) / max(total_convs, 1), 1
    )

    return {
        "period_days": days,
        "summary": {
            "total_conversations": total_convs,
            "total_leads": total_leads,
            "converted": converted,
            "conversion_rate": conversion_rate,
            "hot_conversion_rate": hot_conversion,
            "avg_intent_score": round(float(avg_intent), 2),
            "response_rate": response_rate,
            "msg_per_conversation": msg_per_conv,
            "total_revenue": float(total_revenue),
        },
        "daily_messages": daily_messages,
        "daily_conversations": daily_conversations,
        "daily_leads": daily_leads,
        "daily_orders": daily_orders,
        "daily_revenue": daily_revenue,
        "by_channel": by_channel,
        "by_persona": by_persona,
        "funnel": funnel,
    }
