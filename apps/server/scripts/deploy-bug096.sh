#!/bin/bash
# BUG-096 部署: web 修 React 0 渲染陷阱
set -e
TS=$(date +%Y%m%d_%H%M%S)
cd /www/wwwroot/ab.maque.uno
echo "=== web 备份 + 解压 ==="
if [ -d dist ]; then
  mv dist dist.bak.bug096-$TS
fi
mkdir -p dist
tar -xzf /tmp/web-dist-20260626_132400.tgz -C dist/
# 修嵌套
if [ -d dist/dist ] && [ -f dist/dist/index.html ]; then
  mv dist dist.empty.bak.$TS
  mv dist.empty.bak.$TS/dist dist
  rmdir dist.empty.bak.$TS
  echo "  ✅ 嵌套 dist 修复"
fi
ls -la dist/ dist/assets/ 2>&1 | head -8

echo "=== 宝塔 nginx reload ==="
/etc/init.d/nginx reload 2>&1

echo "=== BUG-096 验证 (React 0 渲染陷阱) ==="
echo "  新 web dist hash: $(ls /www/wwwroot/ab.maque.uno/dist/assets/ | grep '.js$' | head -1)"
echo "  旧 BkD2t3Ct 'userNotifiedAt&&' 命中: $(grep -c 'userNotifiedAt&&' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null || echo 0)"
echo "  新 BwxcAQbo 'userNotifiedAt>0' 命中: $(grep -c 'userNotifiedAt>0' /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null || echo 0)"

echo "=== 端到端 ==="
curl -skm 5 -o /dev/null -w "  https://ab.maque.uno/ HTTP %{http_code}\n" https://ab.maque.uno/
