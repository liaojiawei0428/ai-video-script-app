#!/usr/bin/env python3
"""scp 本机无 BOM package.json 到 /tmp, 然后远端跑 deploy.sh"""
import subprocess
import os

SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@159.75.16.110'

def ssh_run(cmd, timeout=300):
    r = subprocess.run(
        ['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         SERVER, cmd],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


def scp_file(local, remote, timeout=30):
    r = subprocess.run(
        ['scp', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         local, f'{SERVER}:{remote}'],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


# 1. scp 无 BOM 的 package.json + changelog.json
print('[1] scp package.json + changelog.json → /tmp')
out, err, rc = scp_file(
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\package.json',
    '/tmp/package.json'
)
if rc != 0:
    print(f'  ❌ scp package.json 失败: {err[:200]}')
    raise SystemExit(1)
print('  ✅ scp package.json OK')

out, err, rc = scp_file(
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\changelog.json',
    '/tmp/changelog.json'
)
if rc != 0:
    print(f'  ❌ scp changelog.json 失败: {err[:200]}')
    raise SystemExit(1)
print('  ✅ scp changelog.json OK')

# 2. 远端 strip BOM + verify
print()
print('[2] 远端 strip BOM /tmp/package.json + verify version')
out, err, rc = ssh_run("sed -i '1s/^\\xEF\\xBB\\xBF//' /tmp/package.json && python3 -c \"import json; print('version:', json.load(open('/tmp/package.json'))['version'])\"")
print('  ', out.strip())

# 3. 跑 deploy.sh --skip-maintenance (会用 /tmp/package.json 同步 .env + systemd unit)
print()
print('[3] bash deploy.sh --skip-maintenance')
out, err, rc = ssh_run('cd /www/wwwroot/shipin-APP && bash deploy.sh --skip-maintenance 2>&1 | tail -40', timeout=600)
print(out)
if err:
    print(f'  STDERR: {err[:500]}')
if rc != 0:
    print(f'  ❌ deploy.sh 失败 rc={rc}')

# 4. 验证
print()
print('[4] 验证 /api/version')
out, err, rc = ssh_run("curl -sm 5 http://127.0.0.1:6000/api/version | python3 -c \"import sys, json; d = json.load(sys.stdin)['data']; print('version:', d['version']); print('mobileLatestApkVersion:', d.get('mobileLatestApkVersion'))\"")
print(out)