"""Orders API."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.order_service import create_order, get_order, list_orders, update_status, update_order, get_order_stats

router = APIRouter()


class OrderItemCreate(BaseModel):
    product_id: Optional[str] = None
    product_name: str
    variant: Optional[dict] = None
    quantity: int = 1
    unit_price: float = 0.0


class OrderCreate(BaseModel):
    lead_id: Optional[str] = None
    conversation_id: Optional[str] = None
    channel: str = "website"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    delivery_charge: float = 0.0
    discount: float = 0.0
    currency: str = "BDT"
    items: list[OrderItemCreate] = []


class StatusUpdate(BaseModel):
    status: str


def _order_dict(o) -> dict:
    return {
        "id": str(o.id),
        "lead_id": str(o.lead_id) if o.lead_id else None,
        "conversation_id": str(o.conversation_id) if o.conversation_id else None,
        "channel": o.channel,
        "status": o.status.value,
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone,
        "customer_address": o.customer_address,
        "notes": o.notes,
        "total_amount": o.total_amount,
        "currency": o.currency,
        "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "delivery_charge": o.delivery_charge,
        "discount": o.discount,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        "items": [
            {
                "id": str(i.id),
                "product_id": str(i.product_id) if i.product_id else None,
                "product_name": i.product_name,
                "variant": i.variant,
                "quantity": i.quantity,
                "unit_price": i.unit_price,
                "subtotal": i.subtotal,
            }
            for i in (o.items or [])
        ],
    }


@router.get("")
def list_orders_route(
    status: Optional[str] = None,
    lead_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    orders, total = list_orders(db, status=status, lead_id=lead_id, skip=skip, limit=limit)
    return {"orders": [_order_dict(o) for o in orders], "total": total, "skip": skip, "limit": limit}


@router.get("/stats")
def order_stats(db: Session = Depends(get_db)):
    return get_order_stats(db)


@router.get("/{order_id}")
def get_order_route(order_id: str, db: Session = Depends(get_db)):
    o = get_order(db, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_dict(o)


@router.post("", status_code=201)
def create_order_route(body: OrderCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    data["items"] = [i for i in data["items"]]
    o = create_order(db, data)
    return _order_dict(o)


@router.patch("/{order_id}/status")
def update_order_status(order_id: str, body: StatusUpdate, db: Session = Depends(get_db)):
    o = update_status(db, order_id, body.status)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_dict(o)


class OrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None
    delivery_charge: Optional[float] = None
    discount: Optional[float] = None


@router.patch("/{order_id}")
def update_order_route(order_id: str, body: OrderUpdate, db: Session = Depends(get_db)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    o = update_order(db, order_id, data)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_dict(o)
