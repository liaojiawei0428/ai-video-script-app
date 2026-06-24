# Deep剧本 Server — AI Agent 必读

> **你是什么角色**: 任何 AI 接手 shipin-APP 项目, **执行 server 端代码修改 / 部署 / 调试前**必读本文件。
>
> **版本**: v1.0 (2026-06-24 S67 新建)
>
> **本文件覆盖范围**: server 端 AI 行为规范 (跟 mobile AGENTS.md 对称)

---

## 必读优先级 (跟 mobile AGENTS.md 对称)

**任何 AI 接到 server 任务, 必按以下顺序读**:

0. **[`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md)** — 规范自迭代 SOP (最高优先)
1. **[`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)** — 跨端版本管理 (含 § 5.1 活跃任务部署)
2. **[`./deploy.sh`](./deploy.sh)** — server 远端部署脚本 (67 行, 含完整维护模式流程)
3. **[`../../docs/DEPLOY.md`](../../docs/DEPLOY.md)** — server 部署完整 SOP (568 行, 11 节点)
4. **[`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md)** — env 变量管理
5. **[`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md)** — PM2 + ecosystem 完整规范
6. **[`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md)** — DB schema 迁移 SOP
7. **[`../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](../../docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)** — 后端 worker 9 条实战约束
8. **[`../../docs/standards/ADR/`](../../docs/standards/ADR/)** — 架构决策追溯

---

## 🔴 server 端部署前必跑 (5 项)

**这是 S67 BUG-070 教训** — 之前 AI 按跨端 SOP § 5 跑, 跳过了活跃任务检查, 直接 `pm2 restart` 会**打断用户正在跑的小说分析 / 生图 / 生视频任务**, 浪费 token + 用户体验崩。

### 1. 必查活跃任务

```bash
# 服务器
COUNT=$(curl -s "${SERVER}/api/admin/active-tasks" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")
echo "活跃任务数: $COUNT"
```

| COUNT | 行为 |
|---|---|
| `0` | 直接跑部署流程 |
| `> 0` | **必跑维护模式流程** (见下面 § 部署 SOP) |

**对应代码**: `apps/server/src/routes/admin.ts:136` (查 `task_jobs` 表 status='running'/'queued')

### 2. 必读 `apps/server/deploy.sh`

**6 步流程** (维护模式 + 部署 + 恢复):
1. 检查活跃任务数
2. 发维护公告 (`POST /api/notifications/admin/announcement`)
3. 开维护模式 (`PUT /api/admin/maintenance?enable=true`) — controller 拒绝新任务
4. 等任务跑完 (最多 15 分钟, 循环检查)
5. 执行部署 (`tar xzf + pm2 restart`)
6. 关维护模式 + 发完成公告

**触发**: server 有用户正在跑 AI 任务时**必跑**, 否则 token 钱白花 + 用户投诉。

### 3. 必跑 6 维验证 (部署后)

```bash
pm2 env 0 | grep APP_VERSION          # 期望 = 当前版本 (S66 BUG-069 修过)
curl /health                          # 期望 200
curl /api/version                     # 期望 当前版本 + changelog + highlights
curl -X POST /api/novels              # 期望 401 (鉴权)
ss -tlnp | grep 6000                  # 期望 LISTEN
pm2 logs --lines 30 | grep ERROR      # 期望 0 ERROR
```

### 4. 必检查 env 变量

按 [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) § 4.1 跑:

```bash
for k in PORT NODE_ENV APP_VERSION JWT_SECRET MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS AGNES_API_KEY PAY_KEY; do
  grep -qE "^$k=" .env || echo "  ⚠️ 缺失: $k"
done
```

### 5. 必查规范自检 (AI 行为合规)

按 [`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md) § 4 跑 5 维过时检查:

```bash
grep '"version"' apps/server/package.json          # 期望 = 当前版本
grep "process.env.APP_VERSION ||" apps/server/src/index.ts
grep APP_VERSION apps/server/ecosystem.config.js   # 期望 = 2 处都同步
curl https://ab.maque.uno/api/version              # 期望 = 当前版本 + 真实 changelog
```

---

## server 端代码改完后必做 (5 步)

1. **改 6 处版本号** (mobile version.ts / mobile build.gradle / server package.json / server src/index.ts fallback / server ecosystem.config.js env + env_production / web src/config/version.ts / changelog.json)
2. **本地 `tsc --noEmit` 0 错** (本机有 node, S66 起)
3. **本地 `npm run build`** (tsc → dist/)
4. **`cp changelog.json dist/changelog.json`** (S64 起必加, tsc 不复制 json)
5. **跑维护模式流程** (按 `apps/server/deploy.sh`)

---

## 改代码前 5 步必做

1. `Read ../../docs/STANDARDS_EVOLUTION.md` 规范自迭代 SOP (S67 最高优先)
2. `Read apps/server/deploy.sh` (部署脚本, 必读)
3. `Read ../../docs/DEPLOY.md` server 完整 SOP
4. `Read ../../docs/VERSION_MANAGEMENT.md` 跨端版本管理 (含 § 5.1 活跃任务部署)
5. `Grep` 关键 import / 函数是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)

---

## server 端代码架构 (速览)

- **入口**: `src/index.ts` (含 `/api/version`, `/health`, `/api/admin/*`)
- **routes**:
  - `src/routes/admin.ts` (187 行) — 管理员后台 (active-tasks, maintenance, users)
  - `src/routes/notification.ts` — 公告推送 (含 `/admin/announcement`)
  - `src/routes/characters.ts` / `novels.ts` / `episodes.ts` / `shots.ts` / `tasks.ts` / `chat.ts` / `imageAgent.ts` / `videoAgent.ts` / `pricing.ts` / `recharge.ts`
- **controllers**: `src/controllers/*.ts` (12 个)
- **services**: `src/services/*.ts` (含 `scriptService` / `novelService` / `characterService` / `imageAgentService` / `videoAgentService` / `billingService` 等)
- **shared**: `src/shared/*.ts` (含 `changelog.ts` / `maintenance.ts` / `stylePresets.ts` / `types.ts` / `utils.ts`)
- **models**: `src/models/db.ts` (MySQL initTables 自动迁移)
- **middleware**: `src/middleware/auth.ts` (JWT 鉴权)

---

## server 端 8 条铁律 (S67 新增)

1. **必读本文件 + `apps/server/deploy.sh` + `docs/DEPLOY.md`** — 任何 server 任务前必读
2. **有活跃任务必跑 `deploy.sh` 维护模式流程** — S67 BUG-070 教训, 不能直接 pm2 restart
3. **PM2 用 `delete + start`, 不用 `restart`** — BUG-008 教训, restart 不重读 .env
4. **APP_VERSION 改 1 处必同步 6 处** — 含 ecosystem.config.js (env + env_production), S66 BUG-069 教训
5. **必填 env 缺一不可** — JWT_SECRET / MYSQL_* / DEEPSEEK_API_KEYS / AGNES_API_KEY / PAY_KEY 必填
6. **`>> .env` 追加, 不用 `> .env` 重写** — 覆盖会丢生产配置
7. **不删字段, 用 `_deprecated_` 前缀** — S66 DB_MIGRATION § 2.5 规范
8. **commit message 必带版本号 + BUG 编号** — `vX.Y.Z: <改动> (BUG-NNN + 规范修订)`

---

## 常见 5 类任务必做

### 任务 A: 改 server 代码 (改 service / controller / route)

1. 读 BUGS.md (防重蹈覆辙)
2. 读 src/shared/types.ts (字段真源)
3. 改代码 (mimic 现有风格, 不臆造字段)
4. 本地 `tsc --noEmit` 0 错 (防 S60-BUG-056 类型错)
5. 本地 `npm run build` (生成 dist/)
6. 跑维护模式流程部署 (本文件 § 1)
7. 5 维验证 (本文件 § 3)

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
3. **如果有活跃任务**: 先跑 `deploy.sh` 维护模式流程 (不能直接 restart)
4. 修复 + 部署
5. 写 BUG-NNN 进 apps/mobile/BUGS.md (虽然 server 端但 BUGS.md 是跨端共用)

---

## 配套文档

| 文件 | 关系 |
|---|---|
| [`apps/server/deploy.sh`](./deploy.sh) | 远端部署脚本 (必读, 含维护模式流程) |
| [`../../docs/DEPLOY.md`](../../docs/DEPLOY.md) | server 部署完整 SOP (568 行) |
| [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md) | 跨端版本管理 (含 § 5.1 活跃任务部署) |
| [`../../docs/ENV_MANAGEMENT.md`](../../docs/ENV_MANAGEMENT.md) | env 变量管理 (S66) |
| [`../../docs/PM2_GUIDE.md`](../../docs/PM2_GUIDE.md) | PM2 + ecosystem 完整规范 (S66) |
| [`../../docs/DB_MIGRATION.md`](../../docs/DB_MIGRATION.md) | DB 迁移 SOP (S66) |
| [`../../docs/STANDARDS_EVOLUTION.md`](../../docs/STANDARDS_EVOLUTION.md) | 规范自迭代 SOP (S65) |
| [`../../docs/standards/ADR/`](../../docs/standards/ADR/) | 架构决策追溯 |
| [`../../apps/mobile/AGENTS.md`](../../apps/mobile/AGENTS.md) | mobile AI 入口 (对称) |
| [`../../apps/mobile/BUGS.md`](../../apps/mobile/BUGS.md) | 历史 BUG (跨端共用, server BUG 也写这里) |

---

## S67 自检命令 (一键验证部署后 AI 行为合规)

```bash
# 部署后跑一次, 确保 AI 行为规范全部满足
echo "=== S67 自检: server 端 AI 部署行为合规 ==="

# 1. AI 必读 AGENTS.md (通过 git log 验证文档存在)
[ -f apps/server/AGENTS.md ] && echo "✅ apps/server/AGENTS.md 存在" || echo "❌ AGENTS.md 缺失"

# 2. AI 必跑维护模式 (通过 deploy.sh 验证)
[ -f apps/server/deploy.sh ] && echo "✅ deploy.sh 存在 (含维护模式)" || echo "❌ deploy.sh 缺失"

# 3. 6 处 APP_VERSION 同步
grep "APP_VERSION = '3.0.29'" apps/mobile/src/config/version.ts > /dev/null && echo "✅ mobile version.ts" || echo "❌ mobile version.ts"
grep "versionName \"3.0.29\"" apps/mobile/android/app/build.gradle > /dev/null && echo "✅ mobile build.gradle" || echo "❌ mobile build.gradle"
grep '"version": "3.0.29"' apps/server/package.json > /dev/null && echo "✅ server package.json" || echo "❌ server package.json"
grep "process.env.APP_VERSION || '3.0.29'" apps/server/src/index.ts > /dev/null && echo "✅ server index.ts fallback" || echo "❌ server index.ts fallback"
grep "APP_VERSION: '3.0.29'" apps/server/ecosystem.config.js > /dev/null && echo "✅ ecosystem env" || echo "❌ ecosystem env"
grep "APP_VERSION: '3.0.29'" apps/server/ecosystem.config.js | wc -l | grep -q "2" && echo "✅ ecosystem env_production" || echo "❌ ecosystem env_production"
grep "APP_VERSION = '3.0.29'" apps/web/src/config/version.ts > /dev/null && echo "✅ web version.ts" || echo "❌ web version.ts"

# 4. 6 维验证 (部署后)
pm2 env 0 | grep -q "APP_VERSION=3.0.29" && echo "✅ pm2 APP_VERSION 正确" || echo "❌ pm2 APP_VERSION 错"
curl -s http://localhost:6000/health | grep -q "success.:true" && echo "✅ /health 200" || echo "❌ /health 失败"
curl -s "http://localhost:6000/api/version" | grep -q "3.0.29" && echo "✅ /api/version 当前版本" || echo "❌ /api/version 错"

echo "=== 自检完 ==="
```

---

> **最后更新**: 2026-06-24 (S67)
> **下次 review**: server 端有架构变更 / 新流程 / 维护模式机制变化时
