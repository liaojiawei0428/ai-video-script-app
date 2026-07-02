#!/usr/bin/env python3
import subprocess, sys

SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@119.91.155.46'

def ssh_run(cmd, timeout=30):
    r = subprocess.run(
        ['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         SERVER, cmd],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode

# 1. restart shipin-app (清 apkVersion 5min 缓存)
print('[1] systemctl restart shipin-app')
out, err, rc = ssh_run('systemctl restart shipin-app && sleep 3 && systemctl is-active shipin-app', timeout=30)
print('  ', out.strip(), '| rc=', rc)

# 2. 验证 /api/version
print()
print('[2] curl /api/version')
out, err, rc = ssh_run("curl -sm 5 http://127.0.0.1:6000/api/version | python3 -c \"import sys, json; d = json.load(sys.stdin)['data']; print('version:', d['version']); print('mobileLatestApkVersion:', d.get('mobileLatestApkVersion')); ch = d.get('changelog', []); print('changelog count:', len(ch) if isinstance(ch, list) else 'NOT_LIST'); print('changelog[0]:', ch[0]['version'] if isinstance(ch, list) and ch else 'NONE')\"", timeout=15)
print(out)