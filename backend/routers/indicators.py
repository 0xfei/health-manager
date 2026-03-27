"""Indicators router: definitions + records + chart data."""
from datetime import date
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import IndicatorDefinition, IndicatorRecord
from backend.schemas.indicators import (
    IndicatorDefinitionCreate, IndicatorDefinitionOut,
    IndicatorRecordCreate, IndicatorRecordOut,
    IndicatorChartData, ChartDataPoint,
)

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


# ── Definitions ────────────────────────────────────────────────────────────────

@router.get("/definitions", response_model=List[IndicatorDefinitionOut])
def list_definitions(db: Session = Depends(get_db)):
    return db.query(IndicatorDefinition).order_by(
        IndicatorDefinition.sort_order, IndicatorDefinition.name
    ).all()


@router.post("/definitions", response_model=IndicatorDefinitionOut)
def create_definition(payload: IndicatorDefinitionCreate, db: Session = Depends(get_db)):
    existing = db.query(IndicatorDefinition).filter_by(code=payload.code).first()
    if existing:
        raise HTTPException(400, f"指标代码 '{payload.code}' 已存在")
    obj = IndicatorDefinition(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/definitions/{definition_id}", response_model=IndicatorDefinitionOut)
def update_definition(definition_id: str, payload: IndicatorDefinitionCreate, db: Session = Depends(get_db)):
    obj = db.query(IndicatorDefinition).get(definition_id)
    if not obj:
        raise HTTPException(404, "指标定义不存在")
    for k, v in payload.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/definitions/{definition_id}")
def delete_definition(definition_id: str, db: Session = Depends(get_db)):
    obj = db.query(IndicatorDefinition).get(definition_id)
    if not obj:
        raise HTTPException(404, "指标定义不存在")
    if obj.is_system:
        raise HTTPException(400, "系统预置指标不可删除")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Records ────────────────────────────────────────────────────────────────────

def _enrich(record: IndicatorRecord) -> dict:
    d = {c.name: getattr(record, c.name) for c in record.__table__.columns}
    if record.definition:
        d["indicator_name"] = record.definition.name
        d["indicator_code"] = record.definition.code
        d["unit"] = record.definition.unit
        d["ref_min"] = record.definition.ref_min
        d["ref_max"] = record.definition.ref_max
        d["warn_low"] = record.definition.warn_low
        d["warn_high"] = record.definition.warn_high
    return d


@router.get("/records", response_model=List[IndicatorRecordOut])
def list_records(
    indicator_id: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(IndicatorRecord)
    if indicator_id:
        q = q.filter(IndicatorRecord.indicator_id == indicator_id)
    if start_date:
        q = q.filter(IndicatorRecord.recorded_at >= start_date)
    if end_date:
        q = q.filter(IndicatorRecord.recorded_at <= end_date)
    records = q.order_by(IndicatorRecord.recorded_at.desc()).all()
    return [_enrich(r) for r in records]


@router.post("/records", response_model=IndicatorRecordOut)
def create_record(payload: IndicatorRecordCreate, db: Session = Depends(get_db)):
    defn = db.query(IndicatorDefinition).get(payload.indicator_id)
    if not defn:
        raise HTTPException(404, "指标定义不存在")
    obj = IndicatorRecord(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj)


@router.delete("/records/{record_id}")
def delete_record(record_id: str, db: Session = Depends(get_db)):
    obj = db.query(IndicatorRecord).get(record_id)
    if not obj:
        raise HTTPException(404, "记录不存在")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ── Chart data ─────────────────────────────────────────────────────────────────

@router.get("/records/chart-data", response_model=List[IndicatorChartData])
def chart_data(
    indicator_ids: Optional[str] = Query(None, description="逗号分隔的指标ID"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    ids = [i.strip() for i in indicator_ids.split(",")] if indicator_ids else None
    defns_q = db.query(IndicatorDefinition)
    if ids:
        defns_q = defns_q.filter(IndicatorDefinition.id.in_(ids))
    defns = defns_q.order_by(IndicatorDefinition.sort_order).all()

    result = []
    for defn in defns:
        q = db.query(IndicatorRecord).filter(IndicatorRecord.indicator_id == defn.id)
        if start_date:
            q = q.filter(IndicatorRecord.recorded_at >= start_date)
        if end_date:
            q = q.filter(IndicatorRecord.recorded_at <= end_date)
        records = q.order_by(IndicatorRecord.recorded_at).all()
        result.append(IndicatorChartData(
            indicator_id=defn.id,
            indicator_name=defn.name,
            indicator_code=defn.code,
            unit=defn.unit,
            ref_min=defn.ref_min,
            ref_max=defn.ref_max,
            warn_low=defn.warn_low,
            warn_high=defn.warn_high,
            data=[
                ChartDataPoint(
                    date=str(r.recorded_at),
                    value=r.value,
                    value_text=r.value_text,
                )
                for r in records
            ],
        ))
    return result
