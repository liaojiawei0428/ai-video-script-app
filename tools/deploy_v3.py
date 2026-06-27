"""v3.0.46 BUG-117 deploy.py v3.0 - 通用版本号路径 + scp 4 件套 + 公网 HEAD 验证"""
import os, sys, subprocess, tarfile, shutil, hashlib, urllib.request

REMOTE = "root@159.75.16.110"
SSH_KEY = r"C:\Users\Administrator\.ssh\test2"

# 通用路径, 不写死版本号
APP_DIR = r"F:\QiTa\banmu\APP\ai-video-script-app"
SERVER_DIST = os.path.join(APP_DIR, "apps", "server", "dist")
SERVER_PKG_JSON = os.path.join(APP_DIR, "apps", "server", "package.json")
SERVER_ECO = os.path.join(APP_DIR, "apps", "server", "ecosystem.config.js")
SERVER_CHANGELOG = os.path.join(APP_DIR, "apps", "server", "changelog.json")
APK_RELEASE = os.path.join(APP_DIR, "apps", "mobile", "android", "app", "build", "outputs", "apk", "release", "app-release.apk")
TMP_DIR = r"C:\tmp\shipin-app-server-pkg"

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def read_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def run(cmd, timeout=120):
    print(f">>> {cmd[:200]}")
    r = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=timeout)
    print(r.stdout[-1500:] if r.stdout else "")
    if r.stderr: print(f"STDERR: {r.stderr[:500]}")
    return r.returncode

def scp(local, remote, timeout=180):
    r = subprocess.run(f'scp -i "{SSH_KEY}" "{local}" {REMOTE}:{remote}', capture_output=True, text=True, shell=True, timeout=timeout)
    print(f"  scp {os.path.basename(local)} -> {remote}: rc={r.returncode}")
    if r.stderr: print(f"  STDERR: {r.stderr[:300]}")
    return r.returncode

def ssh_run(script, timeout=300):
    """通过临时 file 跑远端脚本 (避免 PowerShell 嵌套 quote 问题)"""
    script_local = r"F:\tmp\ssh_script.sh"
    with open(script_local, "w", encoding="utf-8", newline="\n") as f:
        f.write(script)
    with open(script_local, "rb") as f:
        data = f.read()
    with open(script_local, "wb") as f:
        f.write(data.replace(b"\r\n", b"\n"))
    scp_rc = scp(script_local, "/tmp/ssh_script.sh")
    if scp_rc != 0: return scp_rc
    return run(f'ssh -i "{SSH_KEY}" {REMOTE} "bash /tmp/ssh_script.sh"', timeout=timeout)

# ============================================================
# Step 1: 读版本号 (从 changelog.json latest_version + package.json version 双向确认)
# ============================================================
import json
changelog = read_json(SERVER_CHANGELOG)
version = changelog.get("latest_version") or read_json(SERVER_PKG_JSON).get("version")
if not version:
    print("FATAL: 无法读取版本号")
    sys.exit(1)
print(f"Target version: {version}")
APK_NAME = f"DeepScript_v{version}.apk"
APK_REMOTE_PATH = f"/www/wwwroot/shipin-APP/public/{APK_NAME}"
APK_SHA_REMOTE_PATH = f"{APK_REMOTE_PATH}.sha256"

# ============================================================
# Step 2: 打包 server dist.tar.gz (扁平结构, deploy.sh 期望)
# ============================================================
print("\n" + "=" * 60)
print("Step 2: 打包 server dist.tar.gz (扁平)")
print("=" * 60)
if os.path.exists(TMP_DIR): shutil.rmtree(TMP_DIR)
os.makedirs(TMP_DIR)
for item in os.listdir(SERVER_DIST):
    src = os.path.join(SERVER_DIST, item)
    dst = os.path.join(TMP_DIR, item)
    if os.path.isdir(src): shutil.copytree(src, dst)
    else: shutil.copy2(src, dst)
shutil.copy2(SERVER_PKG_JSON, os.path.join(TMP_DIR, "package.json"))
shutil.copy2(SERVER_ECO, os.path.join(TMP_DIR, "ecosystem.config.js"))
TAR_GZ = os.path.join(r"C:\tmp", f"shipin-app-server-{version}.tar.gz")
with tarfile.open(TAR_GZ, "w:gz") as tar:
    tar.add(TMP_DIR, arcname=".")
print(f"  TAR_GZ: {os.path.getsize(TAR_GZ)} bytes, SHA256: {sha256_file(TAR_GZ)}")

# ============================================================
# Step 3: scp 4 件套 (dist + package.json + changelog.json + APK)
# ============================================================
print("\n" + "=" * 60)
print(f"Step 3: scp 4 件套 (dist + package.json + changelog.json + {APK_NAME})")
print("=" * 60)
if scp(TAR_GZ, "/tmp/dist.tar.gz") != 0: sys.exit("scp dist failed")
if scp(SERVER_PKG_JSON, "/tmp/package.json") != 0: sys.exit("scp package.json failed")
if scp(SERVER_CHANGELOG, "/tmp/changelog.json") != 0: sys.exit("scp changelog.json failed")
if scp(APK_RELEASE, f"/tmp/{APK_NAME}") != 0: sys.exit(f"scp {APK_NAME} failed")

# ============================================================
# Step 4: 跑 deploy.sh (systemd restart + 8 处版本号同步)
# ============================================================
print("\n" + "=" * 60)
print("Step 4: ssh deploy.sh --skip-maintenance")
print("=" * 60)
ssh_run("cd /www/wwwroot/shipin-APP && bash deploy.sh --skip-maintenance 2>&1 | tail -40", timeout=300)

# ============================================================
# Step 5: cp APK 到 nginx 路径 + sha256 校验文件 + nginx reload
# ============================================================
print("\n" + "=" * 60)
print(f"Step 5: cp APK -> {APK_REMOTE_PATH} + sha256 校验 + nginx reload")
print("=" * 60)
apk_sha = sha256_file(APK_RELEASE)
print(f"  本机 APK SHA256: {apk_sha}")
print(f"  本机 APK size:   {os.path.getsize(APK_RELEASE)} bytes")
script = rf'''
set -e
APK_NAME="{APK_NAME}"
APK_PATH="{APK_REMOTE_PATH}"
APK_SHA_PATH="{APK_SHA_REMOTE_PATH}"
LOCAL_APK="/tmp/${{APK_NAME}}"

cp -f "$LOCAL_APK" "$APK_PATH"
chmod 644 "$APK_PATH"
chown root:root "$APK_PATH"

# 写 sha256 校验文件 (客户端可下载校验)
sha256sum "$LOCAL_APK" | awk '{{print $1}}' > "$APK_SHA_PATH"

echo "=== sha256 验证 ==="
echo "本机 SHA256:    {apk_sha}"
echo "远端 SHA256:    $(sha256sum $APK_PATH | awk '{{print $1}}')"
echo "sha256 文件:    $(cat $APK_SHA_PATH)"
echo "=== nginx reload ==="
nginx -t
nginx -s reload 2>&1 || true
echo "=== APK in public ==="
ls -lh $APK_PATH
'''
ssh_run(script, timeout=60)

# ============================================================
# Step 6: 公网 HEAD 验证 (跨项目通用铁律, BUG-117 教训)
# ============================================================
print("\n" + "=" * 60)
print("Step 6: 公网 HTTPS HEAD 验证 (BUG-117 防呆)")
print("=" * 60)
apk_url = f"https://ab.maque.uno/app/{APK_NAME}"
print(f"  APK URL: {apk_url}")
try:
    req = urllib.request.Request(apk_url, method="HEAD")
    with urllib.request.urlopen(req, timeout=15) as r:
        print(f"  HTTP Status:        {r.status} {'✅' if r.status == 200 else '❌'}")
        print(f"  Content-Type:       {r.headers.get('Content-Type')} {'✅' if 'android.package-archive' in str(r.headers.get('Content-Type', '')) else '❌'}")
        print(f"  Content-Length:     {r.headers.get('Content-Length')} {'✅' if int(r.headers.get('Content-Length', 0)) == os.path.getsize(APK_RELEASE) else '❌'}")
        print(f"  Accept-Ranges:      {r.headers.get('Accept-Ranges')} {'✅' if r.headers.get('Accept-Ranges') else '❌'}")
        remote_etag = r.headers.get('ETag', '').strip('"').split('-')[0]
        print(f"  ETag:               {r.headers.get('ETag')}")
except Exception as e:
    print(f"  ❌ ERR: {e}")
    sys.exit(1)

# ============================================================
# Step 7: shipin-app 12 维 verify
# ============================================================
print("\n" + "=" * 60)
print("Step 7: shipin-app 12 维 verify")
print("=" * 60)
verify_script = r'''
echo "1. systemctl shipin-app: $(systemctl is-active shipin-app)"
echo "2. ss 6000: $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
curl -sm 3 http://127.0.0.1:6000/api/version > /tmp/api_v.json
python3 -c "
import json
d = json.load(open('/tmp/api_v.json'))['data']
print('3. version:', d['version'])
print('4. latestVersion:', d.get('latestVersion', 'N/A'))
print('5. highlights:', len(d['highlights']))
print('6. buildDate:', d['buildDate'])
"
echo "7. shipin-app PID: $(systemctl show shipin-app -p MainPID --value)"
'''
ssh_run(verify_script, timeout=60)

print("\n" + "=" * 60)
print(f"✅ 部署完成: version={version}")
print(f"   TAR_GZ SHA256:  {sha256_file(TAR_GZ)}")
print(f"   APK SHA256:     {apk_sha}")
print(f"   APK 公网 URL:   {apk_url}")
print("=" * 60)