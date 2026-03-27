#!/usr/bin/env bash
# ============================================================
# install.sh — 一键安装所有依赖（首次运行前执行）
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   SLE + APS 健康管理系统 - 安装      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Python / 后端 ──────────────────────────────────────────
echo "▶ 检查 Python 版本..."
python3 --version || { echo "❌ 请先安装 Python 3.11+"; exit 1; }

echo "▶ 安装后端 Python 依赖..."
cd backend
pip3 install -r requirements.txt
cd ..

# ── Node.js / 前端 ──────────────────────────────────────────
echo ""
echo "▶ 检查 Node.js 版本..."
node --version || { echo "❌ 请先安装 Node.js 18+"; exit 1; }

echo "▶ 安装前端依赖..."
cd frontend
npm install
cd ..

# ── 数据目录 ──────────────────────────────────────────
echo ""
echo "▶ 初始化本地数据目录..."
mkdir -p data/uploads

echo ""
echo "✅ 安装完成！运行 ./start.sh 启动应用"
echo ""
