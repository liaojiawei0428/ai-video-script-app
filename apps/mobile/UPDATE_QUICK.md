# UPDATE_QUICK.md — 一键升级模板 (复制粘贴 5 min 升级)

> 速查, 完整版看 [DEPLOY.md](./DEPLOY.md)。
> 适合**只升版本号, 不改代码**的场景 (bug fix / 重打包)。

---

## 🎯 5 步升级 (改 2 处 + 打 + 传 + bump + 验)

### Step 1: 改 2 处版本号 (1 min)

```powershell
# 1.1 改 version.ts (字串跟目标版本一致)
$vf = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\src\config\version.ts'
# 旧: APP_VERSION = '3.0.15'
# 新: APP_VERSION = '3.0.16'  ← 改这一行

# 1.2 改 build.gradle (versionCode 单调递增, versionName 跟 APP_VERSION 一致)
$bg = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build.gradle'
# 旧: versionCode 18, versionName "3.0.15"
# 新: versionCode 19, versionName "3.0.16"  ← 改这两行
```

### Step 2: 重打 APK (3-5 min)

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = 'D:\Android'
$env:ANDROID_SDK_ROOT = 'D:\Android'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:PATH"
Set-Location 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android'
.\gradlew.bat assembleRelease --no-daemon
```

### Step 3: 验 APK 签名 + versionName (10 sec)

```powershell
$apk = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'

# 3.1 验 versionName
D:\Android\build-tools\33.0.2\aapt2.exe dump badging $apk | Select-String "package"
# 期望: versionCode='19' versionName='3.0.16'

# 3.2 验签名 (必跑, 防 BUG-023)
D:\Android\build-tools\33.0.2\apksigner.bat verify --print-certs $apk | Select-String "DN:"
# 期望: CN=DeepScript Release, O=shipin-APP
# ❌ 如果是 CN=Android Debug → release.keystore 配置错, 修 build.gradle

# 3.3 记 SHA256
Get-FileHash $apk -Algorithm SHA256 | Select-Object Hash
# 输出形如: 8D4FCE8B4B3B7F8157513666D14DEEC489EDE692D4181B8CF3BCA24A2E1DEC4C
```

### Step 4: scp + bump server (1 min)

```powershell
# 4.1 scp APK
$key = 'C:\Users\Administrator\.ssh\id_ed25519'
$local = $apk  # 跟 Step 3 一致
$remote = 'root@159.75.16.110'
$newVersion = '3.0.16'  # ← 跟 version.ts 一致
$oldVersion = '3.0.15'  # ← bump 脚本要替换的旧值

scp -i $key -o BatchMode=yes $local "${remote}:/tmp/app-release-v${newVersion}.apk"

# 4.2 写 bump 脚本
$bump = @"
#!/bin/bash
set -e
F=/www/wwwroot/shipin-APP/ecosystem.config.js
cp "`$F" "`$F.bak.v${newVersion}-$(date +%Y%m%d_%H%M%S)"
sed -i "s/APP_VERSION: '${oldVersion}'/APP_VERSION: '${newVersion}'/g" "`$F"
cd /www/wwwroot/shipin-APP
pm2 delete 0 2>/dev/null || true
pm2 start ecosystem.config.js
sleep 2
pm2 env 0 | grep APP_VERSION
"@
$bumpPath = "C:\Users\Administrator\.mavis\sessions\mvs_db213f1702fa49cdab0428494236b65e\workspace\bump-${newVersion}.sh"
$bump | Out-File -FilePath $bumpPath -Encoding ascii -NoNewline

scp -i $key -o BatchMode=yes $bumpPath "${remote}:/tmp/bump-${newVersion}.sh"

# 4.3 远端 cp APK + 跑 bump + 验 SHA256
ssh -i $key -o BatchMode=yes $remote "cp /tmp/app-release-v${newVersion}.apk /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk; ls -la /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk; sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk; bash /tmp/bump-${newVersion}.sh; rm -f /tmp/app-release-v${newVersion}.apk /tmp/bump-${newVersion}.sh"
```

### Step 5: 5 维验证 (30 sec)

```powershell
# 5.1 公网 APK 200
ssh -i $key -o BatchMode=yes $remote "curl -sI https://ab.maque.uno/app/DeepScript_v${newVersion}.apk | head -3"
# 期望: HTTP/2 200

# 5.2 远端 SHA256 = 本机 SHA256 (对比 Step 3.3 输出)
ssh -i $key -o BatchMode=yes $remote "sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk"

# 5.3 /api/version 触发升级
ssh -i $key -o BatchMode=yes $remote "curl -s 'http://127.0.0.1:6000/api/version?version=${oldVersion}' | head -c 250"
# 期望: "version":"${newVersion}","needUpdate":true

# 5.4 /api/version 一致不弹
ssh -i $key -o BatchMode=yes $remote "curl -s 'http://127.0.0.1:6000/api/version?version=${newVersion}' | head -c 200"
# 期望: "needUpdate":false

# 5.5 历史 APK 文件保留 (防 BUG-017 覆盖)
ssh -i $key -o BatchMode=yes $remote "ls -la /www/wwwroot/shipin-APP/public/DeepScript_v*.apk | head -10"
# 期望: 5+ 个历史 APK, 时间戳分散
```

---

## 🚨 失败诊断 (7 类)

| 症状 | 看 § | 关键命令 |
|---|---|---|
| 弹窗不显示 | DEPLOY § 8.1 | `curl /api/version?version=current` 看 `needUpdate` |
| 弹窗 1 按钮 (老代码) | DEPLOY § 8.2 | 卸老装新, 老 APK 弹窗代码没 Modal |
| 解析失败 / 应用未安装 | DEPLOY § 8.3 | `apksigner verify --print-certs` 验证书 DN |
| 死循环弹窗 | DEPLOY § 8.4 | `aapt2 dump badging` 验 versionName 一致 |
| 自动装失败, 手动通知栏装成功 | DEPLOY § 8.5 | 改 `res.path()` → `_state.destPath` (BUG-025) |
| 通知栏没进度 | DEPLOY § 8.6 | 设置 → 应用 → Deep剧本 → 通知 → 开启 |
| 装上启动崩 | DEPLOY § 8.7 | 看 gradle 编译错误 + JS bundle 是否编进 APK |

---

## ⚠️ 绝对禁止 (3 条铁律)

1. **禁止 `cp DeepScript_v${old}.apk DeepScript_v${new}.apk` 当试纸** (BUG-024 死循环)
2. **禁止 `release { signingConfig signingConfigs.debug }`** (BUG-023 13 个版本栽这)
3. **禁止 `keytool -genkey` 重新生成 release.keystore** (新 keystore 跟老 APK 签名不匹配)

---

## 📋 速查表

| 项 | 路径 / 值 |
|---|---|
| SSH key | `C:\Users\Administrator\.ssh\id_ed25519` |
| 远端 host | `root@159.75.16.110` |
| 远端公网 APK 路径 | `/www/wwwroot/shipin-APP/public/DeepScript_v${version}.apk` |
| 远端 server 配置 | `/www/wwwroot/shipin-APP/ecosystem.config.js` |
| 远端 nginx 日志 | `/www/wwwlogs/ab.maque.uno.log` (看下载) |
| 永久 release.keystore | `C:\Users\Administrator\.mavis\keystore\release.keystore` (跨项目) |
| 项目内 release.keystore | `apps/mobile/android/app/release.keystore` |
| Java | `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot` |
| Android SDK | `D:\Android` |
| aapt2 | `D:\Android\build-tools\33.0.2\aapt2.exe` |
| apksigner | `D:\Android\build-tools\33.0.2\apksigner.bat` |
| 当前生产版本 | (查 `pm2 env 0 \| grep APP_VERSION`) |
