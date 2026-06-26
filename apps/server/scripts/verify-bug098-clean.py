#!/usr/bin/env python3
"""BUG-098 真实 approve 端到端测试: 创建新 user_notified 订单 + approve"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

MYSQL = 'mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e'

# 1. 登录 admin
login = os.popen('curl -s -X POST http://127.0.0.1:6000/api/admin/login -H "Content-Type: application/json" -d \'{"username":"admin","password":"admin123"}\'').read()
token = json.loads(login)['data']['token']
print(f"token: {token[:30]}...")

# 2. 清理 + 创建新测试 user_notified 订单
TEST_ID = 'b098aaa-bbbb-cccc-dddd-eeeeffff5555'  # 36 char UUID-style
TEST_USER = 'q378685504'[:36]
NOW = int(time.time() * 1000)

os.system(f"{MYSQL} \"DELETE FROM recharge_requests WHERE id='{TEST_ID}'\"")
print(f"--- create user_notified test order {TEST_ID[:8]} ---")
ret = os.system(f"{MYSQL} \"INSERT INTO recharge_requests (id, user_id, username, amount, status, ip, ip_location, user_notified_at, created_at, updated_at) VALUES ('{TEST_ID}', '{TEST_USER}', 'test-bug098', 50.00, 'user_notified', '127.0.0.1', '', {NOW}, {NOW}, {NOW})\"")
print(f"INSERT ret: {ret}")
os.system(f"{MYSQL} \"SELECT id, status, user_notified_at FROM recharge_requests WHERE id='{TEST_ID}'\"")

# 3. 跑 approve
print(f"\n--- POST /admin/orders/{TEST_ID[:8]}/approve ---")
try:
    req = urllib.request.Request(
        f'http://127.0.0.1:6000/api/admin/orders/{TEST_ID}/approve',
        method='POST',
        headers={'Authorization': f'Bearer {token}'},
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"  HTTP {resp.status}: {resp.read().decode()[:300]}")
except urllib.error.HTTPError as e:
    print(f"  HTTP {e.code}: {e.read().decode()[:300]}")
except Exception as e:
    print(f"  err: {e}")

# 4. 看 DB 状态
print("\n--- DB after approve ---")
os.system(f"{MYSQL} \"SELECT id, status, user_notified_at, updated_at FROM recharge_requests WHERE id='{TEST_ID}'\"")
os.system(f"{MYSQL} \"SELECT id, user_id, type, ref_type, amount, balance_after, created_at FROM billing_logs WHERE ref_id='{TEST_ID}'\"")

# 5. cleanup
os.system(f"{MYSQL} \"DELETE FROM recharge_requests WHERE id='{TEST_ID}'\"")
