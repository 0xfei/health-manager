"""
Token 认证中间件
- 所有 /api/* 请求需携带 Authorization: Bearer <token>
- /api/health 和 /api/auth/login 豁免认证
- config.yaml 中 auth.enabled=false 时跳过认证（本地开发用）
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


# 豁免路径（无需 Token）
_EXEMPT_PATHS = {"/api/health", "/api/auth/login", "/api/auth/check"}


class TokenAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # 非 /api/* 路径（静态文件等）直接放行
        if not path.startswith("/api"):
            return await call_next(request)

        # 豁免路径直接放行
        if path in _EXEMPT_PATHS:
            return await call_next(request)

        # 延迟加载，避免循环依赖
        from backend.services.config_service import get_config
        cfg = get_config()
        auth_cfg = getattr(cfg, "auth", None)

        # 认证未启用时直接放行
        if auth_cfg is None or not getattr(auth_cfg, "enabled", True):
            return await call_next(request)

        expected_token = getattr(auth_cfg, "access_token", "")
        if not expected_token:
            # token 未配置则放行（防止锁死）
            return await call_next(request)

        # 提取 Bearer Token
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized: missing token"},
            )

        token = auth_header[len("Bearer "):]
        if token != expected_token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized: invalid token"},
            )

        return await call_next(request)
