#!/bin/bash
# BUG-099 修复: web dist 被破坏 (index-BwxcAQbo.js 2 bytes), 重新解 web tar
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /www/wwwroot/ab.maque.uno
echo "=== 备份 + 解压 web dist 修复 ==="
if [ -d dist ]; then
  mv dist dist.bak.bug099-$TS
fi
mkdir -p dist
tar -xzf /tmp/web-dist-20260626-145000.tgz -C dist/
# 嵌套 dist/dist 修复
if [ -d dist/dist ] && [ -f dist/dist/index.html ]; then
  mv dist dist.empty.bak.$TS
  mv dist.empty.bak.$TS/dist dist
  rmdir dist.empty.bak.$TS
  echo "  ✅ 嵌套 dist 修复"
fi
ls -la dist/assets/ 2>&1 | head -5

echo "=== 宝塔 nginx reload ==="
/etc/init.d/nginx reload 2>&1

echo "=== BUG-099 验证 ==="
echo "  web dist JS file: $(ls -la /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | awk '{print $9, $5}')"
echo "  BUG-096 userNotifiedAt>: $(grep -c 'userNotifiedAt>' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | awk -F: '{s+=$2} END {print s+0}') 命中"
echo "  BUG-096 userNotifiedAt&&: $(grep -c 'userNotifiedAt&&' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null | awk -F: '{s+=$2} END {print s+0}') 命中"
echo "  HTTPS HEAD 200: $(curl -sI -m 5 https://ab.maque.uno/ 2>&1 | head -1 | tr -d \\r)"

echo "=== 跟之前部署 4 件套对比 (APK + web + server) ==="
ls -la /www/wwwroot/shipin-APP/public/DeepScript_v3.0.37.apk | awk '{print "  APK v3.0.37:", $5, "bytes"}'
ls -la /www/wwwroot/ab.maque.uno/dist/assets/*.js | awk '{print "  web dist JS:", $5, "bytes"}'
curl -sm 3 http://127.0.0.1:6000/api/version 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('  server /api/version:', d['version'], d.get('buildDate','N/A'))" 2>&1
