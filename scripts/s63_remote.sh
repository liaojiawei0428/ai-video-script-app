#!/bin/bash
set -e
cd /www/wwwroot/shipin-APP

echo '=== sed APP_VERSION ==='
sed -i "s/APP_VERSION: '3.0.28'/APP_VERSION: '3.0.29'/g" ecosystem.config.js
grep APP_VERSION ecosystem.config.js

echo ''
echo '=== PM2 delete + start ==='
pm2 delete 0 2>&1 | tail -2 || true
pm2 start ecosystem.config.js --env production 2>&1 | tail -3
sleep 2

echo ''
echo '=== PM2 env APP_VERSION ==='
pm2 env 0 | grep APP_VERSION

echo ''
echo '=== /api/version check (老版本 3.0.28) ==='
curl -s 'http://127.0.0.1:6000/api/version?version=3.0.28'

echo ''
echo ''
echo '=== Public APK 200 check ==='
curl -sI 'https://ab.maque.uno/app/DeepScript_v3.0.29.apk' | head -8

echo ''
echo '=== APK list (latest 15) ==='
ls -1t /www/wwwroot/shipin-APP/public/*.apk | head -15
echo '--- total ---'
ls -1 /www/wwwroot/shipin-APP/public/*.apk | wc -l
