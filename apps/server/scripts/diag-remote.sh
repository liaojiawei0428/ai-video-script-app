#!/bin/bash
# shipin-APP 远端诊断 (查 active-tasks + version + systemd + web dist)
echo "---active-tasks---"
curl -sm 3 http://127.0.0.1:6000/api/admin/active-tasks -H "Authorization: Bearer 0" 2>&1 | head -5
echo "---count---"
curl -sm 3 http://127.0.0.1:6000/api/admin/active-tasks -H "Authorization: Bearer 0" 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print('count='+str(d.get('data',{}).get('count','N/A')))" 2>&1
echo "---version---"
curl -sm 3 http://127.0.0.1:6000/api/version 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('version='+d['version']+' buildDate='+d.get('buildDate','N/A'))" 2>&1
echo "---systemd---"
systemctl is-active shipin-app 2>&1
echo "---web dist hash---"
ls -la /www/wwwroot/web-app/dist/assets/ 2>&1 | head -3
echo "---server dist hash---"
ls -la /www/wwwroot/shipin-APP/dist/routes/recharge.js 2>&1
echo "---grep notify-paid in dist---"
grep -l 'notify-paid' /www/wwwroot/shipin-APP/dist/routes/recharge.js 2>&1
