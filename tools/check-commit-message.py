"""铁律 6 自检: 验证 N 个 commit subject 含 BUG 编号 (AGENTS.md § 4 铁律 6 强制)

用法:
  python3 tools/check-commit-message.py           # 默认看最近 10 commit
  python3 tools/check-commit-message.py 10         # 看最近 10 commit
  python3 tools/check-commit-message.py 1         # 看最近 1 commit (commit 前自检)
  python3 tools/check-commit-message.py 1 unstaged  # 看当前 staged commit (commit-message-file 模式, hook 用)
  python3 tools/check-commit-message.py 10 upstream  # 看 origin/main..HEAD 未 push (本地 dev)

退出码:
  0 = 全部 PASS
  1 = 有 FAIL (有 commit subject 缺 BUG 编号)

S72 batch 6 BUG-091 沉淀 (2026-06-26): commit a5ae183 subject 缺 BUG 编号
S72 batch 7 BUG-093 沉淀 (2026-06-26): commit `659025d`+`7e823ac` 缺 BUG 编号
S72 batch 7 BUG-093 修法 2 (2026-06-26 升 N 5→10 + 加 unstaged/upstream 子模式)
  - 默认 N 5→10 (覆盖更多历史 commit)
  - 加 `git log origin/main..HEAD` upstream 模式 (本地 dev 也能 catch)
  - 加 `unstaged` 模式 (从 stdin 读 commit message, pre-commit hook 配套)

S72 batch 7 BUG-093 修法 3 (2026-06-26 配套 pre-commit hook):
  新建 .git/hooks/pre-commit (5 行 bash) + tools/install-pre-commit-hook.sh (1 行安装)
  拦截无 BUG 编号 commit (跟 BUG-082 铁律 8 配套, 跨项目通用 AI 行为合规)
"""
import subprocess
import re
import sys

# 1) unstaged 模式: 从 stdin 读 commit message (pre-commit hook 配套)
if len(sys.argv) >= 3 and sys.argv[2] == "unstaged":
    msg = sys.stdin.read().strip()
    bug_pat = re.compile(r"BUG-\d{3,}|规范修订|规范更新|规范:|docs:")
    if not bug_pat.search(msg):
        print(f"❌ commit message 缺 BUG 编号或规范修订字样")
        print(f"   subject: {msg[:80]}")
        print(f"   修法: 改 subject 包含 'BUG-NNN' (3 位以上数字) 或 '规范修订' 字样")
        print(f"   格式: vX.Y.Z: <改动> (BUG-NNN + 规范修订)")
        sys.exit(1)
    else:
        print(f"✅ commit message 含 BUG 编号或规范修订字样, 铁律 6 合规")
        sys.exit(0)

# 2) upstream 模式: 看 origin/main..HEAD 未 push commit
if len(sys.argv) >= 3 and sys.argv[2] == "upstream":
    range_arg = "origin/main..HEAD"
    print(f"=== 铁律 6 自检: 未 push commit (origin/main..HEAD) ===")
else:
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 10  # S72 batch 7 BUG-093 修法 2: 默认 N 5→10
    range_arg = f"-{N}"
    print(f"=== 铁律 6 自检: 最近 {N} commit message subject ===")

# 3) 通用 git log 模式
result = subprocess.run(
    ["git", "log", range_arg, "--pretty=format:%h | %s"],
    capture_output=True, text=True
)
commits = [c.strip() for c in result.stdout.strip().split("\n") if c.strip()]

# 匹配规则: subject 含 BUG-NNN (3 位以上数字) OR 含 "规范修订" 字样 (跟现有逻辑一致)
bug_pat = re.compile(r"BUG-\d{3,}")
standard_pat = re.compile(r"规范修订|规范更新|docs:|规范:")

print(f"{'状态':6} {'commit':10} subject")
print("-" * 100)

fail_count = 0
for c in commits:
    if " | " not in c:
        continue
    h, msg = c.split(" | ", 1)
    has_bug = bool(bug_pat.search(msg))
    has_standard = bool(standard_pat.search(msg))
    ok = has_bug or has_standard
    status = "✓" if ok else "❌"
    if not ok:
        fail_count += 1
    print(f"{status:6} {h:10} {msg[:90]}")

print()
print(f"PASS={len(commits) - fail_count} / FAIL={fail_count} / TOTAL={len(commits)}")

if fail_count:
    print()
    print("❌ 检测到违规 commit (subject 缺 BUG 编号):")
    print("   - 跟 AGENTS.md § 4 铁律 6 冲突")
    print("   - 修法: git commit --amend -m 'vX.Y.Z: <改动> (BUG-NNN + 规范修订)' (新 commit)")
    print("   - 沉淀: 写 BUG-NNN 段到 apps/mobile/BUGS.md 永久记录")
    sys.exit(1)
else:
    print("✅ 所有 commit subject 含 BUG 编号或规范修订字样, 铁律 6 合规")
    sys.exit(0)
