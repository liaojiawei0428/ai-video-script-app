# Deep剧本 PM2 + ecosystem.config.js 完整规范 (S66)

> **适用范围**: shipin-APP server 进程管理 (PM2 5.x + ecosystem.config.js)
>
> **版本**: v1.0 (2026-06-24 S66 新建)
>
> **强制阅读**: 任何 AI 修改 PM2 配置 / 进程操作前必读本文件
>
> **配套**: [`./DEPLOY.md`](./DEPLOY.md) § 9.3 (4 条基础命令) + [`./ENV_MANAGEMENT.md`](./ENV_MANAGEMENT.md) § 4 (env 注入) + [`./VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) § 2 (APP_VERSION 同步)

---

## § 0. PM2 现状 (S66 自检)

- **PM2 版本**: 5.x (server 装在 Ubuntu 22.04)
- **进程名**: `ai-script-server` (宝塔面板可见, 见 DEPLOY.md § 3.1)
- **配置文件**: `apps/server/ecosystem.config.js` (47 行, S66 已修 APP_VERSION 同步)
- **重要命令**: pm2 list / pm2 logs / pm2 env / pm2 restart (❌ 不用) / pm2 delete + start (✅)

---

## § 1. ecosystem.config.js 完整字段规范

```javascript
module.exports = {
  apps: [
    {
      // ── 1. 基础 ──
      name: 'ai-script-server',                      // 进程名 (宝塔可见)
      script: './dist/index.js',                     // 启动脚本 (相对 shipin-APP 根)
      cwd: '/www/wwwroot/shipin-APP',                // PM2 工作目录 (可选, 默认当前)

      // ── 2. 多实例 ──
      instances: 1,                                  // 1 = 单进程 (shipin-APP 用 fork 模式)
      exec_mode: 'fork',                             // fork = 单进程 / cluster = 多进程
      // exec_mode: 'cluster', instances: 'max'      // 多核 (⚠️ shipin-APP 有内存泄漏风险, 暂不用)

      // ── 3. env (3 块优先级: env_production > shell env > .env) ──
      env: {                                         // dev 环境 (pm2 start 不带 --env production)
        NODE_ENV: 'production',                       // shipin-APP 不区分 dev/prod, 都 production
        PORT: 6000,
        APP_VERSION: '3.0.29',                       // ⚠️ S66 修复: 跟 package.json + index.ts fallback 同步
        // ... 代理字段
      },
      env_production: {                              // 生产 (pm2 start --env production)
        NODE_ENV: 'production',
        PORT: 6000,
        APP_VERSION: '3.0.29',
        // ...
      },
      // ⚠️ 注意: env 跟 env_production 都必填 APP_VERSION, 必同步 (S66 BUG-069)

      // ── 4. 日志 (S66 § 9 详细) ──
      log_file: './logs/combined.log',              // stdout + stderr 合并
      out_file: './logs/out.log',                   // 仅 stdout
      error_file: './logs/error.log',               // 仅 stderr
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',    // 时间格式
      merge_logs: true,                             // 多实例合并 (cluster 模式才有用)
      log_type: 'json',                             // 可选 json 输出 (ELK 友好)

      // ── 5. 重启策略 ──
      max_memory_restart: '1G',                     // 内存超 1G 自动重启 (防内存泄漏)
      restart_delay: 3000,                          // 重启前等 3s (避免快速重启循环)
      max_restarts: 5,                               // 5 次重启失败后停止 (避免无限重启)
      min_uptime: '10s',                            // 启动后 10s 内死掉不算"up"
      kill_timeout: 5000,                            // SIGKILL 前等 5s (graceful shutdown)
      listen_timeout: 10000,                        // listen() 后 10s 内没准备好 = 启动失败

      // ── 6. 监控 ──
      watch: false,                                  // ⚠️ 必 false (shipin-APP 是 dist/, 不是源代码)
      ignore_watch: ['node_modules', 'logs', 'uploads', 'data', 'exports', 'dist'],
      //                  ↑ watch 关闭时这些项实际无效, 留着提醒

      // ── 7. 高级 (S66 暂不启用, 留作未来扩展) ──
      // node_args: '--max-old-space-size=4096',     // V8 堆内存上限
      // kill_signal: 'SIGTERM',                    // graceful shutdown 信号
      // wait_ready: false,                         // listen() 后才认为 ready
      // listen_timeout: 8000,
      // pmx: true,                                  // PM2 监控 (Keymetrics 商业版)
    },
  ],
};
```

---

## § 2. fork vs cluster 模式选型

| 场景 | 模式 | 配置 |
|---|---|---|
| **单进程足够** (shipin-APP 当前) | `fork` + `instances: 1` | 现成配置, 稳定 |
| **多核 CPU 利用** (4 核以上) | `cluster` + `instances: 'max'` 或 `instances: 2` | ⚠️ WebSocket 需 sticky session |
| **CPU 密集** (图像处理 / LLM) | `fork` + 单进程 (依赖多核会触发 GIL) | 适合 shipin-APP (LLM 推理) |
| **IO 密集** (HTTP API) | `cluster` + `instances: 'max'` | 适合纯 CRUD 项目 |

**shipin-APP 选 fork**: 因为有 WebSocket 推送 + LLM API 调用 (外部), 多进程反而增加复杂度。

---

## § 3. PM2 命令速查 (10 条)

```bash
# 启动 (生产环境)
cd /www/wwwroot/shipin-APP
pm2 delete ai-script-server 2>/dev/null || true
pm2 start ecosystem.config.js --env production
# ⚠️ delete + start (不是 restart) - BUG-008

# 查看
pm2 list                                    # 进程列表 (status, pid, uptime, mem, cpu)
pm2 env 0                                   # 进程 0 的所有 env 变量
pm2 env 0 | grep APP_VERSION                # 验 env 生效
pm2 logs ai-script-server --lines 50        # 实时日志
pm2 logs ai-script-server --lines 100 --nostream  # 不 follow, 看 100 行退出
pm2 monit                                   # 实时监控 (CPU / 内存 / 日志)

# 重启 (分场景)
pm2 delete ai-script-server && pm2 start ecosystem.config.js --env production   # ✅ 推荐, 完整 reload
pm2 reload ai-script-server                # ⚠️ graceful reload (cluster 模式才生效, shipin-APP 没用)
pm2 restart ai-script-server               # ❌ 不用, 不重读 .env, 持久 env 会覆盖 (BUG-008)

# 停止 / 删除
pm2 stop ai-script-server                  # 暂停 (不删进程, 可 pm2 start 恢复)
pm2 delete ai-script-server                 # 删除 (清掉 PM2 持久 env, 必须 pm2 start 重建)

# 持久化
pm2 save                                    # 保存进程列表 (开机自启)
pm2 resurrect                               # 恢复 (从 save 恢复)

# 监控 / 重启
pm2 flush                                   # 清空所有日志 (logs/*.log)
pm2 jlist                                   # JSON 格式进程列表 (脚本用)
```

---

## § 4. env 注入 (PM2 启动优先级)

### 4.1 优先级顺序 (高 → 低)

```
1. ecosystem.config.js env_production 块
2. shell env (启动时的 process.env)
3. .env 文件 (server 自己 dotenv 加载)
```

### 4.2 实战配置

```bash
# 方式 A: ecosystem.config.js 写死 (推荐, 配置可见)
# 编辑 apps/server/ecosystem.config.js, env_production.APP_VERSION = '3.0.30'
# 然后 pm2 delete + start

# 方式 B: shell env 临时覆盖
APP_VERSION=3.0.30 pm2 start ecosystem.config.js --env production
# ⚠️ --update-env 会刷 PM2 持久 env, 部署时禁用

# 方式 C: .env 加载 (server 自己 dotenv 读)
# 适用: 不想改 ecosystem.config.js (如密钥轮换)
# 流程: vi .env → pm2 delete + start
```

### 4.3 ⚠️ APP_VERSION 必同步 (S66 BUG-069)

ecosystem.config.js 跟 package.json + index.ts fallback **3 处必同时改**, 否则:

- ecosystem.config.js 写 3.0.26, env_production 块被读
- /api/version 返 3.0.26 (跟实际 3.0.29 不符)
- 客户端收到 needUpdate=true, 触发强制升级弹窗

**S66 自检命令**:

```bash
# 部署后必跑
pm2 env 0 | grep APP_VERSION       # 期望: APP_VERSION=3.0.29 (跟当前发版版本一致)
curl -s https://ab.maque.uno/api/version | jq .data.version   # 期望: "3.0.29"
grep APP_VERSION apps/server/package.json   # 期望: APP_VERSION: '3.0.29'
grep APP_VERSION apps/server/src/index.ts   # 期望: fallback '3.0.29'
grep APP_VERSION apps/server/ecosystem.config.js  # 期望: 2 处都 '3.0.29'
```

---

## § 5. 高级配置 (S66 暂不启用, 留作未来扩展)

### 5.1 V8 内存上限

```javascript
node_args: '--max-old-space-size=4096',  // 4GB 堆内存 (默认 1.5GB)
```

适用: 大量 JSON 解析 / 长篇小说 (S5 实战发现 shipin-APP 处理 4.7M 字《雪中悍刀行》时内存占用 800MB, 4GB 上限够用)。

### 5.2 graceful shutdown

```javascript
kill_signal: 'SIGTERM',                 // 默认 SIGINT, 改 SIGTERM 更标准
kill_timeout: 10000,                    // 10s 内完成清理 (DB 连接 / WebSocket 关闭 / 进行中任务保存)
```

### 5.3 PM2 商业版 Keymetrics

```javascript
pmx: true,                                // 启用 Keymetrics 监控 (PM2 Plus 订阅)
```

shipin-APP 当前用 `pm2 monit` 自带监控, 不订阅 Keymetrics。

---

## § 6. 常见问题

### 6.1 PM2 一直重启, 永远 online 不上

**症状**: `pm2 list` 显示 status=online 但 uptime=0s, 反复重启

**根因**: 代码 throw 在 listen() 之前, 启动即死, PM2 持续重启

**解决**:

```bash
# 1. 看错误日志
pm2 logs ai-script-server --lines 100 --nostream --raw | head -50

# 2. 通常是 .env 缺值 (见 ENV_MANAGEMENT.md § 7)
grep -E "^(JWT_SECRET|MYSQL_|DEEPSEEK_API_KEYS|AGNES_API_KEY|PAY_KEY)=" .env

# 3. 修 .env 后必 pm2 delete + start (不用 restart, BUG-008)
pm2 delete ai-script-server && pm2 start ecosystem.config.js --env production
```

### 6.2 内存一直涨, 超过 1G 自动重启

**症状**: `pm2 list` 显示重启次数一直涨, uptime 短

**根因**: 内存泄漏 (e.g. 全局 Map 没清, LLM response 没释放)

**解决**:

```bash
# 1. 看哪段代码占内存
pm2 monit
# → 看 mem 曲线是不是稳定 / 一直涨

# 2. 临时加 --max-old-space-size 续命
# ecosystem.config.js: node_args: '--max-old-space-size=4096'
pm2 delete && pm2 start

# 3. 找代码 root cause
# 用 heapdump: kill -USR2 <pid> 生成 heap snapshot, Chrome DevTools 分析
```

### 6.3 pm2 restart 跟 delete+start 区别

| 命令 | 行为 | 适用 |
|---|---|---|
| `pm2 restart` | **不**重读 ecosystem.config.js env, 只重启进程 | ❌ 不用 (env 改了不生效) |
| `pm2 reload` | cluster 模式才生效, 逐个重启 worker | ❌ shipin-APP fork 模式无效果 |
| `pm2 delete + start` | 删进程重建, 重读所有 env, 干净 | ✅ 必用 |

### 6.4 宝塔面板看不到进程

**根因**: PM2 进程列表跟宝塔 PM2 管理器是两个独立服务, 用不同路径管理
**解决**: 宝塔 → 软件商店 → PM2 管理器 → 项目列表手动添加 `ai-script-server`, 指向 `/www/wwwroot/shipin-APP`

### 6.5 /health 返 200 但 pm2 显示 status=errored

**根因**: PM2 标记 status 是基于 stdout/stderr, 不基于应用健康
**解决**: 看应用 /health + /api/version, 不要看 pm2 status

---

## § 7. AI Agent 必跑清单

**任何 AI 改 PM2 / ecosystem.config.js 必跑**:

```
[ ] 1. 读本文件 + docs/DEPLOY.md § 9.3 4 条基础命令
[ ] 2. 改 ecosystem.config.js 前必 grep "pm2 env 0" 当前值
[ ] 3. APP_VERSION 改 1 处必同步 5 处 (VERSION_MANAGEMENT § 2)
[ ] 4. pm2 delete + start (不 restart, BUG-008)
[ ] 5. pm2 env 0 | grep APP_VERSION 验证生效
[ ] 6. curl /api/version 验证 client 看到正确版本
[ ] 7. pm2 logs --lines 50 看启动日志无 ERROR
[ ] 8. 写 DEV_PROGRESS.md AI 会话追踪行
```

---

## § 8. 配套文档

| 文件 | 关系 |
|---|---|
| [`apps/server/ecosystem.config.js`](../../apps/server/ecosystem.config.js) | PM2 配置 (S66 修 APP_VERSION) |
| [`docs/DEPLOY.md`](./DEPLOY.md) | server 部署 SOP (含 PM2 § 9.3) |
| [`docs/ENV_MANAGEMENT.md`](./ENV_MANAGEMENT.md) | env 变量管理 (含 § 4 env 注入) |
| [`docs/VERSION_MANAGEMENT.md`](./VERSION_MANAGEMENT.md) | 跨端版本 (含 APP_VERSION 6 处自检) |

---

> **最后更新**: 2026-06-24 (S66)
> **下次 review**: 改 PM2 配置 / 升级 PM2 主版本 / 加新进程时
