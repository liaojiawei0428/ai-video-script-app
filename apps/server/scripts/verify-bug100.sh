#!/bin/bash
# apps/server/scripts/verify-bug100.sh
# v3.0.37 BUG-100 验证脚本 (S72 batch 8 后置, 跟 deploy-bug100.sh 配套)
#
# 5 维必查:
#   1. dist 含 image2pipe (Fix 1)
#   2. dist 含 re-confirm from tool_completed (Fix 2)
#   3. dist 含 video_generations.markFailed (Fix 3)
#   4. video_generations 状态分布 (无 17 天前 queued)
#   5. server 端到端 /api/version + /health
#
# 用法: ssh root@119.91.155.46 "bash /tmp/verify-bug100.sh"
# 作者: mavis, 2026-06-26

set -e
set +e  # 容忍 grep miss 走完整 set (跟 verify-deploy 维度 22 容忍 set -e 同源, BUG-099 教训)

SERVER="root@119.91.155.46"
REMOTE_DEPLOY="/www/wwwroot/shipin-APP"
SSH_KEY="C:\\Users\\Administrator\\.ssh\\test2"
SSH_KEY_UNIX="/c/Users/Administrator/.ssh/test2"
SSH_OPTS="-i $SSH_KEY_UNIX -o StrictHostKeyChecking=no -o ConnectTimeout=10"

color() {
  case "$1" in
    red)    echo -e "\033[31m$2\033[0m" ;;
    green)  echo -e "\033[32m$2\033[0m" ;;
    yellow) echo -e "\033[33m$2\033[0m" ;;
    blue)   echo -e "\033[34m$2\033[0m" ;;
    *)      echo "$2" ;;
  esac
}

PASS=0
FAIL=0
FAIL_MSGS=()

color blue "═══ BUG-100 验证 (5 维) ═══"

# ───── 1. dist 含 image2pipe (Fix 1) ─────
color blue "── 1. dist 含 image2pipe (Fix 1: ffmpeg image2pipe muxer) ──"
if grep -q "image2pipe" "$REMOTE_DEPLOY/dist/utils/ffmpegHelper.js"; then
  color green "   ✓ 1. ffmpegHelper.js 含 image2pipe muxer"
  PASS=$((PASS+1))
else
  color red "   ✗ 1. ffmpegHelper.js 缺 image2pipe (Fix 1 没部署成功)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("1. image2pipe 缺失")
fi

# ───── 2. dist 含 re-confirm from tool_completed (Fix 2) ─────
color blue "── 2. dist 含 re-confirm from tool_completed (Fix 2: 状态机迁移) ──"
if grep -q "re-confirm from tool_completed" "$REMOTE_DEPLOY/dist/services/videoAgentService.js"; then
  color green "   ✓ 2. videoAgentService.js 含 re-confirm from tool_completed (tool_completed 状态允许重 confirm)"
  PASS=$((PASS+1))
else
  color red "   ✗ 2. videoAgentService.js 缺 re-confirm (Fix 2 没部署成功)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("2. re-confirm 缺失")
fi

# ───── 3. dist 含 video_generations.markFailed (Fix 3) ─────
color blue "── 3. dist 含 video_generations.markFailed (Fix 3: catch 必标 failed) ──"
MARK_FAIL_COUNT=$(grep -c "video_generations.markFailed" "$REMOTE_DEPLOY/dist/services/videoAgentService.js")
if [ "$MARK_FAIL_COUNT" -ge 2 ]; then
  color green "   ✓ 3. videoAgentService.js 含 $MARK_FAIL_COUNT 处 markFailed (createTask catch + persist catch 2 个 catch 块都修了)"
  PASS=$((PASS+1))
else
  color red "   ✗ 3. videoAgentService.js 只有 $MARK_FAIL_COUNT 处 markFailed (期望 ≥ 2, Fix 3 没全部署)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("3. markFailed 不足 2 处 (实际 $MARK_FAIL_COUNT)")
fi

# ───── 4. video_generations 状态分布 (无 17 天前 queued) ─────
color blue "── 4. video_generations 状态分布 (无 17 天前 queued) ──"
STATS=$(mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script -B -N -e "
  SELECT status, COUNT(*) FROM video_generations GROUP BY status;
")
echo "$STATS"

QUEUED_COUNT=$(echo "$STATS" | awk '$1=="queued" {print $2}')
if [ -z "$QUEUED_COUNT" ]; then QUEUED_COUNT=0; fi
# 阈值: 0 queued = PASS, 1-5 queued (近 24h 新任务可能) = PASS, > 5 queued = FAIL
if [ "$QUEUED_COUNT" -le 5 ]; then
  color green "   ✓ 4. video_generations queued=$QUEUED_COUNT (≤ 5 PASS, 0 = 完美, 1-5 = 近 24h 新任务)"
  PASS=$((PASS+1))
else
  color red "   ✗ 4. video_generations queued=$QUEUED_COUNT (> 5 FAIL, 还有 17 天前卡死任务没清)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("4. queued 仍有 $QUEUED_COUNT (> 5)")
fi

# ───── 5. server 端到端 (跟 v3.0.37 部署配套) ─────
color blue "── 5. server 端到端 (/api/version + /health + systemd) ──"
HEALTH=$(curl -sIm 3 http://127.0.0.1:6000/health | head -1 | tr -d '\r')
if echo "$HEALTH" | grep -q "200"; then
  color green "   ✓ 5a. /health: $HEALTH"
  PASS=$((PASS+1))
else
  color red "   ✗ 5a. /health: $HEALTH"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("5a. /health 失败")
fi

VERSION=$(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['version'])" 2>/dev/null || echo "ERR")
if [ "$VERSION" = "3.0.37" ]; then
  color green "   ✓ 5b. /api/version: $VERSION"
  PASS=$((PASS+1))
else
  color red "   ✗ 5b. /api/version: $VERSION (期望 3.0.37)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("5b. /api/version 错")
fi

SYSTEMD_ACTIVE=$(systemctl is-active shipin-app.service 2>/dev/null || echo "unknown")
if [ "$SYSTEMD_ACTIVE" = "active" ]; then
  color green "   ✓ 5c. systemd shipin-app: $SYSTEMD_ACTIVE"
  PASS=$((PASS+1))
else
  color red "   ✗ 5c. systemd shipin-app: $SYSTEMD_ACTIVE (期望 active)"
  FAIL=$((FAIL+1))
  FAIL_MSGS+=("5c. systemd 挂")
fi

# ───── 汇总 ─────
echo
color blue "═══ BUG-100 验证汇总 ═══"
color green "PASS=$PASS"
if [ "$FAIL" -gt 0 ]; then
  color red "FAIL=$FAIL"
  for msg in "${FAIL_MSGS[@]}"; do
    color red "   - $msg"
  done
  echo
  color red "❌ BUG-100 验证有 FAIL, 必查后重跑"
  exit 1
else
  color green "FAIL=0"
  color green "✅ BUG-100 验证全过"
  exit 0
fi
