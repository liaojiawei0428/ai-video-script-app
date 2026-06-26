#!/bin/bash
# deploy-bug100-verify.sh 远端验证 (PS 5.1 安全版, base64 decode 后 bash 跑)
echo "=== 1. 3 fix dist 命中 ==="
echo "1. ffmpegHelper image2pipe: $(grep -c image2pipe /www/wwwroot/shipin-APP/dist/utils/ffmpegHelper.js)"
echo "2. re-confirm: $(grep -c 're-confirm from tool_completed' /www/wwwroot/shipin-APP/dist/services/videoAgentService.js)"
echo "3. markFailed: $(grep -c 'video_generations.markFailed' /www/wwwroot/shipin-APP/dist/services/videoAgentService.js)"

echo ""
echo "=== 2. 清 69 卡死任务 + 状态分布 ==="
mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script -e "
  UPDATE video_generations
  SET status = 'failed',
      error_msg = 'Pre BUG-100: ffmpeg + agens upstream 累积 17 days (2026-06-09 to 2026-06-26)'
  WHERE status = 'queued'
    AND created_at < UNIX_TIMESTAMP(NOW() - INTERVAL 1 DAY) * 1000;
  SELECT status, COUNT(*) AS cnt FROM video_generations GROUP BY status;
"

echo ""
echo "=== 3. server 端到端 ==="
echo "5a. /health: $(curl -sIm 3 http://127.0.0.1:6000/health | head -1 | tr -d '\r')"
echo "5b. /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])' 2>/dev/null)"
echo "5c. systemd: $(systemctl is-active shipin-app.service)"
echo "5d. PID: $(cat /www/server/nodejs/vhost/pids/shipin_APP.pid 2>/dev/null)"
