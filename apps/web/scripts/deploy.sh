#!/bin/bash
# ============================================================
# Deep剧本 Web 端 (Vite + React) 部署脚本
# 本地 build → 打包 → scp → 服务器解压 → nginx reload
# ============================================================
# v2.5.36+: 本脚本已纳入统一部署规范
# 完整流程见 docs/DEPLOY.md (节点 1-11)
# AI 助手在执行部署前必须完整阅读 docs/DEPLOY.md
# ============================================================
set -e

# ── 配置 ──
# 服务器地址 (可改成 ssh config 别名, 如 'ab-maque')
SERVER_HOST="${DEPLOY_HOST:-root@159.75.16.110}"
# 服务器 web 根目录 (与 nginx-ab.maque.uno.conf 的 root 保持一致)
WEB_DIR="${DEPLOY_WEB_DIR:-/www/wwwroot/web-app}"
# 临时 tar 包路径 (本地 + 服务器)
LOCAL_TGZ="/tmp/web-dist-$(date +%Y%m%d_%H%M%S).tgz"
REMOTE_TGZ="/tmp/web-dist.tgz"
# 健康检查 URL
HEALTH_URL="https://ab.maque.uno/"

echo ">>> [1/5] 本地 build web 端..."
cd "$(dirname "$0")/../.."  # 回到 monorepo 根
npm install --no-audit --no-fund --silent
cd apps/web
npm run build
cd ../..
echo "    build 完成: apps/web/dist/"

echo ">>> [2/5] 打包 dist + package.json (供 npm ci 用)..."
tar -czf "$LOCAL_TGZ" \
  --exclude='node_modules' \
  -C apps/web \
  dist package.json
echo "    已打包: $LOCAL_TGZ ($(du -h "$LOCAL_TGZ" | cut -f1))"

echo ">>> [3/5] scp 到服务器 ${SERVER_HOST}..."
scp "$LOCAL_TGZ" "${SERVER_HOST}:${REMOTE_TGZ}"

echo ">>> [4/5] 服务器部署..."
ssh "$SERVER_HOST" <<EOF
  set -e
  # 备份旧 dist
  if [ -d "${WEB_DIR}/dist" ]; then
    mv ${WEB_DIR}/dist ${WEB_DIR}/dist.bak.\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
  fi
  # 解压新 dist
  mkdir -p ${WEB_DIR}
  tar -xzf ${REMOTE_TGZ} -C ${WEB_DIR}/
  # 清理临时文件
  rm -f ${REMOTE_TGZ}
  # 确保文件权限
  chown -R www:www ${WEB_DIR}/dist 2>/dev/null || true
  echo "    已部署到 ${WEB_DIR}"
  # 校验 nginx 配置 + reload
  nginx -t && nginx -s reload || /etc/init.d/nginx reload
  echo "    nginx 已 reload"
EOF

echo ">>> [5/5] 健康检查..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  echo "    ✅ ${HEALTH_URL} 返回 ${HTTP_CODE}"
else
  echo "    ⚠️ ${HEALTH_URL} 返回 ${HTTP_CODE} (请人工检查)"
fi

# 清理本地临时文件
rm -f "$LOCAL_TGZ"

echo "=== Web 部署完成 ==="
echo "访问: ${HEALTH_URL}"
