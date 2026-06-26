#!/usr/bin/env python3
"""APK 验证: SHA256 + versionName + 签名 + BUG-097 修法标识"""
import zipfile, hashlib, re, os, sys

apk = r'apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
print(f"--- APK: {apk} ---")
print(f"Size: {os.path.getsize(apk)} bytes")

with open(apk, 'rb') as f:
    h = hashlib.sha256(f.read()).hexdigest()
print(f"SHA256: {h}")

with zipfile.ZipFile(apk, 'r') as z:
    print(f"--- AndroidManifest.xml 关键字段 ---")
    data = z.read('AndroidManifest.xml')
    text = data.decode('latin1', errors='ignore')
    for pat in [r'3\.\d+\.\d+', r'com\.aiscriptmobile[^\x00]+']:
        matches = set(re.findall(pat, text))
        for m in list(matches)[:5]:
            if 'aiscriptmobile' in m.lower() or '3.' in m:
                print(f"  {pat[:30]}: {m[:80]}")

    print(f"--- META-INF 签名文件 ---")
    for name in z.namelist():
        if name.startswith('META-INF/') and (name.endswith('.RSA') or name.endswith('.DSA') or name.endswith('.EC') or name.endswith('.SF') or name.endswith('.MF')):
            print(f"  {name}: {z.getinfo(name).file_size} bytes")

    print(f"--- classes.dex BUG-097 修法标识 ---")
    dex = z.read('classes.dex')
    text = dex.decode('latin1', errors='ignore')
    for pat in [r'notifyRechargePaid', r'user_notified', r'我已付款', r'adminOrders']:
        matches = set(re.findall(pat, text))
        print(f"  {pat}: {len(matches)} 命中 (前 3): {[m[:60] for m in list(matches)[:3]]}")
