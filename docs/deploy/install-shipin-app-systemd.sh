#!/bin/bash
# install-shipin-app-systemd.sh (S69 + BUG-076)
# 把 shipin-APP 注册为 systemd unit, 跟 nginx 一样被 systemd 监控
# 必读: docs/BUGS_INDEX.md BUG-076 (宝塔 "未启动" 解释) + BUG-008/046/049 (PM2 冲突)

set -e
SERVICE="/etc/systemd/system/shipin-app.service"

# 1. 写 unit
cat > $SERVICE << 'EOF'
[Unit]
Description=shipin-APP Node Server (S69 + BUG-076)
Documentation=https://github.com/liaojiawei0428/ai-video-script-app
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/www/wwwroot/shipin-APP
EnvironmentFile=-/www/wwwroot/shipin-APP/.env
Environment=NODE_ENV=production
Environment=PORT=6000
Environment=APP_VERSION=3.0.29
ExecStart=/usr/bin/node /www/wwwroot/shipin-APP/dist/index.js
Restart=always
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5
StandardOutput=append:/www/wwwroot/shipin-APP/logs/systemd-stdout.log
StandardError=append:/www/wwwroot/shipin-APP/logs/systemd-stderr.log
LimitNOFILE=65535
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/www/wwwroot/shipin-APP/logs /www/wwwroot/shipin-APP/uploads /www/wwwroot/shipin-APP/public

[Install]
WantedBy=multi-user.target
EOF

# 2. 必删 PM2 守护 (双管会双实例端口冲突, BUG-046/049 配套)
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# 3. 启 systemd unit
systemctl daemon-reload
systemctl enable shipin-app
systemctl restart shipin-app

# 4. 验证
sleep 3
systemctl status shipin-app --no-pager
echo
echo "--- 6 维验证 ---"
pm2 env 0 2>/dev/null | grep -iE "APP_VERSION|PORT" | head -3
ss -tln 2>/dev/null | grep 6000
curl -s -m 3 http://127.0.0.1:6000/health
echo
curl -s -m 3 http://127.0.0.1:6000/api/version | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('version:', d['version'], '| downloadUrl:', d['downloadUrl'])"
echo
echo "✅ shipin-APP 走 systemd 管理 (跟 apt nginx 一样被 systemd 监控)"
echo "❌ 宝塔 panel 仍显示 shipin_APP '未启动' (宝塔设计限制, 只能管 nginx/PHP, 不能管 node) — 监控走 systemd + 6 维验证"
