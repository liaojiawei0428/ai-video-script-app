# DEPLOY.md — 完整升级部署手册

> 本文档是 shipin-APP mobile 端**版本升级的完整 SOP** (Standard Operating Procedure)。
> 从改代码 → 打 APK → 上传 → 切 server → 验证, 5 步可复制, 10 分钟完成一次升级。
>
> **AI Agent 必读**: 改完 mobile 代码后, 严格按本文档 § 1-5 走。
>
> **最后更新**: 2026-06-16 (S58 P10 BUG-025 修完)

---

## § 0. 升级链路总览 (升级流程图)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. 改 3 处版本号                                                │
│    - src/config/version.ts: APP_VERSION = 'X.Y.Z'            │
│    - android/app/build.gradle: versionCode N, versionName    │
│    - 任何新代码 (改完先 commit)                                  │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. 重打 APK (3-5 min)                                          │
│    cd apps/mobile/android && gradlew assembleRelease          │
│    产出: android/app/build/outputs/apk/release/app-release.apk│
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. 验证 APK 签名 + versionName 跟 version.ts 一致             │
│    aapt2 dump badging → versionName=...                       │
│    apksigner verify --print-certs → CN=DeepScript Release    │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. scp 上传 + bump server APP_VERSION                          │
│    scp APK → /www/wwwroot/shipin-APP/public/DeepScript_vX.Y.Z │
│    sed -i 's/APP_VERSION: old/APP_VERSION: new/' ecosystem    │
│    pm2 delete 0 + pm2 start ecosystem.config.js               │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. 5 维验证                                                    │
│    1) 公网 APK HTTP 200                                       │
│    2) 远端 SHA256 = 本机 SHA256                                 │
│    3) aapt2 远端验 versionName 跟 server APP_VERSION 一致      │
│    4) /api/version?version=old → version=new, needUpdate=true│
│    5) 历史 APK 文件未覆盖 (ls -la DeepScript_v*.apk)          │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│ 6. 用户测 (5 min)                                              │
│    - 卸老 APK → 装新 APK → 杀应用重启 → 看弹窗                  │
│    - 弹 v${old} → v${new} 升级窗 → 选 APP 内下载                │
│    - 验证通知栏进度 + 自动装成功 + 装完不弹窗                    │
└──────────────────────────────────────────────────────────────┘
```

---

## § 1. 改 3 处版本号

### 1.1 `src/config/version.ts`

```ts
// 旧
export const APP_VERSION = '3.0.15';
export const APP_NAME = 'Deep剧本';
export const APP_DISPLAY_NAME = `${APP_NAME} v${APP_VERSION}`;

// 新 (commit 注释必带 BUG-NNN 编号, 后续 BUGS.md 同步)
export const APP_VERSION = '3.0.16';
```

### 1.2 `android/app/build.gradle`

```gradle
android {
    defaultConfig {
        applicationId "com.aiscriptmobile"
        // ...
        versionCode 19        // ← 改: 单调递增, 跟 APP_VERSION 解耦
        versionName "3.0.16"  // ← 改: 跟 APP_VERSION 字串一致
    }
}
```

### 1.3 任何新代码 (改完先 commit)

```bash
git add -A
git commit -m "v3.0.16: <一句话描述> (BUG-NNN)"
```

---

## § 2. 重打 APK

### 2.1 环境变量 (Windows PowerShell)

```powershell
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:ANDROID_HOME = 'D:\Android'
$env:ANDROID_SDK_ROOT = 'D:\Android'
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:PATH"
Set-Location 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android'
.\gradlew.bat assembleRelease --no-daemon
```

### 2.2 增量编译 3-5 min, JS bundle 缓存 (第二次重打会更快)

### 2.3 产出路径

```
apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## § 3. 验证 APK 签名 + versionName

### 3.1 versionName 验

```bash
D:\Android\build-tools\33.0.2\aapt2.exe dump badging <apk> | Select-String "package"
# 期望: package: name='com.aiscriptmobile' versionCode='19' versionName='3.0.16'
```

### 3.2 签名验 (必跑, 防 BUG-023 重演)

```bash
D:\Android\build-tools\33.0.2\apksigner.bat verify --print-certs <apk> | Select-String "DN:"
# 期望: Signer #1 certificate DN: CN=DeepScript Release, O=shipin-APP
# 警告: 如果是 CN=Android Debug → 100% 是 BUG-023, 禁止部署
```

### 3.3 SHA256 记下来 (远端上传后必对)

```powershell
Get-FileHash <apk> -Algorithm SHA256 | Select-Object Hash
# 期望: 形如 8D4FCE8B4B3B7F8157513666D14DEEC489EDE692D4181B8CF3BCA24A2E1DEC4C
```

---

## § 4. scp 上传 + bump server

### 4.1 scp 上传 APK 到远端

```powershell
$key = 'C:\Users\Administrator\.ssh\id_ed25519'
$local = 'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$remote = 'root@159.75.16.110'
$newVersion = '3.0.16'  # ← 跟 version.ts 一致

scp -i $key -o BatchMode=yes $local "${remote}:/tmp/app-release-v${newVersion}.apk"
```

### 4.2 写 bump 脚本 (本机, 然后 scp)

**模板** (C:\Users\Administrator\.mavis\sessions\<session_id>\workspace\bump-XXXX.sh):

```bash
#!/bin/bash
set -e
F=/www/wwwroot/shipin-APP/ecosystem.config.js
# 旧版本
OLD="3.0.15"
# 新版本
NEW="3.0.16"

cp "$F" "$F.bak.v${NEW}-$(date +%Y%m%d_%H%M%S)"
sed -i "s/APP_VERSION: '${OLD}'/APP_VERSION: '${NEW}'/g" "$F"
cd /www/wwwroot/shipin-APP
pm2 delete 0 2>/dev/null || true
pm2 start ecosystem.config.js
sleep 2
pm2 env 0 | grep APP_VERSION
```

```powershell
scp -i $key -o BatchMode=yes <bump.sh> "${remote}:/tmp/bump-${newVersion}.sh"
```

### 4.3 远端 cp + 跑 bump 脚本

```powershell
ssh -i $key -o BatchMode=yes $remote "bash -c 'cp /tmp/app-release-v${newVersion}.apk /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk && ls -la /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk && sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk && bash /tmp/bump-${newVersion}.sh && rm -f /tmp/app-release-v${newVersion}.apk /tmp/bump-${newVersion}.sh'"
```

**注意 PS 5.1 quoting**: 嵌套 `()` `;` 容易挂, 拆 ssh 调用或用 `.bat` 包装。

---

## § 5. 5 维验证

### 5.1 公网 APK HTTP 200

```bash
curl -sI https://ab.maque.uno/app/DeepScript_v${newVersion}.apk | head -3
# 期望: HTTP/2 200, content-type: application/vnd.android.package-archive
```

### 5.2 远端 SHA256 = 本机 SHA256

```powershell
ssh -i $key -o BatchMode=yes $remote "sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk"
# 对比本机 Get-FileHash 输出的 SHA256, 必须完全一致
```

### 5.3 aapt2 远端验 versionName (防 BUG-024 死循环)

```powershell
ssh -i $key -o BatchMode=yes $remote "aapt2 dump badging /www/wwwroot/shipin-APP/public/DeepScript_v${newVersion}.apk | head -1"
# 期望: versionName='${newVersion}' (跟 server APP_VERSION 一致)
```

### 5.4 /api/version 触发升级

```bash
curl -s "http://127.0.0.1:6000/api/version?version=${oldVersion}"
# 期望: "version":"${newVersion}","needUpdate":true,"forceUpdate":true
```

### 5.5 历史 APK 文件未覆盖 (防 BUG-017)

```bash
ls -la /www/wwwroot/shipin-APP/public/DeepScript_v*.apk
# 期望: 看到 5+ 个历史 APK, 时间戳分散, 大小不同
```

---

## § 6. 用户测 (5 min)

### 6.1 卸老装新

1. 用户手机: 设置 → 应用 → Deep剧本 → 卸载
2. Chrome 打开 https://ab.maque.uno/app/DeepScript_v${newVersion}.apk
3. 装上 → 启动 → server 跟 client 都是 ${newVersion} → **不弹窗** ✅

### 6.2 触发升级窗 (验整条链路)

1. 杀应用 (设置 → 强制停止)
2. 重新打开 → `/api/version?version=${newVersion}` → server 返 `version=${nextVersion}` (需要先 bump ${nextVersion})
3. 弹 3 按钮窗: 取消 / APP 内下载 / 浏览器下载
4. 选"APP 内下载" → Modal 进度条 + 通知栏 "Deep剧本 v${nextVersion}"
5. **关键验证**:
   - 锁屏 / 切桌面 / 杀应用 → 通知栏进度持续
   - 下载完 → 自动弹系统安装器 (不是文件管理器)
   - 装上 → 启动 → 客户端 = server → **不弹窗** ✅

---

## § 7. 试纸 5 步 (5 min 验证升级链路)

> 当你**只改弹窗/下载/装 APK 相关代码**, 不想跑完整发布流程, 用这个轻量验证。

```
试纸 = 改 2 处 + 重打 + 部署 + 验
时间: 5 min
```

### 7.1 改 2 处 (跟 § 1.1 + 1.2 一样, 只改版本号, 不改代码)

### 7.2 重打 (跟 § 2 一样, 5 min)

### 7.3 部署 (跟 § 4 一样, 但 bump 到**试用版本**)

**注意**: 试用版本不**真发布**, 用完最好回滚 server APP_VERSION。

### 7.4 验 (跟 § 5 一样)

### 7.5 **绝对禁止**: 用 `cp DeepScript_v${old}.apk DeepScript_v${new}.apk` 当试纸 (BUG-024 死循环)

---

## § 8. 常见 7 类失败诊断

### 8.1 弹窗不显示

- **症状**: server 说有新版本, 客户端启动后不弹窗
- **排查**:
  ```bash
  curl -s "http://127.0.0.1:6000/api/version?version=${currentVersion}"
  # 期望: needUpdate: true
  ```
- **可能**:
  - server APP_VERSION 没切 (PM2 env 没 reload, BUG-008) → `pm2 delete 0 && pm2 start`
  - 客户端 network 错 (axios 失败) → 看 logcat
  - 弹窗代码版本太老 (老 APK 跑老代码) → 让用户卸老装新

### 8.2 弹窗 1 按钮 (老代码, S58 P4)

- **症状**: 弹窗只显示"立即更新", 取消/浏览器下载按钮没有
- **原因**: 老 APK (v3.0.5 之前) 跑老 `updater.ts`, 1 按钮 Alert.alert
- **修法**: 让用户卸老装新 (老 APK 弹窗代码没 Modal 组件, 无解)

### 8.3 解析失败 / 应用未安装 (装不上)

- **症状**: 下载完弹系统安装器, 报"解析包时出现问题" / "应用未安装"
- **诊断**:
  1. **远端 APK 验完整性**: `ssh 远端 'sha256sum DeepScript_v${new}.apk'` 跟本机对比
  2. **签名验**: `apksigner verify --print-certs apk` 看 DN = `CN=DeepScript Release`?
  3. **单独浏览器下同一 URL 装, 能不能装上**:
     - ✅ 能装 = APK OK, 是签名/升级路径问题
     - ❌ 不能装 = APK 损坏, 重新打包
- **可能 + 修法**:
  - 签名不匹配 (BUG-023) → 用 release.keystore 重打
  - 公网 APK 跟本地 SHA256 不一致 → 重新 scp
  - 老 APK 跟新 APK versionCode 降级 (v3.0.16 → v3.0.15) → 升级 versionCode

### 8.4 死循环弹窗 (装完还弹)

- **症状**: 装上 v${new} 后启动, 仍然弹 v${new} → v${new+1} 升级窗
- **诊断**:
  ```bash
  ssh 远端 'aapt2 dump badging DeepScript_v${new}.apk | head -1'
  # 期望 versionName='${new}' 跟 server APP_VERSION=${new} 一致
  ```
- **原因 + 修法** (BUG-024): 试纸 cp 旧包, 内部 versionName 跟 filename 不一致 → **真打 APK** (改 2 处 + 重打)

### 8.5 自动装失败, 手动通知栏装成功

- **症状**: APP 内下载完, 系统自动弹安装器失败; 下拉通知栏手动点通知, 弹出安装器装成功
- **原因** (BUG-025): `RNFetchBlob.android.actionViewIntent(res.path())` 用错路径
- **修法**: 改用 `_state.destPath` 拼 `file://` 协议:
  ```ts
  const installPath = _state.destPath.startsWith('file://')
    ? _state.destPath
    : 'file://' + _state.destPath;
  RNFetchBlob.android.actionViewIntent(installPath, mime);
  ```

### 8.6 通知栏没进度 (Modal 有)

- **症状**: APP 内 Modal 进度条 0% → 100% 正常, 但下拉通知栏没下载卡片
- **可能**:
  - Android 13+ 通知权限被拒 → 让用户到 设置 → 应用 → Deep剧本 → 通知 → 开启
  - `notification: true` 字段没设 → 检查 `RNFetchBlob.config` 里 `notification: true`
- **修法**: 让用户**重新触发一次升级**, 弹通知权限时点"允许"

### 8.7 装上后启动崩

- **症状**: 装上后启动直接闪退 / 卡白屏
- **可能**:
  - JS bundle 编错 → `gradlew assembleRelease` 重打, 看 gradle 报错
  - native module 漏链 → 看 `apk assets/index.android.bundle` 是否包含
  - 装的是老 APK (试纸 cp) → 真打

---

## § 9. SSH key + 远端路径速查

### 9.1 SSH key

- **位置**: `C:\Users\Administrator\.ssh\id_ed25519` (跨项目统一)
- **远端 user/host**: `root@159.75.16.110`
- **注意**: **H58 handoff 别名 `43.142.33.78` 是错的**, 真实 `159.75.16.110` (BUG-003)

### 9.2 远端路径速查

| 路径 | 用途 |
|---|---|
| `/www/wwwroot/shipin-APP/` | shipin-APP 部署根 (flat 结构, 不是 monorepo 嵌套) |
| `/www/wwwroot/shipin-APP/ecosystem.config.js` | PM2 配置, `env.APP_VERSION` + `env_production.APP_VERSION` 两处 |
| `/www/wwwroot/shipin-APP/public/DeepScript_v*.apk` | 公网 APK (自动经 nginx 暴露到 https://ab.maque.uno/app/) |
| `/www/wwwroot/shipin-APP/logs/combined.log` | server log (350 MB+, 清理用 `pm2 flush`) |
| `/www/server/panel/vhost/nginx/extension/ab.maque.uno/` | 宝塔 nginx 扩展 conf, `/app/` location 在这 |
| `/www/wwwlogs/ab.maque.uno.log` | nginx access log, 15 MB+, 监控下载用 `tail -F \| grep DeepScript_v${new}` |

### 9.3 PM2 操作

```bash
pm2 list                                # 看进程
pm2 env 0 | grep APP_VERSION            # 验 APP_VERSION 已切
pm2 logs 0 --lines 50                   # 看 server log
pm2 delete 0 && pm2 start ecosystem.config.js  # 完整重启 (env 必刷)
pm2 restart 0                           # 软重启 (env 不刷, 升级时禁用)
```

### 9.4 Java/Android 环境 (本机)

| 项 | 路径 / 值 |
|---|---|
| Java | `C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot` (PS 短路径 `C:\PROGRA~1\Microsoft\jdk-17.0.19.10-hotspot`) |
| Android SDK | `D:\Android` (platforms-33, build-tools 33.0.2, platform-tools, cmdline-tools) |
| Gradle | 8.3 |
| Node | `C:\Program Files\nodejs\npm.cmd` |

### 9.5 aapt2 + apksigner 路径

```
D:\Android\build-tools\33.0.2\aapt2.exe
D:\Android\build-tools\33.0.2\apksigner.bat
```

---

## § 10. 永久文件清单 (3 份备份)

### 10.1 release.keystore (BUG-023 永久签名)

- **跨项目**: `C:\Users\Administrator\.mavis\keystore\release.keystore` (永久)
- **项目内**: `apps/mobile/android/app/release.keystore` (build.gradle 直接引用, .gitignore 之外)
- **绝不允许重新生成** (新 keystore 跟老 APK 签名不匹配, 用户装不上)

### 10.2 .mavis/keystore/ 目录

```
C:\Users\Administrator\.mavis\keystore\
├── release.keystore          # shipin-APP 永久 release 签名
└── (其他项目 keystore 以后放这)
```

---

## § 11. 一键升级 (UPDATE_QUICK.md 速查)

### 11.1 真发布 (改代码 + 升级)

5 步, 10 min, 看本文档 § 1-5。

### 11.2 试纸 (不改代码, 只验升级链路)

5 步, 5 min, 看本文档 § 7。

### 11.3 失败诊断 (7 类)

看本文档 § 8。

---

## § 12. 历史 BUG 索引 (S58 期间踩过的坑)

| BUG | 标题 | 修法 | 本文 § |
|---|---|---|---|
| BUG-001/002 | APK 启动闪退 (Hermes bytecode) | RN 0.73 默认 Hermes | — |
| BUG-005/009/011/013 | monorepo shared 包 import value | 只 import type | — |
| BUG-007/017/020 | 弹窗老代码 / 覆盖错位 | 卸老装新 + 不批量覆盖 | § 8.1, § 8.2 |
| BUG-021 | APP 内下载没进度条 | react-native-blob-util + DownloadManager | — |
| BUG-022 | BUG-021 修复 (DownloadManager 跑通) | `useDownloadManager: true` | § 8.5 |
| BUG-023 | debug 签名装不上 | release.keystore 永久 | § 8.3, § 10.1 |
| BUG-024 | 试纸死循环 | 真打不 cp | § 8.4, § 7.5 |
| BUG-025 | actionViewIntent 指错 | 用 `_state.destPath` | § 8.5 |

详细看 `BUGS.md`, 规范看 `CODING_STANDARDS.md` 23 条。
