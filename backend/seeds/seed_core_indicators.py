"""
批量导入核心 SLE 指标记录到 indicator_records 表。
同时补充 3 个新指标定义（荧光法 anti-dsDNA、化学发光法 anti-dsDNA、随机尿 ACR）。

运行方式：
  cd /Users/0x01f/BirdScope/health-manager
  python3 -m backend.seeds.seed_core_indicators
"""

import sys
import uuid
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database.session import SessionLocal, init_db
from backend.database.models import IndicatorDefinition, IndicatorRecord

# ─────────────────────────────────────────────────────────────────────────────
# 已有指标定义 ID（来自数据库查询）
# ─────────────────────────────────────────────────────────────────────────────
ID_ANTI_DSDNA_ELISA   = "c91ca3e3-49d0-5f6b-b7e9-2b745e32c066"  # 酶免法 IU/mL
ID_C3                 = "e04d1449-310f-50d8-a604-f838a64af28b"
ID_C4                 = "c764c177-d62d-5e16-90df-92e5c8ff988f"
ID_24UPRO             = "06675fd8-4db5-5d8c-8609-bf3250c5d01a"

# 新指标定义（脚本中创建）
CODE_ANTI_DSDNA_IFA   = "anti-dsDNA-IFA"   # 荧光法（滴度）
CODE_ANTI_DSDNA_CLIA  = "anti-dsDNA-CLIA"  # 化学发光法
CODE_ACR              = "uACR"             # 随机尿微量白蛋白肌酐比

# ─────────────────────────────────────────────────────────────────────────────
# 检测日期映射（列名 → 日期）
# ─────────────────────────────────────────────────────────────────────────────
DATES = {
    "入院":    date(2025, 6,  3),
    "出院前":  date(2025, 7,  3),  # 2025.07.03 出院（题目中 2026.07.03 应为笔误）
    "2025.07.20": date(2025, 7,  20),
    "2025.8.18":  date(2025, 8,  18),
    "2025.9.14":  date(2025, 9,  14),
    "2025.10.12": date(2025, 10, 12),
    "2025.11.22": date(2025, 11, 22),
    "2026.1.13":  date(2026, 1,  13),
    "2026.2.24":  date(2026, 2,  24),
    "2026.3.7":   date(2026, 3,  7),
}

# ─────────────────────────────────────────────────────────────────────────────
# 原始数据：None 或 "/" 表示当天未检测，跳过
# ─────────────────────────────────────────────────────────────────────────────

# 抗双链DNA抗体（荧光法）— 结果为滴度字符串，存 value_text
ANTI_DSDNA_IFA = {
    "入院":       "1:100",
    "出院前":     "1:32",
    "2025.07.20": "1:10",
    "2025.8.18":  "1:32",
    "2025.9.14":  "1:10",
    "2025.10.12": "1:32",
    "2025.11.22": "1:10",
    "2026.2.24":  "1:10",
    "2026.3.7":   "阴性",
}

# 抗双链DNA抗体（酶免法）— 数值 IU/mL
ANTI_DSDNA_ELISA = {
    "入院":       820.79,
    "出院前":     655.23,
    "2025.07.20": 369.11,
    "2025.8.18":  218.87,
    "2025.9.14":  274.35,
    "2025.10.12": 306.7,
    "2025.11.22": 160.78,
    "2026.2.24":  136.55,
}

# 抗双链DNA抗体（化学发光法）— 数值（参考范围随批次不同）
ANTI_DSDNA_CLIA = {
    "2026.1.13": 22.19,   # 参考 <20
    "2026.3.7":  64.5,    # 参考 <30（注：参考值变化，备注说明）
}
ANTI_DSDNA_CLIA_NOTES = {
    "2026.1.13": "参考范围 <20",
    "2026.3.7":  "参考范围 <30",
}

# 补体C3（g/L）
C3 = {
    "入院":       0.775,
    "出院前":     0.751,
    "2025.07.20": 1.000,
    "2025.8.18":  1.060,
    "2025.9.14":  1.060,
    "2025.10.12": 1.210,
    "2025.11.22": 1.070,
    "2026.1.13":  0.973,
    "2026.2.24":  1.060,
    "2026.3.7":   1.080,
}

# 补体C4（g/L）
C4 = {
    "入院":       0.034,
    "出院前":     0.041,
    "2025.07.20": 0.115,
    "2025.8.18":  0.158,
    "2025.9.14":  0.171,
    "2025.10.12": 0.186,
    "2025.11.22": 0.160,
    "2026.1.13":  0.158,
    "2026.2.24":  0.146,
    "2026.3.7":   0.180,
}

# 24h尿蛋白定量（mg/24h）
UPRO_24H = {
    "入院":       4830.0,
    "出院前":     1824.0,
    "2025.07.20": 892.5,
    "2025.8.18":  832.0,
    "2025.9.14":  408.9,
    "2025.10.12": 347.06,
    "2026.1.13":  106.4,
    "2026.2.24":  197.99,
    "2026.3.7":   140.0,
}

# 随机尿微量白蛋白肌酐比（mg/g 或 mg/mmol，此处按原始数据单位 mg/g 录入）
ACR = {
    "入院":       103.26,
    "出院前":     1055.14,
    "2025.07.20": 10.56,
    "2025.8.18":  7.96,
    "2025.9.14":  7.80,
    "2025.10.12": 16.65,
    "2025.11.22": 6.15,
    "2026.2.24":  3.39,
}


def get_or_create_def(db, code: str, name: str, unit: str, category: str,
                       ref_min=None, ref_max=None, warn_low=None, warn_high=None) -> str:
    """获取或创建指标定义，返回 id"""
    existing = db.query(IndicatorDefinition).filter(IndicatorDefinition.code == code).first()
    if existing:
        return existing.id
    new_def = IndicatorDefinition(
        id=str(uuid.uuid4()),
        code=code,
        name=name,
        unit=unit,
        category=category,
        ref_min=ref_min,
        ref_max=ref_max,
        warn_low=warn_low,
        warn_high=warn_high,
        is_system=True,
        description=f"{name}（{code}）",
        created_at=datetime.utcnow(),
    )
    db.add(new_def)
    db.flush()
    print(f"  ✨ 新建指标定义: {name}（{code}）")
    return new_def.id


def add_records_numeric(db, indicator_id: str, data: dict, notes: dict = None, source="manual"):
    """批量添加数值类记录"""
    count = 0
    for col_name, value in data.items():
        if value is None:
            continue
        rec_date = DATES[col_name]
        note = (notes or {}).get(col_name)
        obj = IndicatorRecord(
            id=str(uuid.uuid4()),
            indicator_id=indicator_id,
            value=value,
            value_text=None,
            recorded_at=rec_date,
            source_type=source,
            note=note,
            created_at=datetime.utcnow(),
        )
        db.add(obj)
        count += 1
    return count


def add_records_text(db, indicator_id: str, data: dict, source="manual"):
    """批量添加文字类记录（滴度/阴性等）"""
    count = 0
    for col_name, value_text in data.items():
        if value_text is None:
            continue
        rec_date = DATES[col_name]
        obj = IndicatorRecord(
            id=str(uuid.uuid4()),
            indicator_id=indicator_id,
            value=None,
            value_text=value_text,
            recorded_at=rec_date,
            source_type=source,
            note=None,
            created_at=datetime.utcnow(),
        )
        db.add(obj)
        count += 1
    return count


def seed():
    init_db()
    db = SessionLocal()
    try:
        # 检查已有记录
        existing = db.query(IndicatorRecord).count()
        if existing > 0:
            print(f"⚠️  indicator_records 表已有 {existing} 条记录。")
            answer = input("是否继续追加导入？(y/N): ").strip().lower()
            if answer != "y":
                print("取消导入。")
                return

        print("\n--- 创建新指标定义 ---")
        id_ifa = get_or_create_def(
            db, CODE_ANTI_DSDNA_IFA, "抗双链DNA抗体(荧光法)",
            unit="滴度", category="免疫",
            ref_max=None, warn_high=None,
        )
        id_clia = get_or_create_def(
            db, CODE_ANTI_DSDNA_CLIA, "抗双链DNA抗体(化学发光)",
            unit="IU/mL", category="免疫",
            ref_max=20.0, warn_high=30.0,
        )
        id_acr = get_or_create_def(
            db, CODE_ACR, "随机尿微量白蛋白肌酐比",
            unit="mg/g", category="肾功能",
            ref_max=30.0, warn_high=300.0,
        )
        db.flush()

        print("\n--- 导入指标记录 ---")
        total = 0

        n = add_records_text(db, id_ifa, ANTI_DSDNA_IFA)
        print(f"  抗双链DNA抗体(荧光法):     {n} 条")
        total += n

        n = add_records_numeric(db, ID_ANTI_DSDNA_ELISA, ANTI_DSDNA_ELISA)
        print(f"  抗双链DNA抗体(酶免法):     {n} 条")
        total += n

        n = add_records_numeric(db, id_clia, ANTI_DSDNA_CLIA, notes=ANTI_DSDNA_CLIA_NOTES)
        print(f"  抗双链DNA抗体(化学发光):   {n} 条")
        total += n

        n = add_records_numeric(db, ID_C3, C3)
        print(f"  补体C3:                    {n} 条")
        total += n

        n = add_records_numeric(db, ID_C4, C4)
        print(f"  补体C4:                    {n} 条")
        total += n

        n = add_records_numeric(db, ID_24UPRO, UPRO_24H)
        print(f"  24h尿蛋白定量:             {n} 条")
        total += n

        n = add_records_numeric(db, id_acr, ACR)
        print(f"  随机尿微量白蛋白肌酐比:   {n} 条")
        total += n

        db.commit()
        print(f"\n✅ 成功导入 {total} 条指标记录（含 3 个新指标定义）")
        print(f"📊 indicator_records 表当前共 {db.query(IndicatorRecord).count()} 条记录")
        print(f"📊 indicator_definitions 表当前共 {db.query(IndicatorDefinition).count()} 个定义")

        # 抽样验证
        print("\n--- 抽样验证（C3 全部记录）---")
        c3_recs = (db.query(IndicatorRecord)
                   .filter(IndicatorRecord.indicator_id == ID_C3)
                   .order_by(IndicatorRecord.recorded_at)
                   .all())
        for r in c3_recs:
            print(f"  {r.recorded_at}  C3={r.value} g/L")

    except Exception as e:
        db.rollback()
        print(f"❌ 导入失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
