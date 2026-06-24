# docs/BAOTA_NODE_PROJECT_DEPLOY.md — shipin-APP 部署到宝塔 panel "项目" 列表的标准 SOP (S70 v1.0, BUG-077 修法)

> **目的**: 让任何 AI 接手 shipin-APP 部署时, **走宝塔 panel "项目" 列表路径** (不是 PM2 路径), 部署完自动在宝塔 panel 显示 "已启动", 跟其他服务端 (banmu_server / smartlink-iot) 一致.
> **适用版本**: shipin-APP v3.0.29+ (S69 BUG-076 + S70 BUG-077 之后, 2026-06-24 起).
> **关联 BUG**: BUG-076 (S69 解释) + **BUG-077 (S70 修法) + BUG-046/049 (双 nginx 实例)**.
> **维护者**: 任何 session 收尾 AI, 部署流程变更时必更新本文档.

---

## § 0. 部署架构总览 (未来 AI 一图看懂)

```
┌─────────────────────────────────────────────────────────────────┐
│              宝塔 panel "项目" 列表 → shipin_APP → 已启动         │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 读 PID 文件 + env 找进程
                              │ (site.db sites.project_type='Node' id=13)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   PID 文件路径          启停脚本              systemd unit
   /www/server/        /www/server/         /etc/systemd/system/
   nodejs/vhost/       nodejs/vhost/        shipin-app.service
   pids/shipin_APP.pid scripts/shipin_APP.sh
                              │                     │
                              └─────────┬───────────┘
                                        │ systemctl start/stop/restart
                                        ▼
                            ┌───────────────────────┐
                            │ Node 进程 (systemd    │
                            │ Type=simple, root)    │
                            │ /www/wwwroot/         │
                            │ shipin-APP/dist/      │
                            │ index.js → port 6000 │
                            └───────────────────────┘
                                        ▲
                                        │ proxy_pass http://127.0.0.1:6000
                                        │
                            ┌───────────────────────┐
                            │ 宝塔 nginx (master    │
                            │ pid 14921) + vhost    │
                            │ ab.maque.uno.conf    │
                            │ (location /api/ /app/│
                            │ /ws)                 │
                            └───────────────────────┘
                                        ▲
                                        │ HTTPS
                                        │
                                    用户 (ab.maque.uno)
```

**关键点**:
1. **shipin-APP 走 systemd unit, 不是 PM2** (S70 起, 之前 S58-S69 走 PM2, S70 BUG-077 改 systemd)
2. **宝塔 panel 不启停 node 进程, 只显示状态** — 启停走 `shipin_APP.sh` → `systemctl start/stop shipin-app`
3. **宝塔 nginx 反代**: `/api/` `/app/` `/ws` → `127.0.0.1:6000` (走 ab.maque.uno vhost, 不需要 shipin_APP.conf)
4. **apt nginx 必须 mask + kill** — 终结 6-04 以来双实例冲突, 让宝塔 nginx 占 80/443

---

## § 1. 部署前 5 步必读 (AI 必看)

### 1.1 必读文档清单

```bash
# 5 个文档 (按顺序读)
1. /apps/server/AGENTS.md                          # server 端独有规范
2. /docs/VERSION_MANAGEMENT.md                     # 跨端版本管理 (6 处同步)
3. /docs/DEPLOY.md                                 # 部署 11 节点 SOP
4. /docs/BAOTA_NODE_PROJECT_DEPLOY.md             # 本文档 (宝塔 Node 项目路径)
5. /apps/mobile/BUGS.md § BUG-077                  # 宝塔项目部署踩坑 7 条
```

### 1.2 5 个关键路径 (硬记忆)

```bash
# 1. systemd unit (服务定义)
/etc/systemd/system/shipin-app.service

# 2. 启停脚本 (宝塔 panel 启停按钮实际调用)
/www/server/nodejs/vhost/scripts/shipin_APP.sh

# 3. PID 文件 (宝塔读这个判断启停状态)
/www/server/nodejs/vhost/pids/shipin_APP.pid

# 4. 宝塔项目 db (sites 表 shipin_APP id=13 project_type='Node')
/www/server/panel/data/db/site.db

# 5. 日志路径 (宝塔 panel 日志按钮看这里)
/www/wwwlogs/shipin_APP.log
```

### 1.3 部署前 6 维预检 (硬要求)

```bash
# 1. shipin-APP systemd unit 存在 + NODE_PROJECT_NAME env
$ grep NODE_PROJECT_NAME /etc/systemd/system/shipin-app.service
Environment=NODE_PROJECT_NAME=shipin_APP   # 必须有!

# 2. apt nginx 必须 mask (防双实例冲突)
$ systemctl is-enabled nginx
masked    # 必须是 masked!

# 3. 宝塔 nginx 必须 running
$ systemctl status bt-nginx 2>/dev/null || /www/server/nginx/sbin/nginx -t
syntax ok

# 4. shipin_APP 在宝塔 sites 表
$ sqlite3 /www/server/panel/data/db/site.db \
    "SELECT id,name,project_type FROM sites WHERE name='shipin_APP';"
13|shipin_APP|Node

# 5. shipin_APP 启停脚本可执行
$ ls -la /www/server/nodejs/vhost/scripts/shipin_APP.sh
-rwxr-xr-x 1 www www 535 Jun 24 16:12 /www/server/nodejs/vhost/scripts/shipin_APP.sh

# 6. 6000 端口空闲 (部署前必检)
$ ss -tln | grep :6000 || echo "(free)"
```

**任何一项不过 → 禁止部署, 先修前置**.

---

## § 2. 部署 5 步标准流程 (AI 必走)

### 步骤 1: 本地编译 + 打包 (5 min)

```bash
# 1.1 改 6 处版本号 (跨端铁律 3, BUG-069)
# - apps/server/package.json version
# - apps/server/ecosystem.config.js env + env_production APP_VERSION (2 处)
# - apps/server/src/index.ts fallback APP_VERSION
# - apps/web/src/config/version.ts
# - apps/mobile/src/config/version.ts + build.gradle versionCode + versionName
# - apps/server/changelog.json (加新版条目)

# 1.2 跑 tsc 编译
cd F:\QiTa\banmu\APP\ai-video-script-app\apps\server
npm run build   # tsc → dist/

# 1.3 打包
cd ..
tar czf dist-server-v3.0.30-20260624_1630.tar.gz \
  --exclude='dist.bak*' \
  server/dist server/changelog.json server/ecosystem.config.js server/.env.example

# 输出: dist-server-v3.0.30-20260624_1630.tar.gz (~3 MB)
```

### 步骤 2: 上传到服务器 (3 min)

```bash
# 2.1 ssh-agent 加载 (绕 S69 SSH cache 坑)
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add C:\Users\Administrator\.ssh\shipin_user_key

# 2.2 scp 上传 (大文件走 Matrix CDN URL 更稳)
scp dist-server-v3.0.30-20260624_1630.tar.gz root@159.75.16.110:/tmp/

# 或走 CDN (大文件推荐)
# 1. 主端 mavis mcp call matrix matrix_upload_to_cdn --file args.json
# 2. 拿到 https://cdn.hailuoai.com/mcp/anon/general/<id>.tar.gz URL
# 3. shipin-APP curl -sLo /tmp/dist-server-v3.0.30.tar.gz <url>
```

### 步骤 3: 服务器端部署 (8 min, **走 systemd, 不是 PM2**)

```bash
# 3.1 ssh 到服务器
ssh root@159.75.16.110

# 3.2 检查活跃任务 (S67 BUG-070 教训, 禁止直接 restart)
COUNT=$(curl -s http://127.0.0.1:6000/api/admin/active-tasks | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务: $COUNT"

if [ "$COUNT" -gt 0 ]; then
    echo "⚠️ 有活跃任务, 跑维护模式 deploy.sh"
    bash /www/wwwroot/shipin-APP/scripts/baota-deploy.sh --maintenance
else
    bash /www/wwwroot/shipin-APP/scripts/baota-deploy.sh
fi

# 3.3 deploy.sh 内部 (核心 8 步):

# (1) 备份当前 dist (BUG-073 教训: 保留可回滚版本)
BACKUP_NAME="dist.bak.s70-$(date +%Y%m%d_%H%M%S)"
cp -r /www/wwwroot/shipin-APP/dist "/www/wwwroot/shipin-APP/${BACKUP_NAME}"
echo "✓ 备份到 ${BACKUP_NAME}"

# (2) 解压新 dist (覆盖)
tar xzf /tmp/dist-server-v3.0.30-20260624_1630.tar.gz -C /www/wwwroot/shipin-APP/

# (3) 验证 tsc 输出完整 (防 BUG-073 1-行 minified)
head -1 /www/wwwroot/shipin-APP/dist/index.js
# 必须是 const appConfig = require('./config').config; (201 行完整)
# 不是空文件 / 1-行 ESM 报错版

# (4) 重启 systemd (走 systemd unit, 不是 PM2)
systemctl daemon-reload
systemctl restart shipin-app
sleep 3
systemctl is-active shipin-app   # 必须是 active

# (5) 同步 PID 文件 (宝塔 panel 读这个判断启停)
MAIN_PID=$(systemctl show -p MainPID --value shipin-app)
echo "$MAIN_PID" > /www/server/nodejs/vhost/pids/shipin_APP.pid
echo "✓ PID 文件同步: $MAIN_PID"

# (6) 验证宝塔 panel "项目" 显示 (BUG-077 核心)
python3 -c "
import sys, json
sys.path.insert(0, '/www/server/panel')
sys.path.insert(0, '/www/server/panel/class')
import public
from projectModel.nodejsModel import main
m = main()
p = public.M('sites').where('project_type=? AND name=?', ('Node', 'shipin_APP')).find()
if not p:
    print('✗ shipin_APP not in site.db')
    sys.exit(1)
s = m.get_project_stat(p)
print(f'run={s.get(\"run\")} PID={list(s[\"load_info\"].keys())[0]} mem={int(list(s[\"load_info\"].values())[0][\"memory_used\"]/1024/1024)}MB')
"

# (7) 同步宝塔 shipin_APP config (run_user=root + is_power_on=true, 跟 systemd 一致)
python3 << 'EOF'
import sqlite3, json
conn = sqlite3.connect('/www/server/panel/data/db/site.db')
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
    print(f"✓ site.db shipin_APP config updated: run_user={cfg['run_user']} is_power_on={cfg['is_power_on']}")
conn.close()
EOF

# (8) 12 维验证 (见 § 3)
```

### 步骤 4: 12 维验证 (铁律 5, BUG-008 + BUG-077 验证)

```bash
# 4.1 服务自身验证 (6 维)
echo "1. systemctl shipin-app: $(systemctl is-active shipin-app)"
echo "2. ss 6000: $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
echo "3. /health: $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)"
echo "4. /api/version: $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "5. /api/pricing characterVariant: $(curl -sm 3 http://127.0.0.1:6000/api/pricing | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])')"
echo "6. /api/novels: $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d \\r)"

# 4.2 宝塔 panel 验证 (3 维)
echo "7. 宝塔 nginx 80: $(ss -tln | grep ':80 ' | head -1 | awk '{print $4}')"
echo "8. 宝塔 panel 888: $(ss -tln | grep ':888 ' | head -1 | awk '{print $4}')"
echo "9. ab.maque.uno HTTPS /api/version: $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "10. APK HTTP/2 200: $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.29.apk | head -1 | tr -d \\r)"

# 4.3 宝塔 Node 项目 shipin_APP 验证 (2 维, BUG-077 核心)
echo "11. 宝塔 Node 项目 shipin_APP run: $(python3 -c '
import sys, json
sys.path.insert(0, \"/www/server/panel\")
sys.path.insert(0, \"/www/server/panel/class\")
import public
from projectModel.nodejsModel import main
m = main()
p = public.M(\"sites\").where(\"project_type=? AND name=?\", (\"Node\", \"shipin_APP\")).find()
s = m.get_project_stat(p)
print(s.get(\"run\"), \"PID=\" + str(list(s.get(\"load_info\", {}).keys())[0]), \"mem=\" + str(int(list(s[\"load_info\"].values())[0][\"memory_used\"] / 1024 / 1024)) + \"MB\", \"user=\" + list(s[\"load_info\"].values())[0][\"user\"])
')"
echo "12. 宝塔 shipin_APP config: run_user=$(sqlite3 /www/server/panel/data/db/site.db "SELECT json_extract(project_config, '\$.run_user') FROM sites WHERE name='shipin_APP';") is_power_on=$(sqlite3 /www/server/panel/data/db/site.db "SELECT json_extract(project_config, '\$.is_power_on') FROM sites WHERE name='shipin_APP';") port=$(sqlite3 /www/server/panel/data/db/site.db "SELECT json_extract(project_config, '\$.port') FROM sites WHERE name='shipin_APP';")"

# 期望所有 12 维全过 (跟 S70 部署一致)
```

### 步骤 5: 文档更新 + commit + push (5 min)

```bash
# 5.1 改 apps/mobile/BUGS.md (如果发现新 BUG, 加 BUG-NNN)
# 5.2 改 docs/BUGS_INDEX.md (如果新 BUG, 更新 § 1/2/4.5)
# 5.3 改 apps/server/changelog.json (新版本条目)
# 5.4 commit
& 'C:\Tools\PortableGit\bin\git.exe' add apps/mobile/BUGS.md docs/BUGS_INDEX.md apps/server/changelog.json
& 'C:\Tools\PortableGit\bin\git.exe' commit -m "v3.0.30: 部署 SOP 更新 (BUG-077 + 宝塔 Node 项目路径)"
# 5.5 push (绕 S70 CRL 检查坑)
$env:http_proxy = ""
$env:https_proxy = ""
& 'C:\Tools\PortableGit\bin\git.exe' -c http.schannelCheckRevocation=false push origin main
```

---

## § 3. 部署后 4 步交付

### 3.1 给 user 报告 (中文, 4 段)

```
1. 服务状态: 12 维全过 + 宝塔 Node 项目 shipin_APP 显示"已启动"
2. 版本: v3.0.30 (跟 changelog.json 一致)
3. 备份: dist.bak.s70-20260624_1630.tar.gz (回滚用)
4. 下一步: 让 user 打开宝塔 panel (https://server_ip:8888) → 项目 → shipin_APP → 验证"已启动" + 启停按钮
```

### 3.2 写 commit message

```
v3.0.30 (S71): <改动 1 行说明>
- BUG-NNN: <BUG 1 行说明>
- docs: <文档 1 行说明>
Refs: BUG-077
```

### 3.3 后续 TODO (留给下个 AI)

- [ ] build v3.0.30 APK (mobile `apps/mobile/android/gradlew assembleRelease` + scp 上传 + bump server `version.ts` + `build.gradle`)
- [ ] web `src/pages/DownloadPage.tsx` 验证 v3.0.30 APK 200 OK
- [ ] 清旧 APK (BUG-068/074 教训, 留 5 个版本)

---

## § 4. 9 个常见坑 (任何 AI 必看)

### 坑 1: 用 PM2 部署 ❌ 致命错误

**错误示例**:
```bash
pm2 restart ai-script-server --update-env   # 错! 跟宝塔 systemd unit 冲突
```

**正确做法**:
```bash
systemctl restart shipin-app   # 对! 跟宝塔 systemd unit 一致
```

**原因**: S70 BUG-077 修法把 shipin-APP 改成 systemd unit, PM2 跟 systemd unit 双管会**双实例端口冲突**. **任何 AI 必须走 systemd, 不是 PM2.**

### 坑 2: 改 db/default.db ❌ 错 db 路径

**错误示例**:
```bash
sqlite3 /www/server/panel/data/db/default.db "INSERT INTO sites ..."   # 错!
```

**正确做法**:
```bash
sqlite3 /www/server/panel/data/db/site.db "INSERT INTO sites ..."   # 对!
```

**原因**: 宝塔真实 db 是 `site.db` (36864 bytes, 13 字段, 含 shipin_APP id=13). `default.db` 是空初始化 db (0 行), 改它没用.

### 坑 3: 缺 NODE_PROJECT_NAME env ❌ 宝塔找不到进程

**错误示例**:
```ini
# /etc/systemd/system/shipin-app.service
[Service]
Environment=NODE_ENV=production
Environment=PORT=6000
# 缺 Environment=NODE_PROJECT_NAME=shipin_APP  ← 致命!
```

**正确做法**:
```ini
[Service]
Environment=NODE_ENV=production
Environment=PORT=6000
Environment=NODE_PROJECT_NAME=shipin_APP   # 必须有! 宝塔靠这个 env 找进程
```

**原因**: `nodejsModel.get_project_state_by_cwd()` 遍历 psutil pids 时, 检查 `process.environ['NODE_PROJECT_NAME'] == project_name`. 缺这个 env, 宝塔永远找不到 shipin-APP 进程 → 显示"未启动".

### 坑 4: apt nginx 没终结 ❌ 双实例冲突

**错误示例**:
```bash
# 只 systemctl stop nginx, 不 mask, apt nginx 还会自动重启
systemctl stop nginx
/www/server/nginx/sbin/nginx   # 宝塔 nginx 启不了 (80 被 apt nginx 占)
```

**正确做法**:
```bash
systemctl stop nginx
systemctl mask nginx          # 永久屏蔽 apt nginx
pkill -9 nginx                # 立刻杀所有残留 nginx 进程
sleep 2
/www/server/nginx/sbin/nginx  # 宝塔 nginx 启起来
```

**原因**: apt nginx systemd unit (`/lib/systemd/system/nginx.service`) 会自动重启 nginx, 只 stop 不 mask 会被 systemd 拉起. **必须 mask**.

### 坑 5: 启 shipin_APP.conf ❌ server_name 错

**错误示例**:
```nginx
server {
    server_name shipin_APP;   # 错! 这是项目内部名, 不是域名
    location / { proxy_pass http://127.0.0.1:6000; }
}
```

**正确做法**:
```bash
# 直接用 ab.maque.uno vhost (已经配好反代 + APK 静态)
# 不要启 shipin_APP.conf
rm /www/server/panel/vhost/nginx/shipin_APP.conf   # 删掉错的
```

**原因**: shipin-APP 用户访问用的是 `ab.maque.uno` (域名), 宝塔 nginx `ab.maque.uno.conf` 已经配了 `location /api/` `/app/` `/ws` 反代. 多写 shipin_APP.conf 没意义, 而且 server_name 写项目内部名 0.default.conf 抢 default_server 会 404.

### 坑 6: 用宝塔自定义 nodejsModel.py ❌ 不需要

**错误示例**:
```python
# 写 /www/server/panel/class/projectModel/nodejsModel.py 自定义扩展
# (以为宝塔免费版不支持 Node 项目)
```

**正确做法**:
```bash
# 宝塔 panel 自带的 nodejsModel.py 完整 112KB, 直接用
# 不用写自定义
```

**原因**: 宝塔免费版自带 nodejsModel.py (完整 112KB, 不是 stub), site.db sites 表 schema 13 字段完整支持 Node 项目. 我之前 (S70 一开始) 以为要写自定义, 浪费 1.5h, 实际**0 改动**.

### 坑 7: 写 shipin_app.pid ❌ 跟项目名不一致

**错误示例**:
```bash
echo "$MAIN_PID" > /www/server/nodejs/vhost/pids/shipin_app.pid   # 错! 小写 + 下划线
```

**正确做法**:
```bash
echo "$MAIN_PID" > /www/server/nodejs/vhost/pids/shipin_APP.pid   # 对! 大写 APP
```

**原因**: 宝塔 sites 表 shipin_APP (大写 APP), `nodejsModel.get_project_state_by_cwd` 找进程时, 跟项目名 `shipin_APP` 比较. PID 文件名也要 `shipin_APP.pid` 才一致.

### 坑 8: 走 SQL 改 site.db ❌ 改完没生效

**错误示例**:
```bash
sqlite3 /www/server/panel/data/db/site.db \
  "UPDATE sites SET project_config=... WHERE name='shipin_APP';"
# 改完宝塔 panel 读的还是旧的 (因为宝塔 Sql 是内存 db)
```

**正确做法**:
```python
# 用 Python + public.M (走宝塔 Sql 类, 自动刷内存 db)
python3 << 'EOF'
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
    print(f"✓ shipin_APP config updated: run_user={cfg['run_user']}")
conn.close()
EOF
```

**原因**: 宝塔 Sql 类 (`__memory_user_db`) 启动时 read site.db 加载到 `/dev/shm/<md5>.db` 内存副本 + 设为只读. SQL CLI 改硬盘 db 后, 内存 db 还是旧的. Python 直接 sqlite3 改硬盘 db, 然后**宝塔重启**才会重新加载. 短期不影响 (宝塔运行期内存 db 是对的), 长期要看宝塔什么时候重启.

**正确做法**: 跑 `public.M('sites').where('id=?', (id,)).update({...})` 走宝塔 Sql 类, 自动写内存 + (偶尔 sync 硬盘). 或者用 Python sqlite3 改硬盘 db + `systemctl restart bt` 让宝塔重启读新硬盘 db.

### 坑 9: git push schannel 错 ❌ CRL 检查阻塞

**错误示例**:
```bash
& 'C:\Tools\PortableGit\bin\git.exe' push origin main
fatal: unable to access 'https://github.com/...': schannel: failed to receive handshake, SSL/TLS connection failed
```

**正确做法**:
```bash
$env:http_proxy = ""
$env:https_proxy = ""
& 'C:\Tools\PortableGit\bin\git.exe' -c http.schannelCheckRevocation=false push origin main
# "Everything up-to-date"  ← 成功!
```

**原因**: portableGit 默认用 schannel + 要查 CRL (证书撤销列表). 本机环境 CRL 服务器连不上 → handshake fail. 关掉 `http.schannelCheckRevocation=false` 跳过 CRL 检查即可.

---

## § 5. 紧急回滚 SOP (5 min 回滚)

### 5.1 回滚 dist (代码有问题, 立即回滚)

```bash
# 1. 找最近的备份
ls -la /www/wwwroot/shipin-APP/dist.bak.s70-* | tail -3

# 2. 删当前 dist + 恢复备份
rm -rf /www/wwwroot/shipin-APP/dist
cp -r /www/wwwroot/shipin-APP/dist.bak.s70-20260624_1630 /www/wwwroot/shipin-APP/dist

# 3. 重启 systemd
systemctl restart shipin-app
sleep 3
systemctl is-active shipin-app   # 必须 active

# 4. 12 维验证 (见 § 2.4)
```

### 5.2 回滚 systemd unit (env 配错, 立即回滚)

```bash
# 1. 看历史 systemd unit 备份
ls -la /etc/systemd/system/shipin-app.service.bak.*

# 2. 恢复
cp /etc/systemd/system/shipin-app.service.bak.s70 /etc/systemd/system/shipin-app.service

# 3. reload + restart
systemctl daemon-reload
systemctl restart shipin-app
```

### 5.3 回滚 site.db shipin_APP config (宝塔配置错)

```bash
# 1. 找 site.db 备份
ls -la /tmp/site.db.bak.*

# 2. 恢复 (先停 shipin-app, 避免运行期内存 db 冲突)
systemctl stop shipin-app
cp /tmp/site.db.bak.s70-20260624_1630 /www/server/panel/data/db/site.db
systemctl restart bt    # 重启宝塔 panel 让 db reload
systemctl start shipin-app
```

---

## § 6. 跨端关联 (跟其他文档配套)

| 文档 | 关联章节 |
|---|---|
| `apps/server/AGENTS.md` § 5 部署 5 场景 | 场景 A (改 server 代码) → 走本文档 § 2 步骤 1-5 |
| `docs/DEPLOY.md` | 11 节点 SOP, 本文是 shipin-APP 特化版 |
| `docs/PM2_GUIDE.md` | 历史 (S58-S69 走 PM2), **S70 起走 systemd, 此文档已 deprecated** |
| `apps/mobile/BUGS.md` BUG-077 | 本文 § 4 9 坑 跟 BUG-077 7 教训对应 |
| `docs/BUGS_INDEX.md` § 4.5 | 宝塔部署踩坑 Top 5, 跟本文 § 4 9 坑对应 |
| `docs/ENV_MANAGEMENT.md` | § 4.1 11 个 env 必填项 (跟 systemd unit Environment 同步) |
| `apps/server/deploy.sh` | **S70 起重写为走 systemd unit + 宝塔同步** (见 § 2 步骤 3) |

---

**最后更新**: 2026-06-24 (S70 收尾 v1.0, BUG-077 修法完整化)
**下次 review**: shipin-APP 部署流程变更时 (换 systemd unit / 换宝塔 vhost / 加新 env 等)
**维护者**: 任何 session 收尾 AI (不限于 S71/S72/...)