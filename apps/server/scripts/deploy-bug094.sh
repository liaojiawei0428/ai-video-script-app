#!/bin/bash
# shipin-APP 升级 v3.0.37 BUG-094 修法 (markUserNotified 改 status + admin 端点过滤 pending)
set -e
TS=$(date +%Y%m%d_%H%M%S)

echo "=== [1/7] server 备份 + 解压新 dist ==="
cd /www/wwwroot/shipin-APP
if [ -d dist ]; then
  mv dist dist.bak.bug094-$TS
  echo "  备份: dist -> dist.bak.bug094-$TS"
fi
tar -xzf /tmp/dist_20260626_130000.tar.gz
# 修嵌套 dist/dist (跟 v3.0.37 第一次部署同源)
if [ -d dist/dist ]; then
  if [ -f dist/dist/index.js ]; then
    mv dist dist.empty.bak.$TS
    mv dist.empty.bak.$TS/dist dist
    rmdir dist.empty.bak.$TS
    echo "  ✅ 嵌套 dist 修复"
  fi
fi
ls -la dist/index.js dist/changelog.json 2>&1 | head -3

echo "=== [2/7] server systemd restart (env 同步 deploy.sh 自动) ==="
systemctl restart shipin-app
sleep 3
echo "  systemctl: $(systemctl is-active shipin-app)"
echo "  /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "  /health: $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d '\r')"

echo "=== [3/7] server 端点 BUG-094 验证 ==="
echo "  notify-paid 端点: $(grep -c 'notify-paid' /www/wwwroot/shipin-APP/dist/routes/recharge.js 2>/dev/null || echo 0) 命中"
echo "  markUserNotified 含 status='user_notified': $(grep -c "user_notified" /www/wwwroot/shipin-APP/dist/models/rechargeRequest.js 2>/dev/null || echo 0) 命中"
echo "  findByStatuses method: $(grep -c 'findByStatuses' /www/wwwroot/shipin-APP/dist/models/rechargeRequest.js 2>/dev/null || echo 0) 命中"
echo "  admin.ts default 'user_notified': $(grep -c "'user_notified'" /www/wwwroot/shipin-APP/dist/routes/admin.js 2>/dev/null || echo 0) 命中"

echo "=== [4/7] web 部署 (解压到 ab.maque.uno/dist + 宝塔 nginx reload) ==="
cd /www/wwwroot/ab.maque.uno
if [ -d dist ]; then
  mv dist dist.bak.bug094-$TS
  echo "  web 备份: dist -> dist.bak.bug094-$TS"
fi
mkdir -p dist
tar -xzf /tmp/web-dist-20260626_130000.tgz -C dist/
# 修嵌套 (跟前次同源)
if [ -d dist/dist ]; then
  if [ -f dist/dist/index.html ]; then
    mv dist dist.empty.bak.$TS
    mv dist.empty.bak.$TS/dist dist
    rmdir dist.empty.bak.$TS
    echo "  ✅ web 嵌套 dist 修复"
  fi
fi
ls -la dist/ dist/assets/ 2>&1 | head -8
/etc/init.d/nginx reload 2>&1

echo "=== [5/7] web BUG-094 验证 (默认 'user_notified' + 5 tab) ==="
echo "  web dist hash: $(ls /www/wwwroot/ab.maque.uno/dist/assets/ | grep '.js$' | head -1)"
echo "  adminOrdersApi 'user_notified' 关键字: $(grep -c 'user_notified' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | head -1)"

echo "=== [6/7] admin 端点测试 (看 admin/orders 返什么 status) ==="
# 这里不能直接 curl /api/admin/orders (需 admin JWT), 改用 SQL 看实际 DB 状态
mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e "SELECT status, COUNT(*) as cnt FROM recharge_requests GROUP BY status" 2>&1 | head -10

echo "=== [7/7] 端到端验证 ==="
curl -skm 5 -o /dev/null -w "  https://ab.maque.uno/ HTTP %{http_code}\n" https://ab.maque.uno/
curl -sm 3 -o /dev/null -w "  https://ab.maque.uno/api/version HTTP %{http_code}\n" https://ab.maque.uno/api/version

echo "=== BUG-094 升级完成 ==="
