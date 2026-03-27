"""
批量导入白细胞、中性粒细胞、淋巴细胞指标记录。

运行方式：
  cd /Users/0x01f/BirdScope/health-manager
  python3 -m backend.seeds.seed_blood_routine
"""

import sys
import uuid
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database.session import SessionLocal, init_db
from backend.database.models import IndicatorRecord

# 已有指标定义 ID
ID_WBC  = "40a53cc2-fa49-5a18-a854-4841fea196c6"   # 白细胞计数   ×10⁹/L
ID_NEUT = "b06ff259-b2f0-5668-b407-b4ce029dfb6e"   # 中性粒细胞   ×10⁹/L
ID_LYM  = "f8519537-7165-5cff-b894-755488f20915"   # 淋巴细胞     ×10⁹/L

# 检测日期映射
DATES = {
    "入院":       date(2025,  6,  3),
    "出院前":     date(2025,  7,  3),
    "2025.07.20": date(2025,  7, 20),
    "2025.8.18":  date(2025,  8, 18),
    "2025.9.14":  date(2025,  9, 14),
    "2025.10.12": date(2025, 10, 12),
    "2025.11.22": date(2025, 11, 22),
    "2026.1.9":   date(2026,  1,  9),
    "2026.1.13":  date(2026,  1, 13),
    "2026.1.17":  date(2026,  1, 17),
    "2026.1.30":  date(2026,  1, 30),
    "2026.2.7":   date(2026,  2,  7),
    "2026.2.24":  date(2026,  2, 24),
    "2026.3.7":   date(2026,  3,  7),
    "2026.3.14":  date(2026,  3, 14),
    "2026.3.21":  date(2026,  3, 21),
}

# 原始数据（×10⁹/L）
WBC = {
    "入院":       2.22,
    "出院前":     4.27,
    "2025.07.20": 6.42,
    "2025.8.18":  3.64,
    "2025.9.14":  4.09,
    "2025.10.12": 4.99,
    "2025.11.22": 2.81,
    "2026.1.9":   2.17,
    "2026.1.13":  3.32,
    "2026.1.17":  2.59,
    "2026.1.30":  1.97,
    "2026.2.7":   2.71,
    "2026.2.24":  2.43,
    "2026.3.7":   1.92,
    "2026.3.14":  2.23,
    "2026.3.21":  4.54,
}

NEUT = {
    "入院":       1.47,
    "出院前":     2.98,
    "2025.07.20": 4.98,
    "2025.8.18":  2.65,
    "2025.9.14":  3.05,
    "2025.10.12": 4.06,
    "2025.11.22": 1.84,
    "2026.1.9":   1.21,
    "2026.1.13":  2.77,
    "2026.1.17":  1.52,
    "2026.1.30":  1.04,
    "2026.2.7":   1.52,
    "2026.2.24":  1.46,
    "2026.3.7":   1.09,
    "2026.3.14":  1.18,
    "2026.3.21":  3.73,
}

LYM = {
    "入院":       0.42,
    "出院前":     0.87,
    "2025.07.20": 0.61,
    "2025.8.18":  0.58,
    "2025.9.14":  0.56,
    "2025.10.12": 0.45,
    "2025.11.22": 0.52,
    "2026.1.9":   0.48,
    "2026.1.13":  0.33,
    "2026.1.17":  0.61,
    "2026.1.30":  0.56,
    "2026.2.7":   0.73,
    "2026.2.24":  0.51,
    "2026.3.7":   0.45,
    "2026.3.14":  0.55,
    "2026.3.21":  0.53,
}


def add_records(db, indicator_id: str, data: dict) -> int:
    count = 0
    for col, value in data.items():
        obj = IndicatorRecord(
            id=str(uuid.uuid4()),
            indicator_id=indicator_id,
            value=value,
            value_text=None,
            recorded_at=DATES[col],
            source_type="manual",
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
        existing = db.query(IndicatorRecord).count()
        if existing > 0:
            print(f"⚠️  indicator_records 表已有 {existing} 条记录。")
            answer = input("是否继续追加导入？(y/N): ").strip().lower()
            if answer != "y":
                print("取消导入。")
                return

        total = 0
        n = add_records(db, ID_WBC,  WBC);  print(f"  白细胞计数:   {n} 条"); total += n
        n = add_records(db, ID_NEUT, NEUT); print(f"  中性粒细胞:   {n} 条"); total += n
        n = add_records(db, ID_LYM,  LYM);  print(f"  淋巴细胞:     {n} 条"); total += n

        db.commit()
        print(f"\n✅ 成功导入 {total} 条记录")
        print(f"📊 indicator_records 表当前共 {db.query(IndicatorRecord).count()} 条")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
