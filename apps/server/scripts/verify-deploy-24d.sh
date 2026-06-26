#!/bin/bash
# scripts/verify-deploy-24d.sh — 24 维 verify-deploy.sh 极简汇总 wrapper (S72 batch 7+8 加, BUG-106 修法)
# 用法: bash scripts/verify-deploy-24d.sh                       # 跑全 24 维, 显示 1-22 详情 + 23a/23b/24 + 汇总
#       bash scripts/verify-deploy-24d.sh --strict             # 严格模式, 任何 1 失败 exit 1
# 配套规范: apps/server/AGENTS.md § 2.3 server 端 12 维验证 + AGENTS.md § 5 工作流"部署后 14 维验证" + BUG-079/080/081/082/083/090/096/099 防呆
# 引用: 走 $(dirname "$0")/verify-deploy.sh 同目录相对路径 (S72 batch 9 BUG-106 修法, 兼容本地 / 远端)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERIFY_MAIN="$SCRIPT_DIR/verify-deploy.sh"

if [ ! -f "$VERIFY_MAIN" ]; then
  echo "✗ 主验证脚本不存在: $VERIFY_MAIN"
  echo "  期望路径: $SCRIPT_DIR/verify-deploy.sh"
  exit 2
fi

echo "═══ 24 维 verify-deploy 1-22 全过 (最终) ═══"
bash "$VERIFY_MAIN" "$@" 2>/dev/null | grep -E "✓|✗|维度 [0-9]|PASS|FAIL" | head -30
echo ""
echo "═══ 汇总 ═══"
bash "$VERIFY_MAIN" "$@" 2>/dev/null | tail -3
