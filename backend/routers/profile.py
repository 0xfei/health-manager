"""Patient profile router — 患者个人健康档案（确诊信息、用药概况、主要症状、恢复情况等）"""
import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import PatientProfile

router = APIRouter(prefix="/api/profile", tags=["profile"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class PatientProfileUpdate(BaseModel):
    diagnosed_at: Optional[str] = None          # 确诊日期，如 "2020-06"
    disease_duration_note: Optional[str] = None  # 确诊时长描述，如 "已确诊约 4 年"
    current_medications: Optional[str] = None    # 当前用药描述（自由文本）
    main_symptoms: Optional[str] = None          # 主要症状
    main_issues: Optional[str] = None            # 主要问题（关节/肾脏/皮肤等）
    recovery_status: Optional[str] = None        # 恢复情况：稳定期/活动期/缓解期
    doctor_summary: Optional[str] = None         # 医生对患者的综合评价/最近医嘱
    ai_summary: Optional[str] = None             # AI 生成的综合摘要
    tags: Optional[List[str]] = None             # 自定义标签，如 ["APS", "肾炎"]
    extra: Optional[dict] = None                 # 其他自定义字段


class PatientProfileOut(PatientProfileUpdate):
    id: str
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# ── Helpers ──────────────────────────────────────────────────────────────────

def _to_out(obj: PatientProfile) -> dict:
    return {
        "id": obj.id,
        "diagnosed_at": obj.diagnosed_at,
        "disease_duration_note": obj.disease_duration_note,
        "current_medications": obj.current_medications,
        "main_symptoms": obj.main_symptoms,
        "main_issues": obj.main_issues,
        "recovery_status": obj.recovery_status,
        "doctor_summary": obj.doctor_summary,
        "ai_summary": obj.ai_summary,
        "tags": obj.tags or [],
        "extra": obj.extra or {},
        "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
def get_profile(db: Session = Depends(get_db)):
    """获取患者档案（只有一条，没有则返回空档案）"""
    obj = db.query(PatientProfile).first()
    if not obj:
        return {
            "id": None,
            "diagnosed_at": None,
            "disease_duration_note": None,
            "current_medications": None,
            "main_symptoms": None,
            "main_issues": None,
            "recovery_status": None,
            "doctor_summary": None,
            "ai_summary": None,
            "tags": [],
            "extra": {},
            "updated_at": None,
        }
    return _to_out(obj)


@router.put("", response_model=dict)
def upsert_profile(payload: PatientProfileUpdate, db: Session = Depends(get_db)):
    """创建或更新患者档案（upsert）"""
    obj = db.query(PatientProfile).first()
    if not obj:
        from backend.database.models import new_id
        obj = PatientProfile(id=new_id())
        db.add(obj)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    obj.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(obj)
    return _to_out(obj)


@router.post("/ai-summary")
def generate_ai_summary(db: Session = Depends(get_db)):
    """
    使用 LLM 自动生成患者健康摘要，整合：用药 + 症状 + 指标状态 + 就诊记录
    结果写入 patient_profile.ai_summary
    """
    from backend.database.models import (
        MedicationRecord, SymptomRecord, IndicatorDefinition,
        IndicatorRecord, VisitRecord
    )
    from sqlalchemy import func

    # 收集上下文
    meds = db.query(MedicationRecord).filter(MedicationRecord.end_date == None).all()  # noqa
    med_text = "、".join([m.drug_name + (f"({m.dosage})" if m.dosage else "") for m in meds]) or "暂无用药记录"

    recent_symptoms = db.query(SymptomRecord).order_by(SymptomRecord.recorded_at.desc()).limit(5).all()
    sym_text = "；".join([s.raw_text[:50] for s in recent_symptoms if s.raw_text]) or "暂无症状记录"

    recent_visits = db.query(VisitRecord).order_by(VisitRecord.visit_date.desc()).limit(3).all()
    visit_text = "；".join([
        f"{v.visit_date} {v.hospital or ''} {v.diagnosis or ''}" for v in recent_visits
    ]) or "暂无就诊记录"

    profile = db.query(PatientProfile).first()
    profile_text = ""
    if profile:
        if profile.diagnosed_at:
            profile_text += f"确诊于 {profile.diagnosed_at}"
        if profile.disease_duration_note:
            profile_text += f"，{profile.disease_duration_note}"
        if profile.recovery_status:
            profile_text += f"，当前状态：{profile.recovery_status}"

    prompt = f"""你是一位风湿免疫科医生助手，请根据以下红斑狼疮（SLE）患者信息生成一段150字以内的简洁健康摘要。

患者基本情况：{profile_text or '未填写'}
当前用药：{med_text}
近期症状：{sym_text}
近期就诊：{visit_text}

要求：
1. 用中文，语气客观专业
2. 包含：确诊情况、当前用药要点、主要问题、整体状态评估
3. 不超过150字，不加任何标题或列表，直接输出摘要段落"""

    try:
        from backend.services.config_service import get_config
        from backend.services.parse_service import _build_openai_client
        cfg = get_config().parse.text
        if cfg.provider == "disabled":
            return {"ai_summary": "（AI 解析已禁用，请在 config.yaml 中启用）", "ok": False}

        client = _build_openai_client(cfg)
        resp = client.chat.completions.create(
            model=cfg.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        summary = resp.choices[0].message.content or ""

        # 写回数据库
        if not profile:
            from backend.database.models import new_id
            profile = PatientProfile(id=new_id())
            db.add(profile)
        profile.ai_summary = summary
        profile.updated_at = datetime.utcnow()
        db.commit()

        return {"ai_summary": summary, "ok": True}
    except Exception as e:
        return {"ai_summary": f"AI 生成失败: {str(e)}", "ok": False}
