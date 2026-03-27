#!/bin/bash
# ============================================================
# save.sh — 保存健康数据快照到 Git
# 用法：
#   ./save.sh                  # 自动生成带时间戳的 commit message
#   ./save.sh "备注 xxx"       # 自定义 commit message
# ============================================================

set -e

TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
MSG="${1:-data: 健康数据快照 $TIMESTAMP}"

# 确保在项目根目录
cd "$(dirname "$0")"

# 检查数据库文件是否存在
if [ ! -f "data/health.db" ]; then
  echo "❌ 未找到 data/health.db，请先启动应用录入数据"
  exit 1
fi

# 检查是否有变化
if git diff --quiet data/health.db && git ls-files --error-unmatch data/health.db >/dev/null 2>&1; then
  echo "✅ 数据库无变化，无需提交"
  exit 0
fi

# 暂存并提交
git add data/health.db .gitignore 2>/dev/null || git add data/health.db
git commit -m "$MSG"

echo ""
echo "✅ 数据已保存：$MSG"
echo "   提交记录：$(git log --oneline -1)"
echo ""
echo "💡 如需回滚，运行："
echo "   git log --oneline data/health.db   # 查看历史"
echo "   git checkout <commit_hash> -- data/health.db  # 回滚到指定版本"
