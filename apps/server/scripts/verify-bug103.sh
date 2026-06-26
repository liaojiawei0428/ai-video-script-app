#!/bin/bash
echo "=== BUG-103 5 维 verify ==="
echo ""
echo "1. refundStep 0 命中 (远端 dist):"
grep -c 'async refundStep' /www/wwwroot/shipin-APP/dist/services/billingService.js

echo ""
echo "2. novelService 0 命中 refundStep 调用 (实调用, 不含注释):"
grep -c 'billingService\.refundStep' /www/wwwroot/shipin-APP/dist/services/novelService.js

echo ""
echo "3. h773052122 balance (应 0.14):"
mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script 2>/dev/null -e "SELECT id, username, balance FROM users WHERE id = '3b3aa45d-54d0-449a-bc99-7a804ab9d62e';"

echo ""
echo "4. billing_logs refund (应 audit trail 已加):"
mysql -h 10.1.0.11 -u root -pqQ378685504 ai_script 2>/dev/null -e "SELECT id, type, amount, balance_after, LEFT(ref_label, 80) AS label FROM billing_logs WHERE id = '1c1aacef-a4e7-472d-9842-dacd303f4965';"

echo ""
echo "5. /api/version (应 3.0.39):"
curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c "import sys,json; print('version = ' + json.load(sys.stdin)['data']['version'])"

echo ""
echo "6. 远端 systemd unit APP_VERSION (应 3.0.39):"
grep APP_VERSION /etc/systemd/system/shipin-app.service

echo ""
echo "7. 远端 .env APP_VERSION (应 3.0.39):"
grep APP_VERSION /www/wwwroot/shipin-APP/.env
