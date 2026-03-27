"""APS router: INR dose logs + timeline."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import INRDoseLog, MedicationRecord
from backend.schemas.misc import (
    INRDoseLogCreate, INRDoseLogOut,
    INRTimelinePoint, MedicationRecordOut,
)

router = APIRouter(prefix="/api/aps", tags=["aps"])


@router.post("/inr-dose-log", response_model=INRDoseLogOut)
def create_inr_log(payload: INRDoseLogCreate, db: Session = Depends(get_db)):
    obj = INRDoseLog(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/inr-dose-logs", response_model=List[INRDoseLogOut])
def list_inr_logs(db: Session = Depends(get_db)):
    return db.query(INRDoseLog).order_by(INRDoseLog.log_date.desc()).all()


@router.delete("/inr-dose-log/{log_id}")
def delete_inr_log(log_id: str, db: Session = Depends(get_db)):
    obj = db.query(INRDoseLog).get(log_id)
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@router.get("/inr-latest", response_model=Optional[INRDoseLogOut])
def inr_latest(db: Session = Depends(get_db)):
    return db.query(INRDoseLog).order_by(INRDoseLog.log_date.desc()).first()


@router.get("/inr-timeline", response_model=List[INRTimelinePoint])
def inr_timeline(db: Session = Depends(get_db)):
    logs = db.query(INRDoseLog).order_by(INRDoseLog.log_date).all()
    return [
        INRTimelinePoint(
            date=str(l.log_date),
            inr_value=l.inr_value,
            warfarin_dose=l.warfarin_dose,
            note=l.note,
            next_test_date=str(l.next_test_date) if l.next_test_date else None,
        )
        for l in logs
    ]


@router.get("/medications", response_model=List[MedicationRecordOut])
def aps_medications(db: Session = Depends(get_db)):
    return db.query(MedicationRecord).filter(
        MedicationRecord.is_aps_related == True
    ).order_by(MedicationRecord.start_date.desc()).all()
