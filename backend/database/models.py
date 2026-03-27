"""SQLAlchemy ORM models for health-manager."""
from datetime import datetime, date
from typing import Optional
import uuid

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship


def new_id() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class IndicatorDefinition(Base):
    """指标定义（SLE / APS 预置 + 自定义）"""
    __tablename__ = "indicator_definitions"

    id = Column(String, primary_key=True, default=new_id)
    name = Column(String, nullable=False)           # 显示名称，如 "白细胞"
    code = Column(String, unique=True, nullable=False)  # 英文代码，如 "WBC"
    unit = Column(String)                           # 单位
    ref_min = Column(Float)                         # 正常值下限
    ref_max = Column(Float)                         # 正常值上限
    warn_low = Column(Float)                        # 预警下限
    warn_high = Column(Float)                       # 预警上限
    category = Column(String)                       # 分类：血常规/免疫/肾功/凝血/APS
    description = Column(Text)
    is_system = Column(Boolean, default=True)       # 系统预置还是用户自定义
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("IndicatorRecord", back_populates="definition", cascade="all, delete-orphan")


class IndicatorRecord(Base):
    """指标检测记录"""
    __tablename__ = "indicator_records"

    id = Column(String, primary_key=True, default=new_id)
    indicator_id = Column(String, ForeignKey("indicator_definitions.id"), nullable=False)
    value = Column(Float)                           # 数值结果
    value_text = Column(String)                     # 文字结果（阴性/阳性/弱阳性）
    recorded_at = Column(Date, nullable=False)      # 检测日期
    source_type = Column(String, default="manual")  # manual / ocr / ai / wechat
    source_ref = Column(String)                     # 来源文件路径等
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    definition = relationship("IndicatorDefinition", back_populates="records")


class SymptomRecord(Base):
    """症状记录（文字描述 → AI 解析）"""
    __tablename__ = "symptom_records"

    id = Column(String, primary_key=True, default=new_id)
    recorded_at = Column(Date, nullable=False)
    raw_text = Column(Text)                         # 原始输入
    parsed_symptoms = Column(JSON)                  # AI 解析后的结构化列表
    severity = Column(Integer)                      # 1-10 主观严重程度
    ai_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class MedicationRecord(Base):
    """用药记录"""
    __tablename__ = "medication_records"

    id = Column(String, primary_key=True, default=new_id)
    drug_name = Column(String, nullable=False)
    dosage = Column(String)                         # 如 "3mg"
    dosage_value = Column(Float)                    # 数值，方便 APS 双轴图
    dosage_unit = Column(String)                    # mg / IU / 片
    frequency = Column(String)                      # 每日一次 / 每日两次
    start_date = Column(Date)
    end_date = Column(Date)
    category = Column(String)                       # anticoagulant / steroid / immunosuppressant / other
    is_aps_related = Column(Boolean, default=False)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class INRDoseLog(Base):
    """APS INR + 华法林剂量日志"""
    __tablename__ = "inr_dose_logs"

    id = Column(String, primary_key=True, default=new_id)
    log_date = Column(Date, nullable=False)
    inr_value = Column(Float)
    warfarin_dose = Column(Float)                   # mg
    note = Column(Text)
    next_test_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)


class VisitRecord(Base):
    """就诊记录"""
    __tablename__ = "visit_records"

    id = Column(String, primary_key=True, default=new_id)
    visit_date = Column(Date, nullable=False)
    hospital = Column(String)
    doctor = Column(String)
    diagnosis = Column(Text)
    advice = Column(Text)
    attachments = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class UploadRecord(Base):
    """上传文件 + AI 解析记录"""
    __tablename__ = "upload_records"

    id = Column(String, primary_key=True, default=new_id)
    file_path = Column(String)
    file_name = Column(String)
    file_type = Column(String)                      # image / pdf / text / doc / excel
    raw_ocr_text = Column(Text)
    ai_parsed_json = Column(JSON)
    status = Column(String, default="pending")      # pending / processing / done / failed
    error_msg = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class PatientProfile(Base):
    """患者健康档案（单条记录，upsert）"""
    __tablename__ = "patient_profiles"

    id = Column(String, primary_key=True, default=new_id)
    diagnosed_at = Column(String)                   # 确诊日期，如 "2020-06"
    disease_duration_note = Column(String)          # 确诊时长描述
    current_medications = Column(Text)              # 当前用药描述
    main_symptoms = Column(Text)                    # 主要症状
    main_issues = Column(Text)                      # 主要问题（器官受累）
    recovery_status = Column(String)                # 稳定期/活动期/缓解期
    doctor_summary = Column(Text)                   # 医生最新医嘱/评价
    ai_summary = Column(Text)                       # AI 生成的综合摘要
    tags = Column(JSON)                             # 自定义标签列表
    extra = Column(JSON)                            # 扩展字段
    updated_at = Column(DateTime, default=datetime.utcnow)
