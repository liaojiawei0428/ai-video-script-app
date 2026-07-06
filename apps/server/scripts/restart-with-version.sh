#!/bin/bash
# BUG-082: bump APP_VERSION in .env + restart
set -e
cd /www/wwwroot/shipin-APP
# 用 sed 替换 APP_VERSION=3.0.29 → APP_VERSION=3.0.32 (注意: 不能覆盖整个 .env, 跨端铁律)
sed -i 's/^APP_VERSION=3\.0\.29$/APP_VERSION=3.0.32/' .env
echo "after sed:"
grep APP_VERSION .env
# 重启
systemctl reset-failed shipin-app 2>/dev/null || true
systemctl restart shipin-app
sleep 3
systemctl is-active shipin-app
curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json;d=json.load(sys.stdin); print("API version:", d["data"]["version"]); print("changelog:", d["data"]["changelog"][:100])'
