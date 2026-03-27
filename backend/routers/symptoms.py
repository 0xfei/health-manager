"""Symptoms router."""
import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import SymptomRecord
from backend.schemas.misc import SymptomRecordCreate, SymptomRecordOut

router = APIRouter(prefix="/api/symptoms", tags=["symptoms"])


@router.get("/records", response_model=List[SymptomRecordOut])
def list_symptoms(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(SymptomRecord)
    if start_date:
        q = q.filter(SymptomRecord.recorded_at >= start_date)
    if end_date:
        q = q.filter(SymptomRecord.recorded_at <= end_date)
    return q.order_by(SymptomRecord.recorded_at.desc()).all()


@router.post("/records", response_model=SymptomRecordOut)
def create_symptom(payload: SymptomRecordCreate, db: Session = Depends(get_db)):
    obj = SymptomRecord(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/records/{record_id}")
def delete_symptom(record_id: str, db: Session = Depends(get_db)):
    obj = db.query(SymptomRecord).get(record_id)
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}
