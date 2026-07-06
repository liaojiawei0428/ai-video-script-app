#!/bin/bash
# BUG-082 部署脚本
set -e

SERVER_DIR="/www/wwwroot/shipin-APP"
WEB_DIR="/www/wwwroot/ab.maque.uno"
TS=$(date +%Y%m%d_%H%M%S)

echo "=== 1. 备份 ==="
cd $SERVER_DIR
[ -d dist ] && mv dist dist.bak.bug082-$TS || true
[ -f dist.bak.bug082-$TS/services/videoAgentService.js ] && echo "backup ok"

echo "=== 2. 解压 server dist ==="
unzip -oq /tmp/dist-server.zip -d $SERVER_DIR/
chown -R root:root $SERVER_DIR/dist
ls $SERVER_DIR/dist/services/videoAgentService.js
md5sum $SERVER_DIR/dist/services/videoAgentService.js
md5sum $SERVER_DIR/dist/services/imageAgentService.js
md5sum $SERVER_DIR/dist/utils/errorUtils.js

echo "=== 3. 重启 systemd shipin-app ==="
systemctl reset-failed shipin-app 2>/dev/null || true
systemctl daemon-reload
systemctl restart shipin-app
sleep 3
systemctl is-active shipin-app
ss -tln | grep ':6000' | head -1

echo "=== 4. 健康检查 ==="
curl -sI -m 3 http://127.0.0.1:6000/health | head -1
curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])'

echo "=== 5. 部署 web dist ==="
cd $WEB_DIR
[ -d dist ] && mv dist dist.bak.bug082-$TS || true
unzip -oq /tmp/dist-web.zip -d $WEB_DIR/
ls $WEB_DIR/dist/assets/ | head -5

echo "=== 6. nginx reload ==="
/usr/sbin/nginx -s reload 2>&1 || /www/server/nginx/sbin/nginx -s reload 2>&1 || true
sleep 1
curl -sIk -m 5 https://ab.maque.uno/ | head -1

echo "=== 7. 验证新版本 + 防御渲染 ==="
ls -la $WEB_DIR/dist/assets/index-*.js
grep -o "e.message.message.*JSON.stringify" $WEB_DIR/dist/assets/index-*.js | head -1

echo "=== DONE ==="
