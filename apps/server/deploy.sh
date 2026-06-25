#!/bin/bash
# ============================================================
# shipin-APP 部署脚本 v2.0 (S70 重写)
# 走 systemd unit + 宝塔 panel Node 项目同步, 不再走 PM2
# ============================================================
# 完整 SOP: docs/BAOTA_NODE_PROJECT_DEPLOY.md (§ 1-6, 5 步部署 + 12 维验证 + 9 坑)
# AI 助手执行前必读:
#   1. docs/BAOTA_NODE_PROJECT_DEPLOY.md § 0 架构图 + § 1 部署前 5 步
#   2. apps/mobile/BUGS.md § BUG-077 (宝塔项目部署踩坑 7 条)
#   3. docs/BUGS_INDEX.md § 4.5 宝塔部署踩坑 Top 5
#
# 关键路径 (硬记忆):
#   systemd unit: /etc/systemd/system/shipin-app.service
#   启停脚本:    /www/server/nodejs/vhost/scripts/shipin_APP.sh
#   PID 文件:    /www/server/nodejs/vhost/pids/shipin_APP.pid
#   宝塔 db:     /www/server/panel/data/db/site.db
#   日志路径:    /www/wwwlogs/shipin_APP.log
#
# 用法:
#   bash deploy.sh                         # 默认: 检查活跃任务 + 部署
#   bash deploy.sh --skip-maintenance     # 跳过维护模式 (紧急修复)
#   bash deploy.sh --rollback             # 回滚到上一个 dist 备份
# ============================================================

set -e

# ==================== 配置 ====================
SERVER="http://localhost:6000"
DIST_DIR="/www/wwwroot/shipin-APP"
DIST_NAME="dist"
BAOTA_SCRIPT="/www/server/nodejs/vhost/scripts/shipin_APP.sh"
PID_FILE="/www/server/nodejs/vhost/pids/shipin_APP.pid"
SITE_DB="/www/server/panel/data/db/site.db"
SERVICE_NAME="shipin-app"
MAX_WAIT=900  # 最多等 15 分钟

# ==================== 参数解析 ====================
SKIP_MAINTENANCE=false
ROLLBACK=false
for arg in "$@"; do
  case $arg in
    --skip-maintenance) SKIP_MAINTENANCE=true ;;
    --rollback)         ROLLBACK=true ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

# ==================== 0. 回滚模式 ====================
if [ "$ROLLBACK" = true ]; then
  echo ">>> [回滚模式] 找最近 dist 备份..."
  LATEST_BACKUP=$(ls -td ${DIST_DIR}/dist.bak.* 2>/dev/null | head -1)
  if [ -z "$LATEST_BACKUP" ]; then
    echo "✗ 没找到 dist 备份, 回滚失败"
    exit 1
  fi
  echo "    回滚到: $LATEST_BACKUP"
  rm -rf ${DIST_DIR}/dist
  cp -r "$LATEST_BACKUP" ${DIST_DIR}/dist
  systemctl restart $SERVICE_NAME
  sleep 3
  systemctl is-active $SERVICE_NAME
  echo "=== 回滚完成, 重新跑 12 维验证 ==="
  bash ${DIST_DIR}/deploy.sh --skip-maintenance   # 跳过维护模式, 走同步逻辑
  exit 0
fi

# ==================== 1. 检查活跃任务 ====================
echo ">>> [1/9] 检查活跃任务..."
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
echo "    活跃任务数: ${COUNT}"

if [ "${COUNT}" -gt 0 ] && [ "$SKIP_MAINTENANCE" = false ]; then
  echo ">>> [2/9] 有活跃任务, 跑维护模式流程..."
  curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"title":"系统维护通知","content":"系统即将进行升级维护，预计几分钟完成。正在运行的任务将正常完成，请稍候。"}' > /dev/null
  echo "    ✓ 维护公告已发布"

  curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=true" > /dev/null
  echo "    ✓ 维护模式已开启"

  echo ">>> [3/9] 等待活跃任务完成 (最多 ${MAX_WAIT}s)..."
  WAITED=0
  while [ $WAITED -lt $MAX_WAIT ]; do
    COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])" 2>/dev/null || echo "0")
    echo -ne "    \r等待中... 剩余任务: ${COUNT} (已等 ${WAITED}s)"
    [ "$COUNT" -eq 0 ] && break
    sleep 10
    WAITED=$((WAITED + 10))
  done
  echo ""
  if [ "$COUNT" -gt 0 ]; then
    echo "✗ 15 分钟后还有 ${COUNT} 个活跃任务, 放弃部署"
    curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=false" > /dev/null
    exit 1
  fi
elif [ "$SKIP_MAINTENANCE" = true ]; then
  echo "    ⚠️ 跳过维护模式 (--skip-maintenance)"
fi

# ==================== 2. 部署前 6 维预检 ====================
echo ">>> [4/9] 部署前 6 维预检..."

# 4.1 systemd unit 含 NODE_PROJECT_NAME
if ! grep -q "NODE_PROJECT_NAME=$SERVICE_NAME" /etc/systemd/system/${SERVICE_NAME}.service 2>/dev/null && \
   ! grep -q "NODE_PROJECT_NAME=shipin_APP" /etc/systemd/system/${SERVICE_NAME}.service 2>/dev/null; then
  echo "✗ systemd unit 缺 Environment=NODE_PROJECT_NAME=shipin_APP (BUG-077 必备)"
  echo "  修法: echo 'Environment=NODE_PROJECT_NAME=shipin_APP' >> /etc/systemd/system/${SERVICE_NAME}.service"
  echo "        systemctl daemon-reload && systemctl restart $SERVICE_NAME"
  exit 1
fi
echo "    ✓ systemd unit 含 NODE_PROJECT_NAME"

# 4.2 apt nginx 必须 masked (防双实例冲突)
if systemctl is-enabled nginx 2>/dev/null | grep -q masked; then
  echo "    ✓ apt nginx masked"
else
  echo "    ⚠️ apt nginx 没 masked, 杀 + mask..."
  systemctl stop nginx 2>/dev/null || true
  systemctl mask nginx
  pkill -9 nginx 2>/dev/null || true
  sleep 2
fi

# 4.3 宝塔 nginx 必须 running
if ss -tln | grep -q ":80 "; then
  echo "    ✓ 80 端口已被宝塔 nginx 占"
else
  echo "    ⚠️ 80 端口空闲, 启宝塔 nginx..."
  /www/server/nginx/sbin/nginx -t
  /www/server/nginx/sbin/nginx
  sleep 2
fi

# 4.4 shipin_APP 在宝塔 site.db sites 表
SHIPIN_IN_DB=$(sqlite3 $SITE_DB "SELECT COUNT(*) FROM sites WHERE name='shipin_APP' AND project_type='Node';")
if [ "$SHIPIN_IN_DB" -gt 0 ]; then
  echo "    ✓ shipin_APP 在宝塔 site.db (id=$(sqlite3 $SITE_DB "SELECT id FROM sites WHERE name='shipin_APP';") project_type=Node)"
else
  echo "✗ shipin_APP 不在宝塔 site.db sites 表 (BUG-077 必备)"
  echo "  修法: 跑 docs/BAOTA_NODE_PROJECT_DEPLOY.md § 2 步骤 3.3 (7)"
  exit 1
fi

# 4.5 shipin_APP 启停脚本可执行
if [ -x "$BAOTA_SCRIPT" ]; then
  echo "    ✓ 启停脚本可执行"
else
  echo "    ⚠️ 启停脚本不可执行, 修复权限..."
  chmod +x "$BAOTA_SCRIPT"
fi

# 4.6 6000 端口空闲 (部署前)
if ss -tln | grep -q ":6000 "; then
  echo "    ⚠️ 6000 端口有进程, 杀掉..."
  pkill -f "node.*dist/index.js" || true
  sleep 2
fi

# ==================== 3. 备份 + 解压 ====================
echo ">>> [5/9] 备份当前 dist..."
BACKUP_NAME="dist.bak.s$(date +%Y%m%d_%H%M%S)"
cp -r ${DIST_DIR}/dist ${DIST_DIR}/${BACKUP_NAME}
echo "    ✓ 备份到 ${BACKUP_NAME}"

echo ">>> [6/9] 解压新 dist..."
if [ ! -f /tmp/dist.tar.gz ]; then
  echo "✗ /tmp/dist.tar.gz 不存在, 请先 scp 上传"
  exit 1
fi
rm -rf ${DIST_DIR}/dist
tar xzf /tmp/dist.tar.gz -C ${DIST_DIR}/
echo "    ✓ 解压完成"

# 验证 tsc 输出完整 (BUG-073 教训)
head -1 ${DIST_DIR}/dist/index.js | head -c 200
echo ""
if ! head -1 ${DIST_DIR}/dist/index.js | grep -q "const appConfig"; then
  echo "⚠️ tsc 输出可能不完整 (BUG-073), 验证 head 是否 201 行..."
  DIST_LINES=$(wc -l < ${DIST_DIR}/dist/index.js)
  if [ "$DIST_LINES" -lt 100 ]; then
    echo "✗ dist/index.js 只有 ${DIST_LINES} 行, tsc 编译坏, 回滚!"
    cp -r ${DIST_DIR}/${BACKUP_NAME} ${DIST_DIR}/dist
    exit 1
  fi
fi

# ==================== 3.5 同步 8 处版本号 (🆕 v3.0.33 S71 BUG-082 P3) ====================
# S71 BUG-082 P3 教训: S70 BUG-077 写完未同步 systemd unit + .env, 3 个月后 V3.0.33 升级时才修复
# 必须 2 处都改:
#   - .env APP_VERSION: process.env.APP_VERSION 实际生效
#   - systemd unit Environment=APP_VERSION: systemd 硬编码, 覆盖 [Service] Environment
# 详见 docs/VERSION_MANAGEMENT.md § 5.2 8 处自检

# 从 package.json 读版本号 (单源)
NEW_VERSION=$(python3 -c "import json; print(json.load(open('${DIST_DIR}/package.json'))['version'])" 2>/dev/null || echo "")
if [ -z "$NEW_VERSION" ]; then
  echo "⚠️ 读 package.json version 失败, 跳过 .env + systemd unit 同步 (S71 BUG-082 P3 风险)"
else
  echo ">>> [6.5/9] 同步 8 处版本号 (新版本 ${NEW_VERSION})..."

  # 改 .env APP_VERSION
  if grep -q "^APP_VERSION=" "${DIST_DIR}/.env" 2>/dev/null; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=${NEW_VERSION}/" "${DIST_DIR}/.env"
    echo "    ✓ .env APP_VERSION=${NEW_VERSION}"
  else
    echo "    ⚠️ .env 不存在或无 APP_VERSION 字段, 跳过"
  fi

  # 改 systemd unit Environment=APP_VERSION
  if [ -f /etc/systemd/system/${SERVICE_NAME}.service ]; then
    sed -i "s/^Environment=APP_VERSION=.*/Environment=APP_VERSION=${NEW_VERSION}/" /etc/systemd/system/${SERVICE_NAME}.service
    echo "    ✓ systemd unit Environment=APP_VERSION=${NEW_VERSION}"
  else
    echo "    ⚠️ /etc/systemd/system/${SERVICE_NAME}.service 不存在, 跳过"
  fi
fi

# ==================== 4. 重启 systemd + 宝塔同步 ====================
echo ">>> [7/9] 重启 systemd unit (走 systemd, 不是 PM2)..."
systemctl daemon-reload
systemctl restart $SERVICE_NAME
sleep 3
if ! systemctl is-active $SERVICE_NAME > /dev/null; then
  echo "✗ $SERVICE_NAME 启动失败, 看日志..."
  journalctl -u $SERVICE_NAME --no-pager -n 20
  exit 1
fi
echo "    ✓ $SERVICE_NAME active"

# 验证 /api/version 跟 package.json version 一致 (8 处同步的最终验证)
DEPLOYED_VER=$(curl -sm 5 ${SERVER}/api/version 2>/dev/null | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])' 2>/dev/null || echo "FAIL")
if [ "${DEPLOYED_VER}" != "${NEW_VERSION}" ] && [ -n "${NEW_VERSION}" ]; then
  echo "    ✗ /api/version 返 ${DEPLOYED_VER} 但 package.json 是 ${NEW_VERSION} (8 处同步失败!)"
  echo "    排查: journalctl -u $SERVICE_NAME --no-pager -n 30 | grep -i version"
  echo "    也查: cat /www/wwwroot/shipin-APP/.env | grep APP_VERSION"
  echo "    也查: grep APP_VERSION /etc/systemd/system/${SERVICE_NAME}.service"
  exit 1
fi
echo "    ✓ /api/version 验证: ${DEPLOYED_VER} (8 处同步成功)"

# 同步 PID 文件 (宝塔 panel 读这个判断启停)
MAIN_PID=$(systemctl show -p MainPID --value $SERVICE_NAME)
echo "$MAIN_PID" > $PID_FILE
echo "    ✓ PID 文件同步: $MAIN_PID"

# 同步 site.db shipin_APP config (run_user=root + is_power_on=true)
python3 << 'PYEOF'
import sqlite3, json
conn = sqlite3.connect("/www/server/panel/data/db/site.db")
cur = conn.cursor()
cur.execute("SELECT id, project_config FROM sites WHERE name = ?", ("shipin_APP",))
row = cur.fetchone()
if row:
    pid, old = row
    cfg = json.loads(old)
    cfg["run_user"] = "root"
    cfg["is_power_on"] = True
    cur.execute("UPDATE sites SET project_config = ? WHERE id = ?", (json.dumps(cfg, ensure_ascii=False), pid))
    conn.commit()
    print(f"    ✓ site.db shipin_APP config: run_user={cfg['run_user']} is_power_on={cfg['is_power_on']}")
else:
    print("    ✗ shipin_APP not found in site.db")
conn.close()
PYEOF

# ==================== 5. 12 维验证 ====================
echo ">>> [8/9] 12 维验证..."

# 服务自身 6 维
echo "1.  systemctl shipin-app: $(systemctl is-active $SERVICE_NAME)"
echo "2.  ss 6000:             $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
echo "3.  /health:             $(curl -sI -m 3 ${SERVER}/health | head -1 | tr -d \\r)"
echo "4.  /api/version:        $(curl -sm 3 ${SERVER}/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])' 2>/dev/null || echo 'FAIL')"
echo "5.  characterVariant:    $(curl -sm 3 ${SERVER}/api/pricing | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])' 2>/dev/null || echo 'FAIL')"
echo "6.  /api/novels:         $(curl -sI -m 3 ${SERVER}/api/novels | head -1 | tr -d \\r)"

# 宝塔 + 反代 4 维
echo "7.  宝塔 nginx 80:       $(ss -tln | grep ':80 ' | head -1 | awk '{print $4}')"
echo "8.  宝塔 panel 888:      $(ss -tln | grep ':888 ' | head -1 | awk '{print $4}')"
echo "9.  ab.maque.uno HTTPS:  $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])' 2>/dev/null || echo 'FAIL')"
echo "10. APK HTTP/2 200:      $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v$(curl -sm 3 ${SERVER}/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])').apk 2>/dev/null | head -1 | tr -d \\r)"

# 宝塔 Node 项目 shipin_APP 2 维 (BUG-077 核心)
echo "11. 宝塔 shipin_APP run: $(python3 -c '
import sys, json
sys.path.insert(0, "/www/server/panel")
sys.path.insert(0, "/www/server/panel/class")
import public
from projectModel.nodejsModel import main
m = main()
p = public.M("sites").where("project_type=? AND name=?", ("Node", "shipin_APP")).find()
if not p:
    print("NOT FOUND")
else:
    s = m.get_project_stat(p)
    if s.get("run"):
        pid = list(s["load_info"].keys())[0]
        mem = int(list(s["load_info"].values())[0]["memory_used"] / 1024 / 1024)
        user = list(s["load_info"].values())[0]["user"]
        print(f"run=True PID={pid} mem={mem}MB user={user}")
    else:
        print("run=False")
')"

echo "12. 宝塔 shipin_APP cfg: run_user=$(sqlite3 $SITE_DB "SELECT json_extract(project_config, '\$.run_user') FROM sites WHERE name='shipin_APP';") is_power_on=$(sqlite3 $SITE_DB "SELECT json_extract(project_config, '\$.is_power_on') FROM sites WHERE name='shipin_APP';")"

# ==================== 6. 关闭维护模式 + 完成公告 ====================
if [ "$COUNT" -gt 0 ] && [ "$SKIP_MAINTENANCE" = false ]; then
  echo ">>> [9/9] 关闭维护模式 + 发完成公告..."
  curl -s -X PUT "${SERVER}/api/admin/maintenance?enable=false" > /dev/null 2>&1
  curl -s -X POST "${SERVER}/api/notifications/admin/announcement" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"title":"系统升级完成","content":"系统维护已完成，已恢复正常使用。"}' > /dev/null 2>&1
  echo "    ✓ 维护模式关闭 + 完成公告发送"
fi

echo "=== 部署完成 (走 systemd + 宝塔 Node 项目同步) ==="
echo "📋 备份: ${BACKUP_NAME}"
echo "📋 回滚: bash deploy.sh --rollback"
echo "📋 宝塔 panel: https://<server_ip>:8888 → 项目 → shipin_APP → 验证已启动"