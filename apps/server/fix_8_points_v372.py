#!/usr/bin/env python3
import subprocess

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

# 1. 直接 sed .env APP_VERSION
print('[1] sed .env APP_VERSION=3.0.72')
out, err, rc = ssh_run('grep APP_VERSION /www/wwwroot/shipin-APP/.env')
print('  修前:', out.strip())
out, err, rc = ssh_run("sed -i 's/^APP_VERSION=.*/APP_VERSION=3.0.72/' /www/wwwroot/shipin-APP/.env && grep APP_VERSION /www/wwwroot/shipin-APP/.env")
print('  修后:', out.strip())

# 2. sed systemd unit Environment=APP_VERSION
print()
print('[2] sed systemd unit Environment=APP_VERSION=3.0.72')
out, err, rc = ssh_run('grep APP_VERSION /etc/systemd/system/shipin-app.service')
print('  修前:', out.strip())
out, err, rc = ssh_run("sed -i 's/^Environment=APP_VERSION=.*/Environment=APP_VERSION=3.0.72/' /etc/systemd/system/shipin-app.service && grep APP_VERSION /etc/systemd/system/shipin-app.service")
print('  修后:', out.strip())

# 3. daemon-reload + restart
print()
print('[3] daemon-reload + restart shipin-app')
out, err, rc = ssh_run('systemctl daemon-reload && systemctl restart shipin-app && sleep 3 && systemctl is-active shipin-app')
print('  ', out.strip(), 'rc=', rc)

# 4. 验证 /api/version
print()
print('[4] 验证 /api/version')
out, err, rc = ssh_run("curl -sm 5 http://127.0.0.1:6000/api/version | python3 -c \"import sys, json; d = json.load(sys.stdin)['data']; print('version:', d['version']); print('mobileLatestApkVersion:', d.get('mobileLatestApkVersion')); ch = d.get('changelog', ''); print('changelog 首 80 字:', str(ch)[:80])\"")
print(out)