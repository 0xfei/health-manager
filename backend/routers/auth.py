"""Login 认证接口"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    token: str


@router.post("/login")
def login(req: LoginRequest):
    """验证 token，返回 access_token 供前端存储"""
    from backend.services.config_service import get_config
    cfg = get_config()
    auth_cfg = getattr(cfg, "auth", None)

    # 认证未启用 → 直接通过（本地开发模式）
    if auth_cfg is None or not getattr(auth_cfg, "enabled", True):
        return {"access_token": req.token, "ok": True, "message": "认证已禁用，直接通过"}

    expected = getattr(auth_cfg, "access_token", "")
    if not expected:
        return {"access_token": req.token, "ok": True, "message": "Token 未配置，直接通过"}

    if req.token == expected:
        return {"access_token": req.token, "ok": True, "message": "登录成功"}

    return {"ok": False, "message": "Token 错误，请重新输入"}


@router.get("/check")
def check_auth():
    """检查认证是否启用（前端初始化用）"""
    from backend.services.config_service import get_config
    cfg = get_config()
    auth_cfg = getattr(cfg, "auth", None)
    enabled = auth_cfg is not None and getattr(auth_cfg, "enabled", True)
    has_token = enabled and bool(getattr(auth_cfg, "access_token", ""))
    return {"auth_enabled": enabled and has_token}
