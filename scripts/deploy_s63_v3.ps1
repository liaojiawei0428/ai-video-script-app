$keyPath = 'C:\Users\Administrator\.ssh\deploy_key_shipin_app_ed25519'
$server = 'root@159.75.16.110'
$apkLocal = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$apkName = 'DeepScript_v3.0.29.apk'

Write-Host '=== 1. Test SSH connect ===' -ForegroundColor Cyan
$out1 = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server 'echo CONNECT_OK && uname -a'
Write-Host $out1
Write-Host ''

Write-Host '=== 2. Upload APK to shipin-APP public ===' -ForegroundColor Cyan
$out2 = scp -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $apkLocal ($server + ':/www/wwwroot/shipin-APP/public/' + $apkName) 2>&1
Write-Host $out2
Write-Host ''

Write-Host '=== 3. SHA256 verify (local vs remote) ===' -ForegroundColor Cyan
$localHash = (Get-FileHash -Path $apkLocal -Algorithm SHA256).Hash.ToLower()
Write-Host ('Local  : ' + $localHash)
$remoteOut = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server ('sha256sum /www/wwwroot/shipin-APP/public/' + $apkName)
$remoteHash = ($remoteOut -split '\s+')[0].ToLower()
Write-Host ('Remote : ' + $remoteHash)
if ($localHash -eq $remoteHash) {
    Write-Host 'MATCH OK' -ForegroundColor Green
} else {
    Write-Host 'MISMATCH!' -ForegroundColor Red
}
Write-Host ''

Write-Host '=== 4. Bump server APP_VERSION 3.0.28 -> 3.0.29 + PM2 reload ===' -ForegroundColor Cyan
$bumpScript = @'
cd /www/wwwroot/shipin-APP
sed -i 's/APP_VERSION=.\"3\.0\.28\"./APP_VERSION=\"3.0.29\"/g' ecosystem.config.js
grep APP_VERSION ecosystem.config.js
pm2 delete 0 2>&1 | tail -2
pm2 start ecosystem.config.js --env production 2>&1 | tail -3
sleep 2
pm2 env 0 | grep APP_VERSION
'@
$out4 = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server $bumpScript
Write-Host $out4
Write-Host ''

Write-Host '=== 5. /api/version triggers upgrade ===' -ForegroundColor Cyan
$out5 = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server "curl -s 'http://127.0.0.1:6000/api/version?version=3.0.28'"
Write-Host $out5
Write-Host ''

Write-Host '=== 6. Public APK HTTP 200 + content-type ===' -ForegroundColor Cyan
$out6 = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server ('curl -sI https://ab.maque.uno/app/' + $apkName + ' | head -8')
Write-Host $out6
Write-Host ''

Write-Host '=== 7. APK list retention ===' -ForegroundColor Cyan
$out7 = ssh -i $keyPath -o BatchMode=yes -o StrictHostKeyChecking=no $server 'ls -1t /www/wwwroot/shipin-APP/public/*.apk | head -15 && echo --- && ls -1 /www/wwwroot/shipin-APP/public/*.apk | wc -l'
Write-Host $out7
Write-Host ''

Write-Host '=== DONE ===' -ForegroundColor Cyan
