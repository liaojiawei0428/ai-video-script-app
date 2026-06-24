# docs/BUGS_INDEX.md — BUG 案例库 AI 快速查询索引 (S69 v1.0)

> **目的**: 让任何 AI 接活前 30 秒内定位 BUG 编号 + 修法 + 教训, **不再重复同样错误**
> **配套**:
> - [`apps/mobile/BUGS.md`](../apps/mobile/BUGS.md) — **完整 1146 行 / 74 BUG 详细案例** (项目状态/现象/根因/修法/教训/引用)
> - [`AGENTS.md`](../AGENTS.md) — 跨端总入口, 必读第 16 项 = 本 BUGS_INDEX
> - [`HANDOVER.md`](../HANDOVER.md) — 跨 session 交接, § 0 30 秒速览引用本索引
> - 维护者: 每次重要 session 收尾 (S70/S71/...) 必追加新 BUG + 更新本索引
> - 最后更新: 2026-06-24 (S69 收尾, v1.0, 含 BUG-001 ~ BUG-074)

---

## § 1. 30 秒速览 (按编号倒序, 最近修的优先看)

| BUG | session | 状态 | 简述 | 修法 commit |
|---|---|---|---|---|
| **BUG-076** | S69 | ✓ 解释 | **宝塔 shipin_APP "未启动" 误导**: 宝塔把 shipin-APP 注册为 nginx 站点, 实际 shipin-APP 走 PM2 node, 跟 nginx 无关 | 监控走 PM2 + 6 维验证, 忽略宝塔"未启动"显示 |
| **BUG-075** | S69 | ✓ 已修 | **BUG 案例库缺 AI 友好索引**: 74 BUG 散在 1146 行, 难快速定位 | `34a5714` (`docs/BUGS_INDEX.md` v1.0) |
| **BUG-074** | S69 | ⚠️ 临时修 | **APK 缺失 / 假下载**: server 报 v3.0.31 + forceUpdate, 实际 APK v3.0.29, 用户点 v3.0.31 → 404 | `53e61a1` (5 处版本回退 v3.0.29) |
| **BUG-073** | S69 | ✓ 永久方案 | **S54 1-行 minified src + tsc 5.9.3 + Node 22 静默忽略 ESM**: 部署踩 8h ReferenceError, server.listen 不 fire | S64 backup dist 恢复 (201 行) + 走"单文件 tsc + cp" |
| **BUG-072** | S69 | ✓ 已修 | **Web 端扣费审计 5 BUG 全不一致**: A(pricing 字段) + B(quota 不生效) + C(inline 扣费) + E(video 白送) | `4c25d2d` (16 文件 +170/-487) |
| **BUG-071** | S68 | ✓ 已修 | **跨端规范重复 GAP**: 3 个 AGENTS.md 重复, 改 1 处必同步 3 处 | `4553108` (根 AGENTS.md v2.0 + mobile/server 瘦身) |
| **BUG-070** | S67 | ✓ 已修 | **server 部署没查活跃任务**: 打断用户跑的小说分析/生图 | `4ac7ac3` (`apps/server/deploy.sh` 维护模式 6 步) |
| **BUG-069** | S66 | ✓ 已修 | **ecosystem.config.js APP_VERSION 没改**: env + env_production 2 处, 部署 6 处版本号漏 2 | `3b72a7b` (跨端版本号 6 处同步规范) |
| **BUG-068** | S64 | ⚠️ 反复出现 | **5 个 v3.0.0 同大小副本** (S58 之前), 历史 APK 命名 SOP 失效 | 反复出现, BUG-074 再次踩 |
| **BUG-067** | S64 | ✓ 已修 | **web 端硬编码版本号**: 3 处 v3.0.0 跟 server 不一致 | `abd20b6` (web version.ts 单一来源) |
| **BUG-066** | S64 | ✓ 已修 | web 端 ui 风格不统一 | `abd20b6` (shadcn/ui 引入) |
| BUG-001 ~ 065 | S58-S62 | ✓ 已修 | 历史 65 个 BUG (APK 签名 / 部署 / mobile UI / 跨端), 见 `apps/mobile/BUGS.md` 完整案例 |

---

## § 2. 按关键字快速索引 (AI 必查)

### 🔍 "APK" / "下载" / "签名"
- **BUG-006** keystore 不一致 → BUG-023 永久 keystore 备份
- **BUG-024** APK 死循环弹窗 (cp apk 当试纸)
- **BUG-068** 5 个 v3.0.0 同大小副本 (历史命名 SOP 失效)
- **BUG-074** APK 缺失 / 假下载 (server 报 v3.0.31 但 APK v3.0.29)

### 🔍 "部署" / "deploy" / "shipin-APP"
- **BUG-008** PM2 env reload 失败 (用 `delete + start`)
- **BUG-028** SSH 嵌套 PS 5.1 `-Command` quoting
- **BUG-029** shipin-APP port 6000 vs 3000
- **BUG-045** server API 响应路径不匹配
- **BUG-046** compileSdk = 34 (mobile 兼容)
- **BUG-047** PS 5.1 `&&` + `;` 嵌套 ssh
- **BUG-048** server APP_VERSION PM2 env reload
- **BUG-069** ecosystem.config.js APP_VERSION 没改
- **BUG-070** 部署没查活跃任务
- **BUG-073** S54 1-行 minified 部署踩 8h
- **BUG-074** APK 缺失 / 假下载

### 🔍 "扣费" / "billing" / "VIP" / "pricing"
- **BUG-005** 扣费实现重复 characterService
- **BUG-017** VideoAgent 时长选 5s/10s 缺省 (跟 BUG-055 重复)
- **BUG-055** VideoAgent 时长 UI 文案 2 端不一致
- **BUG-072** Web 端扣费审计 5 BUG 全不一致 (A/B/C/E)

### 🔍 "server" / "Express" / "MySQL" / "PM2"
- BUG-008 / 028 / 029 / 045 / 046 / 048 / 069 / 070 / 073

### 🔍 "mobile" / "RN" / "Android" / "APK" / "Hermes"
- BUG-001 / 002 / 003 / 004 / 005 / 006 / 007 / 013 / 014 / 015 / 016 / 017 / 018 / 019 / 020 / 021 / 022 / 023 / 024 / 025 / 026 / 027 / 035 / 036 / 037 / 039 / 040 / 042 / 043 / 044 / 061 / 062 / 063 / 066 / 067 / 068 / 074

### 🔍 "web" / "React" / "Vite" / "shadcn"
- BUG-066 / 067 / 072

### 🔍 "tsc compile" / "TypeScript" / "dist"
- BUG-046 (compileSdk) / BUG-073 (1-行 minified)

### 🔍 "AGENTS.md" / "规范" / "跨端"
- BUG-071 (跨端规范重复 GAP)

### 🔍 "SSH" / "key" / "Mavis 部署"
- BUG-028 (PS 5.1 quoting) / BUG-070 (维护模式)

---

## § 3. 按场景快速定位 (AI 干活 SOP)

### 🎬 S0. 新 session 开始 (30 秒必读)
1. 读 `AGENTS.md` 第 0 项 (根 AGENTS.md) → 跨端总入口
2. 读 `AGENTS.md` 第 1 项 (DEV_PROGRESS.md) → 当前进度
3. 读 `AGENTS.md` 第 16 项 (**本 BUGS_INDEX.md**) → 已知 BUG 速查
4. 读 `HANDOVER.md` § 0 30 秒速览
5. 看 `DEV_PROGRESS.md` "AI 会话追踪"表 → 上个 session 做到哪

### 🎬 S1. 改 src 代码 (ts/tsx)
- 看 `AGENTS.md` § 5 任务 A 流程 (mobile/server/web 各自 5 步)
- 跑 `tsc --noEmit` 0 错
- 跑 `npm run build`
- **防踩**: BUG-046 (compileSdk) + BUG-073 (1-行 minified) + BUG-071 (跨端规范)

### 🎬 S2. 部署 server (shipin-APP)
- 跑 `apps/server/deploy.sh` 维护模式 (BUG-070)
- 6 维验证 (铁律 5, BUG-008)
- 6 处版本号同步 (BUG-069: server ecosystem env+env_production 2 处 + mobile version.ts + build.gradle + web version.ts + changelog.json)
- **防踩**: BUG-046/073/074

### 🎬 S3. 部署 mobile APK
- `cd apps/mobile/android && ./gradlew assembleRelease`
- `aapt2 dump badging app-release.apk | head -1` 验证 versionCode/versionName (BUG-074 教训)
- `cp app-release.apk /www/wwwroot/shipin-APP/public/DeepScript_v<ver>.apk`
- nginx `extension/ab.maque.uno/app-download.conf` 自动代理 `/app/` → shipin-APP/public/
- **防踩**: BUG-024 (cp apk 当试纸) + BUG-068/074 (命名错位 + 没 build apk 改 version)

### 🎬 S4. 改扣费
- 三处一致: 业务代码 (characterService 等) + `/api/pricing` + VipCenterPage UI (BUG-005/072)
- `grep -r "updateBalance\|consumption" src/` 找遗漏点 (BUG-005)
- **防踩**: BUG-005/072

### 🎬 S5. 改 AGENTS.md / 规范
- 必查 § 1 AGENTS.md 总入口 (跨端), 改 1 处必同步 3 处 (BUG-071)
- 写新铁律必查 `STANDARDS_EVOLUTION.md` § 3 5 步 SOP
- 必查 `docs/standards/ADR/` 是否新加 ADR

### 🎬 S6. 紧急生产故障 (5xx 爆发 / 进程死)
- `pm2 logs ai-script-server --lines 100 --nostream`
- `curl /health` + `/api/version`
- **有活跃任务**: 先跑 `apps/server/deploy.sh` 维护模式 (BUG-070)
- 修复 + 部署
- 写 BUG-NNN 进 `apps/mobile/BUGS.md` (跨端共用)
- 写本索引 § 1 速览行 (30 秒后 AI 能看到)

---

## § 4. 高频踩坑 Top 10 (必读铁律, 任何 AI 必看)

1. **PM2 改 env 必 `delete + start`** (BUG-008) — `restart` 不重读 .env
2. **APP_VERSION 6 处同步** (BUG-069) — server ecosystem env + env_production 2 处 + mobile version.ts + build.gradle + web version.ts + changelog.json
3. **活跃任务必跑维护模式** (BUG-070) — 跑 `apps/server/deploy.sh`, 6 步流程
4. **APK 部署必 aapt2 验证** (BUG-068/074) — `aapt2 dump badging` 确认 versionName 跟文件名一致
5. **APK 命名 `DeepScript_v<ver>.apk` 跟 versionName 必一致** (BUG-024) — 禁止 `cp v3.0.12.apk v3.0.13.apk` 当试纸
6. **server + mobile src + APK 三方版本必同步** (BUG-074) — 改 mobile version.ts 必跑 `verify-apk-version.sh` (TODO S70)
7. **1-行 minified src 禁 tsc 重 build** (BUG-073) — 走"单文件 tsc + cp"模式, 避免 S54 编译坏
8. **跨端规范必收口到根 AGENTS.md** (BUG-071) — 改 1 处必同步 3 处
9. **扣费三处一致** (业务/API/UI) (BUG-005/072) — `grep -r "updateBalance|consumption"`
10. **永久 SSH key + ssh-agent 加载** (S69 部署踩坑) — Windows OpenSSH 9.5p2 + MinGit 9.9p1 都 cache fingerprint, 必须 `ssh-agent` 加载才走对

---

## § 5. 完整 BUG 列表 (按编号 → apps/mobile/BUGS.md 锚点)

> **完整 1146 行 / 74 BUG 案例** 在 `apps/mobile/BUGS.md`, 按编号搜索定位.

### S69 (4 个 P0 BUG, 最近修完)
- BUG-071 → apps/mobile/BUGS.md `## BUG-071 (S68 收口) ...`
- BUG-072 → apps/mobile/BUGS.md `## BUG-072 (S69 扣费审计) ...` 含 A/B/C/D/E 5 子 BUG
- BUG-073 → apps/mobile/BUGS.md `## BUG-073 (S69 部署踩 8h) ...`
- BUG-074 → apps/mobile/BUGS.md `## BUG-074 (S69 APK 下载审计) ...`

### S64-S68 (16 个 P0-P2 BUG)
- BUG-055/056/061/062/063/066/067/068/069/070/071 + S66 BUG-069 + S67 BUG-070 + S68 BUG-071

### S58-S62 (60+ 历史 BUG)
- BUG-001 ~ BUG-053 (S58 P1-P10) + BUG-054/055 (S61 P1)

### S58 之前 (老 BUG, 简化)
- 6 个 v2.0 BUG 段 (S58 之前, 跨端通用 BUG 库, 已并入 BUG-024/025/026/027)

---

## § 6. 维护 SOP (新 BUG 必加索引)

### 新发现 BUG 时必做 (5 步)

1. **修代码 + commit** (按 § 3 S1 SOP)
2. **写 `apps/mobile/BUGS.md`** 完整 BUG-NNN 段 (按现有格式: 现象/根因/修法/教训/引用)
3. **更新本 `docs/BUGS_INDEX.md`**:
   - § 1 30 秒速览表加新 BUG-NNN 行
   - § 2 按关键字索引补充 (如适用)
   - § 4 高频踩坑 (如果进 Top 10)
4. **更新 `HANDOVER.md` § 0** 5 教训 (如新增 Top 10)
5. **更新 `AGENTS.md` 必读 15 项** (如新加铁律)

### 关闭 BUG (已修) 时必做
1. `apps/mobile/BUGS.md` 段加 ✓ 已修 (commit 引用)
2. 本索引 § 1 速览表 status 改 ✓
3. 跑 6 维验证 (server) 或 Playwright (web/mobile)

---

## § 7. 引用文档

- **完整 BUG 库**: `apps/mobile/BUGS.md` (1146 行 / 74 BUG)
- **跨端总入口**: `AGENTS.md` (必读 15 项 + 第 16 项 = 本 BUGS_INDEX)
- **跨 session 交接**: `HANDOVER.md` (S68 新建, § 0 速览 + § 5 坑点)
- **部署 SOP**: `apps/server/deploy.sh` (维护模式 6 步) + `docs/DEPLOY.md` (11 节点)
- **规范自迭代**: `docs/STANDARDS_EVOLUTION.md` (5 步 SOP)
- **版本管理**: `docs/VERSION_MANAGEMENT.md` (跨端 6 处版本号同步)
- **环境变量**: `docs/ENV_MANAGEMENT.md` + `apps/server/.env.example`
- **PM2 + ecosystem**: `docs/PM2_GUIDE.md`
- **DB 迁移**: `docs/DB_MIGRATION.md`
- **后端 worker 9 条**: `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`
- **API 跨端响应**: `HANDOVER.md` § 4.5 (S65 集成笔记)

---

**最后更新**: 2026-06-24 (S69 收尾, v1.0)
**下次 review**: S70 收尾时, 必查 Top 10 + 速览表是否需更新
**维护者**: 任何 session 收尾 AI (不限于 S70/S71/...)
