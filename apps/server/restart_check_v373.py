#!/usr/bin/env python3
"""restart shipin-app 让 apkVersion.ts 重新扫描公网目录 (5min cache 失效)"""
import subprocess
SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@119.91.155.46'
cmd = 'systemctl restart shipin-app && sleep 3 && curl -sm 5 http://127.0.0.1:6000/api/version | python3 -c "import sys, json; d = json.load(sys.stdin)[\'data\']; print(\'version:\', d[\'version\']); print(\'mobileLatestApkVersion:\', d.get(\'mobileLatestApkVersion\')); print(\'downloadUrl:\', d.get(\'downloadUrl\'))"'
r = subprocess.run(['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
                    SERVER, cmd], capture_output=True, text=True, timeout=30, encoding='utf-8', errors='replace')
print(r.stdout)
if r.stderr:
    print('STDERR:', r.stderr[:300])