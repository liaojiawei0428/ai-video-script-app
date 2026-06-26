#!/bin/bash
# shipin-APP web v3.0.37 修复 (dist/dist 嵌套 -> dist/)
set -e
cd /www/wwwroot/ab.maque.uno
echo "=== 修复前 ==="
ls -la dist/ 2>&1 | head -5
echo "--- 旧的 dist (可能空) 备份 ---"
if [ -d dist.bak.v3.0.37-20260626_124529/dist ] && [ ! "$(ls -A dist.bak.v3.0.37-20260626_124529/dist 2>/dev/null)" ]; then
  # 备份里的 dist 是空目录 (嵌套错), 删
  rmdir dist.bak.v3.0.37-20260626_124529/dist 2>/dev/null || true
  echo "  删空 nested dist.bak"
fi
# 修嵌套: dist/dist 里的内容 才是真正的 web dist
if [ -d dist/dist ]; then
  if [ -f dist/dist/index.html ]; then
    # 备份当前 dist (是空 嵌套 dist)
    TS=$(date +%Y%m%d_%H%M%S)
    mv dist dist.empty.bak.$TS
    # 把 dist/dist 提到 dist
    mv dist.empty.bak.$TS/dist dist
    rmdir dist.empty.bak.$TS
    echo "  ✅ 嵌套 dist 修复: dist/dist -> dist"
  fi
fi
echo "=== 修复后 ==="
ls -la dist/ 2>&1 | head -5
ls -la dist/assets/ 2>&1 | head -5
echo "--- web 验证 ---"
curl -skm 5 https://ab.maque.uno/ | head -3
echo "--- web dist hash ---"
ls /www/wwwroot/ab.maque.uno/dist/assets/ | grep '.js$' | head -1
# 验证 BUG-092 按钮在
echo "--- BUG-092 按钮 in dist ---"
grep -l "我已付款" /www/wwwroot/ab.maque.uno/dist/assets/*.js 2>/dev/null && echo "FOUND ✅" || echo "NOT FOUND ❌"
# nginx reload (宝塔 path)
/etc/init.d/nginx reload 2>&1
echo "--- 最终 curl ---"
curl -skm 5 -o /dev/null -w "HTTP %{http_code}\n" https://ab.maque.uno/
