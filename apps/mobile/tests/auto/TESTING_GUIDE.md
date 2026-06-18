# shipin-APP Android 自动化测试流程手册 (ADB + BlueStacks)

> 版本: v1.0  2026-06-16
> 维护: Mavis
> 适用: shipin-APP Android RN 0.73 APK 全功能回归测试

---

## 0. 测试环境前提

### 0.1 必备环境
- **本机**: Windows 10/11 + PowerShell 5.1
- **APK**: 已 build 出来的 `app-release.apk` (永久 release.keystore 签名)
- **模拟器**: **BlueStacks_nxt_cn** (中文新版, 推荐, 真机等价)
  - 路径: `C:\Program Files\BlueStacks_nxt_cn\`
  - 自带 adb: `C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe`
  - 端口: 5555 (实例 ID `emulator-5554`)
- **可选**: AVD (Pixel 6 + Android 13) - 仅适合验弹窗 UI, **不验下载**
- **服务端**: shipin-APP server 跑在 `/www/wwwroot/shipin-APP/` (flat 结构)
- **SSH key**: `C:\Users\Administrator\.ssh\id_ed25519`
- **公网 IP**: `159.75.16.110`

### 0.2 选 BlueStacks 而非 AVD 的原因 (跨项目沉淀)
- AVD 是 QEMU 模拟 + Tencent Cloud 防火墙禁 ICMP + QEMU NAT 拦下载
- 实测 AVD 弹"正在下载 v3.0.23"后进度永远 0.00MB
- BlueStacks 用 Win32 + Tencent NAT 穿透, **实测 5s 80% (5MB/s) 跑完 25MB**
- 结论: **BlueStacks = shipin-APP 升级链路真机等价测试环境**

### 0.3 蓝叠 vs AVD 输入方式区别
| 平台 | input tap | input keyevent |
|------|-----------|----------------|
| AVD | ✅ 响应 | ✅ 响应 |
| 蓝叠 | ❌ 不响应 (被拦) | ✅ 100% 响应 |

**蓝叠专属**: `input keyevent KEYCODE_DPAD_RIGHT × N + KEYCODE_DPAD_CENTER` 触发按钮

---

## 1. 蓝叠启动 + ADB 连接

### 1.1 启动蓝叠
```powershell
# 检查蓝叠是否在跑
Get-Process -Name "HD-Player" -ErrorAction SilentlyContinue

# 启动 (如果没跑)
& "C:\Program Files\BlueStacks_nxt_cn\HD-Player.exe"

# 等待 30s 启动
Start-Sleep 30
```

### 1.2 ADB 连接
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"

# 列出设备
& $bsAdb devices
# 期望输出: emulator-5554    device

# 如果没有, 重启 adb
& $bsAdb kill-server
& $bsAdb start-server
Start-Sleep 3
& $bsAdb devices
```

### 1.3 蓝叠窗口设置 (必做)
```powershell
# 推荐 1080x1920 (默认), 不要用 540x960 (UI 元素过密)
# 蓝叠窗口右上角"设置" → "显示" → 1080x1920
```

---

## 2. 安装 + 启动 APP

### 2.1 卸载旧版 (重要: 防止签名冲突)
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 uninstall com.aiscriptmobile
```

### 2.2 装新版
```powershell
$apk = "F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk"
& $bsAdb -s emulator-5554 install -r $apk

# 期望: Success
# 验装上没
& $bsAdb -s emulator-5554 shell pm list packages | Select-String "aiscriptmobile"
# 期望: package:com.aiscriptmobile

# 验版本
& $bsAdb -s emulator-5554 shell dumpsys package com.aiscriptmobile | Select-String "versionCode|versionName"
# 期望: versionCode=24, versionName=3.0.xx
```

### 2.3 启动 APP
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell am force-stop com.aiscriptmobile
& $bsAdb -s emulator-5554 logcat -c
& $bsAdb -s emulator-5554 shell am start -n com.aiscriptmobile/com.aiscriptmobile.MainActivity

# 等待 React Native 初始化
Start-Sleep 12
```

---

## 3. UI 抓取 + 元素定位

### 3.1 Dump UI tree
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell uiautomator dump /sdcard/ui.xml
& $bsAdb -s emulator-5554 pull /sdcard/ui.xml C:\temp\ui.xml

# 用 Select-String 提所有 text 节点
Get-Content C:\temp\ui.xml -Raw |
  Select-String -Pattern 'text="[^"]+"' -AllMatches |
  ForEach-Object { $_.Matches | ForEach-Object { $_.Value } }
```

### 3.2 找特定 text 节点 + 坐标
```powershell
# 找 "安装" 按钮坐标
$xml = Get-Content C:\temp\ui.xml -Raw
$xml -split '<' | ForEach-Object {
  if ($_ -match 'text="安装"') {
    $r = [regex]::Match($_, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
    if ($r.Success) {
      $cx = ([int]$r.Groups[1].Value + [int]$r.Groups[3].Value) / 2
      $cy = ([int]$r.Groups[2].Value + [int]$r.Groups[4].Value) / 2
      Write-Output "安装 at ($cx,$cy)"
    }
  }
}
```

### 3.3 截图
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell screencap -p /sdcard/shot.png
& $bsAdb -s emulator-5554 pull /sdcard/shot.png C:\temp\shot.png
```

---

## 4. 蓝叠 input 操作 (核心技巧)

### 4.1 ❌ input tap (蓝叠不响应)
```powershell
# 这条不响应, 别用
& $bsAdb -s emulator-5554 shell input tap 484 1097
```

### 4.2 ✅ input keyevent (100% 响应)
```powershell
# 移动焦点 (Alert/Modal 弹窗内 3 按钮: 左右切焦点)
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_DPAD_RIGHT  # 焦点右移
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_DPAD_LEFT   # 焦点左移

# 触发点击 (当前焦点按钮)
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_DPAD_CENTER  # OK 键

# 全局键
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_BACK         # 返回
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_HOME         # Home
& $bsAdb -s emulator-5554 shell input keyevent 4                    # 数字 4 (位置 4)
```

### 4.3 弹窗焦点判定 (3 按钮 Modal)
| 焦点状态 | 焦点按钮 | 按 DPAD_RIGHT 后 |
|----------|----------|------------------|
| 默认 (第 1 个) | 取消 | 切到 "APP 内下载" |
| 第 2 个 | APP 内下载 | 切到 "浏览器下载" |
| 第 3 个 | 浏览器下载 | 循环回 "取消" |

**触发 "APP 内下载"** (默认焦点 + 1 次 RIGHT):
```powershell
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_DPAD_RIGHT
Start-Sleep 1
& $bsAdb -s emulator-5554 shell input keyevent KEYCODE_DPAD_CENTER
```

---

## 5. 关键调试命令

### 5.1 看焦点窗口
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell dumpsys window | Select-String "mCurrentFocus"
# 期望: Window{... u0 com.android.packageinstaller/.PackageInstallerActivity}  ← 系统安装器接管
# 期望: Window{... u0 com.aiscriptmobile/.MainActivity}  ← APP 主页
```

### 5.2 看 logcat (关键 tag 过滤)
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"

# APP 内更新链路关键 log
& $bsAdb -s emulator-5554 logcat -d | Select-String "Updater|DownloadManager|FileProvider|actionViewIntent|RNFetchBlob"

# API 401 / 网络错
& $bsAdb -s emulator-5554 logcat -d | Select-String "API|fetch|network"

# RN 错误 (JS 红屏)
& $bsAdb -s emulator-5554 logcat -d | Select-String "ReactNative|ReactNativeJS"
```

### 5.3 看 DownloadManager 进度
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell dumpsys download | Select-String "STATUS_|DeepScript"
# 期望: STATUS_SUCCESSFUL + filename=DeepScript_v3.0.23.apk
```

### 5.4 看包信息
```powershell
$bsAdb = "C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
& $bsAdb -s emulator-5554 shell pm list packages | Select-String "aiscriptmobile"
& $bsAdb -s emulator-5554 shell dumpsys package com.aiscriptmobile | Select-String "versionCode|versionName|firstInstallTime|lastUpdateTime"
```

---

## 6. 自动化测试模板 (Python 可选)

### 6.1 Python + ADB 模板
```python
import subprocess
import time
import re

class BlueStacksADB:
    def __init__(self):
        self.adb = r"C:\Program Files\BlueStacks_nxt_cn\HD-Adb.exe"
        self.device = "emulator-5554"
        self.package = "com.aiscriptmobile"
    
    def sh(self, cmd):
        """执行 adb shell 命令"""
        return subprocess.run(
            [self.adb, "-s", self.device, "shell"] + cmd.split(),
            capture_output=True, text=True, encoding="utf-8"
        ).stdout
    
    def keyevent(self, code):
        """input keyevent"""
        self.sh(f"input keyevent KEYCODE_{code}")
    
    def tap(self, x, y):
        """input tap (蓝叠可能不响应, 优先用 keyevent)"""
        self.sh(f"input tap {x} {y}")
    
    def dump_ui(self):
        """dump UI tree 到本地"""
        self.sh("uiautomator dump /sdcard/ui.xml")
        subprocess.run([self.adb, "-s", self.device, "pull", "/sdcard/ui.xml", "C:\\temp\\ui.xml"])
    
    def find_text(self, text):
        """找特定 text 节点坐标"""
        with open(r"C:\temp\ui.xml", "r", encoding="utf-8") as f:
            xml = f.read()
        for node in xml.split("<"):
            if f'text="{text}"' in node:
                m = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
                if m:
                    x1, y1, x2, y2 = map(int, m.groups())
                    return (x1+x2)//2, (y1+y2)//2
        return None
    
    def click_text(self, text, use_keyevent=False):
        """点特定 text (优先 keyevent, 蓝叠 tap 不响应)"""
        self.dump_ui()
        pos = self.find_text(text)
        if not pos:
            raise Exception(f"未找到 text='{text}'")
        if use_keyevent:
            # 模拟焦点移动到该元素 + DPAD_CENTER
            # 蓝叠复杂, 推荐用 absolute tap (AOSP emulator 支持)
            self.tap(*pos)
        else:
            self.tap(*pos)
        return pos
    
    def screenshot(self, save_path):
        """截图"""
        self.sh("screencap -p /sdcard/shot.png")
        subprocess.run([self.adb, "-s", self.device, "pull", "/sdcard/shot.png", save_path])
    
    def start_app(self):
        """启动 APP"""
        self.sh(f"am force-stop {self.package}")
        self.sh(f"am start -n {self.package}/.MainActivity")
        time.sleep(12)
    
    def uninstall(self):
        """卸载"""
        self.sh(f"pm uninstall {self.package}")
    
    def install(self, apk_path):
        """装 APK"""
        subprocess.run([self.adb, "-s", self.device, "install", "-r", apk_path])

# 用法
bs = BlueStacksADB()
bs.install(r"F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk")
bs.start_app()
bs.dump_ui()
print(bs.find_text("发现新版 v3.0.23"))
```

---

## 7. shipin-APP 升级链路测试 (标准 SOP)

### 7.1 步骤清单
1. 卸载旧版 (避免签名冲突)
2. 装新版 APK
3. 启动 APP
4. 验弹窗 (客户端<server)
5. 触发 APP 内下载 (DPAD_RIGHT + DPAD_CENTER)
6. monitor 30s 下载进度 (期望 5s 80%)
7. 验 PackageInstaller 接管屏幕 (dumpsys window | grep mCurrentFocus)
8. 系统识别"为现有应用安装更新" (text 匹配)
9. tap "安装" 按钮
10. 验 InstallSuccess + DexOptimizer dexopt
11. 验 lastUpdateTime 跟操作时间一致

### 7.2 关键判定点
- **弹窗不触发**: 客户端=server, 跳过升级测试
- **下载 0.00MB**: 网络问题, 切回 5.3 看 dumpsys download
- **PackageInstaller 不接管**: BUG-027 复发, 查 authorities 配对
- **InstallSuccess 焦点缺失**: 系统装器 crash, 看 logcat 异常

---

## 8. 跨 AI 工具协作约定

### 8.1 文档读序 (新 AI 必读)
1. `apps/mobile/BUGS.md` - 27 个 BUG 全记录 (必读)
2. `apps/mobile/CODING_STANDARDS.md` - 24 条硬性规范
3. `apps/mobile/AGENTS.md` + `CLAUDE.md` - 入口引导
4. `apps/mobile/DEPLOY.md` - 12 节部署手册
5. `apps/mobile/UPDATE_QUICK.md` - 一键升级模板
6. `apps/mobile/tests/auto/REPORT.md` - 历史测试报告
7. **`apps/mobile/tests/auto/TESTING_GUIDE.md` (本文档)** - ADB 测试流程

### 8.2 BUG 记录铁律 (用户硬性要求)
- **每发现一个 BUG 必记录** (修完的也要记)
- 格式: `### BUG-XXX 标题 (日期) - [状态: 修过/待修]`
- 包含: 现象 / 根因 / 修法 / 验证证据
- 修完 24h 内更新 BUGS.md

### 8.3 部署铁律
- 改 mobile 代码 → 必读 BUGS.md + CODING_STANDARDS.md
- 必真打 APK (改 version.ts + build.gradle + 重打 5 min), 禁 cp 旧包
- 部署后必 6 维验证 (弹窗 / 下载 / 安装器 / 装成功 / 重启 APP / logcat)
- 看 error.log (tail -50) 必查

### 8.4 蓝叠专有技巧
- tap 不响应 → keyevent DPAD_RIGHT + DPAD_CENTER
- dumpsys window | grep mCurrentFocus 验焦点
- dumpsys download | grep STATUS_ 验下载状态
- dumpsys package | grep versionCode/versionName 验版本

---

## 9. 故障排查清单

| 现象 | 根因 | 解决方案 |
|------|------|----------|
| `emulator-5554 offline` | 蓝叠 adb 抽风 | `HD-Adb.exe kill-server` + `start-server` + 30s |
| tap 无反应 | 蓝叠拦 tap | 改 keyevent DPAD |
| 下载 0.00MB | AVD/QEMU NAT 拦 | 切到蓝叠 |
| PackageInstaller 不接管 | BUG-027 复发 | 查 authorities = `${applicationId}.provider` |
| APP 启动后空白 | RN bundle 错误 | 看 logcat ReactNativeJS 错误 |
| UI dump 空 | 屏幕没有可访问元素 | 重启 APP |
| 装 APK 失败 | 签名冲突 | 卸老装新 |
| 401 API 错 | server APP_VERSION 没 bump | pm2 env 0 看 + restart |

---

## 10. 测试报告模板

每个功能测试后必填:
```
### 功能: [名称]
- **测试日期**: 2026-06-16
- **测试环境**: BlueStacks 蓝叠 v.X.X
- **客户端版本**: v3.0.22
- **server 版本**: v3.0.23
- **测试结果**: ✅ / ⚠️ / ❌
- **证据**: UI dump 文件, 截图, logcat
- **发现 BUG**: BUG-XXX 标题 (如果有)
- **修复**: 修法 + 部署步骤
- **回归**: 装新 APK 重测
```

---

## 11. 版本历史

- v1.0 (2026-06-16) - 初版, S58 P10 蓝叠端到端跑通后沉淀
- 后续每个测试周期增量更新

---

> 维护: Mavis
> 反馈: 发现新坑直接追加到本文档
