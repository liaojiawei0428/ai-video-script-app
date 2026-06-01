#!/bin/bash
# ============================================================
# Deep剧本 安全部署脚本
# 部署前检查活跃任务 → 发公告 → 等待完成 → 部署 → 恢复
# ============================================================
set -e

SERVER="http://localhost:6000"
DIST_DIR="/www/wwwroot/shipin-APP/dist"
MAX_WAIT=900  # 最多等待15分钟

echo ">>> [1/6] 检查活跃任务..."
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
echo "    活跃任务数: ${COUNT}"

if [ "${COUNT}" -gt 0 ]; then
  echo ">>> [2/6] 有活跃任务，发布维护公告..."
  curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"title":"系统维护通知","content":"系统即将进行升级维护，预计几分钟完成。正在运行的任务将正常完成，请稍候。"}' > /dev/null
  echo "    公告已发布"

  echo ">>> [3/6] 开启维护模式（停止接收新任务）..."
  curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=true" > /dev/null
  echo "    维护模式已开启"

  echo ">>> [4/6] 等待活跃任务完成（最多${MAX_WAIT}秒）..."
  WAITED=0
  while [ $WAITED -lt $MAX_WAIT ]; do
    COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
    echo -ne "    \r等待中... 剩余任务: ${COUNT}  (已等${WAITED}s)"
    [ "$COUNT" -eq 0 ] && break
    sleep 10
    WAITED=$((WAITED + 10))
  done
  echo ""
else
  echo "    无活跃任务，跳过公告和等待"
fi

echo ">>> [5/6] 执行部署..."
tar xzf /tmp/dist.tar.gz -C "${DIST_DIR}/"
pm2 restart ai-script-server --update-env

# 等待服务就绪
echo "    等待服务就绪..."
for i in $(seq 1 30); do
  if curl -s "${SERVER}/health" > /dev/null 2>&1; then
    echo "    服务已就绪"
    break
  fi
  sleep 1
done

echo ">>> [6/6] 恢复服务..."
curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=false" > /dev/null 2>&1
curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"title":"系统升级完成","content":"系统维护已完成，已恢复正常使用。"}' > /dev/null 2>&1

echo "=== 部署完成 ==="
