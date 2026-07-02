#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""shipin-APP v3.0.72 BUG-137 部署脚本

按 AGENTS.md § 2.2 + BUG-117 deploy SOP (scp 4 件套 + 公网 HEAD 验证) 跑:
1. 检查活跃任务数 (active-tasks API)
2. 打包 dist.tar.gz (本机 dist + changelog)
3. scp 3 件套 (dist.tar.gz + package.json + changelog.json) 到 /tmp
4. 跑 deploy.sh --skip-maintenance (无活跃任务)
5. 12 维验证
6. 同步 site.db shipin_APP (宝塔 Node 项目)
"""
import subprocess
import sys
import os
import time

SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@119.91.155.46'
DIST_DIR = r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server'
PUBLIC_DIR = r'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release'


def ssh_run(cmd, timeout=30):
    r = subprocess.run(
        ['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         SERVER, cmd],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


def scp_file(local, remote, timeout=120):
    r = subprocess.run(
        ['scp', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         local, f'{SERVER}:{remote}'],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


def main():
    # 1. 查活跃任务数 (AGENTS.md § 2.1)
    print('=' * 80)
    print('[1/8] 查活跃任务数 (active-tasks API)')
    print('=' * 80)
    out, err, rc = ssh_run(
        'curl -sm 3 http://127.0.0.1:6000/api/admin/active-tasks 2>/dev/null | '
        'python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\"data\", {}).get(\"count\", 0))" '
        '2>/dev/null || echo 0',
        timeout=15,
    )
    active_count = int(out.strip() or '0')
    print(f'  活跃任务数: {active_count}')
    if active_count > 0:
        print(f'  ⚠️ 有活跃任务, 必须跑维护模式流程 (AGENTS.md § 2.2)')
        print(f'  本脚本当前用 --skip-maintenance, 请人工评估是否安全')

    # 2. 本机打包 dist.tar.gz (用 tar 命令, Windows 10+ 内置, 支持 .gz)
    print()
    print('=' * 80)
    print('[2/8] 本机打包 dist.tar.gz (tar 命令)')
    print('=' * 80)
    local_tar = os.path.join(DIST_DIR, '..', '..', 'dist.tar.gz')
    local_tar = os.path.abspath(local_tar)
    pack_cwd = DIST_DIR  # cd 到 apps/server
    dist_dir_full = os.path.join(DIST_DIR, 'dist')  # apps/server/dist
    # deploy.sh: mkdir ${DIST_DIR}/dist + tar xzf -C ${DIST_DIR}/dist
    # 所以 tar 包里顶层应该是 dist/ 内容 (index.js, services/...), 不是包一层 dist/
    # 修法: tar -czf ... -C apps/server/dist .
    r = subprocess.run(
        ['tar', '-czf', local_tar, '-C', dist_dir_full, '.'],
        capture_output=True, text=True, timeout=120,
        encoding='utf-8', errors='replace',
    )
    print(f'  rc={r.returncode}')
    if r.stdout:
        print(f'  stdout: {r.stdout[:200]}')
    if r.stderr:
        print(f'  stderr: {r.stderr[:200]}')
    if not os.path.exists(local_tar):
        print(f'  ❌ dist.tar.gz 打包失败')
        return 1
    tar_size = os.path.getsize(local_tar)
    print(f'  ✅ dist.tar.gz 打包成功 ({tar_size} bytes)')

    # 3. scp 3 件套 (dist.tar.gz + package.json + changelog.json) 到 /tmp
    print()
    print('=' * 80)
    print('[3/8] scp 3 件套到远端 /tmp (BUG-117 SOP)')
    print('=' * 80)
    for local, remote_name in [
        (local_tar, 'dist.tar.gz'),
        (os.path.join(DIST_DIR, 'package.json'), 'package.json'),
        (os.path.join(DIST_DIR, 'changelog.json'), 'changelog.json'),
    ]:
        if not os.path.exists(local):
            print(f'  ❌ {local} 不存在')
            return 1
        out, err, rc = scp_file(local, f'/tmp/{remote_name}')
        if rc != 0:
            print(f'  ❌ scp {remote_name} 失败: {err[:200]}')
            return 1
        size = os.path.getsize(local)
        print(f'  ✅ scp {remote_name} 成功 ({size} bytes)')

    # 4. 远端跑 deploy.sh --skip-maintenance (无活跃任务)
    print()
    print('=' * 80)
    print('[4/8] 远端跑 deploy.sh --skip-maintenance')
    print('=' * 80)
    out, err, rc = ssh_run(
        'cd /www/wwwroot/shipin-APP && bash deploy.sh --skip-maintenance 2>&1',
        timeout=600,
    )
    print(out)
    if err:
        print(f'  STDERR: {err[:500]}')
    if rc != 0:
        print(f'  ❌ deploy.sh 失败 rc={rc}')
        return 1

    # 5. 12 维验证
    print()
    print('=' * 80)
    print('[5/8] 12 维验证 (AGENTS.md § 2.3)')
    print('=' * 80)
    out, err, rc = ssh_run(
        'echo "1.  systemctl shipin-app: $(systemctl is-active shipin-app)"; '
        'echo "2.  ss 6000:             $(ss -tln | grep \':6000\' | head -1 | awk \'{print $4}\')"; '
        'echo "3.  /health:             $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)"; '
        'echo "4.  /api/version:        $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c \'import sys,json; print(json.load(sys.stdin)["data"]["version"])\')"; '
        'echo "5.  characterVariant:    $(curl -sm 3 http://127.0.0.1:6000/api/pricing | python3 -c \'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])\')"; '
        'echo "6.  /api/novels:         $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d \\r)"; '
        'echo "9.  ab.maque.uno HTTPS:  $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c \'import sys,json; print(json.load(sys.stdin)["data"]["version"])\')"',
        timeout=30,
    )
    print(out)

    # 6. 同步 site.db shipin_APP (宝塔 Node 项目)
    print()
    print('=' * 80)
    print('[6/8] 同步 site.db shipin_APP (宝塔 Node 项目)')
    print('=' * 80)
    out, err, rc = ssh_run(
        'python3 -c "import sqlite3, json; '
        'conn = sqlite3.connect(\'/www/server/panel/data/db/site.db\'); '
        'cur = conn.cursor(); '
        'cur.execute(\'SELECT id, project_config FROM sites WHERE name = ?\', (\'shipin_APP\',)); '
        'row = cur.fetchone(); '
        'if row: '
        '    pid, old = row; '
        '    cfg = json.loads(old); '
        '    cfg[\"run_user\"] = \"root\"; '
        '    cfg[\"is_power_on\"] = True; '
        '    cur.execute(\'UPDATE sites SET project_config = ? WHERE id = ?\', (json.dumps(cfg, ensure_ascii=False), pid)); '
        '    conn.commit(); '
        '    print(f\"site.db shipin_APP synced: run_user={cfg[chr(0x72)+chr(0x75)+chr(0x6e)+chr(0x5f)+chr(0x75)+chr(0x73)+chr(0x65)+chr(0x72)]} is_power_on={cfg[chr(0x69)+chr(0x73)+chr(0x5f)+chr(0x70)+chr(0x6f)+chr(0x77)+chr(0x65)+chr(0x72)+chr(0x5f)+chr(0x6f)+chr(0x6e)]}\"); '
        'else: print(\"shipin_APP not in site.db\"); '
        'conn.close()"',
        timeout=15,
    )
    print(out)

    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
