#!/bin/bash
# shipin-APP 部署 v3.0.37 (S72 batch 7 BUG-092)
# 1) server: tar 解压 + .env 同步 + systemd unit APP_VERSION + systemd restart
# 2) web: tar 解压到 ab.maque.uno/dist + 宝塔 nginx reload
# 3) verify 22 维 (核心 6 维)
set -e
echo "=== [1/8] server 备份 dist.bak.v3.0.37-* ==="
cd /www/wwwroot/shipin-APP
TS=$(date +%Y%m%d_%H%M%S)
if [ -d dist ]; then
  mv dist dist.bak.v3.0.37-$TS
  echo "  备份: dist -> dist.bak.v3.0.37-$TS"
fi

echo "=== [2/8] server 解压 /tmp/dist_20260626_124124.tar.gz ==="
tar -xzf /tmp/dist_20260626_124124.tar.gz
# 兼容 deploy.sh v3.0.33 #6 修 (dist/ 子目录): 实际 tar 含 dist/ 前缀, tar -xzf 会建 dist/dist
if [ -d dist/dist ]; then
  mv dist/dist dist_new
  rm -rf dist
  mv dist_new dist
fi
ls -la dist/index.js dist/changelog.json 2>&1 | head -3

echo "=== [3/8] server 同步 .env + systemd unit APP_VERSION (deploy.sh 自动跑) ==="
# deploy.sh v3.0.33+ 自动跑 #5 (读 /tmp/package.json 源同步 .env) + #6 (同步 systemd unit)
# 这里手动 grep 看同步成功
grep "APP_VERSION=" /www/wwwroot/shipin-APP/.env 2>&1
grep "APP_VERSION" /etc/systemd/system/shipin-app.service 2>&1

echo "=== [4/8] server 同步 .env (从 /tmp/package.json source) ==="
# deploy.sh #5: 读 /tmp/package.json source, sync to /www/wwwroot/shipin-APP/.env
# 这里手跑, 防 deploy.sh 跟 .env 漂移
PKG_VERSION=$(python3 -c "import json; print(json.load(open('/tmp/package.json'))['version'])")
echo "  /tmp/package.json version = $PKG_VERSION"
# 同步 APP_VERSION 到 .env
if grep -q "^APP_VERSION=" /www/wwwroot/shipin-APP/.env 2>/dev/null; then
  sed -i "s/^APP_VERSION=.*/APP_VERSION=$PKG_VERSION/" /www/wwwroot/shipin-APP/.env
  echo "  .env APP_VERSION -> $PKG_VERSION"
else
  echo "APP_VERSION=$PKG_VERSION" >> /www/wwwroot/shipin-APP/.env
  echo "  .env APP_VERSION += $PKG_VERSION"
fi
# 同步 systemd unit
sed -i "s/^Environment=APP_VERSION=.*/Environment=APP_VERSION=$PKG_VERSION/" /etc/systemd/system/shipin-app.service
echo "  systemd unit APP_VERSION -> $PKG_VERSION"

echo "=== [5/8] server 同步 .env 全套 (8 必填 + 1 NODE_PROJECT_NAME) ==="
for k in PORT NODE_ENV APP_VERSION JWT_SECRET MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS AGNES_API_KEY PAY_KEY NODE_PROJECT_NAME; do
  if ! grep -qE "^$k=" /www/wwwroot/shipin-APP/.env 2>/dev/null; then
    echo "  ⚠️ 缺失: $k"
  else
    echo "  ✓ $k"
  fi
done

echo "=== [6/8] server systemd daemon-reload + restart + 12 维验证 ==="
systemctl daemon-reload
systemctl restart shipin-app
sleep 3
echo "  systemctl: $(systemctl is-active shipin-app)"
echo "  ss 6000:   $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
echo "  /health:   $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d '\r')"
echo "  /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d["version"]+" buildDate="+d.get("buildDate","N/A"))')"
echo "  /api/novels: $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d '\r')"
echo "  公开 https /api/version: $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d["version"]+" buildDate="+d.get("buildDate","N/A"))')"
echo "  notify-paid 端点: $(grep -l 'notify-paid' /www/wwwroot/shipin-APP/dist/routes/recharge.js && echo FOUND || echo NOT FOUND)"

echo "=== [7/8] web 部署 (解压到 ab.maque.uno/dist + 宝塔 nginx reload) ==="
cd /www/wwwroot/ab.maque.uno
if [ -d dist ]; then
  mv dist dist.bak.v3.0.37-$TS
  echo "  web 备份: dist -> dist.bak.v3.0.37-$TS"
fi
mkdir -p dist
tar -xzf /tmp/web-dist-20260626_124400.tgz -C dist/
ls -la dist/ dist/assets/ 2>&1 | head -8
# 宝塔 nginx reload (mavis memory: 宝塔 nginx 在 /etc/init.d/nginx, 不用 nginx -s reload)
/etc/init.d/nginx reload 2>&1
echo "  宝塔 nginx reload 完成"

echo "=== [8/8] web 端验证 (curl https://ab.maque.uno 看 index.html + 按钮) ==="
curl -skm 5 https://ab.maque.uno/ | head -3
# dist hash 应该跟本机新 build 一致 (ixcV7Xag)
echo "  web dist hash: $(ls /www/wwwroot/ab.maque.uno/dist/assets/ | grep '.js$' | head -1)"

echo "=== 部署完成 ==="
