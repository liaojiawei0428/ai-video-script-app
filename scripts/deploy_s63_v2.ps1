$k = 'C:\Users\Administrator\.ssh\deploy_key_shipin_app_ed25519'
$s = 'root@159.75.16.110'

# 1) test connect
Write-Host '=== 1. Test SSH connect ===' -ForegroundColor Cyan
& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s "echo CONNECT_OK && uname -a" 2>&1
Write-Host ''

# 2) Upload APK
Write-Host '=== 2. Upload APK ===' -ForegroundColor Cyan
$apkLocal = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$apkName = 'DeepScript_v3.0.29.apk'
& scp -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $apkLocal "${s}:/www/wwwroot/shipin-APP/public/${apkName}" 2>&1
Write-Host ''

# 3) Verify SHA256
Write-Host '=== 3. SHA256 verify ===' -ForegroundColor Cyan
$localHash = (Get-FileHash -Path $apkLocal -Algorithm SHA256).Hash.ToLower()
Write-Host "Local  : $localHash"
$remoteHash = (& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s "sha256sum /www/wwwroot/shipin-APP/public/${apkName}" 2>&1) -split ' ' | Select-Object -First 1
Write-Host "Remote : $remoteHash"
if ($localHash -eq $remoteHash.ToString().ToLower()) {
    Write-Host 'MATCH OK' -ForegroundColor Green
} else {
    Write-Host 'MISMATCH!' -ForegroundColor Red
}
Write-Host ''

# 4) Bump server + PM2 reload
Write-Host '=== 4. Bump server + PM2 ===' -ForegroundColor Cyan
$cmd = 'cd /www/wwwroot/shipin-APP && sed -i ''s/APP_VERSION=.3.0.28./APP_VERSION="3.0.29"/g'' ecosystem.config.js && grep APP_VERSION ecosystem.config.js && pm2 delete 0 2>&1 | tail -2 && pm2 start ecosystem.config.js --env production 2>&1 | tail -3 && sleep 2 && pm2 env 0 | grep APP_VERSION'
& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s $cmd 2>&1
Write-Host ''

# 5) /api/version
Write-Host '=== 5. /api/version check ===' -ForegroundColor Cyan
& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s "curl -s 'http://127.0.0.1:6000/api/version?version=3.0.28'" 2>&1
Write-Host ''

# 6) Public APK 200
Write-Host '=== 6. Public APK HTTP 200 ===' -ForegroundColor Cyan
& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s "curl -sI 'https://ab.maque.uno/app/${apkName}' | head -8" 2>&1
Write-Host ''

# 7) APK list retention
Write-Host '=== 7. APK list ===' -ForegroundColor Cyan
& ssh -i $k -o BatchMode=yes -o StrictHostKeyChecking=no $s "ls -1t /www/wwwroot/shipin-APP/public/*.apk | head -20 && echo '---total---' && ls -1 /www/wwwroot/shipin-APP/public/*.apk | wc -l" 2>&1
Write-Host ''

Write-Host '=== DONE ===' -ForegroundColor Cyan
