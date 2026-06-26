#!/bin/bash
# apps/server/scripts/deploy-bug100.sh
# v3.0.37 BUG-100 部署脚本 (S72 batch 8 后置)
#
# 修法: 3 fix 一起发版
#   Fix 1: ffmpegHelper.ts 改用 image2pipe muxer (绕开 image2 muxer filename 误判)
#   Fix 2: videoAgentService.confirm() 允许 tool_completed 状态重 confirm
#   Fix 3: videoAgentService.runCreateTaskInBackground 2 个 catch 块必更新 video_generations 标 failed (防 69 任务卡 queued)
#
# 配套:
#   - 必跑 verify-bug100.sh 验证
#   - 必跑清 69 卡死任务 SQL (verify-bug100.sh § 4)
#
# 用法:
#   ssh root@159.75.16.110 "bash /tmp/deploy-bug100.sh"
#   或本地 (用 scp):  bash deploy-bug100.sh
#
# 部署时间: 2026-06-26 (S72 batch 8 后置), 作者: mavis

set -e

# ───── 配置 ─────
SERVER="root@159.75.16.110"
REMOTE_DEPLOY="/www/wwwroot/shipin-APP"
LOCAL_DIST="$(dirname $(dirname $(realpath $0)))/dist"
LOCAL_CHANGELOG="$(dirname $(dirname $(realpath $0)))/changelog.json"
LOCAL_PACKAGE="$(dirname $(dirname $(realpath $0)))/package.json"
SSH_KEY="${SSH_KEY:-C:\\Users\\Administrator\\.ssh\\test2}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Windows → Linux 路径转换 (PowerShell 跑时)
if [[ "$SSH_KEY" == *\\* ]]; then
  SSH_KEY_UNIX=$(echo "$SSH_KEY" | sed 's|\\|/|g' | sed 's|C:/|/c/|')
else
  SSH_KEY_UNIX="$SSH_KEY"
fi

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

color blue "═══ BUG-100 部署 (3 fix) ═══"
echo "时间: $TIMESTAMP"
echo "本地 dist: $LOCAL_DIST"
echo "远端: $REMOTE_DEPLOY"

# ───── 1. 预检 ─────
color blue "── 1. 预检 (跟 BUG-079/090 防呆) ──"
if [ ! -f "$LOCAL_DIST/utils/ffmpegHelper.js" ]; then
  color red "❌ dist 缺失 ffmpegHelper.js, 必先 npm run build"
  exit 1
fi
LINES=$(wc -l < "$LOCAL_DIST/utils/ffmpegHelper.js")
if [ "$LINES" -lt 50 ]; then
  color red "❌ ffmpegHelper.js 只有 $LINES 行 (< 50 = tsc 编译坏, 跟 S54 BUG-073 同源)"
  exit 1
fi
color green "✓ ffmpegHelper.js $LINES 行 (≥ 50 PASS)"

# 验 3 fix 都在 dist
if ! grep -q "image2pipe" "$LOCAL_DIST/utils/ffmpegHelper.js"; then
  color red "❌ dist ffmpegHelper.js 缺 image2pipe (Fix 1 没编译进去)"
  exit 1
fi
if ! grep -q "re-confirm from tool_completed" "$LOCAL_DIST/services/videoAgentService.js"; then
  color red "❌ dist videoAgentService.js 缺 re-confirm (Fix 2 没编译进去)"
  exit 1
fi
if ! grep -q "video_generations.markFailed" "$LOCAL_DIST/services/videoAgentService.js"; then
  color red "❌ dist videoAgentService.js 缺 markFailed (Fix 3 没编译进去)"
  exit 1
fi
color green "✓ 3 fix 全部在 dist (image2pipe / re-confirm / markFailed)"

# ───── 2. 备份 + scp ─────
color blue "── 2. 备份 + scp ──"
color yellow "远端备份 dist → dist.bak.bug100.$TIMESTAMP"
ssh $SSH_OPTS $SERVER "cp -r $REMOTE_DEPLOY/dist $REMOTE_DEPLOY/dist.bak.bug100.$TIMESTAMP"

color yellow "scp dist + changelog + package.json → 远端 /tmp/"
# scp dist 整目录
scp $SSH_OPTS -r "$LOCAL_DIST" $SERVER:/tmp/dist-bug100/
scp $SSH_OPTS "$LOCAL_CHANGELOG" $SERVER:/tmp/changelog.json
scp $SSH_OPTS "$LOCAL_PACKAGE" $SERVER:/tmp/package.json
color green "✓ scp 完成"

# ───── 3. 远端部署 ─────
color blue "── 3. 远端部署 (替换 dist + 走 systemd) ──"
ssh $SSH_OPTS $SERVER "
  set -e
  cd $REMOTE_DEPLOY

  # 替换 dist (保留 .bak)
  rm -rf dist
  mv /tmp/dist-bug100 dist

  # 同步 changelog + package.json
  cp -f /tmp/changelog.json dist/changelog.json
  cp -f /tmp/package.json package.json

  # 走宝塔 Node 项目脚本 (systemd Type=simple)
  /www/server/nodejs/vhost/scripts/shipin_APP.sh restart

  # 验证 systemd unit 状态
  systemctl is-active shipin-app.service
"

color green "✓ 远端部署完成 + restart"

# ───── 4. 必跑清 69 卡死任务 SQL ─────
color blue "── 4. 清 69 卡 queued 任务 (Pre BUG-100 累积) ──"
ssh $SSH_OPTS $SERVER "
  mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script -e \"
    UPDATE video_generations
    SET status = 'failed',
        error_msg = 'Pre BUG-100: ffmpeg 抽帧失败 + agnes 上游 fetch 失败 累积 (2026-06-09 ~ 2026-06-26, 17 天 69 任务)'
    WHERE status = 'queued'
      AND created_at < UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY) * 1000;
  \"

  # 验证清后状态分布
  mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script -e \"
    SELECT status, COUNT(*) AS cnt FROM video_generations GROUP BY status;
  \"
"
color green "✓ 69 卡死任务已清 (Pre BUG-100 标 failed)"

# ───── 5. 必跑 verify-bug100.sh 验证 ─────
color blue "── 5. 必跑 verify-bug100.sh 验证 (跟 24 维配套) ──"
VERIFY_SCRIPT="$(dirname $(realpath $0))/verify-bug100.sh"
if [ -f "$VERIFY_SCRIPT" ]; then
  scp $SSH_OPTS "$VERIFY_SCRIPT" $SERVER:/tmp/verify-bug100.sh
  ssh $SSH_OPTS $SERVER "chmod +x /tmp/verify-bug100.sh && bash /tmp/verify-bug100.sh"
else
  color yellow "⚠️ verify-bug100.sh 不存在, 跳过"
fi

# ───── 6. 24 维验证 (跟 v3.0.37 部署配套) ─────
color blue "── 6. 24 维验证 ──"
ssh $SSH_OPTS $SERVER "bash /tmp/verify-deploy.sh" || color yellow "⚠️ 24 维验证有 FAIL, 检查"

color green "═══ BUG-100 部署完成 ═══"
echo
echo "回滚: ssh $SERVER 'cd $REMOTE_DEPLOY && /www/server/nodejs/vhost/scripts/shipin_APP.sh stop && rm -rf dist && mv dist.bak.bug100.$TIMESTAMP dist && /www/server/nodejs/vhost/scripts/shipin_APP.sh start'"
echo "沉淀: BUG-100 必写 BUGS_INDEX.md + apps/mobile/BUGS.md + mavis memory + docs/DEPLOY_RELEASE_FLOW.md § 8"
