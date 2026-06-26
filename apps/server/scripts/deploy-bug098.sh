#!/bin/bash
# BUG-098 紧急部署: server restart 让 updateStatus SQL 修复生效
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /www/wwwroot/shipin-APP
echo "=== 备份 + 解压 BUG-098 修法 ==="
if [ -d dist ]; then
  mv dist dist.bak.bug098-$TS
fi
tar -xzf /tmp/dist_20260626_140200.tar.gz
# 嵌套 dist/dist 修复
if [ -d dist/dist ] && [ -f dist/dist/index.js ]; then
  mv dist dist.empty.bak.$TS
  mv dist.empty.bak.$TS/dist dist
  rmdir dist.empty.bak.$TS
  echo "  ✅ 嵌套 dist 修复"
fi
ls -la dist/index.js dist/models/rechargeRequest.js 2>&1 | head -3

echo "=== systemd restart ==="
systemctl restart shipin-app
sleep 3
echo "  systemctl: $(systemctl is-active shipin-app)"
echo "  /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"

echo "=== BUG-098 验证: updateStatus 含 id 参数 ==="
grep "SET status = .* WHERE id" dist/models/rechargeRequest.js | head -2
echo "  params: $(grep -A 1 'UPDATE recharge_requests SET status' dist/models/rechargeRequest.js | tail -1 | tr ',' '\n' | wc -l) 个"

echo "=== 端到端 approve 验证 ==="
TOKEN=$(curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
ORDERS=$(curl -s "http://127.0.0.1:6000/api/admin/orders?status=user_notified" -H "Authorization: Bearer $TOKEN")
echo "$ORDERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('user_notified count:', len(d.get('data',{}).get('orders',[]))); [print(f\"  {o[\\\"id\\\"][:8]} {o[\\\"username\\\"]} amount={o[\\\"amount\\\"]}\") for o in d.get('data',{}).get('orders',[])[:3]]"
