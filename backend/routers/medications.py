"""Medications router."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import MedicationRecord
from backend.schemas.misc import MedicationRecordCreate, MedicationRecordOut

router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.get("", response_model=List[MedicationRecordOut])
def list_medications(
    is_aps_related: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(MedicationRecord)
    if is_aps_related is not None:
        q = q.filter(MedicationRecord.is_aps_related == is_aps_related)
    return q.order_by(MedicationRecord.start_date.desc()).all()


@router.post("", response_model=MedicationRecordOut)
def create_medication(payload: MedicationRecordCreate, db: Session = Depends(get_db)):
    obj = MedicationRecord(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{medication_id}", response_model=MedicationRecordOut)
def update_medication(medication_id: str, payload: MedicationRecordCreate, db: Session = Depends(get_db)):
    obj = db.query(MedicationRecord).get(medication_id)
    if not obj:
        raise HTTPException(404, "用药记录不存在")
    for k, v in payload.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{medication_id}")
def delete_medication(medication_id: str, db: Session = Depends(get_db)):
    obj = db.query(MedicationRecord).get(medication_id)
    if not obj:
        raise HTTPException(404, "用药记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}
