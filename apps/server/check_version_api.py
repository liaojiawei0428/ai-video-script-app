#!/usr/bin/env python3
import urllib.request, json
r = urllib.request.urlopen('https://ab.maque.uno/api/version', timeout=5)
d = json.loads(r.read())
data = d['data']
print('keys:', list(data.keys()))
print('changelog type:', type(data.get('changelog')).__name__)
ch = data.get('changelog', '')
print('changelog 前 300 字符:', str(ch)[:300] if ch else 'EMPTY')
print()
print('latest_version:', data.get('latest_version'))
print('mobileLatestApkVersion:', data.get('mobileLatestApkVersion'))
print('downloadUrl:', data.get('downloadUrl'))