#!/usr/bin/env python3
"""查 admin 端点 default 行为 + user_notified 订单 (BUG-094 修法验证)"""
import json
import os
import sys
import time

MYSQL = 'mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e'

# 1. 登录 admin
login = os.popen('curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\'').read()
try:
    token = json.loads(login)['data']['token']
except Exception as e:
    print(f"login err: {e}")
    sys.exit(1)
print(f"token: {token[:30]}...")

# 2. 查 admin 端点 default (无 ?status= 参数, 期望 user_notified)
print("--- admin GET /orders (default, 期望 user_notified) ---")
resp = os.popen(f'curl -s "http://127.0.0.1:6000/api/admin/orders" -H "Authorization: Bearer {token}"').read()
try:
    d = json.loads(resp)
    orders = d['data']['orders']
    print(f"count: {len(orders)}")
    for o in orders[:5]:
        print(f"  {o['id'][:8]} {o['username']} {o['status']} userNotifiedAt={o['userNotifiedAt']} amount={o['amount']}")
except Exception as e:
    print(f"err: {e}, raw: {resp[:200]}")

# 3. 查 user_notified 订单
print("--- admin GET /orders?status=user_notified ---")
resp = os.popen(f'curl -s "http://127.0.0.1:6000/api/admin/orders?status=user_notified" -H "Authorization: Bearer {token}"').read()
try:
    d = json.loads(resp)
    orders = d['data']['orders']
    print(f"count: {len(orders)}")
    for o in orders[:3]:
        print(f"  {o['id'][:8]} {o['username']} {o['status']} userNotifiedAt={o['userNotifiedAt']} amount={o['amount']}")
except Exception as e:
    print(f"err: {e}")

# 4. 试 approve 一个 user_notified 订单 (user 描述操作失败)
if orders:
    test_id = orders[0]['id']
    print(f"--- POST /admin/orders/{test_id[:8]}/approve ---")
    resp = os.popen(f'curl -s -X POST "http://127.0.0.1:6000/api/admin/orders/{test_id}/approve" -H "Authorization: Bearer {token}"').read()
    print(f"  raw: {resp[:300]}")

# 5. DB 状态
print("--- DB GROUP BY status ---")
os.system(f"{MYSQL} \"SELECT status, COUNT(*) as cnt FROM recharge_requests GROUP BY status\"")

# 6. dist 检查 (verify BUG-094 修法真部署)
print("--- server dist admin.js default check ---")
os.system("grep -A 2 'orders.*adminAuth' /www/wwwroot/shipin-APP/dist/routes/admin.js | head -10")
print("--- markUserNotified SET status in dist ---")
os.system("grep -A 2 'markUserNotified' /www/wwwroot/shipin-APP/dist/models/rechargeRequest.js | head -6")
