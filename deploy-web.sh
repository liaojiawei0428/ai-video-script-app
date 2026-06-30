#!/bin/bash
# 部署 web dist v3.0.58 到 nginx root
# BUG-124 hotfix 修法: tar -C 路径必对齐 nginx root

# 1. 备份
if [ -d /www/wwwroot/ab.maque.uno/dist ]; then
  cp -r /www/wwwroot/ab.maque.uno/dist /www/wwwroot/ab.maque.uno/dist.bak.s$(date +%Y%m%d_%H%M%S)
  echo "✓ backup"
fi

# 2. 解压新 web dist (从 /tmp/web-dist.tgz)
rm -rf /www/wwwroot/ab.maque.uno/dist
mkdir -p /www/wwwroot/ab.maque.uno/dist
tar -xzf /tmp/web-dist.tgz -C /www/wwwroot/ab.maque.uno/dist
chown -R root:root /www/wwwroot/ab.maque.uno/dist
echo "✓ extracted to /www/wwwroot/ab.maque.uno/dist"

# 3. 验证
ls -la /www/wwwroot/ab.maque.uno/dist/assets/ | head -3
echo "---"
# 4. HEAD 公网验证 (看 HTML 引用的 JS hash)
echo "=== 公网 HTML 引用 ==="
curl -sk https://ab.maque.uno/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1
echo "=== 公网 JS bundle 验证 BUG-128 关键字符串 ==="
JS_FILE=$(curl -sk https://ab.maque.uno/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
echo "JS file: $JS_FILE"
curl -sk "https://ab.maque.uno/assets/$JS_FILE" | grep -oE '已用 \$\{[^}]*\} 张参考图' | head -3
echo "(grep 找 '已用 ... 张参考图' 字样, 找到 = UI 已集成 refImageCount badge)"
curl -sk "https://ab.maque.uno/assets/$JS_FILE" | grep -oE '排除以下内容' | head -3
echo "(grep 找 '排除以下内容' 字样, 找到 = UI 已集成 negativePrompt 折叠面板)"
