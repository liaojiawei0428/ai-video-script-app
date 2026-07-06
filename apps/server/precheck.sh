#!/bin/bash
# 部署前 6 维预检 + 部署后 12 维验证 (S70 BUG-077 + S71 BUG-079)
set +e

echo "===== 预检 1-6 ====="
echo "1. NODE_PROJECT_NAME: $(grep NODE_PROJECT_NAME /etc/systemd/system/shipin-app.service 2>/dev/null | head -1)"
echo "2. apt nginx masked: $(systemctl is-enabled nginx 2>&1 | head -1)"
echo "3. 宝塔 nginx pid: $(cat /www/server/nginx/logs/nginx.pid 2>&1)"
echo "4. 6000 端口: $(ss -tln | grep ':6000 ' | head -1 | awk '{print $4}')"
echo "5. shipin-app 状态: $(systemctl is-active shipin-app)"
echo "6. /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["data"]["version"])')"
