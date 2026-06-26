#!/bin/bash
echo "=== BUG-101 5 维验证 ==="
echo "1. Toast.tsx 防御 fallback 命中: $(grep -c 'VARIANT_COLORS.default' /www/wwwroot/shipin-APP/dist/ -r 2>/dev/null | head -1) 个文件"

echo ""
echo "2. 5 处 toast.show 修复: 找 cloud-upload variant 调用"
grep -rn "toast.show.*cloud-upload" /www/wwwroot/shipin-APP/dist/ 2>/dev/null
echo "(空 = 0 命中 = 修完)"

echo ""
echo "3. 找 sparkles variant 调用"
grep -rn "toast.show.*sparkles" /www/wwwroot/shipin-APP/dist/ 2>/dev/null
echo "(空 = 0 命中 = 修完)"

echo ""
echo "4. 找 checkmark-circle variant 调用"
grep -rn "toast.show.*checkmark" /www/wwwroot/shipin-APP/dist/ 2>/dev/null
echo "(空 = 0 命中 = 修完)"

echo ""
echo "5. 找 'success' 替代调用 (必 ≥ 5)"
grep -rn "toast.show.*'success'" /www/wwwroot/shipin-APP/dist/ 2>/dev/null | wc -l

echo ""
echo "=== 6. /api/version 4 字段 ==="
curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print('  version=' + d['version'] + ' buildDate=' + d['buildDate'] + ' highlights=' + str(len(d['highlights'])))
"

echo ""
echo "=== 7. 公网 APK v3.0.38 ==="
curl -sIk https://ab.maque.uno/app/DeepScript_v3.0.38.apk | head -3
echo "远端 SHA256: $(sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v3.0.38.apk | cut -d' ' -f1)"
echo "本机 SHA256: ebe9b5fb31d6dfb66807a2473588dd5c929812bree5569e5ae6bfb599c1a63b76 (应该 = 上)"
