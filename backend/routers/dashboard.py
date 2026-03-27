"""Dashboard router: summary + SLEDAI estimation."""
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import IndicatorDefinition, IndicatorRecord, INRDoseLog
from backend.schemas.misc import DashboardSummary, IndicatorSummaryItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _status(val: Optional[float], defn: IndicatorDefinition) -> str:
    if val is None:
        return "unknown"
    if defn.warn_low is not None and val < defn.warn_low:
        return "danger"
    if defn.warn_high is not None and val > defn.warn_high:
        return "danger"
    if defn.ref_min is not None and val < defn.ref_min:
        return "warning"
    if defn.ref_max is not None and val > defn.ref_max:
        return "warning"
    return "normal"


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    defns = db.query(IndicatorDefinition).order_by(
        IndicatorDefinition.sort_order
    ).all()

    items = []
    last_dates = []
    for defn in defns:
        latest = (
            db.query(IndicatorRecord)
            .filter(IndicatorRecord.indicator_id == defn.id)
            .order_by(IndicatorRecord.recorded_at.desc())
            .first()
        )
        if latest:
            last_dates.append(latest.recorded_at)
        items.append(IndicatorSummaryItem(
            indicator_id=defn.id,
            indicator_name=defn.name,
            indicator_code=defn.code,
            unit=defn.unit,
            latest_value=latest.value if latest else None,
            latest_value_text=latest.value_text if latest else None,
            latest_date=str(latest.recorded_at) if latest else None,
            ref_min=defn.ref_min,
            ref_max=defn.ref_max,
            warn_low=defn.warn_low,
            warn_high=defn.warn_high,
            status=_status(latest.value if latest else None, defn),
        ))

    total = db.query(IndicatorRecord).count()
    last_update = str(max(last_dates)) if last_dates else None
    inr_latest = db.query(INRDoseLog).order_by(INRDoseLog.log_date.desc()).first()

    # upcoming: next_test_date 未来 7 天的 INR 复查提醒
    from datetime import date, timedelta
    today = date.today()
    upcoming_logs = (
        db.query(INRDoseLog)
        .filter(INRDoseLog.next_test_date >= today)
        .filter(INRDoseLog.next_test_date <= today + timedelta(days=14))
        .order_by(INRDoseLog.next_test_date)
        .all()
    )
    upcoming = [f"INR 复查：{l.next_test_date}" for l in upcoming_logs]

    return DashboardSummary(
        total_records=total,
        last_update=last_update,
        indicators=items,
        inr_latest=inr_latest,
        upcoming_tests=upcoming,
    )
