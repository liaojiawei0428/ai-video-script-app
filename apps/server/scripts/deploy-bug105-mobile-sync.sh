#!/bin/bash
# apps/server/scripts/deploy-bug105-mobile-sync.sh
# v3.0.41 BUG-105 mobile 端 sync (S72 batch 7 后置)
#
# 配套 apps/mobile/src/utils/characterUtils.ts (跟 web 端 characterUtils.ts v2.5.34 1:1)
# + 3 个 mobile screen 改 import
# + 6 处版本号同步 3.0.40 → 3.0.41
#
# 用法:
#   scp deploy-bug105-mobile-sync.sh root@159.75.16.110:/tmp/
#   ssh root@159.75.16.110 "bash /tmp/deploy-bug105-mobile-sync.sh"
#
# 部署时间: 2026-06-26 (S72 batch 7 后置, BUG-105 mobile sync), 作者 mavis

set -e

NEW_VERSION="3.0.41"
OLD_VERSION="3.0.40"
PUBLIC_DIR="/www/wwwroot/shipin-APP/public"
SERVER_DIR="/www/wwwroot/shipin-APP"
APK_NAME="DeepScript_v${NEW_VERSION}.apk"
APK_PATH="${PUBLIC_DIR}/${APK_NAME}"
TMP_APK="/tmp/${APK_NAME}"

color() {
  case "$1" in
    red)    echo -e "\033[31m$2\033[0m" ;;
    green)  echo -e "\033[32m$2\033[0m" ;;
    yellow) echo -e "\033[33m$2\033[0m" ;;
    blue)   echo -e "\033[34m$2\033[0m" ;;
    *)      echo "$2" ;;
  esac
}

color blue "═══ BUG-105 mobile 端 sync (v${OLD_VERSION} → v${NEW_VERSION}) ═══"

# ───── 1. cp APK from /tmp to public/ ─────
color blue "── [1/6] cp APK to public/ ──"
if [ ! -f "$TMP_APK" ]; then
  color red "✗ $TMP_APK 不存在, 必先 scp 上传 APK"
  exit 1
fi
cp "$TMP_APK" "$APK_PATH"
ls -la "$APK_PATH"

# ───── 2. cp .sha256 ─────
color blue "── [2/6] cp .sha256 ──"
cp "${TMP_APK}.sha256" "${APK_PATH}.sha256" 2>/dev/null || sha256sum "$APK_PATH" > "${APK_PATH}.sha256"
cat "${APK_PATH}.sha256"

# ───── 3. bump .env APP_VERSION ─────
color blue "── [3/6] bump .env APP_VERSION ──"
sed -i "s/^APP_VERSION=.*/APP_VERSION=${NEW_VERSION}/" "${SERVER_DIR}/.env"
grep "^APP_VERSION=" "${SERVER_DIR}/.env"

# ───── 4. bump systemd unit APP_VERSION ─────
color blue "── [4/6] bump systemd unit APP_VERSION ──"
sed -i "s/Environment=APP_VERSION=${OLD_VERSION}/Environment=APP_VERSION=${NEW_VERSION}/" /etc/systemd/system/shipin-app.service
grep APP_VERSION /etc/systemd/system/shipin-app.service

# ───── 5. bump ecosystem.config.js (deprecated but sync) ─────
color blue "── [5/6] bump ecosystem.config.js (deprecated but sync) ──"
ECOSYSTEM="${SERVER_DIR}/ecosystem.config.js"
if [ ! -f "$ECOSYSTEM" ]; then
  color yellow "⚠️  $ECOSYSTEM 不存在 (flat 结构有时省略), 跳过"
else
  # 兼容任意 3.0.x 历史版本 (远端历史可能是 3.0.29 等老版本, sed pattern 匹配 3.0.40 漏匹配)
  sed -i "s/APP_VERSION: '3\\.0\\.[0-9]*'/APP_VERSION: '${NEW_VERSION}'/g" "$ECOSYSTEM"
  grep "APP_VERSION:" "$ECOSYSTEM"
fi

# ───── 5b. bump dist/changelog.json ─────
color blue "── [5b/6] bump dist/changelog.json ──"
if [ -f /tmp/changelog.json ]; then
  cp -f /tmp/changelog.json "${SERVER_DIR}/dist/changelog.json"
  python3 -c "import json; d=json.load(open('${SERVER_DIR}/dist/changelog.json')); e=d['entries']; print('changelog 最新 entry: version=' + e[-1]['version'] + ' summary=' + e[-1]['summary'][:80])"
else
  color yellow "⚠️  /tmp/changelog.json 不存在, 跳过"
fi

# ───── 6. daemon-reload + restart ─────
color blue "── [6/6] daemon-reload + restart ──"
systemctl daemon-reload
systemctl restart shipin-app
sleep 4
systemctl is-active shipin-app.service
ss -tln | grep :6000 || color red "✗ 6000 端口没在听!"

color green "═══ 远端 bump 完成 ═══"