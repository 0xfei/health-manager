"""
批量导入主要用药记录到 medication_records 表。

运行方式：
  cd /Users/0x01f/BirdScope/health-manager
  python3 -m backend.seeds.seed_medications
"""

import sys
import uuid
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database.session import SessionLocal, init_db
from backend.database.models import MedicationRecord

# ─────────────────────────────────────────────────────────────────────────────
# 用药记录
# 注意：
#   - "激素" 指泼尼松（Prednisone）每片 5mg，服药量以"片"为单位，
#     3片=15mg，2.5片=12.5mg，2片=10mg
#   - bid = 每日两次（bis in die）
#   - 华法林 2026-01-07 起已有 inr_dose_logs 详细记录，此处单独建一条长期记录
#   - end_date=None 表示"目前仍在服用"
# ─────────────────────────────────────────────────────────────────────────────

MEDICATIONS = [
    # ── 泼尼松（激素）——多个剂量调整阶段 ──────────────────────────────────────
    {
        "drug_name":    "泼尼松",
        "dosage":       "15mg",
        "dosage_value": 15.0,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2025, 11, 22),
        "end_date":     date(2026,  1,  9),
        "category":     "steroid",
        "is_aps_related": False,
        "note":         "3片/日（每片5mg）；从3片逐步减量至2片期间",
    },
    {
        "drug_name":    "泼尼松",
        "dosage":       "10mg",
        "dosage_value": 10.0,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2025, 11, 22),
        "end_date":     date(2026,  1,  9),
        "category":     "steroid",
        "is_aps_related": False,
        "note":         "此段激素从3片减量到2片，取减量后剂量2片（10mg）记录",
    },
    {
        "drug_name":    "泼尼松",
        "dosage":       "15mg",
        "dosage_value": 15.0,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2026,  1, 10),
        "end_date":     date(2026,  1, 18),
        "category":     "steroid",
        "is_aps_related": False,
        "note":         "加量至3片/日（15mg）；白细胞偏低，加用升白药物",
    },
    {
        "drug_name":    "泼尼松",
        "dosage":       "12.5mg",
        "dosage_value": 12.5,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2026,  1, 18),
        "end_date":     date(2026,  2, 10),
        "category":     "steroid",
        "is_aps_related": False,
        "note":         "3片减量至2.5片（12.5mg）",
    },
    {
        "drug_name":    "泼尼松",
        "dosage":       "12.5mg",
        "dosage_value": 12.5,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2026,  2, 10),
        "end_date":     None,
        "category":     "steroid",
        "is_aps_related": False,
        "note":         "维持2.5片（12.5mg）/日",
    },

    # ── 吗替麦考酚酯（吗替） ──────────────────────────────────────────────────
    {
        "drug_name":    "吗替麦考酚酯",
        "dosage":       "0.5g bid",
        "dosage_value": 0.5,
        "dosage_unit":  "g",
        "frequency":    "每日两次",
        "start_date":   date(2025, 11, 22),
        "end_date":     date(2026,  1,  9),
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "0.5g bid",
    },
    {
        "drug_name":    "吗替麦考酚酯",
        "dosage":       "1g bid",
        "dosage_value": 1.0,
        "dosage_unit":  "g",
        "frequency":    "每日两次",
        "start_date":   date(2026,  1, 10),
        "end_date":     date(2026,  1, 18),
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "加量至1g bid",
    },
    {
        "drug_name":    "吗替麦考酚酯",
        "dosage":       "0.5g bid",
        "dosage_value": 0.5,
        "dosage_unit":  "g",
        "frequency":    "每日两次",
        "start_date":   date(2026,  1, 18),
        "end_date":     date(2026,  2, 10),
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "减回0.5g bid；同期加他克莫司",
    },

    # ── 利可君片（升白细胞）──────────────────────────────────────────────────
    {
        "drug_name":    "利可君片",
        "dosage":       "常规剂量",
        "dosage_value": None,
        "dosage_unit":  "片",
        "frequency":    "按医嘱",
        "start_date":   date(2025, 11, 22),
        "end_date":     date(2026,  1,  9),
        "category":     "other",
        "is_aps_related": False,
        "note":         "升白细胞辅助用药；因白细胞偏低加用",
    },

    # ── 磷酸腺嘌呤片（升白细胞）────────────────────────────────────────────────
    {
        "drug_name":    "磷酸腺嘌呤片",
        "dosage":       "2片 tid",
        "dosage_value": 2.0,
        "dosage_unit":  "片",
        "frequency":    "每日三次",
        "start_date":   date(2026,  1, 10),
        "end_date":     date(2026,  2, 10),
        "category":     "other",
        "is_aps_related": False,
        "note":         "2片每日3次；激素加量期间替换利可君，白细胞改善后停用",
    },

    # ── 他克莫司 ──────────────────────────────────────────────────────────────
    {
        "drug_name":    "他克莫司",
        "dosage":       "0.5mg bid",
        "dosage_value": 0.5,
        "dosage_unit":  "mg",
        "frequency":    "每日两次",
        "start_date":   date(2026,  1, 18),
        "end_date":     date(2026,  2, 10),
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "0.5mg bid；联合吗替麦考酚酯使用",
    },
    {
        "drug_name":    "他克莫司",
        "dosage":       "1mg bid",
        "dosage_value": 1.0,
        "dosage_unit":  "mg",
        "frequency":    "每日两次",
        "start_date":   date(2026,  2, 10),
        "end_date":     None,
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "加量至1mg bid；停用吗替麦考酚酯",
    },

    # ── 泰它西普（Telitacicept）────────────────────────────────────────────────
    {
        "drug_name":    "泰它西普",
        "dosage":       "每周2针",
        "dosage_value": None,
        "dosage_unit":  "针",
        "frequency":    "每周两次",
        "start_date":   date(2026,  3, 14),
        "end_date":     None,
        "category":     "immunosuppressant",
        "is_aps_related": False,
        "note":         "生物制剂（BLyS/APRIL双靶点抑制剂）；每周2针皮下注射",
    },

    # ── 华法林（APS 抗凝，长期）──────────────────────────────────────────────
    {
        "drug_name":    "华法林",
        "dosage":       "1.75~2mg/日交替",
        "dosage_value": None,
        "dosage_unit":  "mg",
        "frequency":    "每日一次",
        "start_date":   date(2026,  1,  7),
        "end_date":     None,
        "category":     "anticoagulant",
        "is_aps_related": True,
        "note":         "APS 抗凝治疗，INR 目标 2.0-3.0；1.75mg 与 2mg 交替服用，每晚约21-23时服用；详见 INR 日志",
    },
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(MedicationRecord).count()
        if existing > 0:
            print(f"⚠️  medication_records 表已有 {existing} 条记录。")
            answer = input("是否清空后重新导入？(y/N): ").strip().lower()
            if answer == "y":
                db.query(MedicationRecord).delete()
                db.commit()
                print("  已清空旧记录。")
            else:
                print("取消导入。")
                return

        count = 0
        for med in MEDICATIONS:
            obj = MedicationRecord(
                id=str(uuid.uuid4()),
                drug_name=med["drug_name"],
                dosage=med["dosage"],
                dosage_value=med.get("dosage_value"),
                dosage_unit=med.get("dosage_unit"),
                frequency=med.get("frequency"),
                start_date=med.get("start_date"),
                end_date=med.get("end_date"),
                category=med.get("category", "other"),
                is_aps_related=med.get("is_aps_related", False),
                note=med.get("note"),
                created_at=datetime.utcnow(),
            )
            db.add(obj)
            count += 1

        db.commit()
        print(f"✅ 成功导入 {count} 条用药记录")

        # 打印汇总
        all_meds = db.query(MedicationRecord).order_by(
            MedicationRecord.start_date, MedicationRecord.drug_name
        ).all()
        print("\n--- 用药记录汇总 ---")
        for r in all_meds:
            end = str(r.end_date) if r.end_date else "至今"
            aps = " [APS]" if r.is_aps_related else ""
            print(f"  [{r.category}]{aps} {r.drug_name} {r.dosage} {r.frequency} | {r.start_date} ~ {end}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
