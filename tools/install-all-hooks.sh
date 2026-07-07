#!/bin/bash
# 🆕 2026-07-07 S84: 一键装 shipin-APP 项目所有 git hooks (项目宪法 RELEASE_CHECKLIST.md § 6 配套)
#
# 装: bash tools/install-all-hooks.sh
# 卸: rm .git/hooks/commit-msg .git/hooks/pre-push
# 验: ls -la .git/hooks/commit-msg .git/hooks/pre-push
#
# 装后 hooks 自动拦截:
# 1. commit-msg: commit message 必带 vX.Y.Z: 前缀 + 必含 BUG-NNN / 规范修订 (AGENTS.md § 4 铁律 6)
# 2. pre-push: 自动跑 tools/verify-version-8-points.js, 8 处版本号不一致必 reject (AGENTS.md § 4 铁律 3)
#
# 实战教训:
# - v3.0.99 BUG-176 实战违反"server 改动必走 deploy.sh"纪律 (绕过所有自动防线)
# - v3.0.93 修法 2 + S72 batch 6 BUG-091 + S72 batch 7 BUG-093: pre-commit hook + commit message 检查
# - 🆕 v3.0.100 BUG-177: 加 pre-push hook 跑 verify-version-8-points.js, 推出前必查 8 处同步
# - 跨项目通用铁律 #36 (纸上铁律 + 执行纪律缺一不可): 装 hooks 是机制强制, 不依赖 AI 自觉

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
GITHOOKS_DIR="$REPO_ROOT/.githooks"

echo "=== shipin-APP git hooks 一键安装器 (RELEASE_CHECKLIST.md § 6 配套) ==="
echo "REPO_ROOT: $REPO_ROOT"
echo "HOOKS_DIR: $HOOKS_DIR"
echo "GITHOOKS_DIR: $GITHOOKS_DIR"
echo ""

if [ ! -d "$REPO_ROOT" ]; then
  echo "❌ 没在 git repo 根目录跑, 请 cd 到项目根目录再跑"
  exit 1
fi

# ═══════════════════════════════════════════════════════════
# Hook 1: commit-msg
# 作用: 拦截 commit message 缺 BUG-NNN 或 "规范修订" 字样 (AGENTS.md § 4 铁律 6)
# ═══════════════════════════════════════════════════════════
COMMIT_MSG_HOOK="$HOOKS_DIR/commit-msg"
echo ">>> [1/2] 装 commit-msg hook..."
cat > "$COMMIT_MSG_HOOK" << 'HOOK_EOF'
#!/bin/sh
# pre-commit hook: 拦截 commit message 不含 BUG 编号 (AGENTS.md § 4 铁律 6 + v3.0.93 沉淀)
# 配套: tools/check-commit-message.py 1 unstaged 模式
# 装法: bash tools/install-all-hooks.sh
# 卸法: rm .git/hooks/commit-msg
COMMIT_MSG_FILE="$1"
if [ -f "$COMMIT_MSG_FILE" ]; then
  MSG=$(head -1 "$COMMIT_MSG_FILE")
  # 检查 1: 必带 vX.Y.Z 前缀 (跨端铁律 6 + 实战必做)
  if ! echo "$MSG" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+'; then
    echo ""
    echo "❌ commit message 第一行必带 'vX.Y.Z' 前缀 (例如 'v3.0.101: <改动>')"
    echo "   看到你的 message: $MSG"
    echo "   正确格式: git commit -m 'vX.Y.Z: <改动描述> (BUG-NNN + 规范修订)'"
    echo "   (跨端铁律 6, AGENTS.md § 4, 跟 DEPLOY_CHECKLIST.md § 6 配套)"
    echo ""
    exit 1
  fi
  # 检查 2: 必含 BUG-NNN 或 '规范修订' / '规范更新' (AGENTS.md § 4 铁律 6)
  python3 tools/check-commit-message.py 1 unstaged <<< "$MSG" || {
    echo ""
    echo "❌ commit message 必含 BUG-NNN 或 '规范修订' 字样 (AGENTS.md § 4 铁律 6)"
    echo "   正确格式: vX.Y.Z: <改动描述> (BUG-NNN + 规范修订)"
    exit 1
  }
fi
HOOK_EOF
chmod +x "$COMMIT_MSG_HOOK"
echo "  ✓ $COMMIT_MSG_HOOK (-rwxr-xr-x)"

# ═══════════════════════════════════════════════════════════
# Hook 2: pre-push
# 作用: 自动跑 verify-version-8-points.js, 8 处不一致必 reject
# ═══════════════════════════════════════════════════════════
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"
echo ">>> [2/2] 装 pre-push hook..."
cat > "$PRE_PUSH_HOOK" << 'HOOK_EOF'
#!/bin/sh
# pre-push hook: 自动跑 verify-version-8-points.js 8 处版本号同步自检
# 🆕 2026-07-07 S84 (v3.0.100 BUG-177 后续): 加 pre-push (项目宪法 RELEASE_CHECKLIST.md § 6 配套)
#
# 实战教训: v3.0.99 BUG-176 实战违反 - server 改动没 bump mobile version.ts + 没 rebuild APK
# 修法: pre-push 自动跑 verify-version-8-points.js, 8 处不一致必 reject
#
# 装法: bash tools/install-all-hooks.sh
# 卸法: rm .git/hooks/pre-push

# 读当前 package.json 的 version (作为本次发布的目标)
if [ ! -f "apps/server/package.json" ]; then
  echo "⚠️ apps/server/package.json 不存在, 跳过 pre-push 检查 (不在 shipin-APP 项目根)"
  exit 0
fi

NEW_VERSION=$(python3 -c "import json; print(json.load(open('apps/server/package.json'))['version'])" 2>/dev/null || echo "")
if [ -z "$NEW_VERSION" ]; then
  echo "⚠️ 读 version 失败, 跳过 pre-push 检查"
  exit 0
fi

echo ""
echo ">>> [pre-push] 跑 verify-version-8-points.js $NEW_VERSION..."
echo "═══════════════════════════════════════════════════════════════"

# 跑 verify-version-8-points.js (允许没有 ssh key [本地跑 6 处 + changelog])
node tools/verify-version-8-points.js "$NEW_VERSION"
RC=$?

echo "═══════════════════════════════════════════════════════════════"
if [ $RC -ne 0 ]; then
  echo ""
  echo "❌ verify-version-8-points.js FAIL (rc=$RC)"
  echo "   8 处版本号不同步, 禁止 push"
  echo "   排查: 必跑 RELEASE_CHECKLIST.md § 4 8 处同步清单"
  echo "   修法: 改对应文件 + 重跑 'node tools/verify-version-8-points.js $NEW_VERSION' 直到 PASS"
  echo ""
  exit 1
fi
echo ""
echo "✓ pre-push check PASS (8 处版本号同步 $NEW_VERSION)"
echo "═══════════════════════════════════════════════════════════════"
echo ""
exit 0
HOOK_EOF
chmod +x "$PRE_PUSH_HOOK"
echo "  ✓ $PRE_PUSH_HOOK (-rwxr-xr-x)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ 所有 hooks 装好"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "已装 hooks:"
ls -la "$HOOKS_DIR/commit-msg" "$HOOKS_DIR/pre-push" 2>&1 | grep -v sample
echo ""
echo "试一下:"
echo "  git commit -m 'v3.0.101: 测试 (BUG-XXX)'   # 期望 ✓ (带 vX.Y.Z + BUG)"
echo "  git commit -m 'invalid'                  # 期望 ❌ (commit-msg hook reject)"
echo "  git push origin main                      # 期望 ✓ (pre-push 跑 verify-version-8-points.js PASS)"
echo ""
echo "卸载: rm $HOOKS_DIR/commit-msg $HOOKS_DIR/pre-push"
echo ""
