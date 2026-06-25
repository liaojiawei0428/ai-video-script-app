#!/bin/bash
# tools/check-react-spread.sh
# S71 BUG-080 后置: 检测 web 端手挑字段 pattern (forEach + push 没 spread outer 变量)
# 真实 BUG (S71 BUG-080): BillingPage.tsx L118-130 push transactions 时只挑 4 字段 (id/amount/status/ip/createdAt),
#   漏 type, 导致 tab filter (r as any).type === 'consumption' 永远 undefined → 消费记录 tab 全空
#
# 用法:
#   bash tools/check-react-spread.sh <file1> [file2] ...
#   bash tools/check-react-spread.sh --staged     # 检查 git staged 改动的 .tsx/.ts
#   bash tools/check-react-spread.sh --all        # 检查整个 apps/web/src/
#
# 退出码:
#   0 = 全过
#   1 = 有手挑字段 (建议改 spread outer 变量: ...var)

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
exec python3 tools/check-react-spread.py "$@"
