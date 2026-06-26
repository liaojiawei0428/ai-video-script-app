#!/usr/bin/env python3
"""查 admin approve 实际错误 (跟 server log 同时间戳)"""
import json
import os
import sys
import time
import traceback

MYSQL = 'mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e'

# 登录 admin
login = os.popen('curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\'').read()
token = json.loads(login)['data']['token']
print(f"token: {token[:30]}...")

# 查 user_notified 订单
resp = os.popen(f'curl -s "http://127.0.0.1:6000/api/admin/orders?status=user_notified" -H "Authorization: Bearer {token}"').read()
orders = json.loads(resp)['data']['orders']
print(f"user_notified count: {len(orders)}")

if not orders:
    print("no user_notified orders to test")
    sys.exit(0)

# 取一个订单试 approve
test_id = orders[0]['id']
test_user = orders[0]['username']
print(f"\n--- test approve {test_id[:8]} (user={test_user}) ---")

# 先看 userId 实际值
user_id = orders[0].get('userId', '')
print(f"order.userId: {user_id} (type: {type(user_id).__name__})")

# 跑 approve
print("--- POST /admin/orders/.../approve ---")
resp = os.popen(f'curl -s -X POST "http://127.0.0.1:6000/api/admin/orders/{test_id}/approve" -H "Authorization: Bearer {token}" -w "\nHTTP_CODE=%{{http_code}}"').read()
print(f"  resp: {resp}")

# 查 server log 这一秒 (用 journalctl + grep 时间戳)
import datetime
now = datetime.datetime.now().strftime('%H:%M')
print(f"\n--- server log around {now} ---")
os.system(f"journalctl -u shipin-app --no-pager --since '{now}:00' 2>&1 | tail -30")

# 查 DB 状态 (看 approve 真的写没)
print("--- DB status after approve ---")
os.system(f"{MYSQL} \"SELECT id, status, user_notified_at, updated_at FROM recharge_requests WHERE id='{test_id}'\"")

# 查 billing_logs 是否有 topUp 记录
print("--- billing_logs ---")
os.system(f"{MYSQL} \"SELECT id, user_id, type, ref_type, amount, balance_after, created_at FROM billing_logs WHERE ref_id='{test_id}' OR description LIKE '%{test_id}%' ORDER BY created_at DESC LIMIT 5\"")

# 查 user balance (看下 topUp 是不是改 user balance 失败)
os.system(f"{MYSQL} \"SELECT id, username, balance FROM users WHERE id='{user_id}'\"")
