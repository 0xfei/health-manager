"""Seed data: SLE + APS preset indicator definitions."""
from datetime import datetime
import uuid

PRESET_INDICATORS = [
    # ── 血常规 ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "WBC")),
        "name": "白细胞计数", "code": "WBC", "unit": "×10⁹/L",
        "ref_min": 4.0, "ref_max": 10.0, "warn_low": 3.0, "warn_high": 12.0,
        "category": "血常规", "description": "感染/免疫抑制监测", "sort_order": 1,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "NEUT")),
        "name": "中性粒细胞", "code": "NEUT", "unit": "×10⁹/L",
        "ref_min": 2.0, "ref_max": 7.0, "warn_low": 1.5, "warn_high": 8.0,
        "category": "血常规", "description": "感染风险", "sort_order": 2,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "LYM")),
        "name": "淋巴细胞", "code": "LYM", "unit": "×10⁹/L",
        "ref_min": 1.0, "ref_max": 3.3, "warn_low": 0.8, "warn_high": 4.0,
        "category": "血常规", "description": "疾病活动度", "sort_order": 3,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "PLT")),
        "name": "血小板", "code": "PLT", "unit": "×10⁹/L",
        "ref_min": 100.0, "ref_max": 300.0, "warn_low": 80.0, "warn_high": 400.0,
        "category": "血常规", "description": "血液系统受累", "sort_order": 4,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "HGB")),
        "name": "血红蛋白", "code": "HGB", "unit": "g/L",
        "ref_min": 115.0, "ref_max": 160.0, "warn_low": 90.0, "warn_high": None,
        "category": "血常规", "description": "贫血监测", "sort_order": 5,
    },
    # ── 免疫 ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "DSDNA")),
        "name": "抗双链DNA抗体", "code": "anti-dsDNA", "unit": "IU/mL",
        "ref_min": None, "ref_max": 100.0, "warn_low": None, "warn_high": 200.0,
        "category": "免疫", "description": "SLE 活动标志物", "sort_order": 10,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "C3")),
        "name": "补体C3", "code": "C3", "unit": "g/L",
        "ref_min": 0.9, "ref_max": 1.8, "warn_low": 0.6, "warn_high": None,
        "category": "免疫", "description": "疾病活动度", "sort_order": 11,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "C4")),
        "name": "补体C4", "code": "C4", "unit": "g/L",
        "ref_min": 0.1, "ref_max": 0.4, "warn_low": 0.06, "warn_high": None,
        "category": "免疫", "description": "疾病活动度", "sort_order": 12,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "ANA")),
        "name": "抗核抗体(ANA)", "code": "ANA", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "免疫", "description": "SLE 抗体谱", "sort_order": 13,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "AntiSm")),
        "name": "抗Sm抗体", "code": "Anti-Sm", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "免疫", "description": "SLE 特异性抗体", "sort_order": 14,
    },
    # ── 炎症 ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "ESR")),
        "name": "血沉", "code": "ESR", "unit": "mm/h",
        "ref_min": 0, "ref_max": 20.0, "warn_low": None, "warn_high": 40.0,
        "category": "炎症", "description": "炎症活动", "sort_order": 20,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "hsCRP")),
        "name": "超敏C反应蛋白", "code": "hsCRP", "unit": "mg/L",
        "ref_min": 0, "ref_max": 3.0, "warn_low": None, "warn_high": 10.0,
        "category": "炎症", "description": "炎症", "sort_order": 21,
    },
    # ── 肾功能 ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "UPRO")),
        "name": "尿蛋白", "code": "UPRO", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "肾功能", "description": "肾脏受累", "sort_order": 30,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "24hUPRO")),
        "name": "24h尿蛋白定量", "code": "24hUPRO", "unit": "mg/24h",
        "ref_min": 0, "ref_max": 150.0, "warn_low": None, "warn_high": 500.0,
        "category": "肾功能", "description": "狼疮肾炎", "sort_order": 31,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "Cr")),
        "name": "肌酐", "code": "Cr", "unit": "μmol/L",
        "ref_min": 44.0, "ref_max": 133.0, "warn_low": None, "warn_high": 200.0,
        "category": "肾功能", "description": "肾功能", "sort_order": 32,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "BUN")),
        "name": "尿素氮", "code": "BUN", "unit": "mmol/L",
        "ref_min": 2.9, "ref_max": 7.5, "warn_low": None, "warn_high": 14.0,
        "category": "肾功能", "description": "肾功能", "sort_order": 33,
    },
    # ── 肝功能 ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "ALT")),
        "name": "谷丙转氨酶(ALT)", "code": "ALT", "unit": "U/L",
        "ref_min": 0, "ref_max": 40.0, "warn_low": None, "warn_high": 80.0,
        "category": "肝功能", "description": "肝功能/药物副作用", "sort_order": 40,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "AST")),
        "name": "谷草转氨酶(AST)", "code": "AST", "unit": "U/L",
        "ref_min": 0, "ref_max": 40.0, "warn_low": None, "warn_high": 80.0,
        "category": "肝功能", "description": "肝功能", "sort_order": 41,
    },
    # ── 凝血 / APS ────────────────────────────────────
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "PT")),
        "name": "凝血酶原时间", "code": "PT", "unit": "s",
        "ref_min": 11.0, "ref_max": 14.0, "warn_low": None, "warn_high": 18.0,
        "category": "凝血/APS", "description": "抗凝基线", "sort_order": 50,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "INR")),
        "name": "国际标准化比值(INR)", "code": "INR", "unit": None,
        "ref_min": 2.0, "ref_max": 3.0, "warn_low": 1.8, "warn_high": 3.5,
        "category": "凝血/APS", "description": "华法林抗凝强度核心指标", "sort_order": 51,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "APTT")),
        "name": "活化部分凝血活酶时间", "code": "APTT", "unit": "s",
        "ref_min": 28.0, "ref_max": 40.0, "warn_low": None, "warn_high": 60.0,
        "category": "凝血/APS", "description": "APS 凝血监测", "sort_order": 52,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "DDimer")),
        "name": "D-二聚体", "code": "D-Dimer", "unit": "mg/L",
        "ref_min": 0, "ref_max": 0.5, "warn_low": None, "warn_high": 1.0,
        "category": "凝血/APS", "description": "血栓风险", "sort_order": 53,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "FIB")),
        "name": "纤维蛋白原", "code": "FIB", "unit": "g/L",
        "ref_min": 2.0, "ref_max": 4.0, "warn_low": 1.5, "warn_high": 6.0,
        "category": "凝血/APS", "description": "凝血功能", "sort_order": 54,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "aCL")),
        "name": "抗心磷脂抗体(aCL)", "code": "aCL", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "凝血/APS", "description": "APS 诊断抗体", "sort_order": 55,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "B2GP1")),
        "name": "抗β2糖蛋白1抗体", "code": "β2-GP1", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "凝血/APS", "description": "APS 诊断抗体（三联之一）", "sort_order": 56,
    },
    {
        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, "LA")),
        "name": "狼疮抗凝物(LA)", "code": "LA", "unit": None,
        "ref_min": None, "ref_max": None, "warn_low": None, "warn_high": None,
        "category": "凝血/APS", "description": "APS 诊断抗体（三联之一）", "sort_order": 57,
    },
]


def seed_indicators(db):
    """Insert preset indicators if not already present."""
    from backend.database.models import IndicatorDefinition
    for item in PRESET_INDICATORS:
        exists = db.query(IndicatorDefinition).filter_by(code=item["code"]).first()
        if not exists:
            obj = IndicatorDefinition(**item, is_system=True, created_at=datetime.utcnow())
            db.add(obj)
    db.commit()
