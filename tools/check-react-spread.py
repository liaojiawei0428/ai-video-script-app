#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/check-react-spread.py
S71 BUG-080 后置: 检测 web 端手挑字段 pattern.
真实 BUG: BillingPage.tsx push transactions 时只挑 4 字段, 漏 type, 导致 tab filter 全空
"""
import re
import sys
import subprocess
from pathlib import Path

def git_staged_files():
    r = subprocess.run(['git', 'diff', '--name-only', '--cached'], capture_output=True, text=True, cwd=ROOT)
    return [f for f in r.stdout.splitlines() if f.endswith(('.ts', '.tsx', '.js', '.jsx'))]

def all_files():
    out = []
    for p in Path('apps/web/src').rglob('*'):
        if p.suffix in ('.ts', '.tsx', '.js', '.jsx') and 'node_modules' not in str(p):
            out.append(str(p))
    return out

def find_block_end(text, start):
    """找 { ... } 配对结束位置"""
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        ch = text[i]
        if ch == '{': depth += 1
        elif ch == '}': depth -= 1
        i += 1
    return i - 1  # 返回 } 位置

def check_file(filepath):
    raw = Path(filepath).read_bytes()
    for enc in ('utf-8', 'utf-8-sig', 'utf-16', 'utf-16-le', 'utf-16-be', 'gbk'):
        try:
            text = raw.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        return []
    warnings = []
    # 找 forEach((var) => { ... }) 和 .map((var) => ({ ... })) 和 .map((var) => { ... })
    # 注意: forEach 必是块, map 可以是块或表达式
    # 我们要找: 在 forEach/map 块内, 出现 `push({ field: var.field` 或 `return ({ field: var.field` 手挑模式
    foreach_re = re.compile(r'\.forEach\s*\(\s*\(?\s*([a-z_][a-zA-Z0-9_]*)\s*\)?\s*=>\s*\{')
    map_block_re = re.compile(r'\.map\s*\(\s*\(?\s*([a-z_][a-zA-Z0-9_]*)\s*\)?\s*=>\s*\{')
    # 合并所有 outer 块
    for m in list(foreach_re.finditer(text)) + list(map_block_re.finditer(text)):
        var = m.group(1)
        start = m.end()
        end = find_block_end(text, start)
        if end < start:
            continue
        block = text[start:end]
        # 看 block 内有没有 spread outer 变量 (...var)
        if re.search(r'\.\.\.' + re.escape(var) + r'\b', block):
            continue
        # 检测手挑: 必须有 push({ ... }) 或 return ({ ... }) 调用, 内含 var.field
        # 找 push 块
        push_re = re.compile(r'\.push\s*\(\s*\{')
        for pm in push_re.finditer(block):
            pb_start = pm.end() - 1  # {
            pb_end = find_block_end(block, pb_start)
            if pb_end < pb_start:
                continue
            push_block = block[pb_start+1:pb_end]
            # 看 push 块内有没有 var.field (手挑)
            if re.search(r'[a-z_][a-zA-Z0-9_]*\s*:\s*' + re.escape(var) + r'\.[a-z]', push_block):
                # 找第一个手挑行
                hand_re = re.compile(r'[a-z_][a-zA-Z0-9_]*\s*:\s*' + re.escape(var) + r'\.[a-z]')
                hm = hand_re.search(push_block)
                if hm:
                    # 计算实际行号
                    absolute_pos = start + pb_start + 1 + hm.start()
                    line_no = text[:absolute_pos].count('\n') + 1
                    line_start = text.rfind('\n', 0, absolute_pos) + 1
                    line_end = text.find('\n', absolute_pos)
                    line_content = text[line_start:line_end if line_end > 0 else len(text)]
                    warnings.append(f"{filepath}:{line_no}: {line_content.strip()[:120]}")
                    break  # 一个 outer 块报一次
        # 检测 return ({ ... }) map 表达式
        return_re = re.compile(r'return\s*\(\s*\{')
        for rm in return_re.finditer(block):
            rb_start = rm.end() - 1
            rb_end = find_block_end(block, rb_start)
            if rb_end < rb_start:
                continue
            return_block = block[rb_start+1:rb_end]
            if re.search(r'[a-z_][a-zA-Z0-9_]*\s*:\s*' + re.escape(var) + r'\.[a-z]', return_block):
                hand_re = re.compile(r'[a-z_][a-zA-Z0-9_]*\s*:\s*' + re.escape(var) + r'\.[a-z]')
                hm = hand_re.search(return_block)
                if hm:
                    absolute_pos = start + rb_start + 1 + hm.start()
                    line_no = text[:absolute_pos].count('\n') + 1
                    line_start = text.rfind('\n', 0, absolute_pos) + 1
                    line_end = text.find('\n', absolute_pos)
                    line_content = text[line_start:line_end if line_end > 0 else len(text)]
                    warnings.append(f"{filepath}:{line_no}: {line_content.strip()[:120]}")
                    break
    return warnings

ROOT = Path(__file__).parent.parent

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == '--staged':
        files = git_staged_files()
    elif mode == '--all':
        files = all_files()
    elif mode == '':
        print("用法: tools/check-react-spread.sh <file1> [file2] ... | --staged | --all")
        print("  检测 web 端手挑字段 pattern (BUG-080 防呆)")
        sys.exit(2)
    else:
        files = sys.argv[1:]
    if not files:
        print("  无文件可检查")
        sys.exit(0)
    print(f"--- 检查 {len(files)} 个 .ts/.tsx/.js/.jsx ---")
    all_warnings = []
    for f in files:
        warnings = check_file(f)
        all_warnings.extend(warnings)
    if all_warnings:
        print(f"\033[31m✗ {len(all_warnings)} 处手挑字段 (建议改 spread outer 变量: ...var)\033[0m")
        for w in all_warnings:
            print(f"\033[33m  - {w}\033[0m")
        print()
        print("\033[33m修法: 把 push({ id: var.id, amount: var.amount, ... }) 改成 push({ ...var, kind: '...', status: '...' })\033[0m")
        print("\033[33m真实 BUG: S71 BUG-080 (web 端消费记录 tab 没数据)\033[0m")
        sys.exit(1)
    else:
        print("\033[32m✓ 所有 push/return 块都用 spread outer 变量, 没有手挑字段\033[0m")
        sys.exit(0)
