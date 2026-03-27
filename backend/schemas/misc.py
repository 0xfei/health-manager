"""Pydantic schemas for symptoms, medications, visits, APS, upload."""
from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel


# ── Symptoms ──────────────────────────────────────────────────────────────────

class ParsedSymptom(BaseModel):
    symptom_name: str
    category: str
    severity: Optional[int] = None
    duration: Optional[str] = None


class SymptomRecordCreate(BaseModel):
    recorded_at: date
    raw_text: str
    severity: Optional[int] = None


class SymptomRecordOut(BaseModel):
    id: str
    recorded_at: date
    raw_text: Optional[str] = None
    parsed_symptoms: Optional[List[ParsedSymptom]] = None
    severity: Optional[int] = None
    ai_summary: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Medications ───────────────────────────────────────────────────────────────

class MedicationRecordCreate(BaseModel):
    drug_name: str
    dosage: Optional[str] = None
    dosage_value: Optional[float] = None
    dosage_unit: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    category: Optional[str] = None
    is_aps_related: bool = False
    note: Optional[str] = None


class MedicationRecordOut(MedicationRecordCreate):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── APS / INR ─────────────────────────────────────────────────────────────────

class INRDoseLogCreate(BaseModel):
    log_date: date
    inr_value: Optional[float] = None
    warfarin_dose: Optional[float] = None
    note: Optional[str] = None
    next_test_date: Optional[date] = None


class INRDoseLogOut(INRDoseLogCreate):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class INRTimelinePoint(BaseModel):
    date: str
    inr_value: Optional[float] = None
    warfarin_dose: Optional[float] = None
    note: Optional[str] = None
    next_test_date: Optional[str] = None


# ── Visits ────────────────────────────────────────────────────────────────────

class VisitRecordCreate(BaseModel):
    visit_date: date
    hospital: Optional[str] = None
    doctor: Optional[str] = None
    diagnosis: Optional[str] = None
    advice: Optional[str] = None
    attachments: Optional[List[Any]] = None


class VisitRecordOut(VisitRecordCreate):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Upload / AI parse ─────────────────────────────────────────────────────────

class IndicatorValue(BaseModel):
    name: str
    code: Optional[str] = None
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    ref_range: Optional[str] = None
    recorded_at: Optional[date] = None


class ParsedLabReport(BaseModel):
    report_date: Optional[date] = None
    hospital: Optional[str] = None
    patient_name: Optional[str] = None
    indicators: List[IndicatorValue] = []
    confidence: float = 0.0


class UploadRecordOut(BaseModel):
    id: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    status: str
    ai_parsed_json: Optional[Any] = None
    error_msg: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class IndicatorSummaryItem(BaseModel):
    indicator_id: str
    indicator_name: str
    indicator_code: str
    unit: Optional[str] = None
    latest_value: Optional[float] = None
    latest_value_text: Optional[str] = None
    latest_date: Optional[str] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    warn_low: Optional[float] = None
    warn_high: Optional[float] = None
    status: str = "normal"  # normal / warning / danger / unknown


class DashboardSummary(BaseModel):
    total_records: int
    last_update: Optional[str] = None
    indicators: List[IndicatorSummaryItem]
    inr_latest: Optional[INRDoseLogOut] = None
    upcoming_tests: List[str] = []
