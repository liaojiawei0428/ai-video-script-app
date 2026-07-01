#!/usr/bin/env python3
"""strip UTF-8 BOM (EF BB BF) from files (跨项目通用铁律, BUG-082/096/115/131 教训)
PowerShell Edit + Get-Content/Set-Content 会写 BOM, gradle 解析 build.gradle line 1
报 "Unexpected character '?'" (3F = ?), python3 json 解析 package.json 同样报错.
"""
import sys
import os

files = [
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\android\app\build.gradle',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\package.json',
    # 顺便检查所有 8 处
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\web\src\config\version.ts',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\mobile\src\config\version.ts',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\src\index.ts',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\ecosystem.config.js',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\changelog.json',
    r'F:\QiTa\banmu\APP\ai-video-script-app\apps\server\changelog_remote.json',
]

BOM = b'\xef\xbb\xbf'

for f in files:
    if not os.path.exists(f):
        print(f'  ⚠️ {f} 不存在')
        continue
    with open(f, 'rb') as fp:
        head = fp.read(3)
    if head == BOM:
        with open(f, 'rb') as fp:
            data = fp.read()
        with open(f, 'wb') as fp:
            fp.write(data[3:])
        print(f'  ✅ stripped BOM: {f}')
    else:
        print(f'  ✓ no BOM: {f} (head={head.hex()})')