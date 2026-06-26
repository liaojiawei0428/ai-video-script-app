#!/usr/bin/env python3
import json, sys, os
token = os.popen('curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"q378685504"}\'').read()
try:
    data = json.loads(token)
except Exception as e:
    print(f"login parse err: {e}")
    print(f"raw: {token[:200]}")
    sys.exit(1)
auth_token = data.get('data', {}).get('token', '')
if not auth_token:
    print(f"login no token: {token[:200]}")
    sys.exit(1)
print(f"token: {auth_token[:30]}...")
resp = os.popen(f'curl -s "http://127.0.0.1:6000/api/admin/orders?status=approved" -H "Authorization: Bearer {auth_token}"').read()
try:
    data = json.loads(resp)
except Exception as e:
    print(f"resp parse err: {e}")
    print(f"raw: {resp[:300]}")
    sys.exit(1)
orders = data.get('data', {}).get('orders', [])
print(f"count: {len(orders)}")
for o in orders[:2]:
    print('---')
    for k, v in o.items():
        print(f"  {k}: {v!r}")
