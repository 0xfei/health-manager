"""FastAPI main entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from backend.database.session import init_db
from backend.seeds.indicators import seed_indicators
from backend.database.session import SessionLocal
from backend.routers import indicators, symptoms, medications, aps, visits, dashboard, upload, profile
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
app.include_router(profile.router)


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


@app.post("/api/config/update")
def update_config(payload: dict):
    """
    直接更新 config.yaml 中的解析配置，保存后立即热重载生效。

    payload 结构示例：
    {
      "parse": {
        "text":     { "provider": "ollama", "model": "qwen2.5:7b", "api_key": "", "base_url": "http://localhost:11434/v1" },
        "image":    { "provider": "ollama", "model": "qwen2.5:7b", "ocr_engine": "paddleocr", "use_vision": false, ... },
        "document": { ... },
        "symptom":  { "provider": "rule_based", ... }
      }
    }
    只需传入要修改的字段，未传入的字段保持不变。
    """
    import yaml as _yaml
    from pathlib import Path as _Path

    config_path = _Path(__file__).parent / "config.yaml"

    # 读取现有配置（原始 YAML 字典，保留注释格式之外的值）
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            current_raw = _yaml.safe_load(f) or {}
    else:
        current_raw = {}

    # 深度合并：payload 中的字段覆盖现有值
    def _deep_merge(base: dict, override: dict) -> dict:
        result = dict(base)
        for k, v in override.items():
            if isinstance(v, dict) and isinstance(result.get(k), dict):
                result[k] = _deep_merge(result[k], v)
            else:
                result[k] = v
        return result

    merged = _deep_merge(current_raw, payload)

    # 写回 config.yaml
    with open(config_path, "w", encoding="utf-8") as f:
        _yaml.dump(merged, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    # 立即热重载
    cfg = reload_config()
    return {
        "ok": True,
        "message": "配置已更新并重载",
        "parse": {
            "text":     {"provider": cfg.parse.text.provider, "model": cfg.parse.text.model, "base_url": cfg.parse.text.base_url},
            "image":    {"provider": cfg.parse.image.provider, "model": cfg.parse.image.model, "ocr_engine": cfg.parse.image.ocr_engine, "use_vision": cfg.parse.image.use_vision},
            "document": {"provider": cfg.parse.document.provider, "model": cfg.parse.document.model, "pdf_backend": cfg.parse.document.pdf_backend},
            "symptom":  {"provider": cfg.parse.symptom.provider, "model": cfg.parse.symptom.model},
        },
    }


@app.get("/api/config/full")
def get_full_config():
    """返回完整配置（含 api_key，仅用于前端表单回填）"""
    cfg = get_config()
    return {
        "parse": {
            "text": {
                "provider": cfg.parse.text.provider,
                "model": cfg.parse.text.model,
                "api_key": cfg.parse.text.api_key,
                "base_url": cfg.parse.text.base_url,
                "timeout": cfg.parse.text.timeout,
            },
            "image": {
                "provider": cfg.parse.image.provider,
                "model": cfg.parse.image.model,
                "api_key": cfg.parse.image.api_key,
                "base_url": cfg.parse.image.base_url,
                "ocr_engine": cfg.parse.image.ocr_engine,
                "ocr_lang": cfg.parse.image.ocr_lang,
                "use_vision": cfg.parse.image.use_vision,
                "timeout": cfg.parse.image.timeout,
            },
            "document": {
                "provider": cfg.parse.document.provider,
                "model": cfg.parse.document.model,
                "api_key": cfg.parse.document.api_key,
                "base_url": cfg.parse.document.base_url,
                "pdf_backend": cfg.parse.document.pdf_backend,
                "fallback_to_image": cfg.parse.document.fallback_to_image,
            },
            "symptom": {
                "provider": cfg.parse.symptom.provider,
                "model": cfg.parse.symptom.model,
                "api_key": cfg.parse.symptom.api_key,
                "base_url": cfg.parse.symptom.base_url,
            },
        },
        "upload": {
            "dir": cfg.upload.dir,
            "max_size_mb": cfg.upload.max_size_mb,
        },
    }
