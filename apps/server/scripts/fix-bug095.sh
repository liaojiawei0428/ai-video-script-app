#!/bin/bash
# BUG-095 紧急修复: server restart 让 pool 重新 load schema enum
systemctl restart shipin-app
sleep 3
echo "---after restart---"
systemctl is-active shipin-app
curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c "import sys,json; print('version='+json.load(sys.stdin)['data']['version'])"
curl -sI -m 3 http://127.0.0.1:6000/health | head -1
echo "---web dist grep '0' rendering (after status '已通过')---"
# 找 status box 渲染 0 的实际 JSX
grep -o "o.userNotifiedAt" /www/wwwroot/ab.maque.uno/dist/assets/*.js | head -3
echo "---raw 0 字符 near status box---"
grep -oE 'status="approved".{0,200}' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | head -1
