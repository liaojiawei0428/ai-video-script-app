# apps/server/AGENTS.md — Server 端 AI Agent 必读 (S68 瘦身)

> **本文件**: server 端 (Node + Express + MySQL + PM2) AI Agent 独有规范. 跟根 AGENTS.md + mobile AGENTS.md 对称.
> **必读顺序** (S68 收口后):
> 0. **[`../../AGENTS.md`](../../AGENTS.md)** — 跨端统一总入口 (中文/Persistence/铁律/工作流, **必先读**)
> 1. 本文件 — server 端独有 (部署 5 项 + 8 铁律 + 5 类任务 SOP + 代码架构)
> 2. **[`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)** — 跨端版本管理 (含 § 5.0 活跃任务部署)
> 3. **[`./deploy.sh`](./deploy.sh)** — server 远端部署脚本 (含完整维护模式流程)
> 4. **[`../../docs/DEPLOY.md`](../../docs/DEPLOY.md)** — server 部署完整 SOP (11 节点)
> 5. **[`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md)** — env 变量管理
> 6. **[`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md)** — PM2 + ecosystem 完整规范
> 7. **[`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)** — DB schema 迁移 SOP
> 8. **[`../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)** — 后端 worker 9 条实战约束
> 9. **[`../../apps/mobile/BUGS.md`](../../apps/mobile/BUGS.md)** — 跨端共用 BUG 案例库
> 10. **[`../../docs/standards/ADR/`](../../docs/standards/ADR/)** — 架构决策追溯
> 11. **[`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md)** — 规范自迭代 SOP

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
- **PM2**: `ecosystem.config.js` (env + env_production **2 处 APP_VERSION 必同步**, S66 BUG-069 教训)

## § 2. server 端部署前必跑 5 项 (S67 BUG-070 教训, 跨端铁律 5 强化)

> **S67 BUG-070 核心**: 之前 AI 按跨端 SOP § 5 跑, 跳过了活跃任务检查, 直接 `pm2 restart` 会**打断用户正在跑的小说分析 / 生图 / 生视频任务**, 浪费 token + 用户体验崩.

### § 2.1 必查活跃任务

```bash
# 服务器
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务数: $COUNT"
```

| COUNT | 行为 |
|---|---|
| `0` | 直接跑部署流程 (跨端铁律 5) |
| `> 0` | **必跑维护模式流程** (`apps/server/deploy.sh`, 见 § 2.2) |

**对应代码**: `apps/server/src/routes/admin.ts` (查 `task_jobs` 表 status='running'/'queued')

### § 2.2 维护模式 6 步流程 (S67 配套)

1. 检查活跃任务数 (§ 2.1)
2. 发维护公告 (`POST /api/notifications/admin/announcement`)
3. 开维护模式 (`PUT /api/admin/maintenance?enable=true`) — controller 拒绝新任务
4. 等任务跑完 (最多 15 分钟, 循环检查)
5. 执行部署 (`tar xzf + pm2 delete + start`)
6. 关维护模式 + 发完成公告

**触发**: server 有用户正在跑 AI 任务时**必跑**, 否则 token 钱白花 + 用户投诉。

**一键脚本**: 服务器端跑 `bash apps/server/deploy.sh` (含完整 6 步, 自动)

### § 2.3 必跑 6 维验证 (部署后, 跨端铁律 5 server 端)

```bash
pm2 env 0 | grep APP_VERSION          # 期望 = 当前版本 (S66 BUG-069 修过)
curl /health                          # 期望 200
curl /api/version                     # 期望 当前版本 + changelog + highlights
curl -X POST /api/novels              # 期望 401 (鉴权)
ss -tlnp | grep 6000                  # 期望 LISTEN
pm2 logs --lines 30 | grep ERROR      # 期望 0 ERROR
```

### § 2.4 必检查 env 变量

按 [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) § 4.1 跑:

```bash
for k in PORT NODE_ENV APP_VERSION JWT_SECRET MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS AGNES_API_KEY PAY_KEY; do
  grep -qE "^$k=" .env || echo "  ⚠️ 缺失: $k"
done
```

### § 2.5 必查规范自检 (AI 行为合规, 跨端铁律 3 自检)

```bash
grep '"version"' apps/server/package.json          # 期望 = 当前版本
grep "process.env.APP_VERSION ||" apps/server/src/index.ts
grep APP_VERSION apps/server/ecosystem.config.js   # 期望 = 2 处都同步
curl https://ab.maque.uno/api/version              # 期望 = 当前版本 + 真实 changelog
```

## § 3. server 端 8 条铁律 (S67 新增, 跨端铁律 4-6 server 端展开)

> 跨端铁律 3 (6 处版本号) / 铁律 4 (PM2 delete+start) / 铁律 5 (5/6 维验证) 跨端通用, 8 条铁律是 server 端独有强化:

1. **必读本文件 + `apps/server/deploy.sh` + `docs/DEPLOY.md`** — 任何 server 任务前必读
2. **有活跃任务必跑 `deploy.sh` 维护模式流程** — S67 BUG-070 教训, 不能直接 pm2 restart
3. **PM2 用 `delete + start`, 不用 `restart`** — BUG-008 教训, restart 不重读 .env (跨端铁律 4)
4. **APP_VERSION 改 1 处必同步 6 处** — 含 ecosystem.config.js (env + env_production), S66 BUG-069 教训 (跨端铁律 3)
5. **必填 env 缺一不可** — JWT_SECRET / MYSQL_* / DEEPSEEK_API_KEYS / AGNES_API_KEY / PAY_KEY 必填
6. **`>> .env` 追加, 不用 `> .env` 重写** — 覆盖会丢生产配置
7. **不删字段, 用 `_deprecated_` 前缀** — S66 DB_MIGRATION § 2.5 规范
8. **commit message 必带版本号 + BUG 编号** — `vX.Y.Z: <改动> (BUG-NNN + 规范修订)` (跨端铁律 6)

## § 4. 改 server 代码前后 5 步必做 (server 端独有)

### 改前 5 步

1. `Read ../../AGENTS.md` 跨端统一规范 (S68 收口后必先读)
2. `Read apps/server/deploy.sh` (部署脚本, 必读)
3. `Read ../../docs/DEPLOY.md` server 完整 SOP
4. `Read ../../docs/VERSION_MANAGEMENT.md` 跨端版本管理 (含 § 5.0 活跃任务部署)
5. `Grep` 关键 import / 函数是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)

### 改后 5 步

1. **改 6 处版本号** (跨端铁律 3) — mobile version.ts / mobile build.gradle / server package.json / server src/index.ts fallback / server ecosystem.config.js env + env_production / web src/config/version.ts / changelog.json
2. **本地 `tsc --noEmit` 0 错** (本机有 node, S66 起)
3. **本地 `npm run build`** (tsc → dist/)
4. **`cp changelog.json dist/changelog.json`** (S64 起必加, tsc 不复制 json)
5. **跑维护模式流程** (按 `apps/server/deploy.sh`, § 2.2)

## § 5. 常见 5 类任务必做 (server 端独有)

### 任务 A: 改 server 代码 (改 service / controller / route)

1. 读 BUGS.md (跨端共用, 防重蹈覆辙)
2. 读 src/shared/types.ts (字段真源)
3. 改代码 (mimic 现有风格, 不臆造字段)
4. 本地 `tsc --noEmit` 0 错 (防 S60-BUG-056 类型错)
5. 本地 `npm run build` (生成 dist/)
6. 跑维护模式流程部署 (§ 2.2)
7. 6 维验证 (§ 2.3)

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

1. `pm2 logs ai-script-server --lines 100 --nostream` 看错误
2. `curl /health` + `/api/version` 确认问题范围
3. **如果有活跃任务**: 先跑 `deploy.sh` 维护模式流程 (不能直接 restart, § 2.2)
4. 修复 + 部署
5. 写 BUG-NNN 进 apps/mobile/BUGS.md (跨端共用, server BUG 也写这里)

---

**server 部署完整 SOP** (11 节点) → [`../../docs/DEPLOY.md`](../../docs/DEPLOY.md)
**env 变量管理** → [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md)
**PM2 + ecosystem 完整规范** → [`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md)
**DB 迁移 SOP** → [`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)
**后端 worker 9 条实战约束** → [`../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

**🆕 S68 收口**: 跨端通用规范 (中文/Persistence/铁律/工作流) 已收口到根 [`../../AGENTS.md`](../../AGENTS.md), 本文件只保留 server 独有 5 节. 收口设计 → BUG-071 (跨端规范重复 GAP, S68 自检发现) + BUG-070 (维护模式流程 GAP) + 看根 AGENTS.md § 9.

> **最后更新**: 2026-06-24 (S68 收口, v1.1 瘦身版)
> **下次 review**: server 端有架构变更 / 新流程 / 维护模式机制变化时
