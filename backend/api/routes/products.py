"""Product catalog CRUD API."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from core.database import get_db
from services.product_service import (
    get_all_products, get_product, create_product, update_product, delete_product, search_products
)

router = APIRouter()


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = 0.0
    currency: str = "BDT"
    stock: int = 0
    sku: Optional[str] = None
    category: Optional[str] = None
    variants: Optional[list] = None
    images: Optional[list] = None
    is_active: bool = True
    keywords: Optional[list] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    stock: Optional[int] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    variants: Optional[list] = None
    images: Optional[list] = None
    is_active: Optional[bool] = None
    keywords: Optional[list] = None


def _product_dict(p) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "currency": p.currency,
        "stock": p.stock,
        "sku": p.sku,
        "category": p.category,
        "variants": p.variants,
        "images": p.images,
        "is_active": p.is_active,
        "keywords": p.keywords,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
def list_products(
    category: Optional[str] = None,
    active_only: bool = True,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if search:
        products = search_products(db, search, limit=50)
    else:
        products = get_all_products(db, category=category, active_only=active_only)
    return {"products": [_product_dict(p) for p in products], "total": len(products)}


@router.get("/{product_id}")
def get_product_route(product_id: str, db: Session = Depends(get_db)):
    p = get_product(db, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_dict(p)


@router.post("", status_code=201)
def create_product_route(body: ProductCreate, db: Session = Depends(get_db)):
    data = body.model_dump()
    p = create_product(db, data)
    return _product_dict(p)


@router.patch("/{product_id}")
def update_product_route(product_id: str, body: ProductUpdate, db: Session = Depends(get_db)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    p = update_product(db, product_id, data)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_dict(p)


@router.delete("/{product_id}", status_code=204)
def delete_product_route(product_id: str, db: Session = Depends(get_db)):
    if not delete_product(db, product_id):
        raise HTTPException(status_code=404, detail="Product not found")
