"""
批量导入 2026 年华法林 + INR 记录到 inr_dose_logs 表。
运行方式：
  cd /Users/0x01f/BirdScope/health-manager
  python3 -m backend.seeds.seed_inr_2026
"""

import sys
import uuid
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database.session import SessionLocal, init_db
from backend.database.models import INRDoseLog

# ─────────────────────────────────────────────────────────────────────────────
# 原始数据：2026 年华法林每日服药记录
# 字段：log_date, dose_time（服药时间，仅作 note 记录）, warfarin_dose(mg), inr_value(可空)
# ─────────────────────────────────────────────────────────────────────────────

RAW = [
    # (日期,          服药时间,  剂量mg, INR值)
    ("2026-01-07", "20:10", 1.75, None),
    ("2026-01-08", "20:18", 2.00, None),
    ("2026-01-09", "20:38", 1.75, None),
    ("2026-01-10", "21:00", 2.00, None),
    ("2026-01-11", "21:00", 1.75, None),
    ("2026-01-12", "21:15", 2.00, None),
    ("2026-01-13", "21:27", 1.75, None),
    ("2026-01-14", "21:06", 2.00, None),
    ("2026-01-15", "21:12", 1.75, None),
    ("2026-01-16", "21:06", 2.00, None),
    ("2026-01-17", "21:16", 1.75, 2.67),
    ("2026-01-18", "18:58", 2.00, None),
    ("2026-01-19", "21:15", 1.75, None),
    ("2026-01-20", "21:15", 2.00, None),
    ("2026-01-21", "21:15", 1.75, None),
    ("2026-01-22", "21:06", 2.00, None),
    ("2026-01-23", "21:05", 1.75, None),
    ("2026-01-24", "21:02", 2.00, None),
    ("2026-01-25", "21:38", 1.75, None),
    ("2026-01-26", "21:06", 2.00, None),
    ("2026-01-27", "22:01", 1.75, None),
    ("2026-01-28", "21:30", 2.00, None),
    ("2026-01-29", "21:00", 1.75, None),
    ("2026-01-30", "21:01", 2.00, None),
    ("2026-01-31", "21:21", 1.75, 2.90),
    ("2026-02-01", "21:00", 2.00, None),
    ("2026-02-02", "21:01", 1.75, None),
    ("2026-02-03", "21:13", 2.00, None),
    ("2026-02-04", "21:02", 1.75, None),
    ("2026-02-05", "21:06", 2.00, None),
    ("2026-02-06", "21:09", 1.75, None),
    ("2026-02-07", "21:06", 1.75, 3.41),
    ("2026-02-08", "21:13", 1.75, None),
    ("2026-02-09", "21:12", 1.75, None),
    ("2026-02-10", "21:15", 1.75, None),
    ("2026-02-11", "22:54", 1.75, None),
    ("2026-02-12", "23:02", 1.75, None),
    ("2026-02-13", "23:05", 1.75, 3.01),
    ("2026-02-14", "22:58", 1.75, None),
    ("2026-02-15", "23:00", 1.75, None),
    ("2026-02-16", "23:00", 1.75, None),
    ("2026-02-17", "23:00", 1.75, None),
    ("2026-02-18", "23:06", 1.75, None),
    ("2026-02-19", "23:09", 1.75, None),
    ("2026-02-20", "23:00", 1.75, None),
    ("2026-02-21", "23:04", 1.75, None),
    ("2026-02-22", "23:04", 1.75, None),
    ("2026-02-23", "23:08", 1.75, 2.86),
    ("2026-02-24", "23:05", 1.75, None),
    ("2026-02-25", "23:06", 1.75, None),
    ("2026-02-26", "23:10", 1.75, None),
    ("2026-02-27", "23:07", 1.75, None),
    ("2026-02-28", "23:07", 1.75, None),
    ("2026-03-01", "23:01", 1.75, None),
    ("2026-03-02", "23:16", 1.75, None),
    ("2026-03-03", "23:07", 1.75, None),
    ("2026-03-04", "23:02", 1.75, None),
    ("2026-03-05", "23:03", 1.75, None),
    ("2026-03-06", "23:01", 1.75, None),
    ("2026-03-07", "22:44", 1.75, None),
    ("2026-03-08", "23:03", 2.00, 2.49),
    ("2026-03-09", "23:01", 1.75, None),
    ("2026-03-10", "23:00", 1.75, None),
    ("2026-03-11", "23:04", 2.00, None),
    ("2026-03-12", "23:06", 1.75, None),
    ("2026-03-13", "23:08", 1.75, None),
    ("2026-03-14", "23:07", 2.00, 2.82),
    ("2026-03-15", "22:55", 1.75, None),
    ("2026-03-16", "23:05", 1.75, None),
    ("2026-03-17", "23:04", 2.00, None),
    ("2026-03-18", "23:04", 1.75, None),
    ("2026-03-19", "23:08", 1.75, None),
    ("2026-03-20", "23:03", 2.00, None),
    ("2026-03-21", "23:10", 1.75, None),
    ("2026-03-22", "23:18", 1.75, None),
    ("2026-03-23", "23:12", 2.00, None),
    ("2026-03-24", "23:08", 1.75, None),
    ("2026-03-25", "23:11", 1.75, None),
    ("2026-03-26", "23:06", 2.00, None),
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(INRDoseLog).count()
        if existing > 0:
            print(f"⚠️  inr_dose_logs 表已有 {existing} 条记录。")
            answer = input("是否继续追加导入？(y/N): ").strip().lower()
            if answer != "y":
                print("取消导入。")
                return

        count = 0
        inr_count = 0
        for date_str, dose_time, dose_mg, inr_val in RAW:
            y, m, d = date_str.split("-")
            log_date = date(int(y), int(m), int(d))

            note = f"服药时间：{dose_time}"

            obj = INRDoseLog(
                id=str(uuid.uuid4()),
                log_date=log_date,
                inr_value=inr_val,
                warfarin_dose=dose_mg,
                note=note,
                next_test_date=None,
                created_at=datetime.utcnow(),
            )
            db.add(obj)
            count += 1
            if inr_val is not None:
                inr_count += 1

        db.commit()
        print(f"✅ 成功导入 {count} 条华法林记录，其中含 INR 检测值 {inr_count} 条。")

        total = db.query(INRDoseLog).count()
        print(f"📊 inr_dose_logs 表当前共 {total} 条记录。")

        # 打印有 INR 值的记录
        inr_records = (
            db.query(INRDoseLog)
            .filter(INRDoseLog.inr_value.isnot(None))
            .order_by(INRDoseLog.log_date)
            .all()
        )
        print(f"\n含 INR 检测值的记录（共 {len(inr_records)} 条）：")
        for r in inr_records:
            print(f"  {r.log_date}  INR={r.inr_value}  华法林={r.warfarin_dose}mg")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
