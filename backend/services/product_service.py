"""Product catalog service."""
from sqlalchemy.orm import Session
from models.product import Product


def search_products(db: Session, query: str, limit: int = 5) -> list[Product]:
    """Full-text style search: name, description, category, keywords."""
    q = query.lower()
    products = db.query(Product).filter(Product.is_active == True).all()
    scored = []
    for p in products:
        score = 0
        if q in (p.name or "").lower():
            score += 3
        if q in (p.description or "").lower():
            score += 1
        if q in (p.category or "").lower():
            score += 2
        if p.keywords and any(q in str(k).lower() for k in p.keywords):
            score += 2
        if score > 0:
            scored.append((score, p))
    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:limit]]


def format_catalog_context(products: list[Product]) -> str:
    """Format products into an AI-injectable context block."""
    if not products:
        return ""
    lines = ["[PRODUCT CATALOG]"]
    for p in products:
        line = f"- {p.name}: {p.currency} {p.price:.0f}"
        if p.stock == 0:
            line += " (out of stock)"
        elif p.stock < 5:
            line += f" (only {p.stock} left)"
        if p.description:
            line += f" — {p.description[:100]}"
        if p.variants:
            variants_str = ", ".join(
                f"{v.get('size', '')} {v.get('color', '')}".strip()
                for v in p.variants[:4]
            )
            if variants_str:
                line += f" [Variants: {variants_str}]"
        lines.append(line)
    return "\n".join(lines)


def get_all_products(db: Session, category: str | None = None, active_only: bool = True) -> list[Product]:
    q = db.query(Product)
    if active_only:
        q = q.filter(Product.is_active == True)
    if category:
        q = q.filter(Product.category == category)
    return q.order_by(Product.name).all()


def get_product(db: Session, product_id: str) -> Product | None:
    return db.query(Product).filter(Product.id == product_id).first()


def create_product(db: Session, data: dict) -> Product:
    p = Product(**data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def update_product(db: Session, product_id: str, data: dict) -> Product | None:
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        return None
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


def delete_product(db: Session, product_id: str) -> bool:
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True
