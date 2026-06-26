"""铁律 6 自检: 验证 N 个 commit subject 含 BUG 编号 (AGENTS.md § 4 铁律 6 强制)

用法:
  python3 tools/check-commit-message.py           # 默认看最近 5 commit
  python3 tools/check-commit-message.py 10         # 看最近 10 commit
  python3 tools/check-commit-message.py 1         # 看最近 1 commit (commit 前自检)

退出码:
  0 = 全部 PASS
  1 = 有 FAIL (有 commit subject 缺 BUG 编号)

S72 batch 6 BUG-091 沉淀 (2026-06-26): commit a5ae183 subject 缺 BUG 编号
  (虽然 body 有 Refs: BUG-079, BUG-083, BUG-090, 但 body 不算,
   subject 是 git log --oneline 跟 GitHub PR 标题唯一必现的字段)
"""
import subprocess
import re
import sys

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
result = subprocess.run(
    ["git", "log", f"-{N}", "--pretty=format:%h | %s"],
    capture_output=True, text=True
)
commits = [c.strip() for c in result.stdout.strip().split("\n") if c.strip()]

# 匹配规则: subject 含 BUG-NNN (3 位以上数字) OR 含 "规范修订" 字样
bug_pat = re.compile(r"BUG-\d{3,}")
standard_pat = re.compile(r"规范修订|规范更新|docs:|规范:")

print(f"=== 铁律 6 自检: 最近 {N} commit message subject ===")
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
