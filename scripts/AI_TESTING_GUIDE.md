# AI Testing Guide - 后续 AI 测试 Deep剧本 APP 标准流程

> 适用: 任何 AI agent / 测试工程师，对 Android APP（BlueStacks 模拟器上的 Deep剧本 v3.0+）做自动化测试。
>
> 环境: Windows + BlueStacks 5 + ADB + Python 3.14 + Airtest 1.4.3（已装好）
>
> 原则: **能看截图就少猜坐标；能按文本找元素就别死坐标；每步截图 + 报告可追溯**

---

## 🚀 快速开始（30 秒上手）

### 1. 工具链确认（每次开始前）

```powershell
# 验证 ADB + BlueStacks + Python
adb devices                                            # 看到 127.0.0.1:5555 device
python -c "from lib.ui_helper import Device; print('OK')"
```

### 2. 跑现有测试（验证环境）

```powershell
python scripts\test_deep_script.py
```

✅ 跑完会生成：
- `scripts/bs-app-test/reports/sessions/deep-script-YYYYMMDD-HHMMSS/REPORT-*.md`
- `scripts/bs-app-test/reports/sessions/deep-script-YYYYMMDD-HHMMSS/REPORT-*.html`
- `scripts/bs-app-test/reports/sessions/deep-script-YYYYMMDD-HHMMSS/screenshots/*.png`

### 3. 写新测试（高层 API，不用关心底层）

```python
from lib.ui_helper import Device

dev = Device(session="my-test")
dev.launch("com.aiscriptmobile")
dev.input_to("请输入用户名", "xxx")
dev.input_to("请输入密码", "yyy")
dev.tap_text("登录")
dev.assert_visible("我的书架", timeout=15)
dev.tab("生图")
dev.screenshot("after-tab-shengtu")
dev.report("my-test")
```

---

## 📚 核心 API（高层，AI 友好）

### Device 生命周期

```python
dev = Device(session="test-1")    # 创建（自动连 BlueStacks）
dev.launch(pkg)                    # 启动 APP
dev.stop_app(pkg)                  # 强制停止（清状态）
dev.sleep(2)                       # 等 N 秒
dev.report("name")                 # 生成报告
```

### 元素查找（按语义，不靠坐标）

```python
# 按文本找
dev.find(text="登录")              # 完全匹配
dev.find(text="登录", contains=True) # 包含匹配
dev.find(text="登录", index=1)    # 第 2 个匹配项

# 按资源 ID 找（最稳）
dev.find(rid="com.aiscriptmobile:id/login_btn")

# 按 content-desc 找
dev.find(desc="登录")

# 按 class 找
dev.find(cls="EditText", index=0)  # 第 1 个 EditText

# 不抛异常的查找
dev.exists(text="错误提示")        # True/False
```

### 操作

```python
# 点
dev.tap(x, y)                     # 死坐标（不推荐）
dev.tap_text("登录")              # 按文本找 + 点 ⭐ 推荐
dev.tap_resource_id("login_btn")  # 按 rid 点
dev.tap_class("Button")           # 按 class 点

# 输入
dev.input_text("hello")           # 当前焦点输入
dev.input_to("用户名框", "value") # 点输入框 + 输入 ⭐ 推荐
dev.clear_input()                 # 清空当前输入框

# 按键
dev.keyevent("home")              # home/back/enter/delete/volume_up
dev.keyevent("KEYCODE_BACK")

# 滑动
dev.swipe(540, 1500, 540, 500, duration=300)

# Tab 切换
dev.tab("我的")                    # 点底部 Tab（自动找 y >= 1700）

# 启动/停止
dev.launch("com.aiscriptmobile")
dev.stop_app("com.aiscriptmobile")
```

### 等待 + 断言

```python
# 等待元素出现
dev.wait_for("我的书架", timeout=15)

# 断言（超时 + 自动 dump + 截图）
dev.assert_visible("登录", timeout=10)
dev.assert_not_visible("错误提示", timeout=3)
```

### 截图 + 报告

```python
dev.screenshot("after-login")     # 自动序号 + 名称
report = dev.report("test-1")
# report['md']     # Markdown 报告路径
# report['html']   # HTML 报告路径
# report['actions']  # 操作步骤数
# report['screenshots']  # 截图数
```

---

## 🔧 高级：PowerShell 命令（不写 Python 也能用）

```powershell
# 启动
.\scripts\bs-workflow.ps1 start com.aiscriptmobile

# 截图（自动序号 + 命名）
.\scripts\bs-workflow.ps1 screenshot login-page

# 按文本找 + 点击
.\scripts\bs-workflow.ps1 tap-text "登录"

# 输入（自动 tap 输入框 + 输入）
.\scripts\bs-workflow.ps1 input "请输入用户名" "q378685504"

# 切底部 tab
.\scripts\bs-workflow.ps1 tab "我的"

# 等待元素
.\scripts\bs-workflow.ps1 wait "我的书架" 10

# 断言
.\scripts\bs-workflow.ps1 assert "Deep剧本" 10

# 一键登录（参数：用户字段 / 密码字段 / 用户名 / 密码 / 提交文字 / 成功标识 / session 名）
.\scripts\bs-workflow.ps1 login "请输入用户名" "请输入密码" "q378685504" "wuliao" "登录" "我的书架" my-session

# 一键 explore（启动 + 6 tab 切换 + 报告）
.\scripts\bs-workflow.ps1 explore com.aiscriptmobile my-explore

# 生成报告
.\scripts\bs-workflow.ps1 report my-session

# 跑 Python 测试
.\scripts\bs-workflow.ps1 run scripts\test_deep_script.py

# dump UI 树到 JSON（AI 可解析）
.\scripts\bs-workflow.ps1 dump
```

---

## 📊 看截图 + UI 树（AI 决策依据）

每次测试自动保存：
- `screenshots/001-name.png` ... 每步截图
- `ui-dumps/001-ui.xml` ... 每步 UI 树
- `REPORT-name.html` ... 可视化报告
- `REPORT-name.md` ... 文本报告

**AI 决策循环**：
1. 读最近一张截图 → 判断 UI 状态
2. 读 `ui-dumps/latest-ui.xml` → 提取元素坐标
3. 用 `dev.tap_text("...")` 或 `dev.tap(540, 960)` 操作
4. `dev.screenshot("step-N")` + `dev.sleep(1)`
5. 回到 1，直到达成目标

---

## 🧪 测试用例模板

### 模板 1：单流程测试

```python
# scripts/test_my_feature.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.ui_helper import Device

def main():
    dev = Device(session="my-feature")

    # 前置：登录
    dev.launch("com.aiscriptmobile")
    dev.input_to("请输入用户名", "q378685504")
    dev.input_to("请输入密码", "wuliao")
    dev.tap_text("登录")
    dev.assert_visible("我的书架", timeout=15)

    # 测试逻辑
    dev.tab("生图")
    dev.assert_visible("生图会话")
    dev.input_text("做一个赛博朋克女战士")
    dev.tap_text("生成")
    dev.sleep(10)
    dev.screenshot("after-generation")
    dev.assert_visible("下载")

    dev.report("my-feature")

if __name__ == "__main__":
    main()
```

### 模板 2：BUG 复现

```python
# scripts/test_bug_NNN.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib.ui_helper import Device

def main():
    dev = Device(session=f"bug-NNN-repro")

    # 重现步骤（按时间顺序）
    dev.launch("com.aiscriptmobile")
    dev.input_to("请输入用户名", "q378685504")
    dev.input_to("请输入密码", "wuliao")
    dev.tap_text("登录")
    # ... 复现 BUG 的具体操作

    # 截 BUG 现场图
    dev.screenshot("bug-NNN-repro")

    dev.report(f"bug-NNN-repro")

if __name__ == "__main__":
    main()
```

---

## 🚨 常见问题

### 找不到元素

```python
# 1. 增加超时
dev.wait_for("我的书架", timeout=30)  # 默认 10s

# 2. 用 contains 模糊匹配
dev.find(text="书架", contains=True)

# 3. 手动 dump UI 看
import json
ui = dev.dump_ui()
for n in ui:
    print(f"{n.cls} | text='{n.text}' | center={n.center}")
```

### 截图是空白

```python
# 等动画完成
dev.tap_text("生图")
dev.sleep(3)               # 给动画 3 秒
dev.screenshot("...")
```

### 找元素坐标飘了

```python
# 用 dev.find() 拿真实坐标，不要靠肉眼估算
node = dev.find(text="登录按钮")
print(node.center)          # 打印真实坐标
```

### 多个设备混淆

```powershell
# 设置目标设备
$env:BS_DEVICE = "emulator-5554"
$env:BS_DEVICE = "127.0.0.1:5555"
```

---

## 📦 关键文件路径速查

```
scripts/
├── bs-control.ps1             # 底层 ADB（截图/tap/input/screencap 等 16 个子命令）
├── bs-workflow.ps1            # ⭐ 高层 PowerShell 工作流（start/tap-text/input/tab/wait/report）
├── airtest-bootstrap.py       # Airtest smoke + demo
├── lib/                       # ⭐ Python 工具库
│   ├── ui_helper.py           # Device 类（所有高层 API）
│   ├── reporter.py            # 报告生成器
│   ├── dump_to_json.py        # UI XML → JSON
│   └── generate_report.py     # 报告 HTML 生成
├── test_deep_script.py        # ⭐ 第一个完整测试用例
├── README.md                  # 整体说明
└── AI_TESTING_GUIDE.md        # ⭐ 本文件

scripts/bs-app-test/reports/
├── sessions/<session>-YYYYMMDD-HHMMSS/
│   ├── screenshots/001-xxx.png ...  每步截图
│   ├── ui-dumps/001-ui.xml ...      每步 UI 树
│   ├── REPORT-xxx.md                Markdown 报告
│   └── REPORT-xxx.html              HTML 报告（浏览器打开看）
├── screenshots/              # latest 视图（最近一次）
├── ui-dumps/                 # latest 视图
└── airtest-log/              # Airtest 报告
```

---

## 🎯 后续 AI 测试流程建议

1. **接到测试任务** → 先 `bs-workflow.ps1 explore com.aiscriptmobile` 跑一遍熟悉 UI
2. **看 explore 报告** → 找元素真实坐标（不要靠肉眼估算）
3. **写测试脚本** → 复制 `test_deep_script.py` 模板改
4. **跑测试** → `python scripts\test_xxx.py`
5. **看报告** → 打开 `REPORT-xxx.html` 看截图时间线
6. **迭代调试** → 找不到元素时 `dump_ui()` + 截图比对
7. **BUG 复现** → 写 `test_bug_NNN.py`，保留截图证据
8. **回归测试** → 把已有测试脚本定期跑

---

**口诀**：

- **能 tap_text 别 tap 坐标**（坐标飘，文本稳）
- **能 find 别肉眼估**（拿真实 UI 树）
- **每步截图**（BUG 复现靠证据）
- **超时别超 30s**（卡死就 dump 看哪步出问题）
- **报告用 HTML**（比 Markdown 直观）
