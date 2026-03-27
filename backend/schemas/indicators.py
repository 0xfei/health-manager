"""Pydantic schemas for indicators."""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


class IndicatorDefinitionBase(BaseModel):
    name: str
    code: str
    unit: Optional[str] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    warn_low: Optional[float] = None
    warn_high: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0


class IndicatorDefinitionCreate(IndicatorDefinitionBase):
    is_system: bool = False


class IndicatorDefinitionOut(IndicatorDefinitionBase):
    id: str
    is_system: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class IndicatorRecordBase(BaseModel):
    indicator_id: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    recorded_at: date
    source_type: str = "manual"
    note: Optional[str] = None


class IndicatorRecordCreate(IndicatorRecordBase):
    pass


class IndicatorRecordOut(IndicatorRecordBase):
    id: str
    source_ref: Optional[str] = None
    created_at: datetime
    # denormalized from definition
    indicator_name: Optional[str] = None
    indicator_code: Optional[str] = None
    unit: Optional[str] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    warn_low: Optional[float] = None
    warn_high: Optional[float] = None

    model_config = {"from_attributes": True}


class ChartDataPoint(BaseModel):
    date: str
    value: Optional[float] = None
    value_text: Optional[str] = None


class IndicatorChartData(BaseModel):
    indicator_id: str
    indicator_name: str
    indicator_code: str
    unit: Optional[str] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    warn_low: Optional[float] = None
    warn_high: Optional[float] = None
    data: List[ChartDataPoint]
