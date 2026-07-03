#!/usr/bin/env bash
# S75 v3.0.84 commit + push wrapper
set -e
cd "/mnt/f/QiTa/banmu/APP/ai-video-script-app"

# 先把 commit msg 写到文件 (避免命令行引号问题)
cat > /tmp/s75_commit_msg.txt << 'EOF'
v3.0.84: S75 修方向 [Web 为主体, APP 跟随 Web] + #1-#3 收口 (husky hook + AGENTS.md v2.20 + verify-mobile-apk.sh) (BUG-162)

按 2026-07-03 user 明确纠正方向:
- Web 为主体, APP 跟随 Web 端更新完善 (S72 batch 7 规范反转, 2026-06-26 user 早就明确)
- S74 O 任务盘点方向反了, S75 v1.0 重做

3 修 (方向纠正):
1. tools/web_vs_mobile_GAP.md S75 v1.0 重写 - 拿 web 端 27 page 当唯一基准, 盘点结论: 无必修 GAP
2. HANDOVER.md § 9 O 任务描述 + 下一步候选段 - 改回 Web 主体方向
3. docs/BUGS_INDEX.md BUG-161 行 + 跨项目通用铁律 ⑦ - 改方向描述

3 交付 (S75 #1-#3 实战):
1. S75 #1 .husky/commit-msg hook 集成 check-commit-message.py - husky 9 新版机制, 兼容 Windows PowerShell 调 bash, 测试通过 (无 BUG 编号被拦 + 含 BUG-161 通过)
2. S75 #2 AGENTS.md § 4 v2.18 → v2.20 加 4 个新铁律 10/11/12/13 (S73 § 5.10 沉淀的 ~30 条新铁律 1:1 镜像)
3. S75 #3 scripts/verify-mobile-apk.sh 实战 - 修 4 个 bug (CRLF → LF / 中文括号 → 方括号 / ANSI → ASCII / sed → awk), 脚本语法 OK + 工具检测到位 + APK 缺失正确 fail

9 处版本号同步 v3.0.83 → v3.0.84

跨项目通用铁律 7 条新增 (跟 S73 BUG-148-152 1:1 镜像):
① Web 主体, APP 跟随 (S72 batch 7 规范反转, 跨端铁律 4++)
② 跨端 GAP 盘点方向 = web 端当基准 (S75 v1.0 实战沉淀)
③ 盘点结论分 3 类 (无 GAP / 平台差异 / 待 grep)
④ 跨端铁律 4++ 5 步同步 SOP 强制落地
⑤ 修一处必 grep 另一端
⑥ Windows PowerShell 调 bash 时 ANSI 必被吞 (跨项目通用铁律 #16 实战)
⑦ Windows PowerShell 写入 .sh 必 CRLF → LF (跨项目通用铁律 #17 实战)
EOF

git add -A
git commit -F /tmp/s75_commit_msg.txt
echo "---"
git log --oneline -3
echo "---"
git push origin main