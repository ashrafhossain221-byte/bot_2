"""Order management service."""
from sqlalchemy.orm import Session
from models.order import Order, OrderItem, OrderStatus


def create_order(db: Session, data: dict) -> Order:
    items_data = data.pop("items", [])
    order = Order(**data)
    db.add(order)
    db.flush()  # get order.id

    total = 0.0
    for item_data in items_data:
        subtotal = item_data.get("unit_price", 0) * item_data.get("quantity", 1)
        item = OrderItem(order_id=order.id, subtotal=subtotal, **item_data)
        db.add(item)
        total += subtotal

    order.total_amount = total + order.delivery_charge - order.discount
    db.commit()
    db.refresh(order)
    return order


def get_order(db: Session, order_id: str) -> Order | None:
    return db.query(Order).filter(Order.id == order_id).first()


def list_orders(
    db: Session,
    status: str | None = None,
    lead_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Order], int]:
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    if lead_id:
        q = q.filter(Order.lead_id == lead_id)
    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders, total


def update_status(db: Session, order_id: str, new_status: str) -> Order | None:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    order.status = OrderStatus(new_status)
    db.commit()
    db.refresh(order)
    return order


def update_order(db: Session, order_id: str, data: dict) -> Order | None:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return None
    for k, v in data.items():
        if k != "items":
            setattr(order, k, v)
    db.commit()
    db.refresh(order)
    return order


def get_order_stats(db: Session) -> dict:
    from sqlalchemy import func
    total = db.query(Order).count()
    by_status = {}
    for status in OrderStatus:
        count = db.query(Order).filter(Order.status == status).count()
        by_status[status.value] = count
    revenue = db.query(func.sum(Order.total_amount)).filter(
        Order.status.in_([OrderStatus.delivered, OrderStatus.dispatched])
    ).scalar() or 0.0
    return {"total": total, "by_status": by_status, "revenue": float(revenue)}
