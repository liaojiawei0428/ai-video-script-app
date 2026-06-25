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
| **BUG-089** | S72 batch 6 v3.0.36 | ✓ 已修 | **生图/视频生成成功不立刻显示, 必须切走 Tab 再切回才显示**: polling 完成 setMessages(prev) 已更新 streaming→image, 但紧接 loadHistory() → loadConversation() 整体覆盖 messages (userInitiated race / server 写入 race), UI 回到 streaming 加载圈 | ImageAgentScreen + VideoAgentScreen 拆 loadHistory 为 loadHistory + refreshHistory (polling 完成用 refreshHistory 只刷列表不覆盖 messages); polling 完成 alert 后 setTimeout scrollToEnd 200ms |
| **BUG-088** | S72 batch 6 v3.0.36 | ✓ 已修 | **删除会话弹窗被历史侧栏 Modal 完全遮挡, 用户看不到 confirm → 无法删除历史会话**: Dialog.tsx 用普通 View + absoluteFillObject, 被 RN 原生 Modal (历史侧栏) 永远遮挡 (Android Dialog / iOS UIViewController 永远在 React 视图树最上层) | Dialog.tsx 改用 RN <Modal transparent animationType="none" statusBarTranslucent> 包装 (走 native 层); ImageAgentScreen + VideoAgentScreen 历史侧栏删除按钮先 setShowHistory(false) + setTimeout 300ms 再弹 confirm (防两个 RN Modal z-order race) |
| **BUG-087** | S72 batch 5 v3.0.35 | ✓ 已修 | **APP 内"无限发现新版本"**: mobile config/version.ts 1 行注释 tsc 报 `is not a module` → APP_VERSION=undefined → fetch /api/version?version=undefined → server compareVersions(3.0.34, 'undefined')=1 → needUpdate=true 每次冷启动弹窗 | version.ts 改多行 (Write 工具强制 LF); 新增 db/updateMemory.ts (RNFS 24h 抑制); updater.tsx showUpdateDialog 异步化 (取消按钮写 memory + 下载按钮不写); App.tsx useEffect 加日志; 删 web version-fixed.ts |
| **BUG-082** | S71 后置 | ✓ 已修 | **Web 端 React #31 错误**: 视频/图片 agent error part.message 被存为对象 {code, message} 而非 string (agnes API 返对象, server 原样存), web 渲染对象触发 #31, 整个会话 tab 不可用 | 新建 `utils/errorUtils.ts` extractErrorMessage 60 行; videoAgentService L527+L705 + imageAgentService L637 全部走归一; web AgentChatPanel case 'error' 防御性渲染; 历史 SQL 修 1 条 (aa88d219); verify-deploy 加 17-18 维 |
| **BUG-082 P3** | S71 后置 v3.0.33 | ✓ 已修 | **systemd unit 硬编码 APP_VERSION=3.0.29 漏改** (S70 BUG-077 写完未同步) — V3.0.33 升级时发现, process.env.APP_VERSION 实际生效是 .env 3.0.32 (systemd EnvironmentFile 优先级实测覆盖 [Service] Environment), VERSION_MANAGEMENT § 5.2/§ 7.2 6→8 处 + AGENTS.md 铁律 3 6→8 处 + deploy.sh 加 .env+systemd unit 同步 |
| **BUG-081** | S71 后置 | ✓ 已修 | **用户改方案"An unexpected error occurred"**: imageAgentService processTurn allowedStates 漏 plan_ready (S70 passthrough 改后没同步) + throw raw Error 走 errorHandler 兜底 500 | imageAgentService 加 plan_ready + 改 AppError 400; videoAgentService 加 busy 状态 409; web 提取 error.code 友好提示 |
| **BUG-080** | S71 后置 | ✓ 已修 | **web 端"消费记录"tab 没数据**: BillingPage.tsx push transactions 时只挑 4 字段, 漏 `type` → L137 filter `(r as any).type === 'consumption'` 永远 undefined | `...t` spread 整个 t (含 type/refType/refLabel) + web dist 重 build + E2E 模拟 3 tab filter 全 200 条 |
| **BUG-079** | S71 后置 | ✓ 已修 | **S71 报告"12 维验证全过" 100% 假**: server dist 没部署 + DB schema 没 ALTER + web dist 也没 build + routes/billing.ts 写错 `req.user.userId` (应 `req.userId`) | 重写损坏 src (PS 5.1 丢 newline) + 真 scp dist + 手动 ALTER + 改 `req.userId` + 14 维 + E2E JWT |
| **BUG-078** | S71 | ✓ 已修 | **Web 端账单明细缺消费记录 (基本消费数据缺失)**: 只显示充值, 消费和免费完全没记录 | billing_logs 加 4 字段 (is_free/ref_type/ref_id/ref_label) + recordConsumption 统一入口 + /api/billing/transactions API + BillingPage 重写 (4 卡 + 3 tab + ref_type icon) |
| **BUG-077** | S70 | ✓ 已修 | **宝塔 "项目" 找不到 shipin-APP 3 真相**: 内存 db + 错 db 路径 (default.db vs site.db) + 缺 NODE_PROJECT_NAME env | shipin-app.service 加 env + 修 site.db config + 杀 apt nginx + 启宝塔 nginx (12 维全过) |
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
- BUG-001 / 002 / 003 / 004 / 005 / 006 / 007 / 013 / 014 / 015 / 016 / 017 / 018 / 019 / 020 / 021 / 022 / 023 / 024 / 025 / 026 / 027 / 035 / 036 / 037 / 039 / 040 / 042 / 043 / 044 / 061 / 062 / 063 / 066 / 067 / 068 / 074 / 087 / 088 / 089

### 🔍 "弹窗" / "Modal" / "Dialog" / "Confirm" / "遮挡"
- **BUG-088** 删除会话弹窗被历史侧栏 RN Modal 遮挡 (Dialog 改用 RN Modal 包装 + 先关 Modal 再弹 confirm)

### 🔍 "web" / "React" / "Vite" / "shadcn"
- BUG-066 / 067 / 072

### 🔍 "tsc compile" / "TypeScript" / "dist"
- BUG-046 (compileSdk) / BUG-073 (1-行 minified)

### 🔍 "AGENTS.md" / "规范" / "跨端"
- BUG-071 (跨端规范重复 GAP)

### 🔍 "SSH" / "key" / "Mavis 部署"
- BUG-028 (PS 5.1 quoting) / BUG-070 (维护模式)

### 🔍 "宝塔" / "panel" / "bt.cn" / "项目列表"
- **BUG-076** 宝塔 shipin_APP "未启动" 误导 (S69 解释, 监控走 PM2)
- **BUG-077** 宝塔 "项目" 找不到 shipin-APP 3 真相 (S70 已修, 12 维全过)

### 🔍 "账单" / "billing" / "扣费" / "明细" / "充值" / "消费"
- **BUG-005** 扣费实现重复 characterService
- **BUG-017** VideoAgent 时长选 5s/10s 缺省 (跟 BUG-055 重复)
- **BUG-055** VideoAgent 时长 UI 文案 2 端不一致
- **BUG-072** Web 端扣费审计 5 BUG 全不一致 (A/B/C/E)
- **BUG-078** Web 端账单明细缺消费记录 (基本消费数据缺失, S71 已修, 完整记录消费 + 免费)

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

### 🎬 S7. shipin-APP 部署到宝塔 panel "项目" 列表 (S70 BUG-077 新增 SOP)
- **必读**: [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](BAOTA_NODE_PROJECT_DEPLOY.md) (S70 v1.0 完整 SOP)
- **5 步标准流程**:
  1. 本机编译 + 打包 (`tsc --noEmit` + `npm run build` + `cp changelog.json dist/` + `tar czf`)
  2. 上传到服务器 (`ssh-agent` 加载 + scp 或 Matrix CDN URL)
  3. 服务器 systemd 部署 (`bash apps/server/deploy.sh` 自动 9 步: 查任务→公告→维护→等→预检→备份→systemd restart + 宝塔同步→12 维验证→恢复)
  4. **12 维验证** (6 维自身 + 3 维宝塔/nginx/反代/APK + **3 维宝塔 Node 项目 shipin_APP run=True**)
  5. 文档更新 + commit + push (BUGS.md + BUGS_INDEX + changelog.json)
- **9 个常见坑** (任何 AI 必看, 见 `docs/BAOTA_NODE_PROJECT_DEPLOY.md` § 4):
  1. ❌ 用 PM2 部署 (S70 起 shipin-APP **唯一**路径走 systemd)
  2. ❌ 改 `db/default.db` (真实 db 是 `db/site.db`)
  3. ❌ 缺 `NODE_PROJECT_NAME=shipin_APP` env (systemd unit 必须有)
  4. ❌ apt nginx 没 mask (systemctl mask nginx + pkill -9)
  5. ❌ 启 shipin_APP.conf (server_name 写项目内部名错, 用 ab.maque.uno 已配反代)
  6. ❌ 写宝塔自定义 nodejsModel.py (免费版自带完整 112KB, 不用)
  7. ❌ 写 `shipin_app.pid` (大小写错, 必须是 `shipin_APP.pid` 跟 sites 表项目名一致)
  8. ❌ SQL 改 site.db 没生效 (宝塔 Sql 是内存只读 db, 短期不影响, 长期会丢)
  9. ❌ **systemd unit 启 node 失败 `Cannot find module dist/index.js`** (BUG-078 S71 教训) — `ProtectSystem=full` + `ProtectHome=true` 在 systemd 211+ 创建 read-only namespace, 把 `/www/wwwroot/shipin-APP/dist` 设为**不可读** (不是写!). 修法: 删 `ProtectSystem` + `ProtectHome` 两行 (S70 shipin-app.service 复制时漏改), 或改成 `ProtectSystem=strict` (只保护 `/usr` `/boot` 不动 `/www`). **写入 `docs/deploy/shipin-app.service` 模板 + `BAOTA_NODE_PROJECT_DEPLOY.md` § 4 坑 10**

### 🎬 S8. 加新扣费 / 改 billing 字段 (S71 BUG-078 新增 SOP)
- **必读**: [`apps/mobile/BUGS.md` § BUG-078](../apps/mobile/BUGS.md#bug-078-s71-v3029-web-端账单明细-缺消费记录--只显示充值-消费和免费完全没记录-基础消费数据缺失)
- **统一入口**: 所有扣费 (充值 / 消费 / 退费) 都走 `billingService.recordConsumption(userId, opts)` (S71) 或 `billingService.topUp(userId, amount, description)` (S69), **不要**直接 `INSERT INTO billing_logs`
- **必填字段**:
  - `refType`: `novel_analyze` / `episode` / `shot` / `comic` / `character_variant` / `image` / `video` / `prompt_optimize` / `recharge` / `refund`
  - `refId`: 关联 entity id (novel_id / character_id / image_generation_id / video_generation_id / conversation_id)
  - `refLabel`: 人类可读 ("小说分析《XXX》(N字)" / "角色三视图 4 张" / "图片生成 1:1")
  - `amount`: 0 = 免费 (普通用户 30 张/天 / VIP 无限 / 活动赠送), >0 = 实际扣费
- **免费也记 log** — `amount=0 + isFree=true`, 跟收费一样 INSERT billing_logs (统计日活 / 转化率才准)
- **schema 加字段**: 改 `db.ts` 加 `ALTER TABLE billing_logs ADD COLUMN ...` (用 `try {} catch {}` 兼容老库), 加 `INDEX` (ref_type / user_id+created_at)
- **前端必更新**:
  - web `BillingPage.tsx`: 4 卡 summary + 3 tab (全部 / 消费 / 充值) + ref_type icon + 免费黄色 badge
  - web `api.ts`: `getBillingTransactionsApi()` + `getBillingSummaryApi()`
  - mobile: `BillingScreen` 同步显示 (跟 web 一致, TODO S72)
- **新增 route**: `routes/billing.ts` + `app.use('/api/billing', billingRoutes)` (S71 模板, 复用)
- **关联 BUG**: BUG-072 (前置, S69 扣费审计) + **BUG-078 (S71 修法)** + BUG-005 (扣费实现重复)
  9. ❌ git push schannel 失败 (CRL 检查阻塞, `-c http.schannelCheckRevocation=false` 跳过)
- **紧急回滚 5 min**: `bash apps/server/deploy.sh --rollback` (自动恢复 `dist.bak.s<timestamp>` + systemd restart)
- **关联 BUG**: BUG-076 (S69 解释) + **BUG-077 (S70 修法) + BUG-046/049 (双 nginx 实例) + BUG-008 (PM2 env reload, 历史教训) + BUG-070 (维护模式)**

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

## § 4.5 宝塔部署踩坑 Top 5 (S70 BUG-077 总结, 任何 AI 必看)

1. **宝塔 db 真实路径是 `/www/server/panel/data/db/site.db`**, 不是 `data/db/default.db`!  (BUG-077)
2. **宝塔 Sql 类是内存只读 db 副本** (`__memory_user_db` 写到 `/dev/shm/<md5>.db`), 改硬盘 db 不影响 panel 运行时, 必须改 site.db  (BUG-077)
3. **systemd unit 加 `Environment=NODE_PROJECT_NAME=<project_name>`** 是宝塔 `get_project_state_by_cwd` 找进程的必要 env  (BUG-077)
4. **apt nginx + 宝塔 nginx 双实例冲突**: 同一台机 2 个 nginx 抢 80/443, 宝塔 nginx 永远 bind 失败. 修法: `systemctl mask nginx` + `pkill -9 nginx`  (BUG-046/049/077)
5. **disable 项目 server_name 不要写项目内部名**: `server_name shipin_APP` 是错的, 应该是用户访问的实际域名 (ab.maque.uno 已有反代, 不需要 shipin_APP.conf)  (BUG-077)

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

- **完整 BUG 库**: `apps/mobile/BUGS.md` (1538 行 / 75 BUG 含 BUG-077)
- **跨端总入口**: `AGENTS.md` (必读 17 项 = 16 项 S69 + 第 17 项 `docs/BAOTA_NODE_PROJECT_DEPLOY.md` S70 新加)
- **跨 session 交接**: `HANDOVER.md` (S68 新建, § 0 速览 + § 5 坑点, S70 v1.2 加 BUG-077 引用)
- **🆕 宝塔 panel Node 项目部署 SOP**: `docs/BAOTA_NODE_PROJECT_DEPLOY.md` (S70 v1.0, 5 步流程 + 12 维验证 + 9 坑 + 紧急回滚)
- **部署 SOP**: `apps/server/deploy.sh` v2.0 (S70 重写: 走 systemd + 宝塔同步 9 步) + `docs/DEPLOY.md` (11 节点)
- **规范自迭代**: `docs/STANDARDS_EVOLUTION.md` (5 步 SOP)
- **版本管理**: `docs/VERSION_MANAGEMENT.md` (跨端 6 处版本号同步)
- **环境变量**: `docs/ENV_MANAGEMENT.md` + `apps/server/.env.example`
- **PM2 + ecosystem** (历史, S70 deprecated): `docs/PM2_GUIDE.md`
- **DB 迁移**: `docs/DB_MIGRATION.md`
- **后端 worker 9 条**: `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`
- **API 跨端响应**: `HANDOVER.md` § 4.5 (S65 集成笔记)
- **宝塔部署踩坑**: `apps/mobile/BUGS.md` BUG-077 (S70 v1.1) + 本索引 § 4.5 宝塔部署踩坑 Top 5

---

**最后更新**: 2026-06-26 (S72 batch 6 v1.4, 加 BUG-087/088/089: APP 无限弹窗 + Dialog Modal 遮挡 + 生成成功 race condition)
**下次 review**: S72 收尾时, 必查 Top 10 + 速览表是否需更新
**维护者**: 任何 session 收尾 AI (不限于 S70/S71/...)
