"""Tenant management service (for future multi-tenant SaaS)."""
from sqlalchemy.orm import Session
from models.tenant import Tenant


def create_tenant(db: Session, data: dict) -> Tenant:
    t = Tenant(**data)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def get_tenant(db: Session, tenant_id: str) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def list_tenants(db: Session, skip: int = 0, limit: int = 50) -> tuple[list[Tenant], int]:
    q = db.query(Tenant).order_by(Tenant.business_name)
    total = q.count()
    return q.offset(skip).limit(limit).all(), total


def update_tenant(db: Session, tenant_id: str, data: dict) -> Tenant | None:
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        return None
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t


def delete_tenant(db: Session, tenant_id: str) -> bool:
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True
