#!/usr/bin/env python3
"""verify-mobile-apk-helper.py — 给 verify-mobile-apk.sh 调, 跨 PowerShell 调 git bash 时跑 cmd.exe 不卡

用法 (S76 #2 实战 2026-07-03):
    python scripts/verify-mobile-apk-helper.py verify <apk_path>
    python scripts/verify-mobile-apk-helper.py verify-print-certs <apk_path>

arg 自动从 Windows 已知 build-tools 版本找 apksigner.jar.

退出码: 0=OK, 1=FAIL (apksigner verify rc != 0), 2=ERR (调用错)
stdout: apksigner 输出 (WARNING 都走这里)
stderr: 错误诊断
"""
import os
import sys
import subprocess
from pathlib import Path

ANDROID_BUILDTOOLS = Path("D:/Android/build-tools")


def find_apksigner_jar():
    """扫 Android build-tools 目录找最新 apksigner.jar"""
    if not ANDROID_BUILDTOOLS.exists():
        return None
    candidates = sorted(ANDROID_BUILDTOOLS.glob("*/lib/apksigner.jar"), reverse=True)
    return str(candidates[0]) if candidates else None


def to_windows(path):
    """把 git bash /mnt/d/... 路径转 Windows D:\\..."""
    p = str(path).replace("/", "\\")
    if p.startswith("\\mnt\\"):
        drive = p[5]  # d
        return f"{drive.upper()}:{p[6:]}"
    return p


def run_apksigner(jar_path, apk_path, with_print_certs):
    # S76 #2 实战 (2026-07-03): java -jar 不认 \, 必须用正斜杠 /
    jar_path_fwd = jar_path.replace("\\", "/")
    apk_path_fwd = apk_path.replace("\\", "/")
    cmd_parts = ["java", "-jar", jar_path_fwd, "verify"]
    if with_print_certs:
        cmd_parts.append("--print-certs")
    cmd_parts.append(apk_path_fwd)
    # 用 bytes + GBK 解码 (cmd.exe 输出中文系统 OEM 编码)
    r = subprocess.run(
        ["cmd.exe", "/c"] + cmd_parts,
        capture_output=True, timeout=120
    )
    # 尝试 GBK (中文 Windows OEM) 优先, fallback UTF-8
    for enc in ("gbk", "utf-8"):
        try:
            out_str = r.stdout.decode(enc) if r.stdout else ""
            err_str = r.stderr.decode(enc) if r.stderr else ""
            break
        except UnicodeDecodeError:
            continue
    else:
        out_str = r.stdout.decode("utf-8", errors="replace") if r.stdout else ""
        err_str = r.stderr.decode("utf-8", errors="replace") if r.stderr else ""
    if out_str:
        sys.stdout.write(out_str)
    if err_str:
        sys.stderr.write(err_str)
    return r.returncode


def main():
    if len(sys.argv) < 3:
        print(f"usage: {sys.argv[0]} {{verify|verify-print-certs}} <apk_path>", file=sys.stderr)
        sys.exit(2)

    action = sys.argv[1]
    apk_path_arg = sys.argv[2]

    if action not in ("verify", "verify-print-certs"):
        print(f"unknown action: {action}", file=sys.stderr)
        sys.exit(2)

    jar = find_apksigner_jar()
    if not jar:
        print("ERROR: apksigner.jar not found in D:/Android/build-tools/*/lib/", file=sys.stderr)
        sys.exit(2)

    apk_win = to_windows(apk_path_arg)
    rc = run_apksigner(jar, apk_win, action == "verify-print-certs")
    sys.exit(rc)


if __name__ == "__main__":
    main()
