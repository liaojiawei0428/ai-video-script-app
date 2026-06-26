#!/bin/bash
# BUG-093 修法 3: pre-commit hook 安装脚本 (跨项目通用, 跟 BUG-082 铁律 8 配套)
# 装: bash tools/install-pre-commit-hook.sh
# 卸: rm .git/hooks/pre-commit
set -e
HOOK_FILE=".git/hooks/pre-commit"
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# pre-commit hook: 拦截 commit message 不含 BUG 编号 (AGENTS.md § 4 铁律 6)
# 配套: tools/check-commit-message.py 1 unstaged 模式
COMMIT_MSG_FILE="$1"
if [ -f "$COMMIT_MSG_FILE" ]; then
  MSG=$(head -1 "$COMMIT_MSG_FILE")
  python3 tools/check-commit-message.py 1 unstaged <<< "$MSG" || exit 1
fi
EOF
chmod +x "$HOOK_FILE"
echo "✅ pre-commit hook installed: $HOOK_FILE"
echo "   卸载: rm $HOOK_FILE"
