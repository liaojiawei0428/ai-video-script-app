# scripts/ — BlueStacks + Deep剧本 自动化测试工具链

## 一句话总结

> 用 PowerShell + Python + Airtest 控制 BlueStacks 模拟器，对 Android APP（Deep剧本 / ai-script-app）做截图、点击、输入、断言，生成可追溯的 HTML 报告。

---

## 🚀 快速上手（3 条命令）

```powershell
# 1) 验证环境
adb devices                                              # 看到 127.0.0.1:5555 device
python -c "from lib.ui_helper import Device; print('OK')"

# 2) 跑完整登录 + 6 tab 探索测试
python scripts\test_deep_script.py

# 3) 看报告
explorer scripts\bs-app-test\reports\sessions\
```

---

## 📚 文档分层

| 文档 | 用途 |
|---|---|
| **AI_TESTING_GUIDE.md** ⭐ | AI 测试工程师操作手册（先看这个） |
| **README.md** (本文件) | 整体架构 + 命令速查 |
| **lib/ui_helper.py** | Python 高层 API 源码（`Device` 类） |

---

## 🛠️ 工具链三层

```
┌─────────────────────────────────────────────────────────┐
│ 第 3 层：测试用例（场景级）                              │
│   test_deep_script.py   → 登录 + 6 tab + 报告          │
│   test_bug_NNN.py       → BUG 复现                     │
└─────────────────────────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────────────────────────┐
│ 第 2 层：高层 API（语义级，AI 友好）                     │
│   bs-workflow.ps1       → start/tap-text/input/tab/...  │
│   lib/ui_helper.py      → Device 类 + 报告器           │
└─────────────────────────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────────────────────────┐
│ 第 1 层：底层 ADB（命令级）                              │
│   bs-control.ps1        → adb 16 个子命令封装          │
│   adb (D:\Android\platform-tools\adb.exe)              │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 文件结构

```
scripts/
├── bs-control.ps1             # 第 1 层：底层 ADB 封装（16 个子命令）
├── bs-workflow.ps1            # 第 2 层：PowerShell 高层命令
├── airtest-bootstrap.py       # Airtest smoke + demo（首次验环境用）
├── lib/                       # 第 2 层：Python 工具库
│   ├── __init__.py
│   ├── ui_helper.py           # Device 类（find/tap/input/wait/assert/report）
│   ├── reporter.py            # 报告生成（HTML + Markdown）
│   ├── dump_to_json.py        # UI XML → JSON（AI 可读）
│   └── generate_report.py     # HTML 报告生成
├── test_deep_script.py        # 第 3 层：Deep剧本 完整测试用例
├── parse-ui.py                # 临时：UI 解析（已并入 ui_helper）
├── parse-tabs.py              # 临时：底部 tab 解析
├── README.md                  # 本文件
└── AI_TESTING_GUIDE.md        # ⭐ AI 测试工程师操作手册

scripts/bs-app-test/
├── pages/                     # Page Object（待填充）
├── images/                    # 截图模板（图像识别用）
└── reports/
    ├── sessions/<session>-YYYYMMDD-HHMMSS/
    │   ├── screenshots/*.png
    │   ├── ui-dumps/*.xml
    │   ├── REPORT-*.md
    │   └── REPORT-*.html
    ├── screenshots/           # 最新视图
    ├── ui-dumps/              # 最新视图
    └── airtest-log/           # Airtest 报告
```

---

## 🎯 三大场景速查

### 场景 1：AI 测试工程师接到"测一下生图功能"

```powershell
# 1. 复制模板
cp scripts\test_deep_script.py scripts\test_image_generation.py

# 2. 编辑：用 lib/ui_helper.Device 类写测试
notepad scripts\test_image_generation.py

# 3. 跑
python scripts\test_image_generation.py --session img-gen-test

# 4. 看报告
explorer scripts\bs-app-test\reports\sessions\
```

### 场景 2：BUG 复现

```powershell
# 1. 启动 + 复现操作（每步自动截图）
python -c "
import sys; sys.path.insert(0, r'F:\QiTa\banmu\APP\ai-video-script-app\scripts')
from lib.ui_helper import Device
dev = Device(session='bug-repro')
dev.launch('com.aiscriptmobile')
dev.input_to('请输入用户名', 'q378685504')
# ... 复现 BUG 的操作 ...
dev.screenshot('bug-evidence')
dev.report('bug-repro')
"

# 2. 报告里看截图 + UI 树
explorer scripts\bs-app-test\reports\sessions\bug-repro-*
```

### 场景 3：不用 Python，纯 PowerShell

```powershell
# 启动
.\scripts\bs-workflow.ps1 start com.aiscriptmobile

# 等登录页
.\scripts\bs-workflow.ps1 wait "Deep剧本" 10

# 登录
.\scripts\bs-workflow.ps1 input "请输入用户名" "q378685504"
.\scripts\bs-workflow.ps1 input "请输入密码" "wuliao"
.\scripts\bs-workflow.ps1 tap-text "登录"

# 切 tab + 截图
.\scripts\bs-workflow.ps1 tab "生图"
.\scripts\bs-workflow.ps1 screenshot shengtu-page

# 报告
.\scripts\bs-workflow.ps1 report my-session
```

---

## 📊 命令速查

### bs-control.ps1（底层 ADB）

```powershell
.\scripts\bs-control.ps1 devices
.\scripts\bs-control.ps1 connect
.\scripts\bs-control.ps1 info
.\scripts\bs-control.ps1 screenshot <name>
.\scripts\bs-control.ps1 tap <x> <y>
.\scripts\bs-control.ps1 text "value"
.\scripts\bs-control.ps1 swipe <x1> <y1> <x2> <y2> [duration]
.\scripts\bs-control.ps1 keyevent home|back|enter|...
.\scripts\bs-control.ps1 install <apk>
.\scripts\bs-control.ps1 launch <package>
.\scripts\bs-control.ps1 stop <package>
.\scripts\bs-control.ps1 logcat [tag]
.\scripts\bs-control.ps1 record [seconds]
.\scripts\bs-control.ps1 pull /sdcard/x ./
.\scripts\bs-control.ps1 push ./local /sdcard/
.\scripts\bs-control.ps1 shell <cmd>
```

### bs-workflow.ps1（高层）

```powershell
.\scripts\bs-workflow.ps1 connect
.\scripts\bs-workflow.ps1 start <package>
.\scripts\bs-workflow.ps1 screenshot [name]
.\scripts\bs-workflow.ps1 dump                 # UI 树 → JSON
.\scripts\bs-workflow.ps1 tap <x> <y>
.\scripts\bs-workflow.ps1 tap-text "text"
.\scripts\bs-workflow.ps1 tap-rid "rid"
.\scripts\bs-workflow.ps1 input "field" "value"
.\scripts\bs-workflow.ps1 tab "tabName"
.\scripts\bs-workflow.ps1 wait "text" [timeout]
.\scripts\bs-workflow.ps1 assert "text" [timeout]
.\scripts\bs-workflow.ps1 login "userField" "pwdField" "user" "pwd" "submit" "successText" "session"
.\scripts\bs-workflow.ps1 explore <package> [session]
.\scripts\bs-workflow.ps1 report [name]
.\scripts\bs-workflow.ps1 run <script.py>
```

### Python Device API

```python
dev = Device(session="...")
dev.launch(pkg) / dev.stop_app(pkg) / dev.sleep(s)
dev.tap(x, y) / dev.tap_text(t) / dev.tap_resource_id(rid) / dev.tap_class(cls)
dev.input_text(s) / dev.input_to(field, value) / dev.clear_input()
dev.find(text=, rid=, desc=, cls=, contains=, index=)
dev.exists(text=, rid=, desc=)
dev.wait_for(text=, timeout=) / dev.assert_visible(t, timeout=) / dev.assert_not_visible(t)
dev.tab(name) / dev.keyevent(name) / dev.swipe(...)
dev.screenshot(name) / dev.report(name)
```

---

## 🔍 故障排查

| 问题 | 解法 |
|---|---|
| `adb not found` | `Get-Command adb` 看路径；脚本会自动找 `D:\Android\platform-tools\adb.exe` |
| `adb: more than one device` | 设 `$env:BS_DEVICE = "127.0.0.1:5555"` 或用 `connect` 命令 |
| Python 找不到 `lib` | 脚本会自动 `sys.path.insert(0, ...)`；或手动 `set PYTHONPATH=scripts` |
| 截图是空白 | 加 `dev.sleep(2)` 等动画 |
| `assert visible` 超时 | 先 `dev.dump_ui()` 看现在界面，再调整查找条件 |
| PowerShell 中文乱码 | 这是 PS 5.1 GBK 解析 UTF-8 的 bug，用 Python 或 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` |

---

## 🚦 当前状态

- ✅ Python 3.14.6 + airtest 1.4.3 + 全部依赖装好
- ✅ BlueStacks 5.22 + ADB 通道通（`127.0.0.1:5555`）
- ✅ Deep剧本 v3.0.25 已装在 BlueStacks
- ✅ bs-control.ps1 16 子命令全可用
- ✅ bs-workflow.ps1 高层命令全可用
- ✅ test_deep_script.py 跑通（登录 + 6 tab + 报告）
- ✅ HTML 报告生成（含每步截图 + 操作日志）

---

**下一步给后续 AI**：参考 **AI_TESTING_GUIDE.md** 写测试用例，按"高层 API 优先 + 截图证据 + HTML 报告"原则工作。
