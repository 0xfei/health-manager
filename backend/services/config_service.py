"""
配置加载服务：读取 backend/config.yaml，提供全局配置对象。
用户可直接编辑 config.yaml 切换解析方式，无需改代码。
"""
from pathlib import Path
from typing import Optional, Literal
import yaml
from pydantic import BaseModel, Field


CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


# ── Pydantic 配置模型（类型安全 + IDE 补全）────────────────────────────────

class LLMProviderConfig(BaseModel):
    provider: Literal["openai", "ollama", "disabled"] = "ollama"
    model: str = "qwen2.5:7b"
    api_key: str = ""
    base_url: str = "http://localhost:11434/v1"
    timeout: int = 30


class ImageParseConfig(LLMProviderConfig):
    ocr_engine: Literal["paddleocr", "tesseract", "none"] = "paddleocr"
    ocr_lang: str = "ch"
    use_vision: bool = False
    timeout: int = 60


class DocumentParseConfig(LLMProviderConfig):
    pdf_backend: Literal["pymupdf", "pdfplumber", "pypdf2"] = "pymupdf"
    fallback_to_image: bool = True


class SymptomParseConfig(LLMProviderConfig):
    provider: Literal["openai", "ollama", "rule_based", "disabled"] = "ollama"  # type: ignore[assignment]


class ParseConfig(BaseModel):
    text: LLMProviderConfig = Field(default_factory=LLMProviderConfig)
    image: ImageParseConfig = Field(default_factory=ImageParseConfig)
    document: DocumentParseConfig = Field(default_factory=DocumentParseConfig)
    symptom: SymptomParseConfig = Field(default_factory=SymptomParseConfig)


class DatabaseConfig(BaseModel):
    path: str = "data/health.db"


class UploadConfig(BaseModel):
    dir: str = "data/uploads"
    max_size_mb: int = 20
    allowed_types: list[str] = Field(default_factory=lambda: [
        "image/jpeg", "image/png", "image/webp",
        "application/pdf", "text/plain"
    ])


class AuthConfig(BaseModel):
    enabled: bool = True
    access_token: str = ""


class AppConfig(BaseModel):
    parse: ParseConfig = Field(default_factory=ParseConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    upload: UploadConfig = Field(default_factory=UploadConfig)
    auth: AuthConfig = Field(default_factory=AuthConfig)


# ── 单例加载 ────────────────────────────────────────────────────────────────

_config: Optional[AppConfig] = None


def load_config() -> AppConfig:
    """加载并缓存配置（支持热重载：删除 _config 缓存后重新调用）"""
    global _config
    if _config is not None:
        return _config

    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        _config = AppConfig.model_validate(raw)
    else:
        # config.yaml 不存在时使用全部默认值（离线 Ollama 模式）
        _config = AppConfig()

    return _config


def reload_config() -> AppConfig:
    """强制重新读取配置文件"""
    global _config
    _config = None
    return load_config()


def get_config() -> AppConfig:
    """FastAPI dependency 或直接调用均可"""
    return load_config()
