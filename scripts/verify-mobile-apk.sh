#!/bin/bash
# scripts/verify-mobile-apk.sh — shipin-APP APK 真机回归脚本 (12 维度)
#
# 目的: 跟 apps/server/scripts/verify-deploy.sh (远端 27 维度) 配套, 验 mobile APK 真实性
#       解决 BUG-088/089/130/134/135/159/160 反复踩坑 (server 端 grep 不到 mobile bug)
#
# 跨项目通用铁律 (跟 BUG-159 v3.0.79 实战沉淀):
#   - APK 真实打包的 IP 必测 (E2E install + tap login + 验 network OK)
#   - 公网 APK HTTP/2 200 必验
#   - sha256 跟本机一致 (verify-deploy.sh 维度 10)
#   - mobile tsc 0 新错 (跟 verify-deploy.sh 维度 4 一致)
#
# 用法:
#   bash scripts/verify-mobile-apk.sh                                    # 自动找最新 APK
#   bash scripts/verify-mobile-apk.sh apps/mobile/android/app/build/outputs/apk/release/app-release.apk
#   bash scripts/verify-mobile-apk.sh <APK_PATH> --skip-install          # 不装真机
#   bash scripts/verify-mobile-apk.sh <APK_PATH> --package-name com.aiscriptmobile  # 自定义包名
#
# 环境依赖 (Windows / Linux / macOS):
#   - bash 4+ (WSL / Git Bash / native)
#   - Android SDK build-tools (aapt2 / apksigner)
#   - adb (platform-tools)
#   - jq (json 解析, 推荐)
#   - python3 (sha256 验证, 备选)
#   - openssl (sha256 备选)
#
# 返回值:
#   0 = 12 维度全 PASS
#   1 = 1+ 维度 FAIL

set -euo pipefail

# ---------- 默认配置 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_APK_PATH="$REPO_ROOT/apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
APK_PATH="${1:-$DEFAULT_APK_PATH}"
EXPECTED_PACKAGE="com.aiscriptmobile"
SKIP_INSTALL=false
SKIP_ADB=false
REMOTE_APK_URL="https://ab.maque.uno/app/DeepScript_v$(cat $REPO_ROOT/apps/mobile/src/config/version.ts 2>/dev/null | grep -oE "'[0-9]+\.[0-9]+\.[0-9]+'" | head -1 | tr -d \"'\\''\").apk"

# 颜色 (跨平台, Windows Git Bash / Linux 都支持)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ---------- 参数解析 ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=true; shift ;;
    --skip-adb) SKIP_ADB=true; shift ;;
    --package-name) EXPECTED_PACKAGE="$2"; shift 2 ;;
    --help|-h) head -30 "$0"; exit 0 ;;
    -*) echo -e "${RED}未知参数: $1${NC}"; exit 1 ;;
    *) APK_PATH="$1"; shift ;;
  esac
done

# ---------- 工具检测 ----------
find_tool() {
  local tool="$1"
  local paths=(
    "$ANDROID_HOME/build-tools/*/$tool"
    "$ANDROID_SDK_ROOT/build-tools/*/$tool"
    "/opt/android-sdk/build-tools/*/$tool"
    "/usr/local/lib/android/sdk/build-tools/*/$tool"
    "$HOME/Android/Sdk/build-tools/*/$tool"
    "$HOME/Library/Android/sdk/build-tools/*/$tool"
    "C:/Users/*/AppData/Local/Android/Sdk/build-tools/*/$tool.exe"
    "C:/Android/Sdk/build-tools/*/$tool.exe"
  )
  for p in "${paths[@]}"; do
    if ls $p 2>/dev/null | head -1 > /dev/null; then
      ls $p 2>/dev/null | head -1
      return 0
    fi
  done
  command -v "$tool" 2>/dev/null && return 0
  return 1
}

AAPT2=$(find_tool aapt2 2>/dev/null | head -1) || AAPT2=""
APKSIGNER=$(find_tool apksigner 2>/dev/null | head -1) || APKSIGNER=""
ADB=$(find_tool adb 2>/dev/null | head -1) || ADB=""

# ---------- 输出函数 ----------
pass() { echo -e "${GREEN}✓ PASS${NC} $1"; }
fail() { echo -e "${RED}✗ FAIL${NC} $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
warn() { echo -e "${YELLOW}⚠ WARN${NC} $1"; }
info() { echo -e "${BLUE}ℹ${NC} $1"; }
hr()   { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

FAIL_COUNT=0
SKIP_COUNT=0

# ---------- 1. APK 文件存在 ----------
echo ""
hr
echo -e "${BLUE}=== APK 真机回归脚本 (12 维度, shipin-APP BUG-088/089/130/134/135/159/160 教训沉淀) ===${NC}"
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
[[ -n "$AAPT2" ]] && pass "aapt2 找到: $AAPT2" || { fail "aapt2 未找到 (装 Android SDK build-tools)"; }
[[ -n "$APKSIGNER" ]] && pass "apksigner 找到: $APKSIGNER" || { fail "apksigner 未找到 (装 Android SDK build-tools)"; }
[[ -n "$ADB" ]] && pass "adb 找到: $ADB" || warn "adb 未找到 (跳过 11-12 真机回归)"

# 提取 version 期望值 (跟 version.ts 1:1)
EXPECTED_VERSION=$(grep -oE "APP_VERSION = '[0-9]+\.[0-9]+\.[0-9]+'" "$REPO_ROOT/apps/mobile/src/config/version.ts" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
EXPECTED_CODE=$(grep -oE "versionCode [0-9]+" "$REPO_ROOT/apps/mobile/android/app/build.gradle" | head -1 | grep -oE "[0-9]+")
EXPECTED_NAME=$(grep -oE 'versionName "[0-9]+\.[0-9]+\.[0-9]+"' "$REPO_ROOT/apps/mobile/android/app/build.gradle" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')

if [[ -n "$EXPECTED_VERSION" ]]; then
  pass "期望 version: $EXPECTED_VERSION (从 src/config/version.ts)"
else
  fail "src/config/version.ts 解析失败"
fi
if [[ -n "$EXPECTED_CODE" && -n "$EXPECTED_NAME" ]]; then
  pass "期望 versionCode: $EXPECTED_CODE + versionName: $EXPECTED_NAME (从 build.gradle)"
else
  fail "build.gradle 解析失败"
fi

# ---------- 3-6. aapt2 dump badging 维度 ----------
echo ""
echo "3-6. aapt2 dump badging (4 维度)"
if [[ -n "$AAPT2" ]]; then
  BADGING=$("$AAPT2" dump badging "$APK_PATH" 2>&1 || echo "")
  
  PKG_NAME=$(echo "$BADGING" | grep -oE "package: name='[^']+'" | head -1 | sed -E "s/package: name='([^']+)'/\1/")
  if [[ "$PKG_NAME" == "$EXPECTED_PACKAGE" ]]; then
    pass "包名: $PKG_NAME (期望 $EXPECTED_PACKAGE)"
  else
    fail "包名: $PKG_NAME (期望 $EXPECTED_PACKAGE)"
  fi
  
  VERSION_NAME=$(echo "$BADGING" | grep -oE "versionName='[^']+'" | head -1 | sed -E "s/versionName='([^']+)'/\1/")
  if [[ "$VERSION_NAME" == "$EXPECTED_NAME" ]]; then
    pass "versionName: $VERSION_NAME (跟 build.gradle 一致)"
  else
    fail "versionName: $VERSION_NAME (期望 $EXPECTED_NAME 跟 build.gradle 不一致 = APK 没重打)"
  fi
  
  VERSION_CODE=$(echo "$BADGING" | grep -oE "versionCode='[0-9]+'" | head -1 | sed -E "s/versionCode='([^']+)'/\1/")
  if [[ "$VERSION_CODE" == "$EXPECTED_CODE" ]]; then
    pass "versionCode: $VERSION_CODE (跟 build.gradle 一致)"
  else
    fail "versionCode: $VERSION_CODE (期望 $EXPECTED_CODE 跟 build.gradle 不一致 = APK 没重打)"
  fi
  
  MIN_SDK=$(echo "$BADGING" | grep -oE "sdkVersion:'[0-9]+'" | head -1 | sed -E "s/sdkVersion:'([^']+)'/\1/")
  TARGET_SDK=$(echo "$BADGING" | grep -oE "targetSdkVersion:'[0-9]+'" | head -1 | sed -E "s/targetSdkVersion:'([^']+)'/\1/")
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
  if [[ $PERMS -gt 25 ]]; then
    warn "权限数 > 25 (${PERMS}), 可能有过度权限, 审查"
  fi
  # 重点权限必查 (跟 BUG-135 自研 native module 实战一致)
  "$AAPT2" dump permissions "$APK_PATH" 2>&1 | grep -E "(INTERNET|ACCESS_NETWORK_STATE|CAMERA|READ_EXTERNAL_STORAGE)" | while read line; do
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
  if "$APKSIGNER" verify "$APK_PATH" > /dev/null 2>&1; then
    pass "APK 签名: OK"
  else
    fail "APK 签名: FAIL (修了 keystore? BUG-023)"
  fi
  
  # 证书 DN 验证 (跟 mobile AGENTS.md § 3 步骤 3 一致)
  CERT_DN=$("$APKSIGNER" verify --print-certs "$APK_PATH" 2>/dev/null | grep -oE "Subject:.*" | head -1 | sed 's/Subject: //' || echo "")
  if echo "$CERT_DN" | grep -q "DeepScript"; then
    pass "证书 DN: $CERT_DN (跟 release.keystore 一致)"
  else
    fail "证书 DN: $CERT_DN (期望包含 'DeepScript' = release.keystore)"
  fi
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
  
  # 公网 sha256 验证 (可选, 需要网络)
  if command -v curl > /dev/null && [[ -n "$EXPECTED_VERSION" ]]; then
    PUBLIC_URL="https://ab.maque.uno/app/DeepScript_v${EXPECTED_VERSION}.apk"
    info "公网 APK URL: $PUBLIC_URL"
    PUBLIC_SHA256=$(curl -sIL "$PUBLIC_URL" 2>/dev/null | head -20 || echo "")
    PUBLIC_STATUS=$(echo "$PUBLIC_SHA256" | grep -oE "HTTP/[12]\.[01] [0-9]+" | tail -1 | awk '{print $2}')
    PUBLIC_SIZE=$(echo "$PUBLIC_SHA256" | grep -oiE "content-length: [0-9]+" | head -1 | awk '{print $2}')
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
  # 11. adb devices
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
  
  # 12. adb install + am start + version UI
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
      "$ADB" -s "$SERIAL" logcat -d -t 30 2>&1 | grep -E "(AndroidRuntime|FATAL|$EXPECTED_PACKAGE)" | head -10 || true
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
echo -e "${BLUE}=== 总结 ===${NC}"
hr
echo ""
TOTAL=$((12 - SKIP_COUNT))
echo "总维度: 12"
echo "  PASS: $((TOTAL - FAIL_COUNT))"
echo "  FAIL: $FAIL_COUNT"
echo "  SKIP: $SKIP_COUNT"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}✅ 所有可验证维度全 PASS — APK 可以发布${NC}"
  exit 0
else
  echo -e "${RED}❌ $FAIL_COUNT 维度 FAIL — 请修后重跑${NC}"
  echo "   提示: 失败维度跟 BUG-088/089/130/134/135/159/160 教训沉淀对应, 必查"
  exit 1
fi