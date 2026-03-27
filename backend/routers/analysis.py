"""Analysis router: 指标变化分析与智能提醒。

GET /api/analysis/changes?days=90
  - 扫描最近 days 天的指标记录和用药记录
  - 返回结构化 ChangeEvent 列表（无需额外 AI 调用，纯算法）
"""
from datetime import date, timedelta
from typing import List, Optional
from math import isfinite

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import (
    IndicatorDefinition, IndicatorRecord, MedicationRecord, INRDoseLog
)
from backend.schemas.misc import ChangeEvent, AnalysisResult

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


# ── 重点监测指标 code → 复查超期天数 ─────────────────────────────────────────

OVERDUE_THRESHOLDS: dict[str, int] = {
    "WBC":      90,
    "PLT":      90,
    "HGB":      90,
    "RBC":      90,
    "NEUT":     90,
    "LYMPH":    90,
    "anti-dsDNA": 90,
    "C3":       90,
    "C4":       90,
    "ANA":      180,
    "Cr":       90,
    "BUN":      90,
    "ALT":      90,
    "AST":      90,
    "INR":      30,
    "UA":       90,
    "ESR":      90,
    "CRP":      90,
    "TP":       90,
    "ALB":      90,
}

# INR 危险阈值
INR_DANGER_LOW  = 1.8
INR_DANGER_HIGH = 3.5
INR_WARN_LOW    = 2.0
INR_WARN_HIGH   = 3.0

# 大幅波动判定阈值（相对变化率）
LARGE_CHANGE_PCT = 0.30


def _safe_pct(new: float, old: float) -> Optional[float]:
    """计算 (new-old)/old，不安全时返回 None"""
    if old == 0 or not isfinite(old) or not isfinite(new):
        return None
    return round((new - old) / abs(old) * 100, 1)


def _get_status(val: Optional[float], defn: IndicatorDefinition) -> str:
    """与 dashboard.py 中 _status 函数保持一致"""
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


def _analyze_indicators(
    db: Session,
    since: date,
    today: date,
) -> List[ChangeEvent]:
    """对每个有记录的指标进行多维度分析，返回 ChangeEvent 列表。"""
    events: List[ChangeEvent] = []

    defns = db.query(IndicatorDefinition).all()

    for defn in defns:
        # 取该指标自 since 以来的记录，按日期升序
        records = (
            db.query(IndicatorRecord)
            .filter(
                IndicatorRecord.indicator_id == defn.id,
                IndicatorRecord.recorded_at >= since,
            )
            .order_by(IndicatorRecord.recorded_at.asc())
            .all()
        )

        if not records:
            continue

        latest = records[-1]
        latest_val = latest.value
        latest_date_str = str(latest.recorded_at)

        # ── 1. 越界 / 偏高偏低（最新值）─────────────────────────────────
        if latest_val is not None:
            status = _get_status(latest_val, defn)

            if status == "danger":
                events.append(ChangeEvent(
                    type="indicator_danger",
                    level="danger",
                    title=f"{defn.name} 超出预警范围",
                    detail=_build_range_detail(latest_val, defn, status),
                    indicator_id=defn.id,
                    indicator_name=defn.name,
                    current_value=latest_val,
                    recorded_at=latest_date_str,
                    event_date=latest_date_str,
                ))

            elif status == "warning":
                events.append(ChangeEvent(
                    type="indicator_warning",
                    level="warning",
                    title=f"{defn.name} 偏离参考范围",
                    detail=_build_range_detail(latest_val, defn, status),
                    indicator_id=defn.id,
                    indicator_name=defn.name,
                    current_value=latest_val,
                    recorded_at=latest_date_str,
                    event_date=latest_date_str,
                ))

        # ── 2. 指标恢复正常（上次异常，本次正常）─────────────────────────
        if len(records) >= 2 and latest_val is not None:
            prev = records[-2]
            prev_status = _get_status(prev.value, defn)
            curr_status = _get_status(latest_val, defn)
            if prev_status in ("danger", "warning") and curr_status == "normal":
                events.append(ChangeEvent(
                    type="indicator_recovery",
                    level="good",
                    title=f"{defn.name} 恢复正常",
                    detail=(
                        f"{defn.name} 上次 {_fmt_val(prev.value, defn.unit)}（{prev_status}），"
                        f"本次 {_fmt_val(latest_val, defn.unit)}，已回到参考范围内"
                    ),
                    indicator_id=defn.id,
                    indicator_name=defn.name,
                    current_value=latest_val,
                    prev_value=prev.value,
                    change_pct=_safe_pct(latest_val, prev.value) if prev.value else None,
                    recorded_at=latest_date_str,
                    event_date=latest_date_str,
                ))

        # ── 3. 连续恶化（最近 3 次同向偏离且每次更差）────────────────────
        if len(records) >= 3 and all(r.value is not None for r in records[-3:]):
            tail = records[-3:]
            vals = [r.value for r in tail]
            # 判断是否持续偏低：每次都比前次更低，且最新值仍超出参考下限
            if defn.ref_min is not None and all(v < defn.ref_min for v in vals):
                if vals[0] > vals[1] > vals[2]:  # type: ignore[operator]
                    events.append(ChangeEvent(
                        type="indicator_trend_worse",
                        level="warning",
                        title=f"{defn.name} 持续下降",
                        detail=(
                            f"{defn.name} 连续 3 次低于参考下限（{defn.ref_min}{defn.unit or ''}），"
                            f"最新 {_fmt_val(vals[2], defn.unit)}，趋势持续恶化"
                        ),
                        indicator_id=defn.id,
                        indicator_name=defn.name,
                        current_value=vals[2],
                        prev_value=vals[1],
                        change_pct=_safe_pct(vals[2], vals[1]),  # type: ignore[arg-type]
                        recorded_at=latest_date_str,
                        event_date=latest_date_str,
                    ))
            # 判断是否持续偏高：每次都比前次更高，且最新值仍超出参考上限
            elif defn.ref_max is not None and all(v > defn.ref_max for v in vals):
                if vals[0] < vals[1] < vals[2]:  # type: ignore[operator]
                    events.append(ChangeEvent(
                        type="indicator_trend_worse",
                        level="warning",
                        title=f"{defn.name} 持续升高",
                        detail=(
                            f"{defn.name} 连续 3 次超出参考上限（{defn.ref_max}{defn.unit or ''}），"
                            f"最新 {_fmt_val(vals[2], defn.unit)}，趋势持续恶化"
                        ),
                        indicator_id=defn.id,
                        indicator_name=defn.name,
                        current_value=vals[2],
                        prev_value=vals[1],
                        change_pct=_safe_pct(vals[2], vals[1]),  # type: ignore[arg-type]
                        recorded_at=latest_date_str,
                        event_date=latest_date_str,
                    ))

        # ── 4. 大幅波动（相邻两次变化 > 30%）────────────────────────────
        if len(records) >= 2 and latest_val is not None:
            prev = records[-2]
            if prev.value is not None and prev.value != 0:
                pct = _safe_pct(latest_val, prev.value)
                if pct is not None and abs(pct) >= LARGE_CHANGE_PCT * 100:
                    direction = "升高" if pct > 0 else "下降"
                    # 避免与 indicator_danger / recovery 重复提醒：只在「状态未变化」时报波动
                    curr_s = _get_status(latest_val, defn)
                    prev_s = _get_status(prev.value, defn)
                    if curr_s == prev_s:
                        events.append(ChangeEvent(
                            type="indicator_large_change",
                            level="warning",
                            title=f"{defn.name} 大幅{direction}",
                            detail=(
                                f"{defn.name} 相比上次 {_fmt_val(prev.value, defn.unit)} "
                                f"{direction} {abs(pct):.1f}%，"
                                f"本次 {_fmt_val(latest_val, defn.unit)}"
                            ),
                            indicator_id=defn.id,
                            indicator_name=defn.name,
                            current_value=latest_val,
                            prev_value=prev.value,
                            change_pct=pct,
                            recorded_at=latest_date_str,
                            event_date=latest_date_str,
                        ))

        # ── 5. 复查超期（重点指标超过阈值天数未检测）────────────────────
        code = defn.code.upper() if defn.code else ""
        threshold_days = OVERDUE_THRESHOLDS.get(defn.code) or OVERDUE_THRESHOLDS.get(code)
        if threshold_days:
            # 取该指标最近一次检测日期（不限窗口）
            last_rec = (
                db.query(IndicatorRecord)
                .filter(IndicatorRecord.indicator_id == defn.id)
                .order_by(IndicatorRecord.recorded_at.desc())
                .first()
            )
            if last_rec:
                days_since = (today - last_rec.recorded_at).days
                if days_since > threshold_days:
                    events.append(ChangeEvent(
                        type="overdue_check",
                        level="warning",
                        title=f"{defn.name} 复查超期",
                        detail=(
                            f"{defn.name} 上次检测于 {last_rec.recorded_at}，"
                            f"已超过 {days_since} 天（建议 {threshold_days} 天内复查）"
                        ),
                        indicator_id=defn.id,
                        indicator_name=defn.name,
                        current_value=last_rec.value,
                        recorded_at=str(last_rec.recorded_at),
                        event_date=str(today),
                    ))

    return events


def _analyze_inr(db: Session, since: date) -> List[ChangeEvent]:
    """专门分析 INR 危险值（INR 表与指标记录分开存储）。"""
    events: List[ChangeEvent] = []

    logs = (
        db.query(INRDoseLog)
        .filter(INRDoseLog.log_date >= since, INRDoseLog.inr_value.isnot(None))
        .order_by(INRDoseLog.log_date.desc())
        .all()
    )
    if not logs:
        return events

    latest = logs[0]
    inr = latest.inr_value

    if inr is not None:
        if inr < INR_DANGER_LOW:
            events.append(ChangeEvent(
                type="inr_danger",
                level="danger",
                title=f"INR 抗凝不足（{inr}）",
                detail=(
                    f"最新 INR = {inr}，低于目标下限 {INR_DANGER_LOW}，"
                    f"存在血栓风险，请尽快联系医生调整华法林剂量"
                ),
                current_value=inr,
                recorded_at=str(latest.log_date),
                event_date=str(latest.log_date),
            ))
        elif inr > INR_DANGER_HIGH:
            events.append(ChangeEvent(
                type="inr_danger",
                level="danger",
                title=f"INR 出血风险（{inr}）",
                detail=(
                    f"最新 INR = {inr}，超出目标上限 {INR_DANGER_HIGH}，"
                    f"出血风险增加，请尽快联系医生调整华法林剂量"
                ),
                current_value=inr,
                recorded_at=str(latest.log_date),
                event_date=str(latest.log_date),
            ))
        elif inr < INR_WARN_LOW or inr > INR_WARN_HIGH:
            events.append(ChangeEvent(
                type="inr_danger",
                level="warning",
                title=f"INR 接近边界（{inr}）",
                detail=(
                    f"最新 INR = {inr}，目标范围 {INR_WARN_LOW}–{INR_WARN_HIGH}，"
                    f"建议密切监测"
                ),
                current_value=inr,
                recorded_at=str(latest.log_date),
                event_date=str(latest.log_date),
            ))

    return events


def _analyze_medications(db: Session, since: date, today: date) -> List[ChangeEvent]:
    """分析用药变化：新开 / 停用。"""
    events: List[ChangeEvent] = []

    meds = db.query(MedicationRecord).all()
    for med in meds:
        # 新开药：start_date 在分析窗口内
        if med.start_date and since <= med.start_date <= today:
            events.append(ChangeEvent(
                type="medication_added",
                level="info",
                title=f"新增用药：{med.drug_name}",
                detail=(
                    f"于 {med.start_date} 开始使用 {med.drug_name}"
                    + (f"（{med.dosage}）" if med.dosage else "")
                    + (f"，{med.frequency}" if med.frequency else "")
                ),
                medication_name=med.drug_name,
                event_date=str(med.start_date),
            ))
        # 停药：end_date 在分析窗口内
        if med.end_date and since <= med.end_date <= today:
            events.append(ChangeEvent(
                type="medication_stopped",
                level="info",
                title=f"停用药物：{med.drug_name}",
                detail=(
                    f"于 {med.end_date} 停用 {med.drug_name}"
                    + (f"（{med.dosage}）" if med.dosage else "")
                ),
                medication_name=med.drug_name,
                event_date=str(med.end_date),
            ))

    return events


# ── 辅助格式化 ────────────────────────────────────────────────────────────────

def _fmt_val(val: Optional[float], unit: Optional[str]) -> str:
    if val is None:
        return "—"
    s = f"{val:g}"
    if unit:
        s += f" {unit}"
    return s


def _build_range_detail(val: float, defn: IndicatorDefinition, status: str) -> str:
    parts = [f"{defn.name} 最新值 {_fmt_val(val, defn.unit)}"]
    if status == "danger":
        if defn.warn_low is not None and val < defn.warn_low:
            parts.append(f"低于预警下限 {_fmt_val(defn.warn_low, defn.unit)}")
        elif defn.warn_high is not None and val > defn.warn_high:
            parts.append(f"超出预警上限 {_fmt_val(defn.warn_high, defn.unit)}")
    elif status == "warning":
        if defn.ref_min is not None and val < defn.ref_min:
            parts.append(f"低于参考下限 {_fmt_val(defn.ref_min, defn.unit)}")
        elif defn.ref_max is not None and val > defn.ref_max:
            parts.append(f"超出参考上限 {_fmt_val(defn.ref_max, defn.unit)}")
    return "，".join(parts)


# ── 优先级排序：danger > warning > info > good ────────────────────────────────

_LEVEL_ORDER = {"danger": 0, "warning": 1, "info": 2, "good": 3}


# ── 主路由 ────────────────────────────────────────────────────────────────────

@router.get("/changes", response_model=AnalysisResult)
def get_changes(
    days: int = Query(90, ge=7, le=365, description="分析最近 N 天"),
    db: Session = Depends(get_db),
):
    today = date.today()
    since = today - timedelta(days=days)

    events: List[ChangeEvent] = []
    events.extend(_analyze_indicators(db, since, today))
    events.extend(_analyze_inr(db, since))
    events.extend(_analyze_medications(db, since, today))

    # 按优先级排序，同级按 event_date 降序
    events.sort(key=lambda e: (_LEVEL_ORDER.get(e.level, 99), e.event_date), reverse=False)
    events.sort(key=lambda e: e.event_date, reverse=True)
    events.sort(key=lambda e: _LEVEL_ORDER.get(e.level, 99))

    summary = {
        "danger":  sum(1 for e in events if e.level == "danger"),
        "warning": sum(1 for e in events if e.level == "warning"),
        "info":    sum(1 for e in events if e.level == "info"),
        "good":    sum(1 for e in events if e.level == "good"),
    }

    from datetime import datetime
    return AnalysisResult(
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        period_days=days,
        events=events,
        summary=summary,
    )
