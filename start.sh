#!/usr/bin/env bash
# ============================================================
# start.sh — 一键启动后端 + 前端
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   SLE + APS 健康管理系统 - 启动      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 检查依赖
command -v node &>/dev/null || { echo "❌ 需要 Node.js 18+"; exit 1; }

# 选择 Python：优先使用虚拟环境
if [ -f "$SCRIPT_DIR/.venv/bin/python3" ]; then
  PYTHON="$SCRIPT_DIR/.venv/bin/python3"
  echo "  使用虚拟环境: .venv"
elif command -v python3 &>/dev/null; then
  PYTHON="python3"
else
  echo "❌ 需要 Python 3.11+"; exit 1
fi

# 启动后端
echo "▶ 启动后端 (http://127.0.0.1:8000) ..."
cd "$SCRIPT_DIR"
"$PYTHON" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# 等待后端就绪
echo "  等待后端启动..."
for i in $(seq 1 15); do
  sleep 1
  if curl -sf http://127.0.0.1:8000/api/health &>/dev/null; then
    echo "  ✅ 后端已就绪"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "  ⚠️  后端启动超时，请查看日志"
  fi
done

# 启动前端
echo ""
echo "▶ 启动前端 (http://localhost:5173) ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  🚀 应用已启动！                                     ║"
echo "║                                                      ║"
echo "║  前端：http://localhost:5173                         ║"
echo "║  后端 API：http://127.0.0.1:8000/docs                ║"
echo "║                                                      ║"
echo "║  按 Ctrl+C 停止所有服务                              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# 等待退出信号
trap "echo ''; echo '停止所有服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
