"""FastAPI main entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend.database.session import init_db
from backend.seeds.indicators import seed_indicators
from backend.database.session import SessionLocal
from backend.routers import indicators, symptoms, medications, aps, visits, dashboard, upload
from backend.services.config_service import get_config, reload_config

app = FastAPI(
    title="SLE Health Manager API",
    description="本地 SLE + APS 健康管理系统 API",
    version="0.1.0",
)

# CORS: 允许本地前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载上传文件静态访问（路径从 config 读取）
cfg = get_config()
_uploads_dir = Path(cfg.upload.dir)
if not _uploads_dir.is_absolute():
    _uploads_dir = Path(__file__).parent.parent / cfg.upload.dir
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

# 注册路由
app.include_router(indicators.router)
app.include_router(symptoms.router)
app.include_router(medications.router)
app.include_router(aps.router)
app.include_router(visits.router)
app.include_router(dashboard.router)
app.include_router(upload.router)


@app.on_event("startup")
def on_startup():
    """初始化数据库并写入预置指标"""
    init_db()
    db = SessionLocal()
    try:
        seed_indicators(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    cfg = get_config()
    return {
        "status": "ok",
        "message": "SLE Health Manager running",
        "parse_providers": {
            "text": cfg.parse.text.provider,
            "image": cfg.parse.image.provider,
            "symptom": cfg.parse.symptom.provider,
        },
        "db_path": cfg.database.path,
    }


@app.get("/api/config")
def get_app_config():
    """返回当前解析配置（脱敏，不含 api_key）"""
    cfg = get_config()
    return {
        "parse": {
            "text": {
                "provider": cfg.parse.text.provider,
                "model": cfg.parse.text.model,
                "base_url": cfg.parse.text.base_url,
            },
            "image": {
                "provider": cfg.parse.image.provider,
                "model": cfg.parse.image.model,
                "ocr_engine": cfg.parse.image.ocr_engine,
                "use_vision": cfg.parse.image.use_vision,
                "base_url": cfg.parse.image.base_url,
            },
            "document": {
                "provider": cfg.parse.document.provider,
                "model": cfg.parse.document.model,
                "pdf_backend": cfg.parse.document.pdf_backend,
                "base_url": cfg.parse.document.base_url,
            },
            "symptom": {
                "provider": cfg.parse.symptom.provider,
                "model": cfg.parse.symptom.model,
                "base_url": cfg.parse.symptom.base_url,
            },
        },
        "database": {"path": cfg.database.path},
        "upload": {
            "dir": cfg.upload.dir,
            "max_size_mb": cfg.upload.max_size_mb,
        },
        "config_file": str(Path(__file__).parent / "config.yaml"),
    }


@app.post("/api/config/reload")
def config_reload():
    """热重载 config.yaml，无需重启后端"""
    cfg = reload_config()
    return {"ok": True, "message": "配置已重新加载", "parse_providers": {
        "text": cfg.parse.text.provider,
        "image": cfg.parse.image.provider,
        "symptom": cfg.parse.symptom.provider,
    }}
