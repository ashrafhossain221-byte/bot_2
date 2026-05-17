from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from services.dashboard_service import get_dashboard

router = APIRouter()


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    return get_dashboard(db)
