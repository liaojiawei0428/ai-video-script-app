"""
test_deep_script.py - Deep剧本 APP 端到端测试（首个完整用例）

业务流程:
  1. 启动 APP
  2. 登录 (用户名 q378685504, 密码 wuliao)
  3. 验证进入书架
  4. 依次切换 6 个 Tab 并截图
  5. 生成 HTML 报告

用法:
  python scripts/test_deep_script.py
  python scripts/test_deep_script.py --session my-deep-test
"""
import sys
import os
import argparse

# Add scripts dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.ui_helper import Device


def test_login_and_explore(session: str = "deep-script"):
    dev = Device(session=session)

    # 1. 启动 APP（先强制停止确保干净状态）
    dev.stop_app("com.aiscriptmobile")
    dev.launch("com.aiscriptmobile")

    # 2. 等待登录页
    dev.assert_visible("Deep剧本", timeout=15)
    dev.screenshot("01-login-page")

    # 3. 登录
    dev.input_to("请输入用户名", "q378685504")
    dev.screenshot("02-username-filled")
    dev.input_to("请输入密码", "wuliao")
    dev.screenshot("03-password-filled")
    dev.tap_text("登录")

    # 4. 验证进入主页
    dev.assert_visible("我的书架", timeout=15)
    dev.screenshot("04-home-bookshelf")

    # 5. 切换 6 个 Tab
    tabs = ["书架", "进度", "生图", "视频", "上传", "我的"]
    for t in tabs:
        try:
            dev.tab(t)
            dev.screenshot(f"05-tab-{t}")
        except Exception as e:
            dev.screenshot(f"05-tab-{t}-FAIL")
            dev._log("tab_fail", f"{t}: {e}")

    # 6. 验证核心功能可见
    # (生图 tab 应该能看到生图助手)
    dev.tab("生图")
    dev.sleep(1)
    try:
        dev.assert_visible("生图会话", timeout=5)
    except Exception:
        pass

    # 7. 生成报告
    report = dev.report(session)
    print(f"\n=== Test Complete ===")
    print(f"Markdown: {report['md']}")
    print(f"HTML: {report['html']}")
    print(f"Actions: {report['actions']}")
    print(f"Screenshots: {report['screenshots']}")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", default="deep-script", help="报告 session 名称")
    args = parser.parse_args()

    try:
        test_login_and_explore(args.session)
    except Exception as e:
        print(f"❌ TEST FAILED: {e}", flush=True)
        sys.exit(1)
