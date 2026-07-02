#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess
import os

SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@119.91.155.46'
LOCAL_APK = r'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk'


def ssh_run(cmd, timeout=30):
    r = subprocess.run(
        ['ssh', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         SERVER, cmd],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


def scp_file(local, remote, timeout=180):
    r = subprocess.run(
        ['scp', '-i', SSH_KEY, '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes',
         local, f'{SERVER}:{remote}'],
        capture_output=True, text=True, timeout=timeout,
        encoding='utf-8', errors='replace',
    )
    return r.stdout, r.stderr, r.returncode


# 1. scp APK 到 shipin-APP/public/ (nginx alias 路径, 跟 BUG-117 SOP)
local_size = os.path.getsize(LOCAL_APK)
print(f'[1] scp APK → /www/wwwroot/shipin-APP/public/DeepScript_v3.0.72.apk ({local_size} bytes)')
out, err, rc = scp_file(LOCAL_APK, '/www/wwwroot/shipin-APP/public/DeepScript_v3.0.72.apk')
if rc != 0:
    print(f'  ❌ scp 失败: {err[:300]}')
    raise SystemExit(1)
print(f'  ✅ scp 成功')

# 2. 远端验证 sha256
print()
print('[2] 远端 sha256 验证')
out, _, _ = ssh_run("sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v3.0.72.apk")
print('  ' + out.strip())

# 3. 公网 HEAD 200 验证 (BUG-117 SOP 第 4 件套)
print()
print('[3] 公网 HEAD 验证 (https://ab.maque.uno/app/DeepScript_v3.0.72.apk)')
out, _, _ = ssh_run("curl -sIk -m 10 https://ab.maque.uno/app/DeepScript_v3.0.72.apk")
print(out)

# 4. 同步 site.db shipin_APP config (宝塔 Node 项目 + BUG-077)
print('[4] 同步 site.db shipin_APP (宝塔 Node 项目)')
out, _, _ = ssh_run(
    "python3 -c \""
    "import sqlite3, json; "
    "conn = sqlite3.connect('/www/server/panel/data/db/site.db'); "
    "cur = conn.cursor(); "
    "cur.execute('SELECT id, project_config FROM sites WHERE name = ?', ('shipin_APP',)); "
    "row = cur.fetchone(); "
    "if row: "
    "    pid, old = row; "
    "    cfg = json.loads(old); "
    "    cfg['run_user'] = 'root'; "
    "    cfg['is_power_on'] = True; "
    "    cur.execute('UPDATE sites SET project_config = ? WHERE id = ?', (json.dumps(cfg, ensure_ascii=False), pid)); "
    "    conn.commit(); "
    "    print('site.db shipin_APP synced: run_user=' + cfg['run_user'] + ' is_power_on=' + str(cfg['is_power_on'])); "
    "else: print('shipin_APP not in site.db'); "
    "conn.close()"
    "\""
)
print('  ' + out.strip())

# 5. 同步 PID 文件 (宝塔 panel 读这个判断启动)
print()
print('[5] 同步 PID 文件 (宝塔 panel)')
out, _, _ = ssh_run(
    "MAIN_PID=$(systemctl show -p MainPID --value shipin-app); "
    "echo \"$MAIN_PID\" > /www/server/nodejs/vhost/pids/shipin_APP.pid; "
    "echo \"PID: $MAIN_PID\""
)
print('  ' + out.strip())

# 6. 12 维验证最终结果
print()
print('=' * 80)
print('[6] 12 维验证最终')
print('=' * 80)
out, _, _ = ssh_run(
    "echo \"1.  systemctl shipin-app: $(systemctl is-active shipin-app)\"; "
    "echo \"2.  ss 6000:             $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')\"; "
    "echo \"3.  /health:             $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)\"; "
    "echo \"4.  /api/version:        $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)[chr(0x64)+\"a\"+chr(0x74)+chr(0x61)][chr(0x76)+\"e\"+chr(0x72)+chr(0x73)+chr(0x69)+chr(0x6f)+chr(0x6e)]')\"; "
    "echo \"9.  ab.maque.uno HTTPS:  $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)[chr(0x64)+\"a\"+chr(0x74)+chr(0x61)][chr(0x76)+\"e\"+chr(0x72)+chr(0x73)+chr(0x69)+chr(0x6f)+chr(0x6e)]')\"; "
    "echo \"10. APK HTTP/2 200:      $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.72.apk | head -1 | tr -d \\r)\"; "
    "echo \"10b. APK size:           $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.72.apk | grep -i 'content-length' | head -1 | tr -d \\r)\"; "
    "echo \"10c. APK sha256 (远端):   $(sha256sum /www/wwwroot/shipin-APP/public/DeepScript_v3.0.72.apk | awk '{print $1}')\""
)
print(out)
