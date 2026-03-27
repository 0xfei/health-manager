"""Upload router - 接入 parse_service 多模式解析"""
import uuid
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.database.models import UploadRecord, IndicatorDefinition, IndicatorRecord
from backend.schemas.misc import UploadRecordOut
from backend.services.config_service import get_config

router = APIRouter(prefix="/api/upload", tags=["upload"])


def _get_uploads_dir() -> Path:
    cfg = get_config()
    d = Path(cfg.upload.dir)
    if not d.is_absolute():
        d = Path(__file__).resolve().parent.parent.parent / cfg.upload.dir
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/file", response_model=UploadRecordOut)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传文件并保存，返回记录 ID。"""
    ext = Path(file.filename or "unknown").suffix.lower()
    file_id = str(uuid.uuid4())
    saved_name = f"{file_id}{ext}"
    dest = _get_uploads_dir() / saved_name

    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    file_type = (
        "image" if ext in {".jpg", ".jpeg", ".png", ".webp", ".bmp"} else
        "pdf" if ext == ".pdf" else
        "text"
    )

    record = UploadRecord(
        id=file_id,
        file_path=str(dest),
        file_name=file.filename,
        file_type=file_type,
        status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/analyze/{upload_id}", response_model=UploadRecordOut)
async def analyze_upload(upload_id: str, db: Session = Depends(get_db)):
    """
    触发 AI 解析：根据文件类型自动选择解析方式。
    解析结果存入 ai_parsed_json，status 变为 done 或 failed。
    """
    record = db.query(UploadRecord).get(upload_id)
    if not record:
        raise HTTPException(404, "文件记录不存在")
    if not record.file_path or not Path(record.file_path).exists():
        raise HTTPException(400, "文件不存在，无法解析")

    from backend.services.parse_service import parse_lab_image, parse_lab_text, parse_lab_document

    record.status = "processing"
    db.commit()

    try:
        if record.file_type == "image":
            result = parse_lab_image(record.file_path)
        elif record.file_type == "pdf":
            result = parse_lab_document(record.file_path)
        else:  # text
            with open(record.file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            result = parse_lab_text(content)

        record.ai_parsed_json = result
        record.status = "done"
    except Exception as e:
        record.status = "failed"
        record.error_msg = str(e)

    db.commit()
    db.refresh(record)
    return record


@router.post("/confirm/{upload_id}")
async def confirm_upload(upload_id: str, db: Session = Depends(get_db)):
    """
    将解析结果批量写入 indicator_records。
    前端展示解析预览后，用户确认调此接口入库。
    """
    record = db.query(UploadRecord).get(upload_id)
    if not record:
        raise HTTPException(404, "文件记录不存在")
    if record.status != "done" or not record.ai_parsed_json:
        raise HTTPException(400, "尚未完成解析，无法确认入库")

    parsed = record.ai_parsed_json
    indicators_data = parsed.get("indicators", [])
    report_date = parsed.get("report_date")

    imported = 0
    skipped = []
    for item in indicators_data:
        if not item.get("name"):
            continue

        # 尝试匹配已有指标定义（按 code 或名称模糊匹配）
        code = item.get("code", "")
        name = item.get("name", "")
        defn = None
        if code:
            defn = db.query(IndicatorDefinition).filter(
                IndicatorDefinition.code.ilike(code)
            ).first()
        if not defn and name:
            defn = db.query(IndicatorDefinition).filter(
                IndicatorDefinition.name.ilike(f"%{name}%")
            ).first()

        if not defn:
            skipped.append(name or code)
            continue

        rec_date = item.get("recorded_at") or report_date
        if not rec_date:
            skipped.append(f"{name}(无日期)")
            continue

        obj = IndicatorRecord(
            id=str(uuid.uuid4()),
            indicator_id=defn.id,
            value=item.get("value"),
            value_text=item.get("value_text"),
            recorded_at=rec_date,
            source_type="ai",
            source_ref=upload_id,
            note=f"自动导入自 {record.file_name}",
        )
        db.add(obj)
        imported += 1

    db.commit()
    return {
        "imported": imported,
        "skipped": skipped,
        "message": f"成功导入 {imported} 条，跳过 {len(skipped)} 条（指标未匹配或无日期）",
    }


@router.get("/records", response_model=list[UploadRecordOut])
def list_uploads(db: Session = Depends(get_db)):
    return db.query(UploadRecord).order_by(UploadRecord.created_at.desc()).all()


@router.delete("/{upload_id}")
def delete_upload(upload_id: str, db: Session = Depends(get_db)):
    obj = db.query(UploadRecord).get(upload_id)
    if not obj:
        raise HTTPException(404, "记录不存在")
    if obj.file_path and Path(obj.file_path).exists():
        Path(obj.file_path).unlink(missing_ok=True)
    db.delete(obj)
    db.commit()
    return {"ok": True}
