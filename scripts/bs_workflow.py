"""
bs_workflow.py - BlueStacks AI 测试高层 CLI（Python 实现，避免 PS 5.1 字符串坑）

等价于 PowerShell bs-workflow.ps1，但全在 Python 里跑，更稳。

用法:
    python scripts/bs_workflow.py connect
    python scripts/bs_workflow.py start com.aiscriptmobile
    python scripts/bs_workflow.py screenshot login
    python scripts/bs_workflow.py tap-text "登录"
    python scripts/bs_workflow.py input "请输入用户名" "q378685504"
    python scripts/bs_workflow.py tab "我的"
    python scripts/bs_workflow.py wait "我的书架" 10
    python scripts/bs_workflow.py assert "Deep剧本" 10
    python scripts/bs_workflow.py login <user_field> <pwd_field> <user> <pwd> <submit> <success_text> <session>
    python scripts/bs_workflow.py explore <package> [session]
    python scripts/bs_workflow.py report [session]
    python scripts/bs_workflow.py dump
"""
import sys
import os
import argparse

# 把自己加到 path（让 import lib.ui_helper 工作）
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.ui_helper import Device  # noqa: E402


def cmd_connect(args, dev):
    print("[bs] Connected to", dev.serial)


def cmd_start(args, dev):
    dev.stop_app(args.package)
    dev.launch(args.package)


def cmd_screenshot(args, dev):
    dev.screenshot(args.name or "snap")


def cmd_tap(args, dev):
    dev.tap(args.x, args.y)


def cmd_tap_text(args, dev):
    dev.tap_text(args.text)


def cmd_tap_rid(args, dev):
    dev.tap_resource_id(args.rid)


def cmd_input(args, dev):
    dev.input_to(args.field, args.value)


def cmd_tab(args, dev):
    dev.tab(args.name)


def cmd_wait(args, dev):
    dev.wait_for(args.text, timeout=args.timeout)


def cmd_assert(args, dev):
    dev.assert_visible(args.text, timeout=args.timeout)


def cmd_keyevent(args, dev):
    dev.keyevent(args.key)


def cmd_swipe(args, dev):
    dev.swipe(args.x1, args.y1, args.x2, args.y2, duration=args.duration)


def cmd_login(args, dev):
    dev.login(
        username_field=args.user_field,
        password_field=args.pwd_field,
        username=args.username,
        password=args.password,
        submit_text=args.submit,
        success_text=args.success,
        timeout=15,
    )
    dev.report(args.session)


def cmd_explore(args, dev):
    pkg = args.package
    session = args.session
    print(f"[bs] Exploring {pkg} (session={session})")
    dev.stop_app(pkg)
    dev.launch(pkg)
    dev.sleep(5)  # 启动缓冲

    # 智能判断：登录页 vs 主页
    if dev.exists(text="Deep剧本") or dev.exists(text="登录"):
        print("[bs] 检测到登录页，自动登录...")
        if not dev.exists(text="Deep剧本"):
            dev.wait_for("Deep剧本", timeout=15)
        dev.screenshot("01-login-page")
        dev.input_to("请输入用户名", args.username)
        dev.input_to("请输入密码", args.password)
        dev.tap_text("登录")
        dev.wait_for("我的书架", timeout=15)
        dev.screenshot("02-after-login")
    elif dev.exists(text="我的书架"):
        print("[bs] 已登录，直接开始 Tab 探索")
        dev.screenshot("01-launch-already-logged-in")
    else:
        # 未知状态：dump 一下看看
        print("[bs] 未知状态，先 dump UI...")
        dev.screenshot("01-unknown-state")
        try:
            dev.dump_ui()
        except Exception:
            pass
        # 尝试找 Deep剧本 或 我的书架
        try:
            dev.wait_for("我的书架", timeout=10)
        except Exception:
            dev.wait_for("Deep剧本", timeout=10)

    # 6 tab 切换 + 截图
    tabs = ["书架", "进度", "生图", "视频", "上传", "我的"]
    for t in tabs:
        try:
            dev.tab(t)
            dev.sleep(1.2)
            dev.screenshot(f"03-tab-{t}")
        except Exception as e:
            print(f"[bs] WARN tab '{t}' failed: {e}")
            dev.screenshot(f"03-tab-{t}-FAIL")

    dev.report(session)


def cmd_report(args, dev):
    dev.report(args.session)


def cmd_dump(args, dev):
    nodes = dev.dump_ui()
    print(f"[bs] {len(nodes)} nodes dumped")
    for n in nodes[:30]:
        print(f"  {n.cls:18} text={n.text!r:30} rid={n.rid!r:35} center={n.center}")


def cmd_test_login(args, dev):
    """Deep剧本登录测试（预置凭证）"""
    dev.stop_app("com.aiscriptmobile")
    dev.launch("com.aiscriptmobile")
    dev.wait_for("Deep剧本", timeout=15)
    dev.screenshot("01-login-page")
    dev.input_to("请输入用户名", args.username)
    dev.screenshot("02-username-filled")
    dev.input_to("请输入密码", args.password)
    dev.screenshot("03-password-filled")
    dev.tap_text("登录")
    dev.wait_for("我的书架", timeout=15)
    dev.screenshot("04-home-bookshelf")

    tabs = ["书架", "进度", "生图", "视频", "上传", "我的"]
    for t in tabs:
        try:
            dev.tab(t)
            dev.sleep(1.5)
            dev.screenshot(f"05-tab-{t}")
        except Exception as e:
            print(f"[bs] WARN tab '{t}' failed: {e}")
            dev.screenshot(f"05-tab-{t}-FAIL")

    dev.report(args.session)


# ---------- main ----------

def main():
    parser = argparse.ArgumentParser(prog="bs-workflow")
    parser.add_argument("--device", default="127.0.0.1:5555", help="ADB device serial")
    parser.add_argument("--session", default="default", help="Session name for reports")
    parser.add_argument("--username", default="q378685504")
    parser.add_argument("--password", default="wuliao")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("connect").set_defaults(func=cmd_connect)
    p = sub.add_parser("start"); p.add_argument("package"); p.set_defaults(func=cmd_start)
    p = sub.add_parser("screenshot"); p.add_argument("name", nargs="?", default=None); p.set_defaults(func=cmd_screenshot)
    p = sub.add_parser("dump"); p.set_defaults(func=cmd_dump)
    p = sub.add_parser("tap"); p.add_argument("x", type=int); p.add_argument("y", type=int); p.set_defaults(func=cmd_tap)
    p = sub.add_parser("tap-text"); p.add_argument("text"); p.set_defaults(func=cmd_tap_text)
    p = sub.add_parser("tap-rid"); p.add_argument("rid"); p.set_defaults(func=cmd_tap_rid)
    p = sub.add_parser("input"); p.add_argument("field"); p.add_argument("value"); p.set_defaults(func=cmd_input)
    p = sub.add_parser("tab"); p.add_argument("name"); p.set_defaults(func=cmd_tab)
    p = sub.add_parser("wait"); p.add_argument("text"); p.add_argument("timeout", type=int, default=10); p.set_defaults(func=cmd_wait)
    p = sub.add_parser("assert"); p.add_argument("text"); p.add_argument("timeout", type=int, default=10); p.set_defaults(func=cmd_assert)
    p = sub.add_parser("keyevent"); p.add_argument("key"); p.set_defaults(func=cmd_keyevent)
    p = sub.add_parser("swipe")
    p.add_argument("x1", type=int); p.add_argument("y1", type=int)
    p.add_argument("x2", type=int); p.add_argument("y2", type=int)
    p.add_argument("--duration", type=int, default=300); p.set_defaults(func=cmd_swipe)
    p = sub.add_parser("login")
    p.add_argument("user_field"); p.add_argument("pwd_field")
    p.add_argument("username"); p.add_argument("password")
    p.add_argument("submit", nargs="?", default="登录")
    p.add_argument("success", nargs="?", default="我的书架")
    p.set_defaults(func=cmd_login)
    p = sub.add_parser("explore")
    p.add_argument("package")
    p.add_argument("session", nargs="?", default="explore")
    p.set_defaults(func=cmd_explore)
    p = sub.add_parser("report"); p.set_defaults(func=cmd_report)
    p = sub.add_parser("test-login"); p.set_defaults(func=cmd_test_login)

    args = parser.parse_args()

    # 创建 device
    dev = Device(serial=args.device, session=args.session)

    # 执行命令
    try:
        args.func(args, dev)
    except Exception as e:
        print(f"[bs] ERROR: {e}", flush=True)
        # 自动 dump 当前状态
        try:
            dev.screenshot("FAIL-exception")
            dev.dump_ui()
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
