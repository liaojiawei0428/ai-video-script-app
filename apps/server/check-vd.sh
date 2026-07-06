cd /www/wwwroot/shipin-APP
grep -n "SERVER_ONLY" scripts/verify-deploy.sh | head -10
echo ---
grep -n "维度 1" scripts/verify-deploy.sh
