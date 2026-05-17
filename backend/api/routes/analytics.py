"""Analytics API — aggregated metrics for the analytics dashboard."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.database import get_db
from services.analytics_service import get_analytics

router = APIRouter()


@router.get("")
def analytics(
    days: int = Query(default=30, ge=7, le=90),
    db: Session = Depends(get_db),
):
    return get_analytics(db, days=days)
