#!/bin/bash
# 部署 v3.0.33 (BUG-082 P2 修法 6/7/8 + 6 处版本号同步)
# 走 systemd + 宝塔同步 (S70 BUG-077)
set -e

DIST_DIR="/www/wwwroot/shipin-APP"
WEB_DIR="/www/wwwroot/ab.maque.uno"
BAOTA_SITE_DB="/www/server/panel/data/db/site.db"
BAOTA_PID="/www/server/nodejs/vhost/pids/shipin_APP.pid"
BAOTA_SCRIPT="/www/server/nodejs/vhost/scripts/shipin_APP.sh"
BAOTA_BIN="/www/server/nodejs/vhost/bin/go.sh"
NEW_VERSION="3.0.33"
TS=$(date +%Y%m%d_%H%M%S)
BAK_DIR="${DIST_DIR}/dist.bak.v${NEW_VERSION}-${TS}"

echo "===== [1/8] 备份当前 dist ====="
mv "${DIST_DIR}/dist" "${BAK_DIR}"
echo "  ✓ 备份到: ${BAK_DIR}"

echo "===== [2/8] 解压新 dist ====="
tar xzf /tmp/dist.tar.gz -C "${DIST_DIR}/"
echo "  ✓ dist 解压完成"

echo "===== [3/8] 改 .env APP_VERSION=${NEW_VERSION} ====="
sed -i "s/^APP_VERSION=.*/APP_VERSION=${NEW_VERSION}/" "${DIST_DIR}/.env"
grep "^APP_VERSION=" "${DIST_DIR}/.env"

echo "===== [4/8] 改 systemd unit APP_VERSION=${NEW_VERSION} ====="
sed -i "s/^Environment=APP_VERSION=.*/Environment=APP_VERSION=${NEW_VERSION}/" /etc/systemd/system/shipin-app.service
grep "^Environment=APP_VERSION=" /etc/systemd/system/shipin-app.service

echo "===== [5/8] daemon-reload + restart shipin-app ====="
systemctl daemon-reload
systemctl restart shipin-app
echo "  等待服务就绪..."
for i in $(seq 1 30); do
  if curl -sm 2 "${SERVER:-http://127.0.0.1:6000}/health" > /dev/null 2>&1; then
    echo "  ✓ 服务已就绪 (第 ${i}s)"
    break
  fi
  sleep 1
done

echo "===== [6/8] 验证 /api/version ====="
NEW_VER=$(curl -sm 5 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["data"]["version"])')
echo "  /api/version: ${NEW_VER}"
if [ "${NEW_VER}" != "${NEW_VERSION}" ]; then
  echo "  ✗ 版本号不匹配, 期望 ${NEW_VERSION} 实际 ${NEW_VER}"
  exit 1
fi
echo "  ✓ 版本号匹配"

echo "===== [7/8] 同步宝塔 Node 项目 (BUG-077 配套) ====="
# 同步 PID 文件 (systemd restart 改 PID, 宝塔要跟上)
systemctl show -p MainPID --value shipin-app > "${BAOTA_PID}"
echo "  ✓ PID 同步: $(cat ${BAOTA_PID})"
# 同步 site.db run_user=root + is_power_on=true
sqlite3 "${BAOTA_SITE_DB}" "UPDATE sites SET project_config = json_set(project_config, '\$.run_user', 'root', '\$.is_power_on', true) WHERE name='shipin_APP';" 2>&1
echo "  ✓ site.db shipin_APP run_user=root is_power_on=true 同步"

echo "===== [8/8] 部署 web (v3.0.33) ====="
WEB_BAK="${WEB_DIR}/dist.bak.v${NEW_VERSION}-${TS}"
mv "${WEB_DIR}/dist" "${WEB_BAK}"
tar xzf /tmp/web_dist.tar.gz -C "${WEB_DIR}/"
# nginx 不需要 reload (静态文件, 自动生效), 但 reload 一次确保 cache 刷新
nginx -s reload 2>&1 || systemctl reload nginx_bt 2>&1
echo "  ✓ web dist 部署完成 (备份: ${WEB_BAK})"

echo "===== 部署完成 ====="
echo "版本: ${NEW_VER}"
echo "备份: ${BAK_DIR}"
echo "web 备份: ${WEB_BAK}"
