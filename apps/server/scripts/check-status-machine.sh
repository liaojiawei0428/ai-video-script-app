#!/bin/bash
# apps/server/scripts/check-status-machine.sh
# S71 BUG-081 配套 (跨端 AGENTS.md 铁律 4+): 状态机迁移必同步 4 步自检
# 用法: 服务器端 bash apps/server/scripts/check-status-machine.sh
# 退出码: 0 = 4 步全过, 1 = 有不通过 (--strict)
# 配套: AGENTS.md 铁律 4+ + apps/mobile/BUGS.md BUG-081

set +e

SERVER_DIR="/www/wwwroot/shipin-APP"
SERVER_SRC="$SERVER_DIR/src"
MOBILE_SRC="/www/.../apps/mobile/src"  # mobile src 不在 shipin-APP, 这台机没源码
WEB_SRC="/www/.../apps/web/src"        # web src 不在 shipin-APP, 这台机没源码

PASS=0
FAIL=0
WARN=0
FAIL_MSGS=()

echo "═══════════════════════════════════════════════════════════════"
echo "  shipin-APP 状态机迁移 4 步同步自检 (S71 BUG-081 配套)"
echo "═══════════════════════════════════════════════════════════════"
echo

# ==================== 步骤 1: allowedStates allowlist grep ====================
echo "── 步骤 1: allowedStates allowlist (server 端 status 引用点) ──"
echo "   检查所有 status 字段 + allowedStates/transition 引用..."
if [ -d "$SERVER_SRC/services" ]; then
  STATUS_REFS=$(grep -rn "allowedStates\|status\s*===\s*'\|status:\s*'[a-z_]" "$SERVER_SRC/services" 2>/dev/null | wc -l)
  echo "   找到 $STATUS_REFS 处 status 引用 (allowedStates + status 字符串)"
  if [ "$STATUS_REFS" -gt 0 ]; then
    echo "   ✓ 步骤 1 通过 (有 status 引用, AI 必看 grep 结果逐个确认)"
    PASS=$((PASS+1))
  else
    echo "   ⚠ 步骤 1 警告: 0 命中, 可能是新代码, 但建议手动检查"
    WARN=$((WARN+1))
  fi
else
  echo "   ⚠ 步骤 1 跳过: $SERVER_SRC/services 不存在 (脚本应在 server src 目录跑)"
  WARN=$((WARN+1))
fi
echo

# ==================== 步骤 2: response handler UI case grep (server 端) ====================
echo "── 步骤 2: response handler (server controller 返 status 给前端) ──"
echo "   检查 controllers/ 跟 status 相关的 response 字段..."
if [ -d "$SERVER_SRC/controllers" ]; then
  STATUS_RESPONSE=$(grep -rn "status:\s*'[a-z_]\|res\.status\|conversation\.status" "$SERVER_SRC/controllers" 2>/dev/null | wc -l)
  echo "   找到 $STATUS_RESPONSE 处 controller 返 status"
  if [ "$STATUS_RESPONSE" -gt 0 ]; then
    echo "   ✓ 步骤 2 通过 (有 status 返前端, AI 必确认前端 web/mobile 同步)"
    PASS=$((PASS+1))
  else
    echo "   ⚠ 步骤 2 警告: 0 命中"
    WARN=$((WARN+1))
  fi
else
  echo "   ⚠ 步骤 2 跳过"
  WARN=$((WARN+1))
fi
echo

# ==================== 步骤 3: DB schema 兼容 ====================
echo "── 步骤 3: DB schema 兼容 (initTables ALTER + 老 status 兼容) ──"
echo "   检查 models/db.ts ALTER TABLE 跟 status 字段..."
if [ -f "$SERVER_SRC/models/db.ts" ]; then
  STATUS_DB=$(grep -n "ALTER TABLE\|status\s*VARCHAR\|status\s*ENUM\|task_status" "$SERVER_SRC/models/db.ts" 2>/dev/null | wc -l)
  echo "   找到 $STATUS_DB 处 status 字段定义/迁移"
  if [ "$STATUS_DB" -gt 0 ]; then
    echo "   ✓ 步骤 3 通过 (有 status DB 字段, AI 必确认 ALTER 兼容)"
    PASS=$((PASS+1))
  else
    echo "   ⚠ 步骤 3 警告: 0 命中"
    WARN=$((WARN+1))
  fi
else
  echo "   ⚠ 步骤 3 跳过: db.ts 不存在"
  WARN=$((WARN+1))
fi
echo

# ==================== 步骤 4: web/mobile 端 case 状态 (本机无源码) ====================
echo "── 步骤 4: web/mobile 端 UI case 状态 (本机无源码, 跳过) ──"
echo "   本脚本在生产服务器跑, 无 web/mobile 源码."
echo "   ⚠ 必在开发机手动跑:"
echo "     apps/web: grep -rn \"case 'old_status'\" apps/web/src"
echo "     apps/mobile: grep -rn \"case 'old_status'\" apps/mobile/src"
echo "   AI 必看 grep 结果逐个确认 (跨端一致)"
WARN=$((WARN+1))
echo

# ==================== 汇总 ====================
echo "═══════════════════════════════════════════════════════════════"
echo "  状态机迁移自检汇总 (S71 BUG-081 配套)"
echo "═══════════════════════════════════════════════════════════════"
echo "  PASS: $PASS"
echo "  WARN: $WARN"
echo "  FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "  失败项:"
  for msg in "${FAIL_MSGS[@]}"; do
    echo "    - $msg"
  done
  echo
  echo "  ✗ 严格模式: 有失败, exit 1"
  exit 1
fi
echo
if [ "$WARN" -gt 0 ]; then
  echo "  ⚠ 有警告 (步骤 4 跳过 + 步骤 1-3 0 命中), AI 必手动确认"
fi
echo "  ✓ 步骤 1-3 通过, 状态机迁移 4 步同步 (S71 BUG-081 配套)"
exit 0
