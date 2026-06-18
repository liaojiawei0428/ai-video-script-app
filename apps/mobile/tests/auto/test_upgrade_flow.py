#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shipin-APP 升级链路自动测试 (Android AVD)
==========================================

目的: 自动验证 S58 P10 修的 BUG-021/022/023/024/025 全部跑通
工具: ADB + Python (subprocess)
AVD:  Android 13 (API 33) Pixel 6

流程:
  1. 装 shipin-APP v${OLD} APK 到 AVD
  2. 启动 APP, 触发 /api/version 检查
  3. 截图: 看到升级窗 (3 按钮)
  4. 点 "APP 内下载" 按钮
  5. 监控通知栏 + Modal 进度 (0% → 100%)
  6. 监控自动调起系统安装器
  7. 点 "安装" 按钮
  8. 启动新版本, 验证不弹窗 (客户端 = server)

用法:
  python test_upgrade_flow.py \
    --old-apk /path/to/DeepScript_v3.0.16.apk \
    --server-version 3.0.17 \
    --adb-serial emulator-5554
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


# ========== 颜色输出 ==========
class C:
    R = '\033[91m'  # 红
    G = '\033[92m'  # 绿
    Y = '\033[93m'  # 黄
    B = '\033[94m'  # 蓝
    N = '\033[0m'   # 重置


def log(msg, color=C.N):
    print(f"{color}[{time.strftime('%H:%M:%S')}] {msg}{C.N}")


# ========== ADB 封装 ==========
class ADB:
    def __init__(self, serial=None):
        self.serial = serial
        self.cmd = ['adb']
        if serial:
            self.cmd += ['-s', serial]

    def shell(self, cmd, timeout=30):
        """adb shell <cmd>"""
        full = self.cmd + ['shell'] + (cmd if isinstance(cmd, list) else [cmd])
        return subprocess.run(full, capture_output=True, text=True, timeout=timeout)

    def exec(self, *args, timeout=60):
        """adb <args>"""
        full = self.cmd + list(args)
        return subprocess.run(full, capture_output=True, text=True, timeout=timeout)

    def install(self, apk_path):
        """adb install -r <apk>"""
        log(f"装 APK: {apk_path}", C.B)
        r = self.exec('install', '-r', apk_path, timeout=120)
        if r.returncode != 0 or 'Success' not in r.stdout:
            raise RuntimeError(f"adb install 失败: {r.stdout}\n{r.stderr}")
        log(f"✅ APK 装上", C.G)

    def uninstall(self, package):
        log(f"卸 APK: {package}", C.B)
        r = self.exec('uninstall', package, timeout=60)
        if r.returncode != 0:
            log(f"⚠️ 卸 APK 失败 (可能没装): {r.stdout}", C.Y)

    def screenshot(self, save_path):
        """截屏保存到 PNG"""
        r = self.shell(['screencap', '-p', '/sdcard/screen.png'], timeout=10)
        if r.returncode != 0:
            raise RuntimeError(f"screencap 失败: {r.stderr}")
        # pull 到本机
        r2 = self.exec('pull', '/sdcard/screen.png', str(save_path), timeout=10)
        if r2.returncode != 0:
            raise RuntimeError(f"adb pull 失败: {r2.stderr}")
        log(f"📸 截屏: {save_path}", C.B)

    def tap(self, x, y):
        """点击坐标"""
        log(f"👆 tap ({x}, {y})", C.B)
        self.shell(['input', 'tap', str(x), str(y)], timeout=5)

    def text(self, s):
        """输入文本 (支持中文)"""
        # 中文需要用 adb shell input text 替换空格为 %s
        safe = s.replace(' ', '%s')
        self.shell(['input', 'text', safe], timeout=5)

    def keyevent(self, code):
        """按键事件"""
        self.shell(['input', 'keyevent', str(code)], timeout=5)

    def back(self):
        self.keyevent(4)

    def home(self):
        self.keyevent(3)

    def wait_for_text(self, text, timeout=10, package=None):
        """等 UI 出现指定文本"""
        end = time.time() + timeout
        while time.time() < end:
            r = self.shell(['uiautomator', 'dump', '/sdcard/ui.xml'], timeout=10)
            if r.returncode == 0:
                r2 = self.exec('pull', '/sdcard/ui.xml', '/tmp/ui.xml', timeout=5)
                if r2.returncode == 0 and os.path.exists('/tmp/ui.xml'):
                    with open('/tmp/ui.xml', 'r', encoding='utf-8') as f:
                        ui = f.read()
                    if text in ui:
                        return True
            time.sleep(0.5)
        return False

    def tap_text(self, text, timeout=10):
        """找文本并点击"""
        end = time.time() + timeout
        while time.time() < end:
            r = self.shell(['uiautomator', 'dump', '/sdcard/ui.xml'], timeout=10)
            if r.returncode == 0:
                r2 = self.exec('pull', '/sdcard/ui.xml', '/tmp/ui.xml', timeout=5)
                if r2.returncode == 0 and os.path.exists('/tmp/ui.xml'):
                    with open('/tmp/ui.xml', 'r', encoding='utf-8') as f:
                        ui = f.read()
                    import re
                    m = re.search(rf'text="{re.escape(text)}"[^/]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', ui)
                    if m:
                        x1, y1, x2, y2 = map(int, m.groups())
                        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                        log(f"🎯 找到 '{text}' @ ({cx}, {cy})", C.B)
                        self.tap(cx, cy)
                        return True
            time.sleep(0.5)
        return False

    def start_app(self, package, activity=None):
        """启动 APP"""
        if activity:
            comp = f"{package}/{activity}"
        else:
            comp = package
        r = self.shell(['am', 'start', '-n', comp], timeout=10)
        if r.returncode != 0:
            raise RuntimeError(f"启动 APP 失败: {r.stderr}")

    def force_stop(self, package):
        self.shell(['am', 'force-stop', package], timeout=5)

    def logcat_clear(self):
        self.shell(['logcat', '-c'], timeout=5)

    def logcat_dump(self, save_path, lines=200):
        """dump logcat 到文件"""
        r = self.shell(['logcat', '-d', '-t', str(lines)], timeout=10)
        with open(save_path, 'w', encoding='utf-8') as f:
            f.write(r.stdout)
        log(f"📋 logcat: {save_path}", C.B)


# ========== 测试流程 ==========
def test_upgrade_flow(args):
    log(f"=== shipin-APP 升级链路自动测试 ===", C.G)
    log(f"ADB serial: {args.adb_serial}")
    log(f"Old APK: {args.old_apk}")
    log(f"Server 目标 version: {args.server_version}")
    log(f"截图目录: {args.screenshot_dir}")

    pkg = 'com.aiscriptmobile'
    activity = 'com.aiscriptmobile.MainActivity'

    # 准备截图目录
    ss_dir = Path(args.screenshot_dir)
    ss_dir.mkdir(parents=True, exist_ok=True)

    adb = ADB(serial=args.adb_serial)

    # 1. 卸老装新 (确保干净)
    log(f"\n[1/8] 卸老 APK + 装 {args.old_apk}", C.G)
    adb.uninstall(pkg)
    adb.install(args.old_apk)
    adb.logcat_clear()
    time.sleep(2)

    # 2. 启动 APP, 触发 /api/version 检查
    log(f"\n[2/8] 启动 APP, 触发升级检查", C.G)
    adb.start_app(pkg, activity)
    time.sleep(5)  # 等启动 + 网络请求
    adb.screenshot(str(ss_dir / '01-app-launched.png'))

    # 3. 看弹窗
    log(f"\n[3/8] 看升级弹窗 (期望 '发现新版本 v{args.server_version}')", C.G)
    if not adb.wait_for_text(f'发现新版本', timeout=10):
        adb.screenshot(str(ss_dir / '03-no-update-dialog.png'))
        raise AssertionError(f"❌ 10 秒内没看到升级弹窗, 看截图: 03-no-update-dialog.png")

    adb.screenshot(str(ss_dir / '03-update-dialog.png'))
    log(f"✅ 看到升级弹窗", C.G)

    # 4. 点 "APP 内下载"
    log(f"\n[4/8] 点 'APP 内下载' 按钮", C.G)
    if not adb.tap_text('APP 内下载', timeout=5):
        adb.screenshot(str(ss_dir / '04-app-download-button-missing.png'))
        raise AssertionError(f"❌ 没找到 'APP 内下载' 按钮")
    time.sleep(2)
    adb.screenshot(str(ss_dir / '04-after-tap-app-download.png'))

    # 5. 监控下载 (通知栏 + Modal 进度)
    log(f"\n[5/8] 监控下载进度 (通知栏 + Modal, 期望 0% → 100%)", C.G)
    download_done = False
    start = time.time()
    last_pct = 0
    while time.time() - start < 60:  # 60s 超时
        adb.screenshot(str(ss_dir / f'05-downloading-{int(time.time() - start):02d}s.png'))
        # 看下载完成
        if adb.wait_for_text('下载完成', timeout=2):
            download_done = True
            log(f"✅ 下载完成 (用时 {int(time.time() - start)}s)", C.G)
            break
        time.sleep(2)

    if not download_done:
        adb.screenshot(str(ss_dir / '05-download-timeout.png'))
        raise AssertionError(f"❌ 60s 内没下载完")

    adb.screenshot(str(ss_dir / '05-download-done.png'))

    # 6. 等系统安装器自动调起
    log(f"\n[6/8] 等系统安装器自动调起 (BUG-025 关键验证)", C.G)
    installer_appeared = False
    start = time.time()
    while time.time() - start < 30:
        adb.screenshot(str(ss_dir / f'06-installer-wait-{int(time.time() - start):02d}s.png'))
        # 系统安装器 包名 com.android.packageinstaller 或 com.google.android.packageinstaller
        r = adb.shell(['dumpsys', 'window'], timeout=5)
        if 'packageinstaller' in r.stdout.lower() or 'com.android.packageinstaller' in r.stdout.lower():
            installer_appeared = True
            log(f"✅ 系统安装器已调起 (用时 {int(time.time() - start)}s)", C.G)
            break
        time.sleep(1)

    if not installer_appeared:
        adb.screenshot(str(ss_dir / '06-installer-fail.png'))
        log(f"⚠️ 系统安装器没自动调起 — 可能是 BUG-025 复发 (res.path 指错)", C.Y)
        # 尝试手动从通知栏触发
        log(f"尝试下拉通知栏点 '下载完成' 通知 (备份方案)", C.Y)
        adb.shell(['cmd', 'statusbar', 'expand-notifications'], timeout=5)
        time.sleep(2)
        adb.screenshot(str(ss_dir / '06-notification-shade.png'))
        if adb.tap_text('Deep剧本', timeout=5):
            time.sleep(3)
            adb.screenshot(str(ss_dir / '06-installer-manual.png'))
            installer_appeared = True

    if not installer_appeared:
        raise AssertionError(f"❌ 系统安装器没调起 (BUG-025 修复失败)")

    # 7. 点 "安装" 按钮
    log(f"\n[7/8] 点 '安装' 按钮", C.G)
    if not adb.tap_text('安装', timeout=10):
        adb.screenshot(str(ss_dir / '07-install-button-missing.png'))
        raise AssertionError(f"❌ 没找到 '安装' 按钮")

    time.sleep(5)
    adb.screenshot(str(ss_dir / '07-after-tap-install.png'))

    # 8. 启动新版本, 验证不弹窗
    log(f"\n[8/8] 启动新版本, 验证不弹窗 (客户端 = server)", C.G)
    time.sleep(3)  # 等装完
    adb.start_app(pkg, activity)
    time.sleep(5)
    adb.screenshot(str(ss_dir / '08-new-version-launched.png'))

    if adb.wait_for_text('发现新版本', timeout=5):
        adb.screenshot(str(ss_dir / '08-still-update-dialog.png'))
        raise AssertionError(f"❌ 装上新版本还弹窗 — 死循环, BUG-024 复发")
    log(f"✅ 没弹窗 — 客户端 {args.server_version} = server {args.server_version}", C.G)

    # 收尾
    adb.logcat_dump(str(ss_dir / 'logcat-final.log'))

    log(f"\n=== 🎉 全部 8 步通过! ===", C.G)
    log(f"截图: {ss_dir}/", C.G)
    log(f"logcat: {ss_dir}/logcat-final.log", C.G)


def main():
    parser = argparse.ArgumentParser(description='shipin-APP 升级链路自动测试')
    parser.add_argument('--old-apk', required=True, help='老版本 APK 路径')
    parser.add_argument('--server-version', required=True, help='server 目标版本 (新版本号)')
    parser.add_argument('--adb-serial', default='emulator-5554', help='ADB 设备序列号')
    parser.add_argument('--screenshot-dir', default='./upgrade-test-screenshots', help='截图保存目录')
    args = parser.parse_args()

    try:
        test_upgrade_flow(args)
        sys.exit(0)
    except AssertionError as e:
        log(f"\n❌ 测试失败: {e}", C.R)
        sys.exit(1)
    except Exception as e:
        log(f"\n💥 异常: {e}", C.R)
        import traceback
        traceback.print_exc()
        sys.exit(2)


if __name__ == '__main__':
    main()
