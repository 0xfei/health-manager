"""
批量导入历史症状记录到 symptom_records 表。
运行方式：
  cd /Users/0x01f/BirdScope/health-manager
  python3 -m backend.seeds.seed_symptoms
"""

import sys
import uuid
from datetime import date, datetime
from pathlib import Path

# 确保项目根目录在 sys.path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.database.session import SessionLocal, init_db
from backend.database.models import SymptomRecord

# ─────────────────────────────────────────────────────────────────────────────
# 原始数据：每条记录是一个 dict
# 字段：
#   date        日期字符串，如 "2025-1-7"
#   symptoms    症状类型列表（中文）
#   duration    持续时间（可空）
#   start_time  起始时间（可空）
#   end_time    结束时间（可空）
#   severity    范围大小/严重程度描述（可空）
#   count       总次数（可空）
#   note        补充说明（可空）
# ─────────────────────────────────────────────────────────────────────────────

RAW_RECORDS = [
    # ── 2025-1 ──────────────────────────────────────────────────────────────
    {"date": "2025-1-7",  "symptoms": ["左眼", "左脸麻"],            "start_time": "13:00", "count": 1},
    {"date": "2025-1-12", "symptoms": ["闪辉性暗点"],                "start_time": "1:00",  "count": 1},
    {"date": "2025-1-13", "symptoms": ["左眼", "左脸麻"],            "start_time": "17:00", "count": 1, "severity": "树叶大小"},
    {"date": "2025-1-15", "symptoms": ["左眼"],                      "duration": "0:10", "start_time": "17:00", "end_time": "17:10", "count": 1, "severity": "红枣大小"},
    {"date": "2025-1-20", "symptoms": ["闪辉性暗点"],                "start_time": "1:00",  "count": 3},
    {"date": "2025-1-20", "symptoms": ["闪辉性暗点"],                "start_time": "16:37"},
    {"date": "2025-1-20", "symptoms": ["左眼"],                      "start_time": "23:00"},
    {"date": "2025-1-21", "symptoms": ["闪辉性暗点"],                "start_time": "14:00"},
    {"date": "2025-1-28", "symptoms": ["闪辉性暗点"],                "start_time": "18:00"},
    {"date": "2025-1-29", "symptoms": ["闪辉性暗点"],                "start_time": "18:00"},
    {"date": "2025-1-30", "symptoms": ["左眼"],                      "start_time": "16:00"},
    {"date": "2025-1-31", "symptoms": ["闪辉性暗点"],                "start_time": "11:00"},
    {"date": "2025-1-31", "symptoms": ["闪辉性暗点"],                "start_time": "17:00"},
    # ── 2025-2 ──────────────────────────────────────────────────────────────
    {"date": "2025-2-5",  "symptoms": ["闪辉性暗点"],                "start_time": "9:30"},
    {"date": "2025-2-7",  "symptoms": ["闪辉性暗点"],                "start_time": "8:30"},
    {"date": "2025-2-10", "symptoms": ["左眼", "左脸麻"],            "start_time": "11:00", "severity": "四五个硬币大小"},
    {"date": "2025-2-11", "symptoms": ["左眼", "右眼"],              "start_time": "12:00", "severity": "某只眼睛的视野边缘有遮挡，但分辨不清是哪只眼睛"},
    {"date": "2025-2-12", "symptoms": ["左眼", "左脸麻"],            "duration": "1:30", "start_time": "9:00", "end_time": "10:30"},
    {"date": "2025-2-14", "symptoms": ["闪辉性暗点"],                "duration": "0:02", "start_time": "17:00", "end_time": "17:02", "severity": "很小的一个点，然后直接消失", "count": 2},
    {"date": "2025-2-14", "symptoms": ["特殊事件", "似曾相识"],       "duration": "0:30", "start_time": "20:00", "end_time": "20:30",
     "severity": "一开始是觉得一个没看过的电影很熟悉。然后突然一瞬间不知道自己在哪儿。环顾四周发现自己在家里，但想不起自己是为什么会在家里。理智上觉得自己是下班回家的，想不起下班路上经历了什么。想不起工作的具体内容（但能想起工作单位）。想不起当前的日期，以为是7月。"},
    {"date": "2025-2-15", "symptoms": ["左眼"],                      "start_time": "21:30", "severity": "一片很淡的阴影"},
    {"date": "2025-2-19", "symptoms": ["闪辉性暗点", "整脸/头皮麻"], "start_time": "17:00", "severity": "在一个锯齿还没消失的时候出现了另一个锯齿"},
    {"date": "2025-2-24", "symptoms": ["左眼"],                      "start_time": "9:30",  "severity": "四枚硬币大小"},
    {"date": "2025-2-26", "symptoms": ["闪辉性暗点"],                "start_time": "23:59"},
    {"date": "2025-2-28", "symptoms": ["左眼"],                      "start_time": "10:00"},
    # ── 2025-3 ──────────────────────────────────────────────────────────────
    {"date": "2025-3-5",  "symptoms": ["左眼"],                      "start_time": "14:00"},
    {"date": "2025-3-6",  "symptoms": ["左眼"],                      "duration": "0:01", "start_time": "12:00", "end_time": "12:01", "severity": "半分钟好转"},
    {"date": "2025-3-8",  "symptoms": ["头晕", "右眼"],              "duration": "0:05", "start_time": "12:00", "end_time": "12:05",
     "severity": "先是感觉头晕，然后右眼出现一个锯齿状不闪光的图案，闭眼有青色。几分钟消失。"},
    {"date": "2025-3-11", "symptoms": ["闪辉性暗点"],                "duration": "0:01", "start_time": "16:00", "end_time": "16:01", "severity": "很小很小"},
    {"date": "2025-3-12", "symptoms": ["左脸麻"],                    "duration": "6:00", "start_time": "10:00", "end_time": "16:00"},
    {"date": "2025-3-12", "symptoms": ["闪辉性暗点"],                "duration": "0:03", "start_time": "21:00", "end_time": "21:03", "severity": "比较小的一块"},
    {"date": "2025-3-13", "symptoms": ["闪辉性暗点"],                "duration": "0:02", "start_time": "17:00", "end_time": "17:02"},
    {"date": "2025-3-14", "symptoms": ["左脸麻"],                    "start_time": "11:00"},
    {"date": "2025-3-15", "symptoms": ["左脸麻"],                    "start_time": "17:00"},
    {"date": "2025-3-15", "symptoms": ["左眼"],                      "duration": "0:03", "start_time": "18:00", "end_time": "18:03", "severity": "很小的一块"},
    {"date": "2025-3-16", "symptoms": ["左脸麻"],                    "severity": "3月16日起麻了好几天"},
    {"date": "2025-3-19", "symptoms": ["闪辉性暗点"],                "duration": "0:05", "start_time": "11:00", "end_time": "11:05"},
    {"date": "2025-3-20", "symptoms": ["右眼"],                      "duration": "0:15", "start_time": "10:00", "end_time": "10:15", "severity": "右眼内下方视野边缘一小块黑蒙", "count": 3},
    {"date": "2025-3-20", "symptoms": ["左眼"],                      "duration": "0:05", "start_time": "11:00", "end_time": "11:05"},
    {"date": "2025-3-20", "symptoms": ["左眼"],                      "start_time": "20:00", "severity": "面积较大，有1/3个手机那么大"},
    {"date": "2025-3-21", "symptoms": ["左眼"],                      "duration": "0:20", "start_time": "18:00", "end_time": "18:20", "severity": "左眼外下眼角"},
    {"date": "2025-3-22", "symptoms": ["左眼"],                      "start_time": "23:00", "severity": "左眼内上眼角，一点阴影的感觉"},
    {"date": "2025-3-24", "symptoms": ["左眼", "左脸麻"],            "start_time": "10:30",
     "severity": "左眼外下眼角一点阴影的感觉。周末没有脸麻，今天是周一上班又开始麻了，耳垂、下巴、下颌角、左脸之类的"},
    {"date": "2025-3-25", "symptoms": ["闪辉性暗点"],                "duration": "0:01", "start_time": "0:00", "end_time": "0:01", "severity": "很快就消失"},
    {"date": "2025-3-28", "symptoms": ["右眼"],                      "duration": "0:05", "start_time": "19:00", "end_time": "19:05", "severity": "右眼内下眼角有阴影，几分钟消失"},
    {"date": "2025-3-30", "symptoms": ["左眼"],                      "start_time": "19:30", "severity": "较大一块"},
    {"date": "2025-3-31", "symptoms": ["右眼"],                      "start_time": "18:00"},
    # ── 2025-4 ──────────────────────────────────────────────────────────────
    {"date": "2025-4-7",  "symptoms": ["闪辉性暗点"],                "start_time": "11:00"},
    {"date": "2025-4-10", "symptoms": ["右眼"],                      "start_time": "14:00", "severity": "右眼内上眼角", "count": 2},
    {"date": "2025-4-10", "symptoms": ["闪辉性暗点"],                "start_time": "17:30"},
    {"date": "2025-4-11", "symptoms": ["闪辉性暗点"],                "start_time": "8:30",  "count": 2},
    {"date": "2025-4-11", "symptoms": ["左眼"],                      "start_time": "19:30"},
    {"date": "2025-4-12", "symptoms": ["闪辉性暗点"],                "start_time": "1:00"},
    {"date": "2025-4-14", "symptoms": ["右眼"],                      "duration": "2:00", "start_time": "8:30", "end_time": "10:30", "severity": "右眼下方有阴影，一个半小时仍然在", "count": 2},
    {"date": "2025-4-14", "symptoms": ["左眼"],                      "duration": "0:05", "start_time": "15:30", "end_time": "15:35", "severity": "一小块模糊，几分钟消失"},
    {"date": "2025-4-16", "symptoms": ["左眼"],                      "start_time": "14:00", "count": 2},
    {"date": "2025-4-16", "symptoms": ["闪辉性暗点"],                "start_time": "19:30", "severity": "隐隐约约一小块"},
    {"date": "2025-4-17", "symptoms": ["闪辉性暗点"],                "start_time": "10:30", "severity": "直接出现在视野边缘一个C字", "count": 2},
    {"date": "2025-4-17", "symptoms": ["闪辉性暗点"],                "start_time": "21:30", "severity": "直接出现在视野边缘一个C字"},
    {"date": "2025-4-19", "symptoms": ["右眼"],                      "start_time": "12:00", "severity": "一小块"},
    {"date": "2025-4-24", "symptoms": ["左眼"],                      "start_time": "20:30", "severity": "一小块"},
    {"date": "2025-4-26", "symptoms": ["右眼"],                      "start_time": "11:00", "severity": "右眼内下眼角一大片"},
    {"date": "2025-4-29", "symptoms": ["右眼"],                      "start_time": "0:00",  "severity": "右眼内下眼角一大片阴影", "count": 4},
    {"date": "2025-4-29", "symptoms": ["右眼"],                      "start_time": "14:30", "severity": "右眼内下眼角一大片阴影"},
    {"date": "2025-4-29", "symptoms": ["左眼"],                      "start_time": "18:30"},
    {"date": "2025-4-29", "symptoms": ["闪辉性暗点"],                "start_time": "21:30", "severity": "直接出现在视野边缘"},
    {"date": "2025-4-30", "symptoms": ["左眼"],                      "start_time": "0:30",  "count": 2},
    {"date": "2025-4-30", "symptoms": ["左眼"],                      "severity": "一大片"},
    # ── 2025-5 ──────────────────────────────────────────────────────────────
    {"date": "2025-5-2",  "symptoms": ["右眼"],                      "severity": "右眼内下眼角一大片"},
    {"date": "2025-5-4",  "symptoms": ["闪辉性暗点"]},
    {"date": "2025-5-7",  "symptoms": ["闪辉性暗点"],                "start_time": "5:00"},
    {"date": "2025-5-26", "symptoms": ["闪辉性暗点", "左眼"],        "note": "这两天没睡好，多次出现闪辉性，还有一次左眼单眼"},
    {"date": "2025-5-27", "symptoms": ["闪辉性暗点", "左眼"],        "note": "连续两天睡眠不好，症状持续"},
    {"date": "2025-5-29", "symptoms": ["左眼"],                      "start_time": "10:00"},
    {"date": "2025-5-30", "symptoms": ["左眼"],                      "start_time": "19:00"},
    # ── 2025-6 ──────────────────────────────────────────────────────────────
    {"date": "2025-6-2",  "symptoms": ["特殊事件", "左手麻", "左脸麻", "头痛"],
     "start_time": "8:30",
     "severity": "洗手的时候左手突然没有触觉，右手就像是在摸别人的皮肤，一瞬间想跟福说「福」，结果发不出声音，只能发出支支吾吾的声音。现在左耳和左脸也很麻。此后好像一直有点头疼，头疼持续到6.4日中午，剧烈疼痛。右边太阳穴额头，后脑勺后面也有。6.4下午头痛有所缓解，傍晚又严重。"},
    {"date": "2025-6-5",  "symptoms": ["闪辉性暗点"],                "start_time": "8:00",  "severity": "半梦半醒之间"},
    {"date": "2025-6-7",  "symptoms": ["左眼"],                      "start_time": "23:30", "severity": "一点点模糊"},
    {"date": "2025-6-10", "symptoms": ["右眼"],                      "start_time": "9:00",  "severity": "一大片模糊"},
    {"date": "2025-6-11", "symptoms": ["闪辉性暗点"],                "start_time": "20:30"},
    {"date": "2025-6-12", "symptoms": ["似曾相识"],                  "start_time": "21:00", "severity": "觉得小红书评论似曾相识"},
    {"date": "2025-6-14", "symptoms": ["右眼"],                      "start_time": "14:00", "count": 3},
    {"date": "2025-6-14", "symptoms": ["闪辉性暗点"],                "start_time": "19:00"},
    {"date": "2025-6-14", "symptoms": ["左眼"],                      "start_time": "10:30"},
    {"date": "2025-6-15", "symptoms": ["闪辉性暗点"],                "start_time": "3:00",  "severity": "半夜被吵醒时眼前有东西"},
    {"date": "2025-6-16", "symptoms": ["左眼"],                      "start_time": "11:00"},
    {"date": "2025-6-16", "symptoms": ["左眼"],                      "start_time": "13:00"},
    {"date": "2025-6-17", "symptoms": ["左眼"],                      "start_time": "10:30"},
    {"date": "2025-6-18", "symptoms": ["左眼"],                      "start_time": "5:00"},
    {"date": "2025-6-18", "symptoms": ["右眼"],                      "start_time": "15:00"},
    {"date": "2025-6-19", "symptoms": ["左眼"],                      "start_time": "14:00", "count": 2},
    {"date": "2025-6-19", "symptoms": ["左眼"],                      "start_time": "17:30", "severity": "一点点"},
    {"date": "2025-6-20", "symptoms": ["右眼"],                      "start_time": "21:30"},
    {"date": "2025-6-22", "symptoms": ["左眼"],                      "start_time": "18:00"},
    {"date": "2025-6-23", "symptoms": ["右眼"],                      "start_time": "17:00", "severity": "一点点", "count": 4},
    {"date": "2025-6-23", "symptoms": ["左眼"],                      "start_time": "17:30", "severity": "一大片"},
    {"date": "2025-6-23", "symptoms": ["左眼"],                      "start_time": "19:30"},
    {"date": "2025-6-23", "symptoms": ["左眼"],                      "start_time": "21:00"},
    {"date": "2025-6-26", "symptoms": ["右眼"],                      "start_time": "7:00",  "severity": "充电器掉了吓一跳", "count": 2},
    {"date": "2025-6-26", "symptoms": ["右眼"],                      "start_time": "15:30", "severity": "一点点"},
    {"date": "2025-6-27", "symptoms": ["左眼"],                      "start_time": "8:00"},
    # ── 2025-7 ──────────────────────────────────────────────────────────────
    {"date": "2025-7-1",  "symptoms": ["左眼"],                      "duration": "0:05", "start_time": "9:00", "end_time": "9:05", "severity": "几分钟"},
    {"date": "2025-7-4",  "symptoms": ["左眼"],                      "duration": "0:08", "start_time": "17:02", "end_time": "17:10",
     "severity": "比较大一片（是因为急着记录请假情况所以有的？），但是一直是能透光的毛玻璃，而不是完全黑的灰色，也就是比较淡。"},
    {"date": "2025-7-8",  "symptoms": ["左眼", "右眼"],              "start_time": "10:10",
     "severity": "分辨不清是哪只眼睛，非常淡的阴影"},
    # ── 2025-11 ─────────────────────────────────────────────────────────────
    {"date": "2025-11-27", "symptoms": ["闪辉性暗点"],               "duration": "0:19", "start_time": "19:51", "end_time": "20:10", "severity": "游泳的时候"},
    # ── 2026-1 ──────────────────────────────────────────────────────────────
    {"date": "2026-1-25", "symptoms": ["右眼"],                      "duration": "0:05", "start_time": "23:08", "end_time": "23:13", "severity": "右眼有很小一块磨玻璃样"},
    # ── 2026-3 ──────────────────────────────────────────────────────────────
    {"date": "2026-3-3",  "symptoms": ["左眼"],                      "duration": "0:01", "start_time": "18:05", "end_time": "18:06", "severity": "左眼有一个小模糊亮点"},
    {"date": "2026-3-7",  "symptoms": ["左眼", "右眼"],              "start_time": "13:12", "severity": "两只眼睛好像同时有一个树叶大小的阴影"},
    {"date": "2026-3-8",  "symptoms": ["右眼"],                      "start_time": "23:30", "severity": "右眼好像有很小很小一块，眨眼的时候青色的光斑"},
    # ── 其他补充症状（非视觉类，按时间段描述）──────────────────────────────────
    {"date": "2025-6-25", "symptoms": ["左手麻"],
     "note": "左手虎口、大拇指和食指附近麻。左手伸平放松的情况下食指会发抖。不知道是和血栓有关、大脑病灶有关、还是和吃激素药物有关。2025年6月底起，后来好了。"},
    {"date": "2025-7-3",  "symptoms": ["腹痛"],
     "note": "右下腹靠近大腿根的地方阵痛，白细胞9.19，C反应蛋白正常，可能是有发炎。"},
    {"date": "2025-7-5",  "symptoms": ["水肿"],
     "note": "两个手水肿，脚好像有一点点肿。"},
    {"date": "2025-7-21", "symptoms": ["关节痛"],
     "note": "右踝关节疼，7.21开始，后来好了。"},
    {"date": "2025-7-22", "symptoms": ["关节痛"],
     "note": "双踝关节疼，双膝盖疼，7.22开始，后来好了。"},
    {"date": "2025-8-1",  "symptoms": ["关节/肌肉痛"],
     "note": "两个屁股坐的位置酸疼，8月份开始。"},
    {"date": "2025-8-7",  "symptoms": ["腹痛", "恶心"],
     "note": "右上腹疼痛，已经有一两周，主要是右侧躺疼痛。8.7午睡右侧躺，吃完下午四点的药后想吐。8.14晚上游泳肩膀拉伤了只能右侧躺，右上腹大面积隐隐作痛。8.16早上早饭后右上腹一点点疼。"},
    {"date": "2025-8-12", "symptoms": ["视觉异常"],
     "note": "眼睛看整个画面的亮度感觉不是很均匀，特别是眨眼的时候，能感觉到有的区域更亮有的区域更暗。"},
]


def parse_date(date_str: str) -> date:
    """将 '2025-1-7' 等格式解析为 date 对象"""
    parts = date_str.strip().split("-")
    year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
    return date(year, month, day)


def build_raw_text(rec: dict) -> str:
    """将一条原始记录转化为 raw_text 描述文字"""
    parts = []
    syms = "、".join(rec.get("symptoms", []))
    if syms:
        parts.append(f"症状：{syms}")
    if rec.get("start_time"):
        t_part = rec["start_time"]
        if rec.get("end_time"):
            t_part += f" — {rec['end_time']}"
        if rec.get("duration"):
            t_part += f"（持续约 {rec['duration']}）"
        parts.append(f"时间：{t_part}")
    if rec.get("count") and rec["count"] > 1:
        parts.append(f"当日总次数：{rec['count']}")
    if rec.get("severity"):
        parts.append(f"描述：{rec['severity']}")
    if rec.get("note"):
        parts.append(f"备注：{rec['note']}")
    return "；".join(parts)


def build_parsed_symptoms(rec: dict) -> list:
    """将症状类型列表转化为 parsed_symptoms JSON 格式"""
    category_map = {
        "左眼": "眼科",
        "右眼": "眼科",
        "闪辉性暗点": "眼科",
        "视觉异常": "眼科",
        "左脸麻": "神经",
        "右脸麻": "神经",
        "整脸/头皮麻": "神经",
        "左手麻": "神经",
        "右手麻": "神经",
        "头晕": "神经",
        "头痛": "神经",
        "特殊事件": "神经",
        "似曾相识": "神经",
        "腹痛": "消化",
        "恶心": "消化",
        "水肿": "血液/心血管",
        "关节痛": "关节",
        "关节/肌肉痛": "关节",
    }
    result = []
    for sym in rec.get("symptoms", []):
        category = category_map.get(sym, "其他")
        result.append({
            "symptom_name": sym,
            "category": category,
            "severity": None,
        })
    return result


def seed():
    init_db()
    db = SessionLocal()
    try:
        # 检查是否已有数据，避免重复导入
        existing = db.query(SymptomRecord).count()
        if existing > 0:
            print(f"⚠️  symptom_records 表已有 {existing} 条记录。")
            answer = input("是否继续追加导入？(y/N): ").strip().lower()
            if answer != "y":
                print("取消导入。")
                return

        count = 0
        for rec in RAW_RECORDS:
            d = parse_date(rec["date"])
            raw_text = build_raw_text(rec)
            parsed = build_parsed_symptoms(rec)

            obj = SymptomRecord(
                id=str(uuid.uuid4()),
                recorded_at=d,
                raw_text=raw_text,
                parsed_symptoms=parsed,
                severity=None,
                ai_summary=None,
                created_at=datetime.utcnow(),
            )
            db.add(obj)
            count += 1

        db.commit()
        print(f"✅ 成功导入 {count} 条症状记录。")

        # 验证
        total = db.query(SymptomRecord).count()
        print(f"📊 symptom_records 表当前共 {total} 条记录。")

        # 打印最新5条
        latest = db.query(SymptomRecord).order_by(SymptomRecord.recorded_at.desc()).limit(5).all()
        print("\n最新5条记录：")
        for r in latest:
            print(f"  {r.recorded_at}  {r.raw_text[:60]}...")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
