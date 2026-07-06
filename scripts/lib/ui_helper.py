"""
ui_helper.py - BlueStacks + Android 设备 UI 高层 API（AI 友好）

设计目标：
- AI 测试不需要关心底层坐标，只用文本 / 资源 ID 找元素
- 每步自动截图 + dump UI 树（让 AI 可看）
- 失败自动 dump + 报告，便于 BUG 复现

核心 API：
    dev = Device(serial="127.0.0.1:5555")
    dev.launch("com.aiscriptmobile")
    dev.tap_text("登录")
    dev.input_to("请输入用户名", "q378685504")
    dev.wait_for("我的书架", timeout=10)
    dev.assert_visible("登录")
    dev.tab("我的")
    dev.screenshot("login-success")
    dev.report("login-test")
"""
import os
import re
import subprocess
import time
from pathlib import Path
from xml.etree import ElementTree as ET

# ============== 默认配置 ==============

DEFAULT_SERIAL = "127.0.0.1:5555"
DEFAULT_ADB = r"D:\Android\platform-tools\adb.exe"

# 报告根目录（项目内）
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REPORT_ROOT = REPO_ROOT / "scripts" / "bs-app-test" / "reports"
SCREENSHOT_DIR = REPORT_ROOT / "screenshots"
UI_DUMP_DIR = REPORT_ROOT / "ui-dumps"

# ============== UI 节点 ==============


class UINode:
    """UI 树单个节点封装"""

    __slots__ = ("pkg", "cls", "text", "rid", "desc", "bounds", "clickable", "focusable")

    def __init__(self, attribs):
        self.pkg = attribs.get("package", "")
        self.cls = attribs.get("class", "").split(".")[-1]
        self.text = attribs.get("text", "")
        self.rid = attribs.get("resource-id", "")
        self.desc = attribs.get("content-desc", "")
        self.clickable = attribs.get("clickable", "false") == "true"
        self.focusable = attribs.get("focusable", "false") == "true"
        b = attribs.get("bounds", "")
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
        if m:
            x1, y1, x2, y2 = map(int, m.groups())
            self.bounds = (x1, y1, x2, y2)
        else:
            self.bounds = (0, 0, 0, 0)

    @property
    def center(self):
        x1, y1, x2, y2 = self.bounds
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    def __repr__(self):
        return f"<UINode {self.cls} text='{self.text[:20]}' rid='{self.rid}' center={self.center}>"


# ============== 设备类 ==============


class Device:
    """
    Android 设备封装（BlueStacks 优先）。

    用法:
        dev = Device()
        dev.launch("com.aiscriptmobile")
        dev.tap_text("登录")
        ...
        dev.report("test-1")
    """

    def __init__(self, serial: str = DEFAULT_SERIAL, adb_path: str = DEFAULT_ADB, session: str = "default"):
        self.serial = serial
        self.adb = adb_path
        self.session = session  # 用于报告分目录
        # 当前操作的截图序列号
        self._step = 0
        # 操作日志（用于报告）
        self.actions = []
        # 当前会话报告目录
        self.session_dir = REPORT_ROOT / "sessions" / f"{session}-{time.strftime('%Y%m%d-%H%M%S')}"
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.shots_dir = self.session_dir / "screenshots"
        self.shots_dir.mkdir(exist_ok=True)
        self.ui_dir = self.session_dir / "ui-dumps"
        self.ui_dir.mkdir(exist_ok=True)
        # 确保设备连接
        self._connect()

    # ---------- 底层 ADB ----------

    def _adb(self, *args, check=True, capture=True, timeout=30):
        """Run adb command"""
        cmd = [self.adb, "-s", self.serial] + list(args)
        try:
            r = subprocess.run(cmd, capture_output=capture, text=True, timeout=timeout)
            if check and r.returncode != 0:
                raise RuntimeError(f"adb failed: {' '.join(cmd)}\nstderr: {r.stderr}")
            return r
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"adb timeout: {' '.join(cmd)}")

    def _connect(self):
        """确保设备连接（已连则跳过）"""
        r = subprocess.run([self.adb, "devices"], capture_output=True, text=True, timeout=10)
        if self.serial not in r.stdout:
            self._adb("connect", self.serial)

    def shell(self, *args, **kw):
        return self._adb("shell", *args, **kw)

    # ---------- 截图 + UI 树 ----------

    def screenshot(self, name: str = None) -> Path:
        """截图 + 保存到 session 目录 + 全局 reports 目录"""
        self._step += 1
        if name is None:
            name = f"step-{self._step:03d}"
        # 去掉文件名非法字符
        safe_name = re.sub(r'[<>:"/\\|?*]', '_', name)
        local = self.shots_dir / f"{self._step:03d}-{safe_name}.png"
        # 用 stdout 流（PowerShell 5.1 兼容性问题用 Start-Process 也行，但 Python subprocess 没问题）
        cmd = [self.adb, "-s", self.serial, "exec-out", "screencap", "-p"]
        with open(local, "wb") as f:
            r = subprocess.run(cmd, stdout=f, timeout=15)
        if r.returncode != 0 or local.stat().st_size < 100:
            raise RuntimeError(f"Screenshot failed: {local}")
        # 复制到全局 screenshots 目录（latest 视图）
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        try:
            import shutil
            shutil.copy(local, SCREENSHOT_DIR / f"{safe_name}.png")
        except Exception:
            pass
        self._log("screenshot", str(local))
        return local

    def dump_ui(self, save: bool = True) -> list:
        """dump 当前界面 UI 树，返回 UINode 列表"""
        self.shell("uiautomator", "dump", "/sdcard/ui.xml")
        r = self._adb("shell", "cat", "/sdcard/ui.xml", check=False)
        # Decode binary safely (BlueStacks uiautomator may emit UTF-8 / UTF-16 / UTF-16LE)
        try:
            raw_bytes = r.stdout.encode("utf-8", errors="ignore") if isinstance(r.stdout, str) else r.stdout
        except Exception:
            raw_bytes = r.stdout
        # Strip BOMs
        if raw_bytes[:3] == b"\xef\xbb\xbf":  # UTF-8 BOM
            raw_bytes = raw_bytes[3:]
            encoding = "utf-8"
        elif raw_bytes[:2] == b"\xff\xfe":  # UTF-16 LE BOM
            raw_bytes = raw_bytes[2:]
            encoding = "utf-16-le"
        elif raw_bytes[:2] == b"\xfe\xff":  # UTF-16 BE BOM
            raw_bytes = raw_bytes[2:]
            encoding = "utf-16-be"
        else:
            # No BOM: try utf-8 first, fallback to utf-16-le
            try:
                raw_bytes.decode("utf-8")
                encoding = "utf-8"
            except UnicodeDecodeError:
                encoding = "utf-16-le"
        text = raw_bytes.decode(encoding, errors="ignore")
        # 删除无效 token 字符（uiautomator 有时会输出 & 等）
        text_clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
        try:
            root = ET.fromstring(text_clean)
        except ET.ParseError:
            # fallback: 正则解析
            root = None

        nodes = []
        attr_re = re.compile(r'(\w[\w-]*)\s*=\s*"([^"]*)"')

        def walk(elem):
            a = dict(attr_re.findall(elem.attrib.get("__raw__", "") or ""))
            if not a and "package" in elem.attrib:
                # ElementTree fallback
                a = dict(elem.attrib)
            if a:
                node = UINode(a)
                if node.pkg == "com.aiscriptmobile" or True:  # all packages
                    nodes.append(node)
            for child in elem:
                walk(child)

        if root is not None:
            walk(root)
        else:
            # Regex fallback
            for m in re.finditer(r'<node\s+([^>]*?)/?>', text, re.DOTALL):
                attrs = dict(attr_re.findall(m.group(1)))
                if attrs.get("package"):
                    nodes.append(UINode(attrs))

        if save:
            ui_file = self.ui_dir / f"{self._step:03d}-ui.xml"
            ui_file.write_text(text, encoding="utf-8", errors="ignore")
            # 也保存一个 latest
            UI_DUMP_DIR.mkdir(parents=True, exist_ok=True)
            (UI_DUMP_DIR / "latest-ui.xml").write_text(text, encoding="utf-8", errors="ignore")
        self._log("dump_ui", f"{len(nodes)} nodes")
        return nodes

    # ---------- 元素查找 ----------

    def find(self, *, text=None, rid=None, desc=None, cls=None,
             contains=False, exact=True, index=0) -> UINode:
        """
        按条件找元素（默认找第一个）。
        - text: 完全匹配或包含（contains=True）
        - rid: 资源 ID
        - desc: content-desc
        - cls: class 名（短名，如 EditText）
        - index: 第几个匹配项
        """
        nodes = self.dump_ui()
        results = []
        for n in nodes:
            if text is not None:
                if exact:
                    if n.text != text:
                        continue
                else:
                    if contains:
                        if text not in n.text:
                            continue
                    else:
                        # 正则
                        if not re.search(text, n.text):
                            continue
            if rid is not None and rid not in n.rid:
                continue
            if desc is not None and desc != n.desc:
                continue
            if cls is not None and n.cls != cls:
                continue
            results.append(n)
        if not results:
            raise LookupError(
                f"UI element not found: text={text!r} rid={rid!r} desc={desc!r} cls={cls!r}"
            )
        return results[min(index, len(results) - 1)]

    def find_all(self, **kw) -> list:
        """找所有匹配元素（同 find，但返回列表）"""
        # 简化版：去掉 index 限制
        nodes = self.dump_ui()
        results = []
        for n in nodes:
            ok = True
            if "text" in kw and kw["text"] not in n.text:
                ok = False
            if ok and "rid" in kw and kw["rid"] not in n.rid:
                ok = False
            if ok and "cls" in kw and kw["cls"] != n.cls:
                ok = False
            if ok:
                results.append(n)
        return results

    def exists(self, **kw) -> bool:
        """元素是否存在（不抛异常）"""
        try:
            self.find(**kw)
            return True
        except LookupError:
            return False

    # ---------- 操作 ----------

    def tap(self, x: int, y: int, name: str = None):
        """点击坐标"""
        self.shell("input", "tap", str(x), str(y))
        self._log("tap", f"({x},{y})" + (f" [{name}]" if name else ""))

    def tap_text(self, text: str, contains: bool = False, index: int = 0, name: str = None):
        """按文本找元素并点击"""
        node = self.find(text=text, contains=contains, exact=not contains, index=index)
        x, y = node.center
        self.tap(x, y, name=name or text)
        return node

    def tap_resource_id(self, rid: str, index: int = 0):
        """按资源 ID 点击"""
        node = self.find(rid=rid, index=index)
        x, y = node.center
        self.tap(x, y, name=f"rid={rid}")

    def tap_class(self, cls: str, index: int = 0):
        """按类名点击"""
        node = self.find(cls=cls, index=index)
        x, y = node.center
        self.tap(x, y, name=f"cls={cls}")

    def input_text(self, text: str):
        """向当前焦点输入框输入文本（空格 → %s）"""
        safe = text.replace(" ", "%s")
        self.shell("input", "text", safe)
        self._log("input", text)

    def input_to(self, target_text: str, value: str):
        """
        点中输入框 → 输入文本。
        target_text: 输入框 placeholder 或上方 label
        """
        node = self.tap_text(target_text)
        time.sleep(0.5)
        self.input_text(value)
        return node

    def clear_input(self, target_text: str = None):
        """清空输入框（先 tap → ctrl+a → delete）"""
        if target_text:
            self.tap_text(target_text)
        self.shell("input", "keyevent", "KEYCODE_MOVE_END")
        # 按 30 次删除键（清空常见输入长度）
        for _ in range(30):
            self.shell("input", "keyevent", "KEYCODE_DEL")
        self._log("clear_input", target_text or "current")

    def keyevent(self, name: str):
        """按键：home / back / enter / delete / volume_up / ..."""
        map_aliases = {
            "home": "KEYCODE_HOME",
            "back": "KEYCODE_BACK",
            "recent": "KEYCODE_APP_SWITCH",
            "enter": "KEYCODE_ENTER",
            "delete": "KEYCODE_DEL",
            "backspace": "KEYCODE_DEL",
            "tab": "KEYCODE_TAB",
            "esc": "KEYCODE_ESCAPE",
            "volume_up": "KEYCODE_VOLUME_UP",
            "volume_down": "KEYCODE_VOLUME_DOWN",
        }
        code = map_aliases.get(name.lower(), name)
        self.shell("input", "keyevent", code)
        self._log("keyevent", code)

    def swipe(self, x1, y1, x2, y2, duration=300):
        """滑动"""
        self.shell("input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration))
        self._log("swipe", f"({x1},{y1})->({x2},{y2})")

    def launch(self, package: str):
        """启动 app"""
        self.shell("monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1")
        time.sleep(2)
        self._log("launch", package)

    def stop_app(self, package: str):
        """强制停止 app"""
        self.shell("am", "force-stop", package)
        self._log("stop_app", package)

    # ---------- 等待 + 断言 ----------

    def wait_for(self, text=None, rid=None, timeout=10, interval=0.5) -> UINode:
        """等待元素出现（带超时）"""
        start = time.time()
        while time.time() - start < timeout:
            try:
                return self.find(text=text, rid=rid)
            except LookupError:
                time.sleep(interval)
        raise TimeoutError(f"Timeout {timeout}s waiting for text={text!r} rid={rid!r}")

    def assert_visible(self, text=None, rid=None, timeout=10, msg=""):
        """断言元素可见"""
        try:
            node = self.wait_for(text=text, rid=rid, timeout=timeout)
            self._log("assert_visible", f"✅ {text or rid} {msg}")
            return node
        except TimeoutError:
            # 失败时截图 + dump
            self.screenshot(f"FAIL-assert-{text or rid}")
            self._log("assert_visible", f"❌ TIMEOUT {text or rid} {msg}")
            raise

    def assert_not_visible(self, text=None, rid=None, timeout=3):
        """断言元素不可见"""
        start = time.time()
        while time.time() - start < timeout:
            if not self.exists(text=text, rid=rid):
                self._log("assert_not_visible", f"✅ {text or rid}")
                return
            time.sleep(0.5)
        raise AssertionError(f"Element still visible after {timeout}s: {text or rid}")

    # ---------- 高级操作 ----------

    def login(self, username_field: str, password_field: str,
              username: str, password: str, submit_text: str = "登录",
              success_text: str = None, timeout: int = 10):
        """
        通用登录流程：填用户名 → 填密码 → 点登录按钮 → 等待成功标识。
        - username_field / password_field: 输入框的 placeholder 文本
        - submit_text: 登录按钮文字
        - success_text: 登录成功后应该看到的元素（如"我的书架"）
        """
        self.input_to(username_field, username)
        self.input_to(password_field, password)
        self.tap_text(submit_text)
        if success_text:
            self.wait_for(success_text, timeout=timeout)
        self.screenshot(f"login-{username}")

    def tab(self, tab_text: str):
        """点底部 tab（自动找底部 y > 1700 的元素）"""
        nodes = self.find_all(text=tab_text)
        # 优先选底部的（y >= 1700）
        bottom = [n for n in nodes if n.bounds[1] >= 1700]
        node = bottom[0] if bottom else nodes[0]
        x, y = node.center
        self.tap(x, y, name=f"tab={tab_text}")
        time.sleep(1.5)  # 给动画留时间

    # ---------- 报告 ----------

    def _log(self, action: str, detail: str):
        ts = time.strftime("%H:%M:%S")
        entry = {"step": self._step, "time": ts, "action": action, "detail": detail}
        self.actions.append(entry)

    def report(self, name: str = None):
        """生成 Markdown + HTML 报告"""
        from .reporter import generate_report
        return generate_report(self, name or self.session)

    def sleep(self, secs: float):
        time.sleep(secs)
        self._log("sleep", f"{secs}s")


# ============== 便捷函数 ==============


def quick_screenshot(name: str = "snap") -> Path:
    """快速截图（无设备对象时用）"""
    dev = Device()
    return dev.screenshot(name)
