#!/usr/bin/env python3
"""shipin-APP v3.0.72 web dist 部署脚本 (跟 web/scripts/deploy.sh 等价)
关键: nginx vhost `root /www/wwwroot/ab.maque.uno/dist;` (宝塔 vhost)
"""
import subprocess
import os

SSH_KEY = r'C:\Users\Administrator\.ssh\test2'
SERVER = 'root@119.91.155.46'
WEB_DIR = '/www/wwwroot/ab.maque.uno'  # 修正: 跟 nginx vhost `root /www/wwwroot/ab.maque.uno/dist` 对齐
LOCAL_DIST = r'F:\QiTa\banmu\APP\ai-video-script-app\apps\web\dist'
LOCAL_TGZ = r'F:\QiTa\banmu\APP\ai-video-script-app\dist-web.tgz'


def ssh_run(cmd, timeout=60):
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


# 1. 本地 tar web/dist
print('[1] 本地 tar web/dist')
r = subprocess.run(['tar', '-czf', LOCAL_TGZ, '-C', LOCAL_DIST, '.'],
                   capture_output=True, text=True, timeout=120, encoding='utf-8', errors='replace')
print(f'  rc={r.returncode}, size={os.path.getsize(LOCAL_TGZ)} bytes')

# 2. scp 到 /tmp
print()
print('[2] scp → /tmp/web-dist.tgz')
out, err, rc = scp_file(LOCAL_TGZ, '/tmp/web-dist.tgz')
if rc != 0:
    print(f'  ❌ scp 失败: {err[:300]}')
    raise SystemExit(1)
print('  ✅ scp OK')

# 3. 远端部署 (跟 web/scripts/deploy.sh 等价: mv 旧 dist + tar xzf + chown + nginx reload)
print()
print('[3] 远端 mv 旧 dist + tar xzf + chown + nginx reload')
cmd = (
    'set -e; '
    f'if [ -d {WEB_DIR}/dist ]; then mv {WEB_DIR}/dist {WEB_DIR}/dist.bak.$(date +%Y%m%d_%H%M%S); fi; '
    f'mkdir -p {WEB_DIR}; '
    f'tar -xzf /tmp/web-dist.tgz -C {WEB_DIR}/dist 2>&1 || (mkdir -p {WEB_DIR}/dist && tar -xzf /tmp/web-dist.tgz -C {WEB_DIR}/dist); '
    f'rm -f /tmp/web-dist.tgz; '
    f'chown -R www:www {WEB_DIR}/dist 2>/dev/null || true; '
    f'echo "    已部署到 {WEB_DIR}/dist"; '
    f'nginx -t 2>&1 && nginx -s reload || /etc/init.d/nginx reload; '
    f'echo "    nginx reloaded"; '
)
out, err, rc = ssh_run(cmd, timeout=60)
print(out)
if err:
    print(f'  STDERR: {err[:500]}')
if rc != 0:
    print(f'  ❌ 远端部署失败 rc={rc}')
    raise SystemExit(1)

# 4. 公网 HEAD 验证
print()
print('[4] 公网 HEAD 验证 (https://ab.maque.uno/)')
out, err, rc = ssh_run('curl -skI -m 10 https://ab.maque.uno/ | head -5')
print(out)

# 5. 检查新 bundle hash 是否在公网返回
print()
print('[5] 检查新 bundle hash 是否生效 (index-CNQIgh2A.js)')
out, err, rc = ssh_run('curl -sk -o /dev/null -w "%{http_code}" -m 10 https://ab.maque.uno/assets/index-CNQIgh2A.js')
print(f'  HTTP code: {out.strip()}')

print()
print('=== Web 部署完成 ===')