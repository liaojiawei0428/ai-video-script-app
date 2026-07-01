#!/usr/bin/env python3
import urllib.request, json
r = urllib.request.urlopen('https://ab.maque.uno/api/version', timeout=5)
d = json.loads(r.read())
print('version:', d['data']['version'])
print('mobileLatestApkVersion:', d['data'].get('mobileLatestApkVersion'))
print('latest_version:', d['data'].get('latest_version'))
ch = d['data'].get('changelog', [])
print('changelog 首条:', ch[0]['version'] if ch else 'NONE')
print('  summary:', ch[0]['summary'][:80] if ch else 'NONE')
print('  highlights 条数:', len(ch[0]['highlights']) if ch else 0)
if ch:
    for i, h in enumerate(ch[0]['highlights'][:3]):
        print(f'  highlight[{i}]:', h[:80])