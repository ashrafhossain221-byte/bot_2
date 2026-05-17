"""Multi-tenant management API."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.tenant_service import create_tenant, get_tenant, list_tenants, update_tenant, delete_tenant

router = APIRouter()


class TenantCreate(BaseModel):
    business_name: str
    subdomain: Optional[str] = None
    plan: str = "starter"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    monthly_message_limit: str = "1000"
    settings: Optional[dict] = None


class TenantUpdate(BaseModel):
    business_name: Optional[str] = None
    subdomain: Optional[str] = None
    plan: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    monthly_message_limit: Optional[str] = None
    settings: Optional[dict] = None


def _tenant_dict(t) -> dict:
    return {
        "id": str(t.id),
        "business_name": t.business_name,
        "subdomain": t.subdomain,
        "plan": t.plan,
        "is_active": t.is_active,
        "contact_email": t.contact_email,
        "contact_phone": t.contact_phone,
        "notes": t.notes,
        "monthly_message_limit": t.monthly_message_limit,
        "settings": t.settings,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("")
def list_tenants_route(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    tenants, total = list_tenants(db, skip=skip, limit=limit)
    return {"tenants": [_tenant_dict(t) for t in tenants], "total": total}


@router.get("/{tenant_id}")
def get_tenant_route(tenant_id: str, db: Session = Depends(get_db)):
    t = get_tenant(db, tenant_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_dict(t)


@router.post("", status_code=201)
def create_tenant_route(body: TenantCreate, db: Session = Depends(get_db)):
    t = create_tenant(db, body.model_dump())
    return _tenant_dict(t)


@router.patch("/{tenant_id}")
def update_tenant_route(tenant_id: str, body: TenantUpdate, db: Session = Depends(get_db)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    t = update_tenant(db, tenant_id, data)
    if not t:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_dict(t)


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant_route(tenant_id: str, db: Session = Depends(get_db)):
    if not delete_tenant(db, tenant_id):
        raise HTTPException(status_code=404, detail="Tenant not found")
