#!/usr/bin/env python3
"""
tools/bump-version.py — shipin-APP 一键发版脚本 (v3.0.83 沉淀)

> 跨端铁律 3 强化版 (AGENTS.md § 4): 改 1 处版本号必同步 9 处 (本地 8 文件 + changelog).
> 跨项目通用铁律 (跨项目通用铁律 14): 大规模清理必 dryrun.
> 跨项目通用铁律 (跨项目通用铁律 6): commit message 必带版本号 + BUG 编号.

【9 处同步清单】 (跟 S73 v3.0.82 highlights 实战 1:1)
1. apps/server/package.json (version field)
2. apps/server/src/index.ts (APP_VERSION fallback 字符串)
3. apps/server/ecosystem.config.js (env.APP_VERSION)
4. apps/server/ecosystem.config.js (env_production.APP_VERSION)
5. apps/server/changelog.json (latest_version + latest_version_time + entries[0])
6. apps/mobile/src/config/version.ts (APP_VERSION)
7. apps/mobile/android/app/build.gradle (versionCode + versionName)
8. apps/web/src/config/version.ts (APP_VERSION + APP_VERSION_CODE)

【远端 2 处】 (deploy.sh 自动同步, 不在脚本里直改)
+ /www/wwwroot/shipin-APP/.env APP_VERSION
+ /etc/systemd/system/shipin-app.service Environment=APP_VERSION

【用法】
  python tools/bump-version.py --patch                       # 自动 +0.0.1 (3.0.82 → 3.0.83)
  python tools/bump-version.py --minor                       # 自动 +0.1 (3.0.82 → 3.1.0)
  python tools/bump-version.py --major                       # 自动 +1 (3.0.82 → 4.0.0)
  python tools/bump-version.py --version 3.0.83              # 显式指定
  python tools/bump-version.py --patch --summary "BUG-160 ..." --highlights "a|b|c"
  python tools/bump-version.py --patch --commit              # 顺便 git commit + push
  python tools/bump-version.py --apply                       # 默认 dryrun, --apply 才真改
  python tools/bump-version.py --rollback                    # 撤回 .bak 备份

【典型发版流程】
  1. python tools/bump-version.py --patch                    # dryrun 预览改了什么
  2. python tools/bump-version.py --patch --apply            # 真改 8 文件 + 1 changelog entry
  3. python tools/bump-version.py --verify                   # 跑 verify-version-8-points.js
  4. git add + git commit + git push
  5. (远端) bash apps/server/deploy.sh --skip-maintenance    # 系统自动同步 .env + systemd unit
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# CST 时区 (跟 apps/server/changelog.json buildDate 格式一致)
CST = timezone(timedelta(hours=8))
TODAY = datetime.now(CST).strftime('%Y-%m-%d')

REPO_ROOT = Path(__file__).resolve().parent.parent  # tools/ → repo root

# ---------- 9 个文件定义 ----------

FILES = [
    {
        'id': 'server.package',
        'path': 'apps/server/package.json',
        'pattern': r'"version"\s*:\s*"(\d+\.\d+\.\d+)"',
        'replacement': lambda old, new: f'"version": "{new}"',
    },
    {
        'id': 'server.index_fallback',
        'path': 'apps/server/src/index.ts',
        'pattern': r"(APP_VERSION.*?fallback.*?'|fallback.*?')\s*(\d+\.\d+\.\d+)\s*'",
        # 修法 1: 强 pattern (有 fallback 注释的行); 修法 2: 兜底 pattern (任何 '3.0.XX' 字符串) — 由 do_bump 决定
        'replacement': lambda old, new: lambda m: m.group(0).replace(old, new),
        'multi_match': True,
        'comment': "fallback '3.0.XX' string (匹配 APP_VERSION fallback 默认值)",
    },
    {
        'id': 'server.eco_env',
        'path': 'apps/server/ecosystem.config.js',
        'pattern': r"APP_VERSION:\s*'(\d+\.\d+\.\d+)'",
        'replacement': lambda old, new: f"APP_VERSION: '{new}'",
        'multi_match': True,
        'comment': "env + env_production 2 处 (PM2 部署, S70 起 deprecated 但 ecosystem 仍保留)",
    },
    {
        'id': 'mobile.version_ts',
        'path': 'apps/mobile/src/config/version.ts',
        'pattern': r"export const APP_VERSION\s*=\s*'(\d+\.\d+\.\d+)'",
        'replacement': lambda old, new: f"export const APP_VERSION = '{new}'",
    },
    {
        'id': 'mobile.build_gradle',
        'path': 'apps/mobile/android/app/build.gradle',
        'pattern': r'(versionCode\s+)(\d+)(\s*\n\s*versionName\s+")(\d+\.\d+\.\d+)(")',
        'replacement': None,  # 特殊处理: versionCode + versionName 同步, versionCode = old +1
        'multi_match': False,
        'comment': "build.gradle versionCode + versionName 必同步, versionCode 自动 +1",
    },
    {
        'id': 'web.version_ts',
        'path': 'apps/web/src/config/version.ts',
        'pattern': r"export const APP_VERSION\s*=\s*'(\d+\.\d+\.\d+)'",
        'replacement': lambda old, new: f"export const APP_VERSION = '{new}'",
    },
    {
        'id': 'web.version_ts_code',
        'path': 'apps/web/src/config/version.ts',
        'pattern': r"export const APP_VERSION_CODE\s*=\s*(\d+)",
        'replacement': None,  # 特殊处理: 自动 +1 跟 versionCode 同步
        'comment': "APP_VERSION_CODE = mobile build.gradle versionCode (跨端 1:1 镜像)",
    },
]

# server ecosystem.config.js 特殊处理 (2 处: env + env_production)
ECO_ENV_FILES_PATTERN = re.compile(
    r"(env\s*:\s*\{[^}]*APP_VERSION:\s*')(\d+\.\d+\.\d+)(')"
    r"|(env_production\s*:\s*\{[^}]*APP_VERSION:\s*')(\d+\.\d+\.\d+)(')",
    re.DOTALL,
)

# changelog.json 特殊处理 (顶层 latest_version + latest_version_time + entries[0])
CHANGELOG_PATH = 'apps/server/changelog.json'


def detect_current_version():
    """从 apps/server/package.json 检测当前版本"""
    pkg_path = REPO_ROOT / 'apps' / 'server' / 'package.json'
    # 跨项目通用铁律 #15: 兼容 UTF-8 BOM (PowerShell Edit 工具会写 BOM, BUG-130 hotfix 实战)
    with open(pkg_path, encoding='utf-8-sig') as f:
        pkg = json.load(f)
    v = pkg.get('version', '')
    if not re.match(r'^\d+\.\d+\.\d+$', v):
        die(f"package.json version 格式错: {v!r}")
    return v


def bump_version(current, mode, explicit=None):
    """根据 mode 返回新版本号"""
    if explicit:
        if not re.match(r'^\d+\.\d+\.\d+$', explicit):
            die(f"--version 参数格式错: {explicit!r} (期望 X.Y.Z)")
        return explicit
    major, minor, patch = map(int, current.split('.'))
    if mode == 'patch':
        return f'{major}.{minor}.{patch + 1}'
    if mode == 'minor':
        return f'{major}.{minor + 1}.0'
    if mode == 'major':
        return f'{major + 1}.0.0'
    die(f"未知 mode: {mode}")


def calc_new_version_code(old_version_code, new_version):
    """新 APP_VERSION_CODE = 旧 +1 (跟 mobile build.gradle versionCode 1:1 镜像)"""
    return old_version_code + 1


def read_file(path):
    full = REPO_ROOT / path
    # 跨项目通用铁律 #15: 兼容 UTF-8 BOM
    with open(full, encoding='utf-8-sig') as f:
        return f.read(), full


def write_file(path, content):
    full = REPO_ROOT / path
    # 跨项目通用铁律 #15: 写时保留 utf-8 (不写 BOM, 防 build.gradle gradle 解析失败)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)


def backup_file(path):
    """备份原文件 — 如果 .bak 已存在就不覆盖 (保留最早原始版本)
    
    跨项目通用铁律: 备份保留原始状态, 不要覆盖. 一个文件可能多次修改 (web.version_ts + web.version_ts_code 都改 version.ts),
    第一次 backup 是原始, 后续 backup 跳过, rollback 全部能恢复.
    """
    full = REPO_ROOT / path
    bak = full.with_suffix(full.suffix + '.bak')
    if bak.exists():
        # 已备份过 (跨多次修改同文件), 不覆盖, 保留最早原始版本
        return bak
    shutil.copy2(full, bak)
    return bak


def detect_index_fallback(content, old=None):
    """检测 server/src/index.ts 里的 APP_VERSION fallback 字符串
    
    修法: 用更精确的 pattern 找带 'fallback' 注释的行, 没找到再 fallback 到通用 pattern
    返回: (kind, match, version_in_match) 或 (None, None, None)
    """
    # pattern 1: 带 fallback 注释的行
    p1 = re.compile(
        r"(APP_VERSION\s*\|\|\s*['\"])(\d+\.\d+\.\d+)(['\"])",
    )
    m = p1.search(content)
    if m:
        return ('fallback_explicit', m, m.group(2))
    # pattern 2: process.env.APP_VERSION || 'X.Y.Z' 默认值
    p2 = re.compile(
        r"(\|\|\s*['\"])(\d+\.\d+\.\d+)(['\"])",
    )
    m = p2.search(content)
    if m:
        return ('fallback_or', m, m.group(2))
    return (None, None, None)


def replace_in_file(file_def, old, new, dryrun=True):
    """通用文件替换 — 返回 (changes_count, preview_lines)"""
    path = file_def['path']
    content, full_path = read_file(path)

    if file_def['id'] == 'server.index_fallback':
        # 特殊: server/src/index.ts fallback
        kind, m, current_v = detect_index_fallback(content)
        if not m:
            return (0, [f"  ⚠️  {path}: 没找到 fallback 'X.Y.Z' 字符串 (检查源码)"])
        if current_v != old:
            return (0, [f"  ⚠️  {path}: fallback={current_v} 跟期望 old={old} 不一致, 中断"])
        new_content = content.replace(old, new, 1) if kind == 'fallback_or' else content[:m.start(2)] + new + content[m.end(2):]
        return _apply_change(path, content, new_content, 1, dryrun)

    if file_def['id'] == 'server.eco_env':
        # 特殊: ecosystem.config.js env + env_production 2 处
        count = 0
        new_content = content
        for m in ECO_ENV_FILES_PATTERN.finditer(content):
            old_v = m.group(2) or m.group(5)
            if old_v == old:
                count += 1
                # 替换 group(2) 或 group(5) (取决于哪个 capture group 命中)
                if m.group(2):
                    new_content = new_content.replace(
                        f"APP_VERSION: '{old}'",
                        f"APP_VERSION: '{new}'",
                        1,
                    )
                elif m.group(5):
                    new_content = new_content.replace(
                        f"APP_VERSION: '{old}'",
                        f"APP_VERSION: '{new}'",
                        1,
                    )
        if count == 0:
            return (0, [f"  ⚠️  {path}: 没找到 APP_VERSION: 'X.Y.Z' (env + env_production)"])
        return _apply_change(path, content, new_content, count, dryrun)

    if file_def['id'] == 'mobile.build_gradle':
        # 特殊: build.gradle versionCode + versionName 同步, versionCode 自动 +1
        # 找当前 versionCode
        m_code = re.search(r"versionCode\s+(\d+)", content)
        m_name = re.search(r'versionName\s+"(\d+\.\d+\.\d+)"', content)
        if not m_code or not m_name:
            return (0, [f"  ⚠️  {path}: 没找到 versionCode/versionName"])
        old_code = int(m_code.group(1))
        old_name = m_name.group(1)
        if old_name != old:
            return (0, [f"  ⚠️  {path}: versionName={old_name} 跟期望 old={old} 不一致, 中断 (防误改)"])
        new_code = calc_new_version_code(old_code, new)
        # 一次性替换
        new_content = re.sub(
            r'(versionCode\s+)(\d+)(\s*\n\s*versionName\s+")(\d+\.\d+\.\d+)(")',
            lambda m: f'{m.group(1)}{new_code}{m.group(3)}{new}{m.group(5)}',
            content,
            count=1,
        )
        return _apply_change(path, content, new_content, 1, dryrun, extra_info=f"versionCode {old_code} → {new_code}, versionName {old_name} → {new}")

    if file_def['id'] == 'web.version_ts_code':
        # 特殊: APP_VERSION_CODE = 旧 +1 跟 mobile versionCode 同步
        m = re.search(r"export const APP_VERSION_CODE\s*=\s*(\d+)", content)
        if not m:
            return (0, [f"  ⚠️  {path}: 没找到 APP_VERSION_CODE"])
        old_code = int(m.group(1))
        new_code = calc_new_version_code(old_code, new)
        new_content = re.sub(
            r"(export const APP_VERSION_CODE\s*=\s*)(\d+)",
            lambda mm: f"{mm.group(1)}{new_code}",
            content,
            count=1,
        )
        return _apply_change(path, content, new_content, 1, dryrun, extra_info=f"APP_VERSION_CODE {old_code} → {new_code}")

    # 通用: 单 regex 替换
    pattern = file_def['pattern']
    matches = list(re.finditer(pattern, content))
    if not matches:
        return (0, [f"  ⚠️  {path}: 没找到 pattern {pattern[:60]}..."])
    
    count = 0
    new_content = content
    for m in reversed(matches):  # reversed 防 index 漂移
        old_in_match = m.group(1) if m.lastindex else None
        if old_in_match != old:
            continue
        replacement_func = file_def['replacement']
        if callable(replacement_func):
            new_str = replacement_func(old, new)
        else:
            new_str = replacement_func.replace(old, new)
        new_content = new_content[:m.start()] + new_str + new_content[m.end():]
        count += 1
    
    if count == 0:
        return (0, [f"  ⚠️  {path}: 找到 {len(matches)} 个 match 但没有 version 字段值匹配 old={old}"])
    return _apply_change(path, content, new_content, count, dryrun)


def _apply_change(path, content, new_content, count, dryrun, extra_info=''):
    """统一应用改动 (dryrun 只 preview, 不写)"""
    if count == 0:
        return (0, [f"  ⚠️  {path}: count=0"])
    lines = []
    info = f" ({extra_info})" if extra_info else ''
    if dryrun:
        lines.append(f"  [DRYRUN] {path}: {count} 处替换{info}")
        # preview: 抽 diff 第一行
        for i, (a, b) in enumerate(zip(content.splitlines(), new_content.splitlines())):
            if a != b:
                lines.append(f"    - {a.strip()[:100]}")
                lines.append(f"    + {b.strip()[:100]}")
                if i >= 3:
                    lines.append(f"    ... (更多省略)")
                    break
    else:
        bak_path = backup_file(path)
        write_file(path, new_content)
        lines.append(f"  ✓ {path}: {count} 处替换{info} (备份: {bak_path.name})")
    return (count, lines)


def update_changelog(new, summary, highlights, type_='patch', dryrun=True):
    """更新 changelog.json: latest_version + latest_version_time + entries[0]"""
    full = REPO_ROOT / CHANGELOG_PATH
    # 跨项目通用铁律 #15: 兼容 UTF-8 BOM
    with open(full, encoding='utf-8-sig') as f:
        data = json.load(f)

    if 'entries' not in data:
        die(f"{CHANGELOG_PATH}: 缺 entries 字段")

    old_latest = data.get('latest_version', '')
    if old_latest == new:
        return (0, [f"  ⚠️  {CHANGELOG_PATH}: latest_version 已经是 {new}"])

    new_entry = {
        'version': new,
        'buildDate': TODAY,
        'type': type_,
        'summary': summary,
        'highlights': highlights,
    }

    # prepend (跟 S73 v3.0.82 实战 1:1)
    data['entries'].insert(0, new_entry)
    data['latest_version'] = new
    data['latest_version_time'] = TODAY

    new_content = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    
    # 注意: BUG-145 教训 — latest_version 顶层字段必保持单一份, prepend 不复制
    if data.get('latest_version') != new:
        return (0, [f"  ⚠️  {CHANGELOG_PATH}: latest_version 字段冲突"])

    if dryrun:
        return (1, [f"  [DRYRUN] {CHANGELOG_PATH}: prepend entry v{new} ({len(highlights)} highlights)"])
    else:
        bak = backup_file(CHANGELOG_PATH)
        write_file(CHANGELOG_PATH, new_content)
        return (1, [f"  ✓ {CHANGELOG_PATH}: prepend entry v{new} (备份: {bak.name})"])


def detect_old_version_in_files():
    """扫描所有 9 处验证当前版本一致 (防御性 — 万一漏改就有 warning)"""
    versions = {}
    for fdef in FILES:
        content, _ = read_file(fdef['path'])
        if fdef['id'] == 'server.index_fallback':
            _, m, current_v = detect_index_fallback(content)
            versions[fdef['id']] = current_v
        elif fdef['id'] == 'server.eco_env':
            matches = list(ECO_ENV_FILES_PATTERN.finditer(content))
            # 兼容: 多个 env 块都应该是同一版本, 返第一个
            if matches:
                first_match = matches[0]
                versions[fdef['id']] = f"{first_match.group(2) or first_match.group(5)} ×{len(matches)}"
            else:
                versions[fdef['id']] = None
        elif fdef['id'] == 'mobile.build_gradle':
            m = re.search(r'versionName\s+"(\d+\.\d+\.\d+)"', content)
            versions[fdef['id']] = m.group(1) if m else None
        elif fdef['id'] == 'web.version_ts_code':
            m = re.search(r"export const APP_VERSION_CODE\s*=\s*(\d+)", content)
            versions[fdef['id']] = f"code={m.group(1)}" if m else None
        else:
            m = re.search(fdef['pattern'], content)
            versions[fdef['id']] = m.group(1) if m else None

    # 主版本字段 (必一致): server.package + mobile.version_ts + web.version_ts + mobile.build_gradle
    main_versions = [
        versions.get('server.package'),
        versions.get('mobile.version_ts'),
        versions.get('mobile.build_gradle'),
        versions.get('web.version_ts'),
    ]
    print('🔍 当前版本扫描:')
    for k, v in versions.items():
        marker = ' ✓' if v in main_versions else ' ⚠️'
        print(f'   {k:30s} = {v}{marker}')

    if len(set(filter(None, main_versions))) > 1:
        die('主版本字段不一致! 请先修一致再 bump (跨端铁律 3 实战)')

    return versions


def run_verify_8_points(new_version=None):
    """跑 verify-version-8-points.js 验证 (8 维度)"""
    verify_js = REPO_ROOT / 'tools' / 'verify-version-8-points.js'
    if not verify_js.exists():
        print(f"⚠️  {verify_js} 不存在, 跳过验证")
        return
    print(f'\n🔧 跑 verify-version-8-points.js 验证 (NEW_VERSION={new_version})...')
    cmd = ['node', str(verify_js)]
    if new_version:
        cmd.append(new_version)
    result = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    print(result.stdout)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        die('verify-version-8-points.js 验证失败, 中断!')


def rollback():
    """撤回 .bak 备份"""
    bak_files = list(REPO_ROOT.rglob('*.bak'))
    if not bak_files:
        print('⚠️  没找到 .bak 备份, 无可撤回')
        return
    print(f'🔧 撤回 {len(bak_files)} 个 .bak 文件:')
    for bak in bak_files:
        original = bak.with_suffix('')
        shutil.copy2(bak, original)
        print(f'   ✓ {bak.name} → {original.name}')
        bak.unlink()
    print('✅ 撤回完成')


def git_commit_push(new, summary, bug_no):
    """git commit + push (--commit 参数)"""
    commit_msg = f"v{new}: {summary} (BUG-{bug_no})"
    print(f'\n🔧 git commit + push...')
    print(f'   msg: {commit_msg}')
    for cmd in [
        ['git', 'add', '-A'],
        ['git', 'commit', '-m', commit_msg],
        ['git', 'push', 'origin', 'main'],
    ]:
        r = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        print(f'   $ git {" ".join(cmd[1:4])}')
        if r.stdout.strip():
            print(f'     stdout: {r.stdout.strip()[:200]}')
        if r.returncode != 0:
            print(f'   ❌ 失败: {r.stderr.strip()}', file=sys.stderr)
            return False
    print(f'   ✅ commit + push 完成')
    return True


def die(msg):
    print(f'❌ {msg}', file=sys.stderr)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='shipin-APP 一键 bump version (9 处同步 + changelog entry + optional commit)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    g = parser.add_mutually_exclusive_group()
    g.add_argument('--patch', action='store_true', help='自动 +0.0.1')
    g.add_argument('--minor', action='store_true', help='自动 +0.1')
    g.add_argument('--major', action='store_true', help='自动 +1')
    g.add_argument('--version', help='显式指定版本号 X.Y.Z')

    parser.add_argument('--summary', help='changelog entry summary (1 句话)')
    parser.add_argument('--highlights', help='changelog entry highlights (| 分隔多条, 推荐 3-5 条)')
    parser.add_argument('--type', default='patch', choices=['major', 'minor', 'patch'], help='changelog entry type')
    parser.add_argument('--bug-no', help='BUG 编号 (例 161) — commit message 必带 (跨端铁律 6)')

    parser.add_argument('--apply', action='store_true', help='真改 (默认 dryrun)')
    parser.add_argument('--commit', action='store_true', help='改完 git commit + push')
    parser.add_argument('--verify', action='store_true', help='改完跑 verify-version-8-points.js')
    parser.add_argument('--rollback', action='store_true', help='撤回 .bak 备份')

    args = parser.parse_args()

    if args.rollback:
        rollback()
        return 0

    if not any([args.patch, args.minor, args.major, args.version]):
        parser.error('至少指定 --patch / --minor / --major / --version 之一')

    if args.commit and not args.bug_no:
        parser.error('--commit 必带 --bug-no (跨端铁律 6: commit message 必带版本号 + BUG 编号)')

    # 1. 扫当前版本
    old = detect_current_version()
    print(f'🔖 当前版本: {old}')
    detect_old_version_in_files()

    # 2. 计算新版本
    mode = 'patch' if args.patch else 'minor' if args.minor else 'major' if args.major else None
    new = bump_version(old, mode, args.version)
    print(f'🚀 新版本:   {new} (mode={mode or "explicit"})')

    if not args.apply:
        print('\n⚠️  DRYRUN 模式 — 加 --apply 才真改')

    # 3. 处理 changelog
    summary = args.summary or '[待填] summary 必填 (一句话描述这次发版)'
    highlights_str = args.highlights or 'highlight 1|highlight 2|highlight 3'
    highlights = [h.strip() for h in highlights_str.split('|') if h.strip()]

    if not args.apply and not (args.summary and args.highlights):
        print('\n💡 提示: --apply 模式必带 --summary + --highlights (changelog entry 必填)')
        print(f'   示例: --summary "BUG-XXX 修 ..." --highlights "改 1|改 2|改 3"')

    # 4. 改 9 个文件 (8 + changelog)
    print('\n🔧 改 9 处版本号:')
    total_changes = 0
    for fdef in FILES:
        count, lines = replace_in_file(fdef, old, new, dryrun=not args.apply)
        for line in lines:
            print(line)
        total_changes += count

    # changelog
    count, lines = update_changelog(new, summary, highlights, args.type, dryrun=not args.apply)
    for line in lines:
        print(line)
    total_changes += count

    print(f'\n📊 总计: {total_changes} 处改动 (8 版本号 + 1 changelog)')

    if not args.apply:
        print('\n✅ DRYRUN 完成 — 加 --apply 真改')
        return 0

    # 5. 真改完跑验证
    if args.verify:
        run_verify_8_points(new_version=new)

    # 6. 远端部署提示
    print(f'\n📦 接下来:')
    print(f'   1. git add + commit:')
    print(f'      git add -A && git commit -m "v{new}: {summary} (BUG-{args.bug_no or "XXX"})"')
    print(f'   2. git push origin main')
    print(f'   3. 远端部署:')
    print(f'      bash apps/server/deploy.sh  # 自动同步 .env + systemd unit + 重打 APK')
    print(f'      python tools/verify-deploy.sh  # 27 维验证')

    # 7. 可选 commit + push
    if args.commit:
        if not git_commit_push(new, summary, args.bug_no):
            sys.exit(1)

    return 0


if __name__ == '__main__':
    main()