# 部署规范流程 (Deployment SOP)

> 适用于 DeepScript (ai-video-script-app) 的所有部署场景
>
> 版本：v1.1 (2026-06-24 S65 增补: SSH key 区分 + 5/6 维验证分工 + 跨端引用)
>
> **所有 AI 助手在执行任何部署操作前必须完整阅读本文档。**
>
> ⚠️ **本文档覆盖 server 部署专用 SOP** (11 节点 + 6 维验证 + 8 条铁律 + 回滚)。
> **跨端发版规范** (mobile + server + web 统一) 看 [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) § 5。
> **mobile 升级** 看 [`apps/mobile/DEPLOY.md`](../apps/mobile/DEPLOY.md)。
> **web 部署** 看 [`apps/web/DEPLOY.md`](../apps/web/DEPLOY.md)。
> **规范随版本迭代 SOP** 看 [`docs/STANDARDS_EVOLUTION.md`](./STANDARDS_EVOLUTION.md)。
>
> **5 维 vs 6 维验证分工 (避免文档冲突)**:
> - **6 维 (server-only)**: 本文档 § 6 — 进程 / 端口 / /health / /api/version / 鉴权 / 日志 — 专门验 **server 进程** + **端口监听** + **内部日志**
> - **5 维 (跨端通用)**: [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) § 5.8 — 公网 APK 200 / SHA256 / /api/version / /download 页 / 历史 APK — 验 **跨端 APK 全链路**
>
> 两个维度**不冲突, 必须都跑**: server 端跑 6 维确认内部进程健康, 跨端跑 5 维确认 APK 全链路通畅。

---

## 0. 部署目标 & 环境

### 0.1 目标服务器
| 项 | 值 |
|---|---|
| 服务器地址 | `159.75.16.110` |
| 操作系统 | Ubuntu (VM-4-11-ubuntu, kernel 6.8.0-101) |
| 部署根目录 | `/www/wwwroot/shipin-APP` (单层 Express, NOT monorepo) |
| Node 版本 | v22.22.2 (`/www/server/nodejs/v22.22.2`) |
| PM2 | 已装, 进程名 `ai-script-server` (宝塔面板里能看到) |
| MySQL | `10.1.0.11:3306` (远程 DB), 数据库 `ai_script` |
| 宝塔 | 已装, 端口 888 (用户操作面板) |
| nginx | 宝塔管理, 站点 `ab.maque.uno` (用户待配) |

### 0.2 部署源 (本地)
- **本地仓库根**: `F:\文档\其它\banmu\APP\ai-video-script-app` (用户工作区)
- **本地 monorepo** (Turborepo): `apps/server/` (后端), `apps/web/` (前端), `apps/mobile/` (RN)
- **部署的只是 `apps/server/`** (单层结构, web 端单独部署)

### 0.3 关键约束
- ✅ 生产数据库不能丢数据 (78 characters / 12 novels / 20 users / 346 episodes)
- ✅ 必须支持 5 分钟内回滚
- ✅ 宝塔面板必须能直接看到 PM2 进程 (进程名保持 `ai-script-server`)
- ✅ 不能让生产 .env 暴露在 git/对话中
- ❌ 本地无 node 环境 (部署时所有 build 在服务器做)

---

## 1. 关键节点 (11 个)

部署流程分 **3 阶段 11 节点**:

```
[Pre-Deploy 阶段]                  [Execute 阶段]                  [Post-Deploy 阶段]
0. 预部署检查                         3. 打包源码                      9. 验证
1. 备份 shipin-APP                   4. 传输 (scp)                   10. 清理 + 持久化
2. 备份 DB (mysqldump)              5. 服务器 build                  11. 宝塔确认
                                    6. 替换 dist/package.json
                                    7. 环境变量修复
                                    8. PM2 干净重启
```

---

## 2. 完整流程 (Step-by-Step)

### 阶段 1: 预部署 (Pre-Deploy)

#### 节点 0: 预部署检查

**AI 必须在动手前向用户报告计划**:
- 本次部署什么 (代码变更清单)
- 风险评估 (DB / 配置 / 密钥)
- 预计影响时长 (维护窗口)
- 回滚预案 (5 分钟可回)

**AI 必须执行**:
```bash
# 1. 读 AGENTS.md 强制规范
# 2. 读 DEV_PROGRESS.md 找下一个待办
# 3. 列出本次所有改动 (用 git diff 或代码审查)
# 4. 查密钥是否已轮换 (SSH / DEEPSEEK / MYSQL / PAY / JWT)
# 5. 报告用户, 等待授权
```

#### 节点 1: 备份 shipin-APP (服务器)

```bash
cd /www/wwwroot/shipin-APP
TS=$(date +%Y%m%d_%H%M%S)
[ -d dist ] && mv dist dist.bak.$TS
[ -f package.json ] && mv package.json package.json.bak.$TS
[ -f tsconfig.json ] && mv tsconfig.json tsconfig.json.bak.$TS
[ -f .env ] && cp .env .env.bak.$TS
# 注意: 不删 .env.production (模板)
ls -la | grep -E "(dist|package|tsconfig|env)\.bak\." | head -10
```

**保留时间**: 至少 7 天 (定期清理)

#### 节点 2: 备份数据库 (服务器)

```bash
mkdir -p /www/backup/release/v2.5.36
mysqldump -h10.1.0.11 -uroot -p ai_script \
  --single-transaction --quick --routines --triggers \
  > /www/backup/release/v2.5.36/ai_script-$(date +%Y%m%d_%H%M%S).sql
ls -lh /www/backup/release/v2.5.36/
# 验证 sql 文件大小 (>1MB 算成功)
```

**保留**: 永久 (按版本目录归档)

---

### 阶段 2: 执行 (Execute)

#### 节点 3: 打包源码 (本地)

```bash
# PowerShell 5.1 / Windows
$tgz = "C:\Users\Administrator\AppData\Local\Temp\server-src-$(date +%Y%m%d_%H%M%S).tgz"
$root = "F:\文档\其它\banmu\APP\ai-video-script-app"
tar -czf $tgz -C $root `
  --exclude='apps/server/node_modules' `
  --exclude='apps/server/dist' `
  --exclude='apps/server/uploads' `
  --exclude='apps/server/exports' `
  --exclude='apps/server/logs' `
  apps/server
```

**打包范围**: 仅 `apps/server/` (后端), 不含 `packages/` (server 用内部 `src/shared/`, 不依赖 monorepo)
**排除**: node_modules / dist / 用户数据 / 日志

#### 节点 4: 传输 (scp)

```bash
$keyPath = "C:\Users\Administrator\AppData\Local\Temp\deploy_key_YYYYMMDD.pem"
# 锁权限
icacls $keyPath /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
# 上传
scp -i $keyPath -o StrictHostKeyChecking=accept-new $tgz root@159.75.16.110:/tmp/
```

**SSH 认证**:
- 用户提供 SSH 私钥 (or password)
- 私钥**持久化保存**到 `~/.ssh/id_ed25519` (用户 2026-06-13 明确要求, 覆盖之前"用完 trash"规则)
- 写入后用 `ssh-keygen -y -f ~/.ssh/id_ed25519` 验证能提取公钥 (防 OpenSSH 9.5p2 末尾 \n 缺失 bug)
- 测 `ssh root@159.75.16.110 "echo OK"` 免密登录 OK 才算完成
- 私钥保存到 `%TEMP%` 路径 (mavis 部署工具用), 临时用完 trash; **持久 key 在 `~/.ssh/id_ed25519`** 保留不动

#### 节点 5: 服务器 build

```bash
# 服务器端
mkdir -p /www/wwwroot/shipin-APP-build
tar -xzf /tmp/server-src-YYYYMMDD.tgz -C /www/wwwroot/shipin-APP-build/
cd /www/wwwroot/shipin-APP-build/apps/server
npm install --no-audit --no-fund --include=dev  # devDeps 需 tsc
npm run build                                    # tsc -> dist/
```

**为什么在服务器 build**:
- 本地无 node
- 服务器有 node v22 + 完整工具链
- monorepo 依赖解耦后, server 可独立 build

#### 节点 6: 替换文件 (服务器)

```bash
cd /www/wwwroot/shipin-APP
# 替换
cp -r /www/wwwroot/shipin-APP-build/apps/server/dist ./dist
cp /www/wwwroot/shipin-APP-build/apps/server/package.json ./package.json
cp /www/wwwroot/shipin-APP-build/apps/server/tsconfig.json ./tsconfig.json
# 验证
grep '"version"' package.json
ls -la dist/index.js
```

**不替换**:
- `.env` (生产配置, 保留)
- `.env.production` (模板, 保留)
- `uploads/` (用户上传, 保留)
- `exports/` (用户生成, 保留)
- `node_modules/` (新依赖由 npm install 处理)

#### 节点 7: 环境变量修复 (服务器)

**检查清单** (脚本化):

```bash
cd /www/wwwroot/shipin-APP
# 1. JWT_SECRET 必填且不能是 dev default
if ! grep -qE "^JWT_SECRET=.{20,}" .env; then
  NEW=$(openssl rand -hex 32)
  sed -i "/^JWT_SECRET=/d" .env
  echo "JWT_SECRET=$NEW" >> .env
  echo "  → 已生成新 JWT_SECRET (256-bit)"
fi

# 2. APP_VERSION 必须在 ecosystem.config.js 是新版本号
#    (单环境变量无法改 PM2 配置, 需要 sed/scp 替换)

# 3. NODE_ENV 必须是 production
grep -E "^NODE_ENV=" .env
# 4. 其他必填 env (参考 server .env.example)
for k in MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE DEEPSEEK_API_KEYS; do
  grep -qE "^$k=" .env || echo "  ⚠️ 缺失: $k"
done
```

**关键规则**:
- `.env` 必须保留 (覆盖会丢生产配置)
- 缺失的 env 用 `>>` 追加, 不覆盖已有
- 强密钥用 `openssl rand -hex 32` (256-bit) 生成

#### 节点 8: 数据库迁移 (服务器)

**核心原则**:
- `server/src/models/db.ts` 启动时调 `initTables()`, **所有 ALTER/CREATE 都被自动跑**
- ALTER 用 `try/catch` 包裹 (重复列名不阻塞)
- CREATE TABLE 用 `IF NOT EXISTS` (已存在不阻塞)
- **不需要手跑 SQL 文件**

```bash
# 仅在 schema 升级后第一次启动时, 验证 initTables 跑了:
# server 启动后, 查新字段/新表是否就位
mysql -h... -e "SHOW COLUMNS FROM characters LIKE 'description'"
mysql -h... -e "SHOW TABLES LIKE 'assets'"
mysql -h... -e "SELECT COUNT(*) FROM style_presets"  # 应 = 5
```

**手动 SQL 文件** (`apps/server/migrations/v*.sql`):
- 用于应急/用户想显式控制时
- 已被 `initTables()` 覆盖, 实际不必跑
- 保留作为 schema 变更的 source of truth

#### 节点 9: PM2 干净重启 (服务器)

**关键: 用 `pm2 delete` + `pm2 start`, 不要用 `pm2 restart`**

```bash
cd /www/wwwroot/shipin-APP

# 1. 删除进程 (清掉 PM2 持久 env)
pm2 delete ai-script-server

# 2. 干净启动 (不传 --update-env, 让 PM2 读 ecosystem.config.js 的 env)
pm2 start ecosystem.config.js

# 3. 等 5 秒, 检查启动成功
sleep 5
pm2 list
# 期望: status=online, pid 非 0, version 正确, mem < 200MB

# 4. 健康检查
curl -s -m 5 http://localhost:6000/health
curl -s -m 5 http://localhost:6000/api/version
curl -s -m 5 -o /dev/null -w "%{http_code}\n" http://localhost:6000/api/novels
# 期望: health=200, version=新版本号, /api/novels=401(无 token)
```

**为什么用 delete 而非 restart**:
- `pm2 restart` 不重读 ecosystem.config.js 的 env
- `pm2 restart --update-env` 也只重读 shell env, 不读 .env
- `pm2 delete` + `pm2 start` 是唯一清掉 PM2 持久 env 的方式

#### 节点 10: 验证 (6 维全通过)

| 维度 | 检查项 | 期望 |
|---|---|---|
| 1. 进程 | `pm2 list` | ai-script-server online, mem < 200MB, pid > 0 |
| 2. 端口 | `ss -tlnp \| grep 6000` | LISTEN 0.0.0.0:6000 |
| 3. /health | `curl /health` | 200 + `{"success":true,...}` |
| 4. /api/version | `curl /api/version` | version = 部署版本号 |
| 5. 鉴权 | `curl /api/novels` (无 token) | 401 |
| 6. 日志 | `pm2 logs --lines 30` | 看到 "MySQL connected" + "Database tables initialized", 无 ERROR |

**6 维必须全部通过**, 任何一项失败 = 部署失败, 立即回滚。

#### 节点 11: 清理 + 持久化

**硬约束 (2026-06-15 S57b 后追加)**:
- **禁止在服务器非部署项目目录新建临时文件** (例如: 部署 shipin-APP 时, 不能在 `/www/wwwroot/gg.maque.uno/` 或 `/www/wwwroot/sparrow-logic/` 写 staging)
- **临时文件只能放在**:
  - 服务器: `/www/wwwroot/shipin-APP-build/` (server build 临时) 或 `/www/wwwroot/web-build/` (web 远端 build 临时, S57b 后已废弃, 本机 build web) 或 `/tmp/<session-prefix>-<purpose>/`
  - 本机: `C:\Users\Administrator\.mavis\scratchpads\<sessionId>\`
- **必须做 staging manifest**: 每次部署 session 开工时, 立即在 `C:\Users\Administrator\.mavis\scratchpads\<sessionId>\STAGING_MANIFEST.md` 写:
  ```
  # Staging Manifest — session mvs_xxx, 2026-06-15

  ## 远端 shipin-APP (159.75.16.110)
  | 时间 | 路径 | 用途 | 状态 |
  |---|---|---|---|
  | 09:21 | /www/wwwroot/shipin-APP-build/ | server build staging | 09:31 删 |
  | 09:21 | /tmp/s56-bak.sh | 备份脚本 | 09:31 删 |
  | 09:30 | /www/wwwroot/web-build/ | web 远端 build (S57b 后废弃) | 11:40 删 |

  ## 远端 其他项目: 0
  ## 本机 scratchpad
  | 时间 | 路径 | 用途 | 状态 |
  |---|---|---|---|
  | 09:21 | id_ed25519 (411 B) | SSH key 持久化 | 保留 |
  | 09:55 | src-changes-s57-v1.tgz (11.6 KB) | src 改动 tgz | 保留作存档 |
  ```
- **session 结束 / 部署完成 / 用户主动要求时**必须按 manifest 对账, 全部清理 (SSH key 等明确"保留"的除外)

```bash
# 服务器 (按 manifest 逐条删)
pm2 save  # 持久化进程列表
# 先 ssh 查 manifest 里所有路径, 然后逐条删
ssh root@159.75.16.110 'rm -rf /www/wwwroot/shipin-APP-build /tmp/s56-* /tmp/s57-* /tmp/s58-*'
# 保留 dist.bak.* / package.json.bak.* 至少 7 天
# 保留 /www/backup/release/<version>/*.sql 永久

# 本地
mavis-trash <manifest 里的本地路径>
# 保留 ~/.mavis/scratchpads/<sessionId>/id_ed25519 (SSH key 持久化)
```

**踩过的坑 (避免重犯)**:
- 2026-06-15: S56 web 部署后 `/www/wwwroot/web-build` 留了 stale 目录到 S57b 才被 user 问出来
- 2026-06-15: S56 + S57b `/tmp/s56-*.sh /tmp/s57-*.sh` 散乱, 手动一个个 `rm` 容易漏
- 修法: **manifest 记录所有 staging 路径, 部署完 `git grep <session-prefix>` 对账一次**

---

## 3. 部署后用户在宝塔面板操作

### 3.1 查看进程
1. 登录宝塔面板: `https://159.75.16.110:888`
2. 左侧菜单 → **软件商店** → 找到 **PM2 管理器** (宝塔版) → 点击 **设置**
3. 在 PM2 管理器界面:
   - **进程列表** → 应该看到 `ai-script-server`, status = `online`
   - **显示信息**: name / pid / version / mode / uptime / memory
4. 点 **查看日志** 按钮: 可看 stdout/stderr 实时日志
5. 点 **重启** / **停止** / **删除** 按钮: 在宝塔里直接控制

### 3.2 查看 Web 端
- 左侧菜单 → **网站** → 站点 `ab.maque.uno` (待用户添加)
- 操作: 修改 nginx 配置 / 申请 SSL / 重启 nginx
- **当前 web 端还没部署** (依赖 ab.maque.uno 域名解析 + 宝塔加站点)

### 3.3 添加 ab.maque.uno 站点 (用户操作)
1. 宝塔 → **网站** → **添加站点** → 域名 `ab.maque.uno`
2. 根目录: `/www/wwwroot/web-app/` (与 nginx-ab.maque.uno.conf 一致)
3. PHP: **纯静态**
4. 数据库: 不创建
5. 提交后:
   - 宝塔自动写 nginx 站点配置
   - **手动**申请 Let's Encrypt SSL (宝塔 → 网站 → ab.maque.uno → SSL → Let's Encrypt → 申请)
6. **通知 AI 助手**: SSL 申请完成后, AI 可执行 `apps/web/scripts/deploy.sh` 部署 web 端

### 3.4 常用操作
- **重启服务**: PM2 管理器 → 选中进程 → 重启
- **看错误**: PM2 管理器 → 日志 → 搜索 ERROR
- **资源监控**: PM2 管理器 → 监控 (CPU / 内存 / I/O)
- **改配置**: 宝塔 → 文件 → `/www/wwwroot/shipin-APP/.env` → 编辑 → 重启进程生效

---

## 4. 回滚流程 (5 分钟回滚)

```bash
# 服务器
cd /www/wwwroot/shipin-APP

# 1. 停当前进程
pm2 delete ai-script-server

# 2. 找到最新备份
LATEST_DIST=$(ls -td dist.bak.* 2>/dev/null | head -1)
LATEST_PKG=$(ls -t package.json.bak.* 2>/dev/null | head -1)
LATEST_TSC=$(ls -t tsconfig.json.bak.* 2>/dev/null | head -1)
LATEST_ENV=$(ls -t .env.bak.* 2>/dev/null | head -1)

echo "回滚到:"
echo "  dist:        $LATEST_DIST"
echo "  package:     $LATEST_PKG"
echo "  tsconfig:    $LATEST_TSC"
echo "  .env:        $LATEST_ENV"

# 3. 恢复
[ -n "$LATEST_DIST" ] && rm -rf dist && mv "$LATEST_DIST" dist
[ -n "$LATEST_PKG" ] && rm -f package.json && mv "$LATEST_PKG" package.json
[ -n "$LATEST_TSC" ] && rm -f tsconfig.json && mv "$LATEST_TSC" tsconfig.json
[ -n "$LATEST_ENV" ] && cp "$LATEST_ENV" .env  # 备份的 .env 优先级最高

# 4. 启动
pm2 start ecosystem.config.js
sleep 3
curl -s http://localhost:6000/health
# 期望: 200, 且 /api/version 显示旧版本号
```

**回滚不影响数据**: 增量 ALTER 已成功的不回滚 (会丢 v2.0.0 新字段), 但代码回滚后这些字段没被引用, 不会有功能影响。

**回滚边界**:
- ✅ 可以回滚: 上一版本 → 当前版本 (有 dist.bak.* 备份)
- ❌ 不能回滚: 跨多个版本 (需要按顺序逐个回滚)
- ❌ 不能回滚: 跨大版本 (v1.2.0 → v2.0.0), 需要先做 schema downgrade

---

## 5. 常见问题 (Troubleshooting)

### 5.1 启动失败: `JWT_SECRET is required in production`

**原因**: 我的 BUG 修复 #5 (auth.ts) 加了生产环境 throw, `.env` 里 JWT_SECRET 缺失或等于 dev default。

**解决**:
```bash
cd /www/wwwroot/shipin-APP
grep -E "^JWT_SECRET=" .env
# 如果缺失或长度 < 20:
sed -i "/^JWT_SECRET=/d" .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
pm2 delete ai-script-server && pm2 start ecosystem.config.js
```

**注意**: 改 JWT_SECRET 会让所有现有 token 失效, 用户需重新登录。

### 5.2 启动失败: `MySQL connect failed`

**原因**: DB 连接信息错误或网络不通。

**解决**:
```bash
# 1. 验证 .env 中 MYSQL_* 配置
grep -E "^MYSQL_" .env
# 2. 直接 mysql 连接测试
mysql -h$MYSQL_HOST -u$MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT 1"
# 3. 检查防火墙
nc -zv 10.1.0.11 3306
```

### 5.3 PM2 一直重启, 永远 online 不上

**原因**: 代码 throw 在 listen 之前, 启动即死, PM2 持续重启。

**解决**:
```bash
# 1. 看日志找 throw 原因
pm2 logs ai-script-server --lines 50 --nostream --raw
# 2. 通常是 .env 缺值, 见 5.1
# 3. 修 .env 后, 必须 pm2 delete 再 start (不要 restart)
```

### 5.4 /api/version 仍是旧版本号

**原因**: ecosystem.config.js 硬编码了 APP_VERSION, 代码层 `process.env.APP_VERSION || '2.5.36'` 被 env 覆盖。

**解决**:
```bash
# 修 ecosystem.config.js
sed -i "s/APP_VERSION: '[^']*'/APP_VERSION: '2.5.36'/g" ecosystem.config.js
# 或本地修改后 scp 覆盖
# 注意: 这种 sed 在中文终端可能失败, 推荐 scp 方式
```

### 5.5 端口 6000 没监听

**原因**: server 启动失败 (看 PM2 日志) 或 app.listen 之前的代码 throw。

**解决**:
```bash
pm2 logs ai-script-server --lines 30 --nostream
# 找到 throw 原因后修复
```

### 5.6 本地没 node 无法 build

**应对**: 部署流程已设计为 **服务器 build**, 不需要本地 node。如果非要在本地 build, 用 nvm 或 winget 装:
```bash
winget install OpenJS.NodeJS.LTS
# 或
nvm install 22
```

---

## 6. AI 助手必须遵守的 8 条规则

> 这些规则被 AGENTS.md 引用, 任何 AI 助手违反 = 部署失败 / 数据丢失。

1. **部署前先报告计划**: 改动清单 / 风险 / 影响时长 / 回滚预案, 等用户授权
2. **必须先备份** shipin-APP (dist + package.json + tsconfig.json + .env) + DB (mysqldump)
3. **不覆盖 .env / .env.production**: 只用 `>>` 追加缺失 env, 绝不 `> .env` 重写
4. **不覆盖 uploads / exports / logs**: 用户数据, 永远只追加不删
5. **PM2 必须用 `delete + start`, 不用 `restart`**: restart 不会重读 .env, 会被持久 env 覆盖
6. **部署后 6 维验证全通过** 才算完成 (进程 / 端口 / /health / /api/version / 鉴权 / 日志) — **server 端特有**, 跨端 5 维验证看 [`VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) § 5.8
7. **deploy.sh 失败不破坏 shipin-APP**: build 始终在 `/www/wwwroot/shipin-APP-build/` 临时目录
8. **SSH key 处理 (区分两种 key, 避免文档自相矛盾)**:
   - **永久持久 key** `~/.ssh/id_ed25519` (用户 2026-06-13 明确要求持久化) → **保留**, 不要 mavis-trash
   - **临时 session key** `/tmp/deploy_key_*.pem` (mavis 部署工具短期用) → 用完立即 `mavis-trash`
   - 两个作用域不同, 不要混淆
9. **部署后在 DEV_PROGRESS.md AI 会话追踪表加一行**: 记录版本号 / 改动 / 验证结果
10. **不写"先跑通再说"的代码**: 部署脚本必须容错 (`set -e` 必须在所有命令后能跑通)

---

## 7. 部署检查清单 (Checklist)

AI 助手在部署完成后, 必须逐项打勾:

```
[ ] 0. 报告用户, 等授权
[ ] 1. 备份 dist.bak.TS / package.json.bak.TS / tsconfig.json.bak.TS / .env.bak.TS
[ ] 2. mysqldump 到 /www/backup/release/vX.Y.Z/
[ ] 3. 打包 apps/server/ (排除 node_modules / dist / 用户数据)
[ ] 4. scp 到 /tmp/, 本地 key 锁 600
[ ] 5. 服务器: 解压到 shipin-APP-build/, npm install + npm run build
[ ] 6. 服务器: 复制 dist + package.json + tsconfig.json (不覆盖 .env)
[ ] 7. 服务器: 检查 JWT_SECRET / APP_VERSION / NODE_ENV / MYSQL_*
[ ] 8. 服务器: 启动 server, initTables() 自动同步 schema
[ ] 9. 服务器: pm2 delete + start (清掉持久 env)
[ ] 10. 服务器: 6 维验证全通过
    [ ] pm2 list: status=online
    [ ] ss -tlnp: 6000 LISTEN
    [ ] /health: 200
    [ ] /api/version: 正确版本号
    [ ] /api/novels: 401
    [ ] pm2 logs: 无 ERROR
[ ] 11. 服务器: pm2 save + 删 build 临时目录 + 删 /tmp tarball
[ ] 12. 本地: 删 .pem key (mavis-trash) + 删本地 tarball
[ ] 13. 用户: 宝塔 → PM2 管理器 → 确认 ai-script-server 在线
[ ] 14. DEV_PROGRESS.md: 加 AI 会话追踪行
```

---

## 8. 附:本次部署实战记录 (S14, 2026-06-09)

| 步骤 | 用时 | 关键事件 |
|---|---|---|
| 打包 + scp | 1 min | 本地 207KB tarball, scp 到 /tmp/ |
| 服务器 build | 30s | npm install 551 包 + tsc build |
| 替换 | 5s | dist + package.json + tsconfig.json |
| 环境变量修复 | 30s | JWT_SECRET 缺失 → 生成 256-bit 替换; APP_VERSION 硬编码 → 改 ecosystem.config.js |
| DB 同步 | 0s | server 启动 initTables() 自动跑完 4 张新表 + 17 字段 |
| PM2 重启 | 1 min | delete + start 干净启动 |
| 验证 | 30s | 6 维全通过 |
| **总计** | **~5 min** | (含建备份 / 查日志) |

**遇到的问题及解法**:
1. `notify.ts` build 错误: object literal 同名属性 → rename `type` → `notifyType`
2. CREATE TABLE 多行 SQL 走 `mysql -e` 失败: 改用 server 启动 initTables()
3. `JWT_SECRET` 是 dev default 触发 throw: 生成 256-bit 新 secret 写进 .env
4. PM2 持久 env 覆盖 .env 修复: `pm2 delete` + `pm2 start`(不 --update-env)
5. `APP_VERSION` 硬编码: scp 覆盖 ecosystem.config.js (sed 中文终端引号转义问题)

---

## 9. 文档变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-06-09 | 初版, 基于 S14 实战总结 |
| | | 后续优化: 收集实战经验, 补故障案例 |

---

> **本 SOP 是 DeepScript 部署的唯一规范**, 所有 AI 助手在执行部署前必须完整阅读。
> 有改进建议时, 请在 PR 描述里列具体改进点, 经用户确认后更新本文档。
