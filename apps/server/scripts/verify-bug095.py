#!/usr/bin/env python3
"""BUG-095 端到端 v3: admin123 + 短 id"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

MYSQL = 'mysql -h 10.1.0.11 -uroot -pqQ378685504 ai_script -e'
TEST_ID = 'aaaa1111-bb22-cc33-dd44-555566667777'
NOW = int(time.time() * 1000)

# 1. 清理 + 创建测试 pending 订单
os.system(f"{MYSQL} \"DELETE FROM recharge_requests WHERE id='{TEST_ID}'\"")
os.system(f"{MYSQL} \"INSERT INTO recharge_requests (id, user_id, username, amount, status, ip, ip_location, created_at, updated_at) VALUES ('{TEST_ID}', 'test-user-bug095', 'test-bug095', 10.00, 'pending', '127.0.0.1', '', {NOW}, {NOW})\"")
print("--- before notify-paid ---")
os.system(f"{MYSQL} \"SELECT id, status, user_notified_at FROM recharge_requests WHERE id='{TEST_ID}'\"")

# 2. 登录 admin 拿 token
print("--- login admin ---")
login_req = urllib.request.Request(
    'http://127.0.0.1:6000/api/admin/login',
    method='POST',
    headers={'Content-Type': 'application/json'},
    data=json.dumps({'username': 'admin', 'password': 'admin123'}).encode(),
)
with urllib.request.urlopen(login_req, timeout=5) as resp:
    token = json.loads(resp.read())['data']['token']
print(f"admin token: {token[:30]}...")

# 3. 调 notify-paid 端点 (用 admin token 模拟)
print("--- POST notify-paid ---")
req = urllib.request.Request(
    f'http://127.0.0.1:6000/api/recharge/{TEST_ID}/notify-paid',
    method='POST',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
    },
    data=b'{}',
)
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        print(f"HTTP {resp.status}: {resp.read().decode()[:500]}")
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")

# 4. 看 DB
print("--- after notify-paid ---")
os.system(f"{MYSQL} \"SELECT id, status, user_notified_at FROM recharge_requests WHERE id='{TEST_ID}'\"")
os.system(f"{MYSQL} \"DELETE FROM recharge_requests WHERE id='{TEST_ID}'\"")
