#!/bin/bash
# BUG-098 完整修法部署 v3: updateStatus + topUp 双修
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /www/wwwroot/shipin-APP
echo "=== 备份 + 解压 ==="
if [ -d dist ]; then
  mv dist dist.bak.bug098v3-$TS
fi
tar -xzf /tmp/dist_20260626_140500.tar.gz
if [ -d dist/dist ] && [ -f dist/dist/index.js ]; then
  mv dist dist.empty.bak.$TS
  mv dist.empty.bak.$TS/dist dist
  rmdir dist.empty.bak.$TS
fi
systemctl restart shipin-app
sleep 3
echo "  systemctl: $(systemctl is-active shipin-app)"
echo "  /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"

echo "=== BUG-098 完整修法验证 ==="
echo "  topUp ref_label '' literal: $(grep -c "VALUES (?, ?, 'charge', ?, ?, '', ?, 0, 0, 'recharge', '', '', ?)" dist/services/billingService.js) 命中"
echo "  updateStatus 4 params: $(grep "UPDATE recharge_requests SET status" dist/models/rechargeRequest.js)"

echo "=== 端到端 approve 验证 (完整流程) ==="
python3 /tmp/verify-bug098-clean.py 2>&1
