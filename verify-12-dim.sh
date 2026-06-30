#!/bin/bash
echo "=== 12 维验证 (v3.0.58 BUG-128) ==="
echo "1.  systemctl shipin-app: $(systemctl is-active shipin-app)"
echo "2.  ss 6000:              $(ss -tln | grep :6000 | head -1 | awk '{print $4}')"
echo "3.  /health:              $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)"
echo "4.  /api/version:         $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "5.  characterVariant:     $(curl -sm 3 http://127.0.0.1:6000/api/pricing | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])')"
echo "6.  /api/novels:          $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d \\r)"
echo "7.  宝塔 nginx 80:        $(ss -tln | grep :80 | head -1 | awk '{print $4}')"
echo "8.  ab.maque.uno HTTPS:   $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "9.  APK HTTP/2 200:       $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.58.apk | head -1 | tr -d \\r)"
echo "10. 宝塔 shipin_APP run:  $(cat /www/server/nodejs/vhost/pids/shipin_APP.pid 2>/dev/null) (PID)"
echo "11. systemd Environment:  $(grep Environment=APP_VERSION /etc/systemd/system/shipin-app.service)"
echo "12. .env APP_VERSION:     $(grep ^APP_VERSION /www/wwwroot/shipin-APP/.env)"
echo ""
echo "=== 公网实测 BUG-128 修后 LLM 产出关键校验 ==="
JS_FILE=$(curl -sk https://ab.maque.uno/ | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
echo "13. 公网 JS bundle:       $JS_FILE"
JS_BYTES=$(curl -sk "https://ab.maque.uno/assets/$JS_FILE" | wc -c)
echo "14. 公网 JS bundle 大小:  $JS_BYTES bytes"
HAS_REF=$(curl -sk "https://ab.maque.uno/assets/$JS_FILE" | grep -c "refImageCount")
HAS_NEG=$(curl -sk "https://ab.maque.uno/assets/$JS_FILE" | grep -c "negativePrompt")
echo "15. JS 含 refImageCount 字段处理:  $HAS_REF 次 (期望 > 0)"
echo "16. JS 含 negativePrompt 字段处理: $HAS_NEG 次 (期望 > 0)"
echo ""
echo "=== changelog BUG-128 校验 ==="
CHANGELOG_HAS_BUG128=$(curl -sk https://ab.maque.uno/api/version | grep -c "BUG-128")
echo "17. /api/version changelog 含 BUG-128: $CHANGELOG_HAS_BUG128 次 (期望 > 0)"
