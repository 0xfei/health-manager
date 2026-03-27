"""Database session and initialization.

数据库说明：
  - 使用 SQLite（单文件），存储在项目根目录 data/health.db
  - 整个 data/ 目录就是全部数据：拷贝 data/ 即完成迁移
  - 数据库路径可通过 backend/config.yaml database.path 自定义
  - 首次运行自动创建数据库和表，无需额外安装数据库服务
"""
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .models import Base

# 项目根目录（backend/database/session.py → 上三级）
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


def _get_db_url() -> str:
    """从 config.yaml 读取数据库路径，config 不存在则使用默认值。"""
    try:
        from backend.services.config_service import get_config
        cfg_path = get_config().database.path
        p = Path(cfg_path)
        if not p.is_absolute():
            p = ROOT_DIR / p
    except Exception:
        p = ROOT_DIR / "data" / "health.db"

    p.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{p}"


DATABASE_URL = _get_db_url()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """创建所有表（首次运行或迁移时调用）"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yield a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
