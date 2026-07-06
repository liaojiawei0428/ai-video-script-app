#!/bin/bash
echo "=== deploy.sh 头部 + 关键段验证 ==="
F="/www/wwwroot/shipin-APP/deploy.sh"
echo "1. 文件存在: $([ -f $F ] && echo YES || echo NO)"
echo "2. 文件行数: $(wc -l < $F)"
echo "3. 含 S70 v2.0 systemd: $(grep -c 'shipin-APP 部署脚本 v2.0' $F)"
echo "4. 含 8 处版本号同步段: $(grep -c '同步 8 处版本号' $F)"
echo "5. 含 /api/version 验证: $(grep -c '/api/version 验证' $F)"
echo "6. 含 改 .env APP_VERSION: $(grep -c '.env APP_VERSION=' $F)"
echo "7. 含 改 systemd unit: $(grep -c 'systemd unit Environment' $F)"
echo
echo "=== 关键段摘录 ==="
grep -n '3.5/9\|6.5/9\|7/9' $F
