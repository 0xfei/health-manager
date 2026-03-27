"""Visits router."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import VisitRecord
from backend.schemas.misc import VisitRecordCreate, VisitRecordOut

router = APIRouter(prefix="/api/visits", tags=["visits"])


@router.get("", response_model=List[VisitRecordOut])
def list_visits(db: Session = Depends(get_db)):
    return db.query(VisitRecord).order_by(VisitRecord.visit_date.desc()).all()


@router.post("", response_model=VisitRecordOut)
def create_visit(payload: VisitRecordCreate, db: Session = Depends(get_db)):
    obj = VisitRecord(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{visit_id}")
def delete_visit(visit_id: str, db: Session = Depends(get_db)):
    obj = db.query(VisitRecord).get(visit_id)
    if not obj:
        raise HTTPException(404, "就诊记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}
