"""
airtest-bootstrap.py — BlueStacks 5 + Airtest 自检 + 设备连接 demo

依赖（用户手装 Python 3.12+ 后跑）:
    pip install airtest pocoui pillow opencv-python

用法:
    python scripts/airtest-bootstrap.py          # 自检 + demo
    python scripts/airtest-bootstrap.py --demo   # 跑完整 demo（点 + 输入 + 断言 + 报告）

报告: scripts/bs-app-test/reports/airtest-log/
"""
import sys
import argparse
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = PROJECT_ROOT / "scripts" / "bs-app-test" / "reports" / "screenshots"
IMAGES_DIR = PROJECT_ROOT / "scripts" / "bs-app-test" / "images"

# Device URI format: android://<adb_server_host>:<adb_server_port>/<device_serial>
# adb_server defaults to 127.0.0.1:5037
# BlueStacks ADB device is at 127.0.0.1:5555
DEVICE_URI = "android://127.0.0.1:5037/127.0.0.1:5555"


def smoke():
    """自检：依赖 + 设备连通 + 截图"""
    print("=" * 60)
    print("[1/4] 检查依赖...")
    try:
        import airtest  # noqa: F401
        print(f"  ✅ airtest {airtest.__version__}")
    except ImportError:
        print("  ❌ airtest 未装。先跑: pip install airtest pocoui pillow opencv-python")
        sys.exit(1)

    try:
        import poco  # noqa: F401  (pocoui PyPI package imports as 'poco')
        print(f"  ✅ pocoui (imported as poco) 已装")
    except ImportError:
        print("  ⚠️  poco 未装（可选，UI 控件断言需要）")

    try:
        from PIL import Image  # noqa: F401
        print(f"  ✅ Pillow 已装")
    except ImportError:
        print("  ❌ Pillow 未装（图像识别需要）")
        sys.exit(1)

    print("\n[2/4] 检查 adb + BlueStacks...")
    from airtest.core.api import device, connect_device

    try:
        dev = connect_device(DEVICE_URI)
        print(f"  ✅ 已连接: {dev}")
    except Exception as e:
        print(f"  ❌ 连接失败: {e}")
        print("     请确认 BlueStacks 5 已启动 + adb connect 127.0.0.1:5555")
        sys.exit(1)

    print("\n[3/4] 设备信息...")
    info = dev.adb.get_device_info()
    for k, v in info.items():
        print(f"  {k}: {v}")

    print("\n[4/4] 截图测试...")
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    # airtest 1.4.3: dev.screenshot() returns None, writes to logdir.
    # Use snapshot() to get a path.
    from airtest.core.api import snapshot
    out = str(SCREENSHOTS_DIR / "smoke.png")
    snapshot(msg="smoke test")  # writes to logdir
    # Also do a direct screencap via adb for deterministic output
    import subprocess
    proc = subprocess.run(
        ["adb", "-P", "5037", "-s", "127.0.0.1:5555", "exec-out", "screencap", "-p"],
        capture_output=True, timeout=10
    )
    Path(out).write_bytes(proc.stdout)
    print(f"  ✅ 截图 -> {out}")
    print(f"     大小: {Path(out).stat().st_size} bytes")

    print("\n🎉 自检通过！跑 demo: python scripts/airtest-bootstrap.py --demo")


def demo():
    """完整 demo：图像识别点击 + 文本输入 + 断言 + 报告"""
    print("=" * 60)
    print("Airtest Demo: BlueStacks 5 操作流程")
    print("=" * 60)

    from airtest.core.api import (
        connect_device, start_app, text, keyevent,
        assert_exists, assert_not_exists, Template, touch,
        sleep, snapshot, auto_setup
    )

    # 自动设置：连接设备 + 初始化日志
    auto_setup(
        __file__,
        logdir=str(PROJECT_ROOT / "scripts" / "bs-app-test" / "reports" / "airtest-log"),
        devices=[DEVICE_URI],
        project_root=str(PROJECT_ROOT),
    )

    # === 第一步：截图判断当前状态 ===
    print("\n[1] 截图判断 APP 当前状态...")
    snapshot(msg="初始截图")

    # === 第二步：模拟点击（图像识别方式，不死坐标）===
    # 演示：点击屏幕中心（用坐标方式）
    print("\n[2] 模拟点击（坐标）...")
    # BlueStacks 默认 1080x1920
    touch((540, 960))  # 屏幕中心
    sleep(1)

    # === 第三步：模拟输入 ===
    print("\n[3] 模拟输入文本...")
    # 示例：输入到当前焦点控件
    text("Hello from Airtest!")
    sleep(0.5)

    # === 第四步：按键操作 ===
    print("\n[4] 按键: HOME...")
    keyevent("HOME")
    sleep(1)

    # === 第五步：断言 ===
    print("\n[5] 断言: 桌面出现...")
    try:
        # 桌面截图断言（图像识别）
        home_template = Template(str(IMAGES_DIR / "bluestacks_home.png"))
        assert_exists(home_template, "回到桌面")
        print("  ✅ 断言通过：回到桌面")
    except AssertionError as e:
        print(f"  ⚠️ 断言失败（首次跑 baseline 可能不一致）: {e}")

    # === 第六步：最终截图 ===
    print("\n[6] 最终截图...")
    snapshot(msg="demo 结束")

    print("\n" + "=" * 60)
    print("🎉 Demo 完成！")
    print(f"📊 报告目录: {PROJECT_ROOT / 'scripts' / 'bs-app-test' / 'reports' / 'airtest-log'}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true", help="跑完整 demo")
    args = parser.parse_args()

    if args.demo:
        demo()
    else:
        smoke()
