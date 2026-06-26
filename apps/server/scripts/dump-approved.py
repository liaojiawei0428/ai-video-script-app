#!/usr/bin/env python3
import json
import os
import sys

MYSQL = 'mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e'
# 登录 admin 拿 token
login = os.popen('curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\'').read()
try:
    data = json.loads(login)
    token = data['data']['token']
except Exception as e:
    print(f"login err: {e}, raw: {login[:200]}")
    sys.exit(1)
print(f"token: {token[:30]}...")

# 查 approved 订单
resp = os.popen(f'curl -s "http://127.0.0.1:6000/api/admin/orders?status=approved" -H "Authorization: Bearer {token}"').read()
try:
    data = json.loads(resp)
except Exception as e:
    print(f"resp err: {e}, raw: {resp[:300]}")
    sys.exit(1)
orders = data['data']['orders']
print(f"count: {len(orders)}")
for o in orders[:2]:
    print('---')
    for k, v in o.items():
        print(f"  {k}: {v!r}")
