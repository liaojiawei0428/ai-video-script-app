# shipin-APP 升级链路自动测试 (Android AVD)

> 验证 S58 P10 修的 BUG-021/022/023/024/025 全部跑通。
> 工具: ADB + Python (subprocess, 不需要 AndroidEnv / DroidBot)
> 模拟器: Android 13 (API 33) Pixel 6
> **最后更新**: 2026-06-16

---

## 🎯 测试覆盖

| 步骤 | 验证什么 | 对应 BUG |
|---|---|---|
| 1 | 卸老装新 | — |
| 2 | 启动 APP, 触发 /api/version | BUG-021 (弹窗代码) |
| 3 | **看到 3 按钮升级窗** | BUG-021 (Modal 渲染) |
| 4 | **点 "APP 内下载"** | BUG-022 (blob-util 入口) |
| 5 | **下载进度 0% → 100%** | BUG-022 (DownloadManager 通知栏) |
| 6 | **自动调起系统安装器** | BUG-025 (actionViewIntent destPath) |
| 7 | **点 "安装" 装上** | BUG-023 (release 签名) |
| 8 | **不弹窗** | BUG-024 (试纸不死循环) |

---

## 🛠️ 环境要求

### 1. Android Studio + AVD (一次性, 5-10 min)

```powershell
# 1. 装 Android Studio (如果没装)
winget install --id Google.AndroidStudio -e

# 2. 装 AVD 组件 (本机有 D:\Android SDK, 跑下面)
$env:ANDROID_HOME = 'D:\Android'
& 'D:\Android\cmdline-tools\latest\bin\sdkmanager.bat' --licenses
& 'D:\Android\cmdline-tools\latest\bin\sdkmanager.bat' 'emulator','platforms;android-33','system-images;android-33;google_apis;x86_64'
```

### 2. 创建 AVD

Android Studio → Tools → Device Manager → Create Device → **Pixel 6** → System Image **Android 13 (API 33, Google APIs x86_64)** → Finish。

### 3. 启动 AVD

```powershell
D:\Android\emulator\emulator.exe -avd Pixel_6_API_33
```

或者 Android Studio → Device Manager → Pixel 6 → ▶ 启动。

### 4. ADB 验证

```powershell
adb devices
# 期望: emulator-5554  device
```

---

## 🚀 用法

### 1. Bump server 到新版本 (真发布流程)

```bash
# 在 apps/mobile/tests/auto/ 目录
# 1) 改 src/config/version.ts + build.gradle 重打 (见 DEPLOY.md § 1-2)
# 2) scp + bump server (见 DEPLOY.md § 4)
```

### 2. 跑测试

```powershell
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\tests\auto
python test_upgrade_flow.py `
  --old-apk "F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk" `
  --server-version "3.0.17" `
  --adb-serial "emulator-5554" `
  --screenshot-dir "./screenshots-v3017"
```

### 3. 看截图

测试跑完看 `./screenshots-v3017/` 目录:
- `01-app-launched.png` — APP 启动
- `03-update-dialog.png` — 升级弹窗 (3 按钮)
- `05-downloading-NNs.png` — 下载进度
- `05-download-done.png` — 下载完成
- `06-installer-manual.png` — 系统安装器 (BUG-025 验证关键)
- `07-after-tap-install.png` — 装上
- `08-new-version-launched.png` — 新版本启动, 不弹窗

---

## 📊 退出码

| 码 | 含义 |
|---|---|
| 0 | ✅ 全部 8 步通过 |
| 1 | ❌ AssertionError (弹窗没出现 / 没下载完 / 还弹窗) |
| 2 | 💥 异常 (adb 错 / APK 损坏) |

CI 用法:

```yaml
# .github/workflows/test-upgrade.yml
- name: shipin-APP 升级链路自动测试
  run: |
    python apps/mobile/tests/auto/test_upgrade_flow.py \
      --old-apk ${{ matrix.old-apk }} \
      --server-version ${{ matrix.new-version }} \
      --screenshot-dir ./test-output
```

---

## 🐛 失败诊断

| 失败点 | 看截图 | 修法 |
|---|---|---|
| Step 3 没看到弹窗 | `03-no-update-dialog.png` | server APP_VERSION 没切, 或客户端没网络 |
| Step 4 找不到 "APP 内下载" | `04-app-download-button-missing.png` | 弹窗代码版本不对 (老 APK 跑老代码) |
| Step 5 下载超时 | `05-download-timeout.png` | server 公网 APK URL 不可达 |
| Step 6 安装器没调起 | `06-installer-fail.png` | **BUG-025 复发**, 改 `res.path()` → `_state.destPath` |
| Step 8 还弹窗 | `08-still-update-dialog.png` | **BUG-024 复发**, 试纸 cp 旧包, 真打 APK |

---

## 🔄 维护

- **新 BUG 加进 Step X.X** 跟新表行
- **截图目录命名** `screenshots-v${newVersion}/`, 不覆盖
- **logcat 拉最后 200 行** 写到 `logcat-final.log`, 出问题第一时间看

详细升级 SOP 看 [DEPLOY.md](../../DEPLOY.md), 踩坑 BUG 看 [BUGS.md](../../BUGS.md)。
