#!/bin/bash
# BUG-095 部署: server restart + 验证 markUserNotified 不再抛错
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /www/wwwroot/shipin-APP
echo "=== backup dist + 解压 BUG-095 修法 ==="
if [ -d dist ]; then
  mv dist dist.bak.bug095-$TS
fi
tar -xzf /tmp/dist_20260626_131500.tar.gz
# 嵌套 dist/dist 修复
if [ -d dist/dist ] && [ -f dist/dist/index.js ]; then
  mv dist dist.empty.bak.$TS
  mv dist.empty.bak.$TS/dist dist
  rmdir dist.empty.bak.$TS
fi
ls -la dist/index.js dist/models/db.js 2>&1 | head -3

echo "=== systemd restart + /api/version 验证 ==="
systemctl restart shipin-app
sleep 3
echo "  systemctl: $(systemctl is-active shipin-app)"
echo "  /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"

echo "=== BUG-095 验证 ==="
echo "  ALTER status enum user_notified in db.js: $(grep -c 'user_notified' dist/models/db.js) 命中"
echo "  markUserNotified SET status='user_notified' in dist: $(grep -A 1 'markUserNotified' dist/models/rechargeRequest.js | grep -c 'user_notified')"

echo "=== DB schema 当前 ==="
mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e "SHOW COLUMNS FROM recharge_requests WHERE Field='status'" 2>&1 | grep -v Warning
