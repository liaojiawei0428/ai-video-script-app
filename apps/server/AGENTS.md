# apps/server/AGENTS.md — Server 端 AI Agent 必读 (S70 更新: 走 systemd + 宝塔 Node 项目)

> **本文件**: server 端 (Node + Express + MySQL + **systemd unit**) AI Agent 独有规范. 跟根 AGENTS.md + mobile AGENTS.md 对称.
> **必读顺序** (S68 收口后, S70 加宝塔路径, S72 batch 7 加 🆕 部署主入口):
> 0. **[`../../AGENTS.md`](../../AGENTS.md)** — 跨端统一总入口 (中文/Persistence/铁律/工作流, **必先读**)
> 0.5. **[`../../docs/DEPLOY_RELEASE_FLOW.md`](../../docs/DEPLOY_RELEASE_FLOW.md)** — 🆕 **S72 batch 7 部署 + 发布主入口 SOP (14 段 + 24 维验证 + 9 已知坑, 跨端统一)**
> 1. 本文件 — server 端独有 (部署 5 项 + 8 铁律 + 5 类任务 SOP + 代码架构)
> 2. **[`../../docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../../docs/BAOTA_NODE_PROJECT_DEPLOY.md)** — 🆕 **S70 宝塔 Node 项目部署 SOP (5 步流程 + 12 维验证 + 9 坑, BUG-077 修法)**
> 3. **[`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)** — 跨端版本管理 (含 § 5.0 活跃任务部署)
> 4. **[`./deploy.sh`](./deploy.sh)** — server 远端部署脚本 v2.0 (**S70 重写**: 走 systemd unit + 宝塔同步, 不再走 PM2)
> 5. **[`../../docs/DEPLOY.md`](../../docs/DEPLOY.md)** — server 部署完整 SOP (11 节点)
> 6. **[`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md)** — env 变量管理
> 7. **[`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md)** — PM2 + ecosystem 历史规范 (S70 起 deprecated, 仅供考古)
> 8. **[`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)** — DB schema 迁移 SOP
> 9. **[`../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)** — 后端 worker 9 条实战约束
> 10. **[`../../apps/mobile/BUGS.md`](../../apps/mobile/BUGS.md)** — 跨端共用 BUG 案例库 (**BUG-076/077/079/082/090/094/095/096/097/098/099 必读**)
> 11. **[`../../docs/standards/ADR/`](../../docs/standards/ADR/)** — 架构决策追溯
> 12. **[`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md)** — 规范自迭代 SOP

> **跨端规范 (中文/Persistence/铁律/工作流/代码 4 原则/禁新旧版) → 看根 [`../../AGENTS.md`](../../AGENTS.md), 本文件不重复**.

---

## § 1. server 项目速览 (Node + Express + MySQL)

- **入口**: `src/index.ts` (含 `/api/version`, `/health`, `/api/admin/*`)
- **routes**:
  - `src/routes/admin.ts` — 管理员后台 (active-tasks, maintenance, users)
  - `src/routes/notification.ts` — 公告推送 (含 `/admin/announcement`)
  - `src/routes/characters.ts` / `novels.ts` / `episodes.ts` / `shots.ts` / `tasks.ts` / `chat.ts` / `imageAgent.ts` / `videoAgent.ts` / `pricing.ts` / `recharge.ts`
- **controllers**: `src/controllers/*.ts` (12 个)
- **services**: `src/services/*.ts` (含 `scriptService` / `novelService` / `characterService` / `imageAgentService` / `videoAgentService` / `billingService` 等)
- **shared**: `src/shared/*.ts` (含 `changelog.ts` / `maintenance.ts` / `stylePresets.ts` / `types.ts` / `utils.ts`)
- **models**: `src/models/db.ts` (MySQL initTables 自动迁移)
- **middleware**: `src/middleware/auth.ts` (JWT 鉴权)
- **PM2**: `ecosystem.config.js` (env + env_production **2 处 APP_VERSION 必同步**, S66 BUG-069 教训, **S70 起 deprecated** — shipin-APP 走 systemd unit 路径)
- **systemd unit**: `/etc/systemd/system/shipin-app.service` (**S70 起 shipin-APP 唯一部署路径**, 跟宝塔 panel Node 项目同步, BUG-077 修法)
- **宝塔 Node 项目**: site.db sites 表 shipin_APP id=13 project_type='Node' (跟 systemd unit sync, 宝塔 panel 显示已启动)

## § 2. server 端部署前必跑 5 项 (S70 BUG-077 重构, 走 systemd + 宝塔路径)

> **S70 BUG-077 核心变化**: shipin-APP **不再走 PM2**, 改走 systemd unit + 宝塔 panel Node 项目同步. 部署路径完全重构, 未来 AI 必须按本文 § 2 SOP 走, **不要再用 `pm2 restart`**.

### § 2.1 必查活跃任务 (不变)

```bash
# 服务器
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务数: $COUNT"
```

| COUNT | 行为 |
|---|---|
| `0` | 直接跑部署流程 (走 systemd restart) |
| `> 0` | **必跑维护模式流程** (`bash deploy.sh`, 见 § 2.2) |

**对应代码**: `apps/server/src/routes/admin.ts` (查 `task_jobs` 表 status='running'/'queued')

### § 2.2 维护模式 9 步流程 (S70 重构, 走 systemd + 宝塔同步)

**完整 SOP**: [`../../docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../../docs/BAOTA_NODE_PROJECT_DEPLOY.md) § 2

服务器端跑 `bash apps/server/deploy.sh` 自动执行:

1. 检查活跃任务数 (§ 2.1)
2. 发维护公告 (`POST /api/notifications/admin/announcement`)
3. 开维护模式 (`PUT /api/admin/maintenance?enable=true`) — controller 拒绝新任务
4. 等任务跑完 (最多 15 分钟, 循环检查)
5. **部署前 6 维预检** (systemd unit NODE_PROJECT_NAME + apt nginx masked + 宝塔 nginx running + site.db shipin_APP + 启停脚本可执行 + 6000 端口空闲)
6. **备份 + 解压** (`dist.bak.s70-<timestamp>` + `tar xzf /tmp/dist.tar.gz` + tsc 输出完整验证防 BUG-073)
7. **重启 systemd** (`systemctl daemon-reload && systemctl restart shipin-app`) + **同步 PID 文件** (`/www/server/nodejs/vhost/pids/shipin_APP.pid`) + **同步 site.db config** (run_user=root + is_power_on=true)
8. **12 维验证** (systemd + 6000 + 6 API + 宝塔 nginx + 反代 + APK + 宝塔 Node 项目 shipin_APP run=True)
9. 关维护模式 + 发完成公告

**触发**: server 有用户正在跑 AI 任务时**必跑**, 否则 token 钱白花 + 用户投诉.

**一键脚本**: 服务器端跑 `bash apps/server/deploy.sh` (含完整 9 步, 自动)

### § 2.3 必跑 12 维验证 (部署后, 跨端铁律 5 server 端扩展)

```bash
# 6 维服务自身 (跟以前一样)
echo "1.  systemctl shipin-app: $(systemctl is-active shipin-app)"
echo "2.  ss 6000:             $(ss -tln | grep ':6000' | head -1 | awk '{print $4}')"
echo "3.  /health:             $(curl -sI -m 3 http://127.0.0.1:6000/health | head -1 | tr -d \\r)"
echo "4.  /api/version:        $(curl -sm 3 http://127.0.0.1:6000/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "5.  characterVariant:    $(curl -sm 3 http://127.0.0.1:6000/api/pricing | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["image"]["standard"]["characterVariant"]["amount"])')"
echo "6.  /api/novels:         $(curl -sI -m 3 http://127.0.0.1:6000/api/novels | head -1 | tr -d \\r)"

# 3 维宝塔 + 反代 (新加)
echo "7.  宝塔 nginx 80:       $(ss -tln | grep ':80 ' | head -1 | awk '{print $4}')"
echo "8.  宝塔 panel 888:      $(ss -tln | grep ':888 ' | head -1 | awk '{print $4}')"
echo "9.  ab.maque.uno HTTPS:  $(curl -skm 5 https://ab.maque.uno/api/version | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["version"])')"
echo "10. APK HTTP/2 200:      $(curl -sIk -m 5 https://ab.maque.uno/app/DeepScript_v3.0.29.apk | head -1 | tr -d \\r)"

# 2 维宝塔 Node 项目 shipin_APP (BUG-077 核心, 新加)
echo "11. 宝塔 shipin_APP run: $(python3 -c '
import sys, json
sys.path.insert(0, \"/www/server/panel\")
sys.path.insert(0, \"/www/server/panel/class\")
import public
from projectModel.nodejsModel import main
m = main()
p = public.M(\"sites\").where(\"project_type=? AND name=?\", (\"Node\", \"shipin_APP\")).find()
s = m.get_project_stat(p)
print(s.get(\"run\"), \"PID=\" + str(list(s.get(\"load_info\", {}).keys())[0]) if s.get(\"load_info\") else \"N/A\")
')"

echo "12. 宝塔 shipin_APP cfg: $(sqlite3 /www/server/panel/data/db/site.db \"SELECT json_extract(project_config, '\$.run_user') || '/' || json_extract(project_config, '\$.is_power_on') FROM sites WHERE name='shipin_APP';\")"
```

**期望所有 12 维全过** — 跟 S70 部署实测一致 (server.ts:30036 / 6000 / 200 / v3.0.29 / 0.1 / 401 / 80 / 888 / v3.0.29 / HTTP/2 200 / run=True PID=10890 / run_user=root is_power_on=true)

### § 2.4 必检查 env 变量 (不变)

按 [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) § 4.1 跑:

```bash
for k in PORT NODE_ENV APP_VERSION JWT_SECRET MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS AGNES_API_KEY PAY_KEY NODE_PROJECT_NAME; do
  grep -qE "^$k=" .env || echo "  ⚠️ 缺失: $k"
done
# 注意: NODE_PROJECT_NAME 必须 = shipin_APP (宝塔 get_project_state_by_cwd 依赖, BUG-077)
```

### § 2.5 必查规范自检 (AI 行为合规, 跨端铁律 3 自检)

```bash
grep '"version"' apps/server/package.json              # 期望 = 当前版本
grep "process.env.APP_VERSION ||" apps/server/src/index.ts
grep APP_VERSION apps/server/ecosystem.config.js       # 期望 = 2 处都同步 (S70 起 deprecated, 仅供历史兼容)
grep NODE_PROJECT_NAME /etc/systemd/system/shipin-app.service  # 期望 = shipin_APP (BUG-077)
curl https://ab.maque.uno/api/version                  # 期望 = 当前版本 + 真实 changelog
```

## § 3. server 端 8 条铁律 (S70 重构: PM2 → systemd unit)

> 跨端铁律 3 (6 处版本号) / 铁律 5 (12 维验证) 跨端通用, 8 条铁律是 server 端独有强化 (**S70 起 PM2 deprecated**):

1. **必读本文件 + `apps/server/deploy.sh` + `docs/BAOTA_NODE_PROJECT_DEPLOY.md`** — 任何 server 任务前必读
2. **有活跃任务必跑 `deploy.sh` 维护模式流程** — S67 BUG-070 教训, 不能直接 restart
3. **systemd 用 `restart`, 不用 `pm2 restart`** — S70 BUG-077 重构, shipin-APP **唯一**部署路径走 systemd unit (跟宝塔 panel Node 项目同步)
4. **APP_VERSION 改 1 处必同步 8 处** (v3.0.33 扩 6→8) — 含 ecosystem.config.js (env + env_production) + **🆕 .env** + **🆕 systemd unit Environment=APP_VERSION**, S66 BUG-069 + S71 BUG-082 P3 教训 (跨端铁律 3)
5. **必填 env 缺一不可** — JWT_SECRET / MYSQL_* / DEEPSEEK_API_KEYS / AGNES_API_KEY / PAY_KEY / **NODE_PROJECT_NAME=shipin_APP** (BUG-077 必备)
6. **`>> .env` 追加, 不用 `> .env` 重写** — 覆盖会丢生产配置
7. **不删字段, 用 `_deprecated_` 前缀** — S66 DB_MIGRATION § 2.5 规范
8. **commit message 必带版本号 + BUG 编号** — `vX.Y.Z: <改动> (BUG-NNN + 规范修订)` (跨端铁律 6)

## § 4. 改 server 代码前后 5 步必做 (server 端独有)

### 改前 5 步

1. `Read ../../AGENTS.md` 跨端统一规范 (S68 收口后必先读)
2. `Read ../../docs/BAOTA_NODE_PROJECT_DEPLOY.md` 宝塔 Node 项目部署 SOP (S70 必读)
3. `Read apps/server/deploy.sh` (部署脚本, 必读)
4. `Read ../../docs/DEPLOY.md` server 完整 SOP
5. `Read ../../docs/VERSION_MANAGEMENT.md` 跨端版本管理 (含 § 5.0 活跃任务部署)
6. `Grep` 关键 import / 函数是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)

### 改后 5 步

1. **改 8 处版本号** (v3.0.33 扩 6→8, 跨端铁律 3) — mobile version.ts / mobile build.gradle / server package.json / server src/index.ts fallback / server ecosystem.config.js env + env_production / web src/config/version.ts / changelog.json / **🆕 .env APP_VERSION** / **🆕 systemd unit Environment=APP_VERSION**
2. **本地 `tsc --noEmit` 0 错** (本机有 node, S66 起)
3. **本地 `npm run build`** (tsc → dist/)
4. **`cp changelog.json dist/changelog.json`** (S64 起必加, tsc 不复制 json)
5. **跑维护模式流程** (按 `apps/server/deploy.sh`, § 2.2) — **走 systemd restart, 不要 pm2 restart** (S70 BUG-077, deploy.sh v3.0.33 自动同步 .env + systemd unit + 验证 /api/version)

## § 5. 常见 5 类任务必做 (server 端独有)

### 任务 A: 改 server 代码 (改 service / controller / route)

1. 读 BUGS.md (跨端共用, 防重蹈覆辙, **BUG-076/077 必读**)
2. 读 src/shared/types.ts (字段真源)
3. 改代码 (mimic 现有风格, 不臆造字段)
4. 本地 `tsc --noEmit` 0 错 (防 S60-BUG-056 类型错)
5. 本地 `npm run build` (生成 dist/)
6. 跑维护模式流程部署 (§ 2.2)
7. **12 维验证** (§ 2.3, 含宝塔 Node 项目 shipin_APP run=True)

### 任务 B: 加新 API 端点

1. 读 routes/admin.ts (了解现有 admin 端点格式)
2. 改 routes/ + controllers/ + shared/types.ts
3. 更新 docs/VERSION_MANAGEMENT.md § 2.3 (API 列表)
4. 更新 apps/mobile + apps/web (前端配套)
5. 部署 + 验证

### 任务 C: 加新表 / 改 schema

1. 读 [`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md) § 1-2
2. 改 `src/models/db.ts` `initTables()` 加 CREATE TABLE IF NOT EXISTS
3. 用 try/catch 包 ALTER (防字段重复)
4. 更新 `apps/server/changelog.json` 当前版本条目 (加 schema 变更段)
5. 部署 (自动迁移)
6. `mysql SHOW COLUMNS` 验证生效

### 任务 D: 加新第三方 API (DeepSeek / Agnes / 支付宝)

1. 读 [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) § 1.3 (8 个第三方 Key)
2. 改 `.env.example` (加新 Key 模板)
3. 改 `ecosystem.config.js` (env 块加新 Key)
4. 改 `src/services/*.ts` (新 Provider)
5. 部署 + 验证

### 任务 E: 紧急生产故障 (5xx 爆发 / 进程死)

1. `journalctl -u shipin-app --no-pager -n 100` 看错误 (S70 起走 systemd, 不是 pm2 logs)
2. `curl /health` + `/api/version` 确认问题范围
3. **如果有活跃任务**: 先跑 `deploy.sh --skip-maintenance` 流程 (S70 重构, § 2.2)
4. 修复 + 部署
5. 写 BUG-NNN 进 apps/mobile/BUGS.md (跨端共用, server BUG 也写这里)

---

**server 部署完整 SOP** (11 节点) → [`../../docs/DEPLOY.md`](../../docs/DEPLOY.md)
**🆕 宝塔 Node 项目部署 SOP** (S70 v1.0, 5 步流程 + 12 维验证 + 9 坑) → [`../../docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../../docs/BAOTA_NODE_PROJECT_DEPLOY.md)
**env 变量管理** → [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md)
**PM2 + ecosystem 完整规范 (历史, S70 deprecated)** → [`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md)
**DB 迁移 SOP** → [`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)
**后端 worker 9 条实战约束** → [`../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

**🆕 S68 收口 + S70 重构**: 跨端通用规范 (中文/Persistence/铁律/工作流) 已收口到根 [`../../AGENTS.md`](../../AGENTS.md). S70 BUG-077 重构 shipin-APP 部署路径 (PM2 → systemd + 宝塔 Node 项目), **未来 AI 必走 systemd 路径**, 详细 SOP 在 [`../../docs/BAOTA_NODE_PROJECT_DEPLOY.md`](../../docs/BAOTA_NODE_PROJECT_DEPLOY.md).

> **最后更新**: 2026-06-27 (S72 batch 11+12 v2.2, 加 BUG-111 ETag ERR_HTTP_HEADERS_SENT 修法 SOP + § 4 铁律 3 补 跨项目通用 middleware setHeader 必在 body 发送前 + verify-deploy.sh 27 维 (含 BUG-079/080/082/090/111 防呆), 跟根 AGENTS.md v2.12 + mobile v1.4 + web v1.2 同步)
> **下次 review**: server 端有架构变更 / 新流程 / 维护模式机制变化时
