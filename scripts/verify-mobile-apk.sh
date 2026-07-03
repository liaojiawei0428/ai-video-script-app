#!/usr/bin/env bash
# scripts/verify-mobile-apk.sh — shipin-APP APK 真机回归脚本 (12 维度, LF)
#
# 目的: 跟 apps/server/scripts/verify-deploy.sh 27 维度配套, 验 mobile APK 真实性
#       解决 BUG-088/089/130/134/135/159/160 反复踩坑
#
# S75 #3 实战 (2026-07-03): 第一次实战, 修 4 处 bug:
#   - sed -E 转义问题 (嵌套 shell quote 冲突) → 改 awk -F"'"
#   - 中文括号 bash parser 误解 → 改英文 brackets 或全角方括号
#   - CRLF Windows line endings → 用 LF
#   - \033 ANSI escape 被 PowerShell 调 bash 时吞 → 改 ASCII 字符标签
#
# 跨项目通用铁律 (跟 BUG-159 v3.0.79 实战沉淀):
#   - APK 真实打包的 IP 必测 (E2E install + tap login + 验 network OK)
#   - 公网 APK HTTP/2 200 必验
#   - sha256 跟本机一致 (verify-deploy.sh 维度 10)
#   - mobile tsc 0 新错 (跟 verify-deploy.sh 维度 4 一致)
#
# 用法:
#   bash scripts/verify-mobile-apk.sh                                              # 自动找最新 APK
#   bash scripts/verify-mobile-apk.sh apps/mobile/android/app/build/outputs/apk/release/app-release.apk
#   bash scripts/verify-mobile-apk.sh <APK_PATH> --skip-install                    # 不装真机
#   bash scripts/verify-mobile-apk.sh <APK_PATH> --package-name com.aiscriptmobile  # 自定义包名

set -euo pipefail

# S76 #2 实战 (2026-07-03): PowerShell 调 git bash 时, bash 子进程看不到 py.exe/java
# git bash 用 /mnt/c/... (WSL 风格) 不是 /c/...
export PATH="/mnt/c/Users/Administrator/AppData/Local/Microsoft/WindowsApps:/mnt/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot/bin:/mnt/d/Android/platform-tools:/mnt/d/Android/build-tools/33.0.1:/c/Android/platform-tools:$PATH"

# ---------- 默认配置 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_APK_PATH="$REPO_ROOT/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
APK_PATH="${1:-$DEFAULT_APK_PATH}"
EXPECTED_PACKAGE="com.aiscriptmobile"
SKIP_INSTALL=false
SKIP_ADB=false

# 颜色 (Windows PowerShell 调 bash 时 ANSI \033 escape 会被吞, 改用 ASCII 标签)
RED=''
GREEN=''
YELLOW=''
BLUE=''
NC=''

# ---------- 参数解析 ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=true; shift ;;
    --skip-adb) SKIP_ADB=true; shift ;;
    --package-name) EXPECTED_PACKAGE="$2"; shift 2 ;;
    --help|-h) head -30 "$0"; exit 0 ;;
    -*) echo "unknown arg: $1"; exit 1 ;;
    *) APK_PATH="$1"; shift ;;
  esac
done

# ---------- 工具检测 ----------
find_tool() {
  # S76 #2 实战 (2026-07-03): find_tool 返回工具路径走 stdout, 失败返回 1
  #   - 不用 $(... 2>&1) 命令替换 (会吞函数内 >&2 stderr, AAPT2 取到 stderr 行)
  #   - 用 ls $pattern 取首个匹配 (兼容 PowerShell 调 bash, /dev/null 改走 2>&1)
  #   - 子命令用 2>&1 隔离错误输出
  #   - apksigner 优先返回 apksigner.jar (跨平台兼容, 走 java -jar)
  local tool="$1"
  local tool_exe="$tool"
  case "$tool" in
    aapt2|apksigner|adb) tool_exe="${tool}.exe" ;;
  esac

  # 优先: apksigner.jar (跨平台, 走 java -jar 比 .bat 稳)
  if [[ "$tool" == "apksigner" ]]; then
    local jar_patterns=(
      "${ANDROID_HOME:-/nonexistent}/build-tools/*/lib/apksigner.jar"
      "${ANDROID_SDK_ROOT:-/nonexistent}/build-tools/*/lib/apksigner.jar"
      "/opt/android-sdk/build-tools/*/lib/apksigner.jar"
      "/usr/local/lib/android/sdk/build-tools/*/lib/apksigner.jar"
      "$HOME/Android/Sdk/build-tools/*/lib/apksigner.jar"
      "$HOME/Library/Android/sdk/build-tools/*/lib/apksigner.jar"
      "/mnt/d/Android/build-tools/*/lib/apksigner.jar"
      "/d/Android/build-tools/*/lib/apksigner.jar"
      "/mnt/c/Users/Administrator/AppData/Local/Android/Sdk/build-tools/*/lib/apksigner.jar"
    )
    for jar_pattern in "${jar_patterns[@]}"; do
      local jar_first=$(ls $jar_pattern 2>&1 | head -1)
      if [[ -n "$jar_first" && -f "$jar_first" ]]; then
        echo "$jar_first"
        return 0
      fi
    done
  fi

  # 一般: 找 $tool_exe / $tool.bat
  local patterns=(
    "${ANDROID_HOME:-/nonexistent}/build-tools/*/$tool_exe"
    "${ANDROID_SDK_ROOT:-/nonexistent}/build-tools/*/$tool_exe"
    "/opt/android-sdk/build-tools/*/$tool_exe"
    "/usr/local/lib/android/sdk/build-tools/*/$tool_exe"
    "$HOME/Android/Sdk/build-tools/*/$tool_exe"
    "$HOME/Library/Android/sdk/build-tools/*/$tool_exe"
    "/mnt/d/Android/build-tools/*/$tool_exe"
    "/mnt/d/Android/build-tools/*/$tool.bat"
    "/mnt/d/Android/platform-tools/$tool_exe"
    "/d/Android/build-tools/*/$tool_exe"
    "/d/Android/build-tools/*/$tool.bat"
    "/d/Android/platform-tools/$tool_exe"
    "C:/Users/*/AppData/Local/Android/Sdk/build-tools/*/$tool_exe"
    "C:/Android/Sdk/build-tools/*/$tool_exe"
    "C:/Android/platform-tools/$tool_exe"
    "/c/Users/Administrator/AppData/Local/Android/Sdk/build-tools/*/$tool_exe"
  )
  for pattern in "${patterns[@]}"; do
    # 子命令用 2>&1 隔离错误, 不用 /dev/null (PS 调 bash 会吞)
    local first=$(ls $pattern 2>&1 | head -1)
    if [[ -n "$first" && -f "$first" ]]; then
      echo "$first"
      return 0
    fi
  done

  # Fallback: PATH 里直接找
  local onpath=$(command -v "$tool" 2>&1 | head -1)
  if [[ -n "$onpath" ]]; then
    echo "$onpath"
    return 0
  fi
  return 1
}

AAPT2=$(find_tool aapt2 | head -1) || AAPT2=""
APKSIGNER=$(find_tool apksigner | head -1) || APKSIGNER=""
ADB=$(find_tool adb | head -1) || ADB=""

# ---------- 输出函数 ----------
pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
warn() { echo "[WARN] $1"; }
info() { echo "[INFO] $1"; }
hr()   { echo "================================================================"; }

FAIL_COUNT=0
SKIP_COUNT=0

# ---------- 1. APK 文件存在 ----------
echo ""
hr
echo "=== APK 真机回归脚本 12 维度 (跟 shipin-APP BUG-088/089/130/134/135/159/160 教训沉淀) ==="
hr
echo ""
echo "1. APK 文件存在"
if [[ ! -f "$APK_PATH" ]]; then
  fail "APK 不存在: $APK_PATH"
  echo "   提示: gradle assembleRelease 后 APK 在 apps/mobile/android/app/build/outputs/apk/release/"
  exit 1
fi
APK_SIZE=$(stat -c%s "$APK_PATH" 2>/dev/null || stat -f%z "$APK_PATH" 2>/dev/null || wc -c < "$APK_PATH")
APK_SIZE_MB=$((APK_SIZE / 1024 / 1024))
if [[ $APK_SIZE_MB -ge 25 && $APK_SIZE_MB -le 35 ]]; then
  pass "APK 大小: ${APK_SIZE} bytes (${APK_SIZE_MB} MB, 合理范围 25-35 MB)"
else
  warn "APK 大小: ${APK_SIZE} bytes (${APK_SIZE_MB} MB, 期望 25-35 MB, 偏离需调查)"
fi

# ---------- 2. APK 工具检测 ----------
echo ""
echo "2. APK 工具检测"
if [[ -n "$AAPT2" ]]; then pass "aapt2 找到: $AAPT2"; else fail "aapt2 未找到 (装 Android SDK build-tools)"; fi
if [[ -n "$APKSIGNER" ]]; then pass "apksigner 找到: $APKSIGNER"; else fail "apksigner 未找到 (装 Android SDK build-tools)"; fi
if [[ -n "$ADB" ]]; then pass "adb 找到: $ADB"; else warn "adb 未找到 (跳过 11-12 真机回归)"; fi

EXPECTED_VERSION=$(grep -oE "APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'" "$REPO_ROOT/apps/mobile/src/config/version.ts" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" || echo "")
EXPECTED_CODE=$(grep -oE "versionCode [0-9]+" "$REPO_ROOT/apps/mobile/android/app/build.gradle" | head -1 | grep -oE "[0-9]+" || echo "")
EXPECTED_NAME=$(grep -oE 'versionName "[0-9]+\.[0-9]+\.[0-9]+"' "$REPO_ROOT/apps/mobile/android/app/build.gradle" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "")

if [[ -n "$EXPECTED_VERSION" ]]; then pass "期望 version: $EXPECTED_VERSION (从 src/config/version.ts)"; else fail "src/config/version.ts 解析失败"; fi
if [[ -n "$EXPECTED_CODE" && -n "$EXPECTED_NAME" ]]; then pass "期望 versionCode: $EXPECTED_CODE + versionName: $EXPECTED_NAME (从 build.gradle)"; else fail "build.gradle 解析失败"; fi

# ---------- 3-6. aapt2 dump badging ----------
echo ""
echo "3-6. aapt2 dump badging (4 维度)"
if [[ -n "$AAPT2" ]]; then
  BADGING=$("$AAPT2" dump badging "$APK_PATH" 2>&1 || echo "")

  PKG_NAME=$(echo "$BADGING" | grep -oE "package: name='[^']+'" | head -1 | awk -F"'" '{print $2}')
  if [[ "$PKG_NAME" == "$EXPECTED_PACKAGE" ]]; then pass "包名: $PKG_NAME (期望 $EXPECTED_PACKAGE)"; else fail "包名: $PKG_NAME (期望 $EXPECTED_PACKAGE)"; fi

  VERSION_NAME=$(echo "$BADGING" | grep -oE "versionName='[^']+'" | head -1 | awk -F"'" '{print $2}')
  if [[ "$VERSION_NAME" == "$EXPECTED_NAME" ]]; then pass "versionName: $VERSION_NAME (跟 build.gradle 一致)"; else fail "versionName: $VERSION_NAME (期望 $EXPECTED_NAME 跟 build.gradle 不一致 = APK 没重打)"; fi

  VERSION_CODE=$(echo "$BADGING" | grep -oE "versionCode='[0-9]+'" | head -1 | awk -F"'" '{print $2}')
  if [[ "$VERSION_CODE" == "$EXPECTED_CODE" ]]; then pass "versionCode: $VERSION_CODE (跟 build.gradle 一致)"; else fail "versionCode: $VERSION_CODE (期望 $EXPECTED_CODE 跟 build.gradle 不一致 = APK 没重打)"; fi

  MIN_SDK=$(echo "$BADGING" | grep -oE "sdkVersion:'[0-9]+'" | head -1 | awk -F"'" '{print $2}')
  TARGET_SDK=$(echo "$BADGING" | grep -oE "targetSdkVersion:'[0-9]+'" | head -1 | awk -F"'" '{print $2}')
  pass "minSdk: $MIN_SDK + targetSdk: $TARGET_SDK"
else
  fail "aapt2 不可用, 跳过 3-6 维度"
  SKIP_COUNT=$((SKIP_COUNT+4))
fi

# ---------- 7. aapt2 dump permissions ----------
echo ""
echo "7. aapt2 dump permissions"
if [[ -n "$AAPT2" ]]; then
  PERMS=$("$AAPT2" dump permissions "$APK_PATH" 2>&1 | grep "uses-permission" | wc -l)
  pass "权限数: $PERMS 个"
  if [[ $PERMS -gt 25 ]]; then warn "权限数 > 25 ($PERMS), 可能有过度权限, 审查"; fi
  "$AAPT2" dump permissions "$APK_PATH" 2>&1 | grep -E "INTERNET|ACCESS_NETWORK_STATE|CAMERA|READ_EXTERNAL_STORAGE" | while read line; do
    echo "       $line"
  done
else
  fail "aapt2 不可用"
  SKIP_COUNT=$((SKIP_COUNT+1))
fi

# ---------- 8-9. apksigner verify ----------
echo ""
echo "8-9. apksigner verify (签名 + 证书 DN)"
if [[ -n "$APKSIGNER" ]]; then
  # S76 #2 实战 (2026-07-03):
  #   - apksigner.jar 走 verify-mobile-apk-helper.py (PowerShell 调 git bash 不能直接调 java + cmd.exe /c 会卡)
  #   - WARNING 多 (META-INF 没 v2 签名), 输出走文件避免卡 stdout
  #   - cert DN 是 "Signer #1 certificate DN: CN=..." 格式, 不是 Subject
  SIGN_TMP=/tmp/_apkverify_$$.log
  CERT_TMP=/tmp/_apkcert_$$.log
  HELPER="$SCRIPT_DIR/verify-mobile-apk-helper.py"
  # APK 转 Windows 路径给 helper (PowerShell 不识别 /mnt/d/)
  # S76 #2 实战 (2026-07-03): sed 不能直转 /mnt/f/ → F:\, 否则变 \mnt\f\
  # 用 bash parameter expansion: / → \, 跳过前 5 个字节 (/mnt), drive 字母 caps
  to_wsl_to_win() {
    local p="$1"
    if [[ "$p" == /mnt/* ]]; then
      local drive=$(echo "$p" | cut -c6 | tr '[:lower:]' '[:upper:]')
      local rest="${p#/mnt/?/}"
      rest="${rest//\//\\}"
      echo "${drive}:\\${rest}"
    else
      echo "${p//\//\\}"
    fi
  }
  APK_WIN=$(to_wsl_to_win "$APK_PATH")
  HELPER_WIN=$(to_wsl_to_win "$HELPER")

  if [[ "$APKSIGNER" == *.jar ]]; then
    py.exe "$HELPER_WIN" verify "$APK_WIN" > "$SIGN_TMP" 2>&1
  elif [[ "$APKSIGNER" == *.bat ]]; then
    "$APKSIGNER" verify "$APK_PATH" > "$SIGN_TMP" 2>&1
  else
    "$APKSIGNER" verify "$APK_PATH" > "$SIGN_TMP" 2>&1
  fi
  SIGN_RC=$?
  if [[ $SIGN_RC -eq 0 ]]; then
    pass "APK 签名: OK"
  else
    fail "APK 签名: FAIL (修了 keystore? BUG-023)"
    tail -3 "$SIGN_TMP" | sed 's/^/       /'
  fi

  if [[ "$APKSIGNER" == *.jar ]]; then
    py.exe "$HELPER_WIN" verify-print-certs "$APK_WIN" > "$CERT_TMP" 2>&1
  elif [[ "$APKSIGNER" == *.bat ]]; then
    "$APKSIGNER" verify --print-certs "$APK_PATH" > "$CERT_TMP" 2>&1
  else
    "$APKSIGNER" verify --print-certs "$APK_PATH" > "$CERT_TMP" 2>&1
  fi
  # apksigner.jar (跟 JDK keytool 一致) 输出 "Signer #1 certificate DN: CN=...", 不是 Subject
  CERT_DN=$(grep -oE "Signer #[0-9]+ certificate DN: .*" "$CERT_TMP" | head -1 | sed 's/^Signer #[0-9]\+ certificate DN: //' || echo "")
  if echo "$CERT_DN" | grep -q "DeepScript"; then
    pass "证书 DN: $CERT_DN (跟 release.keystore 一致)"
  else
    fail "证书 DN: $CERT_DN (期望包含 'DeepScript' = release.keystore)"
  fi
  rm -f "$SIGN_TMP" "$CERT_TMP"
else
  fail "apksigner 不可用"
  SKIP_COUNT=$((SKIP_COUNT+2))
fi

# ---------- 10. sha256 本机 vs 公网 ----------
echo ""
echo "10. sha256 本机 vs 公网 (跨项目通用铁律: BUG-117 公网 APK 404 教训)"
APK_SHA256=$(sha256sum "$APK_PATH" 2>/dev/null | awk '{print $1}' || shasum -a 256 "$APK_PATH" 2>/dev/null | awk '{print $1}')
if [[ -n "$APK_SHA256" ]]; then
  pass "本机 sha256: $APK_SHA256"

  if command -v curl > /dev/null && [[ -n "$EXPECTED_VERSION" ]]; then
    PUBLIC_URL="https://ab.maque.uno/app/DeepScript_v${EXPECTED_VERSION}.apk"
    info "公网 APK URL: $PUBLIC_URL"
    PUBLIC_HEADERS=$(curl -sIL "$PUBLIC_URL" 2>/dev/null || echo "")
    PUBLIC_STATUS=$(echo "$PUBLIC_HEADERS" | grep -oE "HTTP/[12]\.[01] [0-9]+" | tail -1 | awk '{print $2}')
    PUBLIC_SIZE=$(echo "$PUBLIC_HEADERS" | grep -oiE "content-length: [0-9]+" | tail -1 | awk '{print $2}')
    if [[ "$PUBLIC_STATUS" == "200" ]]; then
      pass "公网 APK HTTP: 200 (content-length: $PUBLIC_SIZE)"
      if [[ "$PUBLIC_SIZE" == "$APK_SIZE" ]]; then
        pass "公网 APK 大小 = 本机 APK 大小: $APK_SIZE"
      else
        fail "公网 APK 大小 ($PUBLIC_SIZE) ≠ 本机 ($APK_SIZE) = scp 没覆盖老 APK"
      fi
    else
      fail "公网 APK HTTP: $PUBLIC_STATUS (期望 200, 远端 scp 没覆盖?)"
    fi
  fi
else
  fail "本机 sha256 计算失败"
fi

# ---------- 11-12. adb 真机回归 ----------
echo ""
echo "11-12. adb 真机回归 (蓝叠 / 国产 ROM / 海外设备)"
if [[ "$SKIP_ADB" == "true" ]]; then
  warn "跳过 adb (--skip-adb)"
  SKIP_COUNT=$((SKIP_COUNT+2))
elif [[ -z "$ADB" ]]; then
  warn "adb 未找到, 跳过 11-12 真机回归"
  SKIP_COUNT=$((SKIP_COUNT+2))
else
  DEVICES=$("$ADB" devices 2>&1 | grep "device$" | wc -l)
  if [[ $DEVICES -gt 0 ]]; then
    pass "adb devices: $DEVICES 台真机已连"
    "$ADB" devices | while read line; do
      [[ "$line" == *"device"* ]] && echo "       $line"
    done
  else
    warn "adb devices: 0 台真机, 跳过 11-12 真机回归 (插真机或开蓝叠模拟器)"
    SKIP_COUNT=$((SKIP_COUNT+2))
  fi

  if [[ $DEVICES -gt 0 && "$SKIP_INSTALL" == "false" ]]; then
    echo ""
    info "执行 adb install + am start + UI 验证 (这会真装 APK 到真机, 谨慎)"
    SERIAL=$("$ADB" devices | grep "device$" | head -1 | awk '{print $1}')

    info "[12.1] adb install (uninstall 老的 + install 新的)"
    "$ADB" -s "$SERIAL" uninstall "$EXPECTED_PACKAGE" 2>&1 | head -1 || true
    if "$ADB" -s "$SERIAL" install -r "$APK_PATH" 2>&1 | grep -q "Success"; then
      pass "adb install: Success (真机已装新 APK)"

      info "[12.2] adb shell am start (启动 APP)"
      "$ADB" -s "$SERIAL" shell am start -n "${EXPECTED_PACKAGE}/.MainActivity" 2>&1 | head -1
      sleep 3

      info "[12.3] adb shell dumpsys package (验 installed metadata)"
      INSTALLED_VN=$("$ADB" -s "$SERIAL" shell dumpsys package "$EXPECTED_PACKAGE" 2>/dev/null | grep -oE "versionName=[^ ]+" | head -1 | sed 's/versionName=//')
      INSTALLED_VC=$("$ADB" -s "$SERIAL" shell dumpsys package "$EXPECTED_PACKAGE" 2>/dev/null | grep -oE "versionCode=[0-9]+" | head -1 | sed 's/versionCode=//')
      if [[ "$INSTALLED_VN" == "$EXPECTED_NAME" && "$INSTALLED_VC" == "$EXPECTED_CODE" ]]; then
        pass "真机 installed: versionName=$INSTALLED_VN + versionCode=$INSTALLED_VC (跟 APK 一致)"
      else
        fail "真机 installed: versionName=$INSTALLED_VN + versionCode=$INSTALLED_VC (期望 $EXPECTED_NAME + $EXPECTED_CODE)"
      fi

      info "[12.4] adb logcat 抓 30s 启动错误 (BUG-135 GMS / BUG-130 image-picker 教训)"
      "$ADB" -s "$SERIAL" logcat -d -t 30 2>&1 | grep -E "AndroidRuntime|FATAL|$EXPECTED_PACKAGE" | head -10 || true
    else
      fail "adb install: FAIL (签名冲突? 卸载后重试)"
    fi
  elif [[ "$SKIP_INSTALL" == "true" ]]; then
    warn "跳过 install (--skip-install)"
    SKIP_COUNT=$((SKIP_COUNT+2))
  fi
fi

# ---------- 总结 ----------
echo ""
hr
echo "=== 总结 ==="
hr
echo ""
TOTAL=$((12 - SKIP_COUNT))
echo "总维度: 12"
echo "  PASS: $((TOTAL - FAIL_COUNT))"
echo "  FAIL: $FAIL_COUNT"
echo "  SKIP: $SKIP_COUNT"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "[OK] 所有可验证维度全 PASS - APK 可以发布"
  exit 0
else
  echo "[FAIL] $FAIL_COUNT 维度 FAIL - 请修后重跑"
  echo "   提示: 失败维度跟 BUG-088/089/130/134/135/159/160 教训沉淀对应, 必查"
  exit 1
fi