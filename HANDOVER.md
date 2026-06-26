# HANDOVER.md — shipin-APP 项目交接文档 (跨 AI 协作)

> **本文档**: shipin-APP 项目跨 AI 会话交接文档, 下一个 session 开始前**必读**.
> **维护者**: 每次重要 session 收尾后, AI 必追加一段 (见 § 6 模板).
> **最后更新**: 2026-06-26 (S72 batch 6 收口 v1.6, BUG-088/089/090 修 + Dialog Modal 遮挡 + polling race + deploy.sh cp 源错 + 跨端 8 处版本号 9 项 + Top 12 + 27 坑点)

---

## § 0. 30 秒速览 (下个 session 必看)

- **项目**: shipin-APP (`F:\QiTa\banmu\APP\ai-video-script-app`), AI 短剧剧本生成 Web+Mobile+Server
- **当前版本**: v3.0.36 (生产 server 实际版本, S72 batch 6 部署, 8 处版本号全对齐 + 公网 APK 已上传)
- **最近 8 session**: S64 (跨端版本管理) → S65 (STANDARDS_EVOLUTION + ADR) → S66 (后端部署规范 P0+P1) → S67 (server 端 AI 部署入口 + 活跃任务专项) → S68 (AGENTS.md 跨端收口 v2.0) → **S69 (BUG-071/072/073/074/075 + BUGS_INDEX + systemd unit)** → **S70 (BUG-077 宝塔 panel Node 项目部署 + 路径重构)** → **S71 (BUG-079/080/081/082 4 P0 + 铁律 4+/8 + 8 处版本号)** → **S72 (汇报规范 7 文件 + REPORTING_STANDARDS.md)** → **S72 batch 4 (ADR-0002 8 问题全修 + BUG-083 修生产 dist/changelog.json 损坏)** → **S72 batch 5 (BUG-087 APP 无限弹窗 + web APP_VERSION_CODE 同步)** → **S72 batch 6 (BUG-088 Dialog Modal 遮挡 + BUG-089 polling race + BUG-090 deploy.sh cp 源错)** ← 最近 session
- **核心交付**: 跨端统一规范体系 (16 份文档), BUGS.md 90 个案例, 跨端 AGENTS.md 2 层结构 (根 v2.0 + mobile/server 瘦身 v2.0)
- **生产环境**: `https://ab.maque.uno` (公网), 服务器本地路径 `/www/wwwroot/shipin-APP` (flat 结构, 非 monorepo)
- **本机环境**: Windows Server 2022 + PowerShell 5.1, **PortableGit 2.43.0** 已装 (`C:\Tools\PortableGit\bin\git.exe`)
- **🚨 S70 部署路径重大变化**: shipin-APP **不再走 PM2**, **走 systemd unit + 宝塔 panel Node 项目同步**. 任何新 session 接手, **必读** [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](docs/BAOTA_NODE_PROJECT_DEPLOY.md) (S70 v1.0, 5 步部署 + 12 维验证 + 9 坑). 不要用 `pm2 restart`, 用 `systemctl restart shipin-app`.
- **关键 5 教训** (从 S58-S70 12 个 session 沉淀): ①必读 AGENTS.md ②APP_VERSION 6 处同步 ③**systemd restart 不用 pm2** ④活跃任务必跑维护模式 ⑤commit message 必带版本号+BUG
- **S69 收尾 (v1.1)**: 4 个 P0 BUG 全修 (BUG-071 跨端规范 + BUG-072 扣费审计 5 子 + BUG-073 S54 1-行 minified 部署 8h + BUG-074 APK 假下载) + **新建 [`docs/BUGS_INDEX.md`](docs/BUGS_INDEX.md) v1.0** (AI 友好 BUG 快速查询: 30 秒速览 + 按关键字 + 按场景 + Top 10 高频踩坑) + AGENTS.md 必读 16 项
- **S70 收尾 (v1.2)**: **BUG-077 宝塔 panel Node 项目部署** + 重构 deploy.sh 走 systemd unit + 新建 [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](docs/BAOTA_NODE_PROJECT_DEPLOY.md) v1.0 (5 步 SOP + 12 维验证 + 9 坑) + `apps/server/AGENTS.md` v2.0 (引用 BAOTA SOP) + `apps/server/deploy.sh` v2.0 (走 systemd + 宝塔同步) + **BUGS_INDEX.md v1.1** (加 § 4.5 宝塔部署踩坑 Top 5 + BUG-077 速览). Commit `7b11230` ✓
- **🚨 必查 (避免重复踩坑)**: 任何新 session 开始, **必读** [`docs/BUGS_INDEX.md` § 4.5 宝塔部署踩坑 Top 5 + § 4 Top 10](docs/BUGS_INDEX.md#45-宝塔部署踩坑-top-5-s70-bug-077-总结-任何-ai-必看), 跟 BUG-008/024/068/069/070/071/072/073/074/**077** 10 个高频 BUG 直接关联

---

## § 1. 项目架构 (3 端 + monorepo)

### 1.1 技术栈
| 端 | 栈 | 端口 / 包名 | 部署方式 |
|---|---|---|---|
| **apps/mobile** (RN) | RN 0.73 + Hermes + TS + React Navigation 6 | `com.aiscriptmobile` | APK 公网分发 (scp → /www/wwwroot/shipin-APP/public/downloads/) |
| **apps/web** (React) | React + Vite | 公网 web 端 | 本机 build → scp → nginx |
| **apps/server** (Node) | Node 18 + Express + MySQL 8 + PM2 6.x | port 6000 | 本机 build → tar → scp → pm2 delete+start |
| **packages/shared-types** | TS type only (BFG-005 教训: 只 type, 不 value) | npm workspaces 链接 | 跟 server 一起部署 |
| **packages/shared-utils** | TS utils | npm workspaces 链接 | 跟 server 一起部署 |

### 1.2 关键目录速览
```
shipin-APP/
├── AGENTS.md                  ← 跨端统一总入口 v2.0 (S68 新) ★ 必读
├── HANDOVER.md                ← 本文件 (跨 AI 交接)
├── DEV_PROGRESS.md            ← AI 会话追踪表 (开始工作前必读)
├── apps/
│   ├── mobile/                ← RN 端
│   │   ├── AGENTS.md          ← mobile 端独有 (S68 瘦身, 76 行)
│   │   ├── BUGS.md            ← 跨端共用 BUG 案例库 (22 个, 840 行)
│   │   ├── CODING_STANDARDS.md ← 38 条硬性规范
│   │   ├── DEPLOY.md          ← mobile APK 升级 5 步
│   │   ├── android/           ← APK build
│   │   ├── src/               ← RN 源码
│   │   └── ...
│   ├── server/                ← Node 端
│   │   ├── AGENTS.md          ← server 端独有 (S68 瘦身, 147 行)
│   │   ├── deploy.sh          ← 远端部署脚本 (含维护模式)
│   │   ├── ecosystem.config.js ← PM2 配置 (env + env_production 2 处 APP_VERSION)
│   │   ├── .env.example       ← env 变量模板 (100 行, S66 补全)
│   │   ├── src/               ← Express 源码
│   │   └── ...
│   └── web/                   ← React 端
│       ├── DEPLOY.md          ← web 部署 5 步
│       └── src/               ← React 源码
├── docs/                      ← 跨端规范文档
│   ├── STANDARDS_EVOLUTION.md ← ★ 规范自迭代 SOP (最高优先, 347 行)
│   ├── VERSION_MANAGEMENT.md  ← 跨端版本管理 (含 § 5 发版 SOP + § 5.A 活跃任务部署)
│   ├── ENV_MANAGEMENT.md      ← env 变量管理 (S66 新, 320 行)
│   ├── PM2_GUIDE.md           ← PM2 + ecosystem 完整规范 (S66 新, 302 行)
│   ├── DB_MIGRATION.md        ← DB 迁移 SOP (S66 新, 418 行)
│   ├── DEPLOY.md              ← server 部署完整 SOP (568 行, 11 节点)
│   ├── notes/DEPLOYMENT_AND_BACKEND_RULES.md ← 后端 worker 9 条实战约束
│   ├── standards/ADR/         ← ADR 决策记录 (0000 模板 + 0001 changelog)
│   └── APP_RELEASE_GUIDE.md   ← ⚠️ 已冻结, 指向 VERSION_MANAGEMENT.md
├── scripts/                   ← 临时脚本 (airtest / bs 控制 / deploy_*.ps1)
└── packages/                  ← monorepo shared 包
```

---

## § 2. S64-S68 5 个 session 关键交付 (5 维规范体系成型)

### 2.1 5 session 速览

| Session | 触发 | 版本 | 核心交付 | BUG | Commit |
|---|---|---|---|---|---|
| **S64** | "版本号散落 6 处不一致" | v3.0.30 P2 | 跨端版本管理规范 + 6 处版本号自检 + 真实 changelog | BUG-066/067/068 | 990e0d5 + 19681aa |
| **S65** | "部署流程是否有相关规范?" + "每次重大更新都要做好规范" | v3.0.30 P2 ✅ | STANDARDS_EVOLUTION SOP + ADR 实践 + web DEPLOY | (5 GAP ✅) | abd20b6 + 59dd611 |
| **S66** | "部署后端的相关流程和规范有吗?" | v3.0.30 P3 | ENV/PM2/DB 3 份新规范 + ecosystem APP_VERSION 6 处同步 | BUG-069 | 3b72a7b + 441f2c1 |
| **S67** | (S66 自检发现活跃任务 GAP) | v3.0.30 P4 | server AGENTS.md + 活跃任务部署专项 (维护模式) | BUG-070 | 4ac7ac3 + d5d4425 |
| **S68** | "统一收口 AGENTS.md" | v3.0.30 P5 | 根 AGENTS.md v2.0 + mobile/server 瘦身 + 跨端 6 铁律 | BUG-071 | 4553108 + 3349f37 + a4bcebc |
| **S69** | "S69 收尾" | v3.0.30 P6 | BUGS_INDEX.md v1.0 + 4 P0 BUG (071/072/073/074) + 5 GAP 补 | BUG-071/072/073/074 | 多 commit |
| **S70** | "宝塔部署踩坑" | v3.0.30 P7 | BUG-077 + 宝塔 Node 项目 + BAOTA_NODE_PROJECT_DEPLOY.md v1.0 + deploy.sh 走 systemd | BUG-077 | 7b11230 + db59d4d |
| **S71** | "S71 后置 4 P0 BUG" | v3.0.32→3.0.33 P8 | BUG-079/080/081/082 4 P0 + BUG-082 P2 TODO + 8 处版本号规范自迭代 + 4 教训 + 铁律 4+/8 | BUG-079/080/081/082 + 082 P3 | d795675 / 6ea3484 / abca9d3 / 4381a7e / f92cc19 / 81f4972 / 084a148 / 1a402c3 |
| **S72** | "汇报沟通规范从无到有" | v3.0.33 P9 | 新建 `docs/REPORTING_STANDARDS.md` 7 文件体系 (主索引 59 行 + 6 topic files 各 < 100 行) + 加做事 4 原则 / 任务前列计划 / 自我改进循环 (A/B/C) + 跨端跨工具借鉴 (Karpathy CLAUDE.md + Boris Cherny + 灵犀 Claw + BerriAI) | (规范自迭代, 无 BUG) | b176ee9 / 02c496b / 58e69fd / f5e2a48 / bfa9ea9 |
| **S72 batch 4** (本 session) | "S72 batch 4 P0/P1/P2 部署 + 修生产 dist/changelog.json 损坏 + 铁律 9 思考链 visible" | v3.0.33 P10 + **AGENTS.md v2.9** | ADR-0002 8 问题全修 (P0 #1-#4 并发扣费/异常回滚/状态机/billing_logs 孤儿 + P1 #5-#8 取消状态/解析 fallback/upload 清理/extract 失败 + P2 #9-#11 自动剧集配置/analyze 鉴权/chunk 段号) + deploy.sh 3 修 (NEW_VERSION 路径/解压 dist 子目录/backup if 检查) + **BUG-083 (本 session 发现)**: 生产 dist/changelog.json 400 Chinese 损坏成 `?` 修复 + verify-deploy.sh 维度 21 防呆 + **🆕 铁律 9 (S72 batch 4 收口 user 硬要求)**: 思考链 + 工具调用流必须 visible, 跨端 6→9 铁律, 配 REPORTING_STANDARDS.md v2.4 同步 | BUG-083 (新) | 0b626ce / 5c49e68 / b6fddcf / d3c5ca8 / dda46a2 / 0c6b77f / 6ac0fe3 / 36392aa / 1244bea / d0babad / d7e7d00 / f543562 / 310098e + 后续 BUG-083 修法 + 铁律 9 commit |
| **S72 batch 5** | "BUG-087 APP 无限弹窗 + web APP_VERSION_CODE 同步" | v3.0.35 P11 | **BUG-087**: mobile version.ts 1 行损坏 tsc 报 `is not a module` → APP_VERSION=undefined → fetch `?version=undefined` → server `compareVersions('3.0.34', 'undefined')=1` → needUpdate=true 每次冷启动弹窗. 修法: version.ts 改多行 (Write 工具强制 LF) + 新建 db/updateMemory.ts (RNFS 24h 抑制) + updater.tsx showUpdateDialog 异步化 + App.tsx 加日志 + 删 web version-fixed.ts. **8 处版本号同步漏改 9**: web `APP_VERSION_CODE` (38→39) 必跟 mobile build.gradle versionCode 同步 | BUG-087 (新) | 跨端 8 处版本号 9 项自检新增 |
| **S72 batch 6** ← 最近 | "BUG-088 Dialog Modal 遮挡 + BUG-089 polling race + BUG-090 deploy.sh changelog cp 源错" | v3.0.36 P12 | **BUG-088**: Dialog 组件用普通 View + absoluteFillObject, 被 RN 原生 Modal (历史侧栏) 永远遮挡. 修法: Dialog.tsx 改用 RN `<Modal transparent animationType="none">` 包装 + historyModal 内删除按钮先关再开 (300ms timeout). **BUG-089**: polling 完成 setMessages 已更新 streaming→image, 但紧接 loadHistory() → loadConversation() 整体覆盖 messages (race condition). 修法: 拆 loadHistory 为 loadHistory + refreshHistory (polling 完成用 refreshHistory 只刷列表不覆盖 messages) + polling 完成 alert 后 setTimeout scrollToEnd 200ms. **BUG-090**: deploy.sh 第 6 步 `cp -f ${DIST_DIR}/changelog.json dist/changelog.json` 源是生产目录 (老版本), 不是 /tmp/ (本机 scp). 修法: 优先 /tmp/changelog.json + 部署 SOP 必加 scp changelog.json + 12 维验证查 changelog 字段. **🆕 verify-deploy.sh 升 21→22 维** (维度 22 BUG-090 /api/version 4 字段验证: version + changelog + highlights + buildDate) | BUG-088/089/090 (新) | 0ce03f0 / 0683dc3 / a00602d + a5ae183 (.gitignore 清理 21 个 untracked) + verify-deploy.sh 维度 22 (6 commit push origin main) |

### 2.2 92 个 BUG 分布
- **S58-P10** 7 个: BUG-017/021/022/023/024/025 (APK 升级 7 铁律源头)
- **S60** 4 个: BUG-056 等 (server type 错)
- **S64** 3 个: BUG-066/067/068 (跨端版本 6 处)
- **S65-S66** 1 个: BUG-069 (ecosystem 漏修, S64 教训应用)
- **S67-S68** 2 个: BUG-070/071 (活跃任务 + AGENTS.md 收口)
- **S69-S71** 5 个: BUG-072/073/074/075/076/077/078/079/080/081/082 (P0 跨端收尾 + 宝塔重构)
- **S72 batch 4** 1 个: BUG-083 (dist/changelog.json 字符编码损坏)
- **S72 batch 5** 1 个: BUG-087 (APP 无限弹窗 + web APP_VERSION_CODE 同步)
- **S72 batch 6** 4 个: BUG-088 (Dialog Modal 遮挡) + BUG-089 (polling race) + BUG-090 (deploy.sh cp 源错) + BUG-091 (commit a5ae183 缺 BUG 编号, 违反铁律 6)
- **S72 batch 7** 3 个: BUG-092 (扫码支付页面"我已付款"按钮从来没实现) + BUG-093 (commit `659025d`+`7e823ac` 缺 BUG 编号, 跟 BUG-091 同款违规) + BUG-094 (admin 看板默认查 'pending' 错, markUserNotified 漏改 status, 14 条累积后台, 跟 BUG-081/092 配套)

### 2.3 规范文档清单 (15 份, 按优先级)
0. **`AGENTS.md`** (S68 v2.0, 297 行) — 跨端统一总入口
1. `docs/STANDARDS_EVOLUTION.md` (S65, 347 行) — 规范自迭代 SOP ★
2. `docs/VERSION_MANAGEMENT.md` (S64, 613 行) — 跨端版本管理
3. `docs/standards/ADR/` (S65) — 0000 模板 + 0001 changelog
4. `apps/mobile/AGENTS.md` (S68 瘦身, 76 行) — mobile 独有
5. `apps/server/AGENTS.md` (S67+S68, 147 行) — server 独有
6. `apps/mobile/BUGS.md` (跨端共用, 840 行, 22 BUG) — BUG 案例库
7. `apps/mobile/CODING_STANDARDS.md` (38 条) — 硬性规范
8. `apps/mobile/DEPLOY.md` — mobile APK 升级 5 步
9. `apps/web/DEPLOY.md` (S65) — web 部署
10. `docs/DEPLOY.md` (568 行, 11 节点) — server 部署完整 SOP
11. `docs/ENV_MANAGEMENT.md` (S66, 320 行) — env 变量管理
12. `docs/PM2_GUIDE.md` (S66, 302 行) — PM2 + ecosystem
13. `docs/DB_MIGRATION.md` (S66, 418 行) — DB 迁移 SOP
14. `docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md` — 后端 worker 9 条
15. `DEV_PROGRESS.md` — AI 会话追踪表 (开始工作前必读)

---

## § 3. 6 处版本号位置 (S66 修正后, 跨端铁律 3)

> **改 1 处必同步 6 处 + 2 配套** (S66 BUG-069 教训, 含 ecosystem.config.js):

| # | 文件 | 字段 | 当前值 |
|---|---|---|---|
| 1 | `apps/mobile/src/config/version.ts` | `export const APP_VERSION = '3.0.30'` | 3.0.30 |
| 2 | `apps/mobile/android/app/build.gradle` | `versionCode 36` + `versionName "3.0.30"` | 3.0.30 |
| 3 | `apps/server/package.json` | `"version": "3.0.30"` | 3.0.30 |
| 4 | `apps/server/src/index.ts` | `process.env.APP_VERSION \|\| '3.0.30'` (fallback) | 3.0.30 |
| 5 | `apps/server/ecosystem.config.js` | **2 处**: `env.APP_VERSION` + `env_production.APP_VERSION` | 3.0.30 |
| 6 | `apps/web/src/config/version.ts` | `export const APP_VERSION = '3.0.30'` | 3.0.30 |
| 配套 | `apps/server/changelog.json` | 当前版本 changelog 条目 | 11 个版本真实 changelog |

**自检命令** (`VERSION_MANAGEMENT.md § 7.2`):
```bash
grep "APP_VERSION = '3.0.30'" apps/mobile/src/config/version.ts
grep "versionName \"3.0.30\"" apps/mobile/android/app/build.gradle
grep '"version": "3.0.30"' apps/server/package.json
grep "process.env.APP_VERSION || '3.0.30'" apps/server/src/index.ts
grep "APP_VERSION: '3.0.30'" apps/server/ecosystem.config.js  # 2 处都返回
grep "APP_VERSION = '3.0.30'" apps/web/src/config/version.ts
```

---

## § 4. 关键设计决策 (避免重复踩坑)

### 4.1 shipin-APP 文件结构: 本地 monorepo vs 生产 flat
- **本地** (开发): `F:\QiTa\banmu\APP\ai-video-script-app\apps\server\` (monorepo 嵌套)
- **生产**: `/www/wwwroot/shipin-APP/` (flat 结构, 直接是 server 根, **不是** monorepo 嵌套)
- **部署时**: 只 `tar` 必要的 `dist/` + `package.json` + `tsconfig.json` + `changelog.json` + `.env.example`, **不要 tar 整个 monorepo**
- **回滚**: 保留前 5 个版本的 dist + .env + DB dump

### 4.2 monorepo shared 包: 只 type, 不 value (BUG-005 教训)
- `@ai-script/shared-types` 只放 TS type 定义
- ❌ 禁止 import value (会引入运行时依赖, 部署到 shipin-APP 失败)
- ✅ 改用: 把 value 复制到 server 自己的 `src/shared/utils.ts`

### 4.3 server 维护模式机制 (S67 BUG-070 配套, 已实现)
- **端点**: `apps/server/src/routes/admin.ts:136` (查活跃任务) + `:144` (开/关维护)
- **状态**: `apps/server/src/shared/maintenance.ts` (全局变量 `let _maintenance = false`)
- **controller 检查**: `characterController.ts:14` + `novelController.ts:12` import `getMaintenance` 拒绝新任务
- **公告**: `apps/server/src/routes/notification.ts:53` (`POST /api/notifications/admin/announcement`)
- **一键部署**: `apps/server/deploy.sh` (58 行, 6 步: 查→公告→维护→等任务→部署→恢复)

### 4.4 跨端 AGENTS.md 2 层结构 (S68 收口核心)
- **根 `AGENTS.md`** = 跨端统一 (9 节: 中文/Persistence/必读 15 项/6 铁律/工作流/Worker 9 条/代码 4 原则/禁新旧版/子项目入口)
- **子 `apps/*/AGENTS.md`** = app 独有 (mobile 5 节 / server 5 节, 互不重复)
- **必读第 0 份**: mobile + server 都指向 `../../AGENTS.md`

### 4.5 server 后端 6 维验证 (部署后必跑, 跨端铁律 5)
```bash
pm2 env 0 | grep APP_VERSION          # 期望 = 当前版本
curl /health                          # 期望 200
curl /api/version                     # 期望 当前版本 + changelog + highlights
curl -X POST /api/novels              # 期望 401 (鉴权)
ss -tlnp | grep 6000                  # 期望 LISTEN
pm2 logs --lines 30 | grep ERROR      # 期望 0 ERROR
```

---

## § 5. 坑点清单 (跨项目通用 + shipin-APP 特有, S58-S68 11 session 沉淀)

### 5.1 shipin-APP 特有
1. **CharacterDescription 11 维** vs CharacterExtraDescription 4 维, types.ts 跟 characterService.ts 字段必对齐, 改前 grep 验证
2. **v3.0.0 状态机 12 态** (极简模式跳 3 态), 改 task_jobs.status 必同步前端
3. **异步任务无锁** (P0 bug), confirm 重复点会扣多次 token 钱
4. **ASPECT_DIMENSIONS 文字比例兜底**, 不同 aspect ratio 不同宽高
5. **不要引入新 npm 依赖** (后端 worker 9 条 #1), shipin-APP 装包 = 重装 node_modules, 慢

### 5.2 部署 / 环境
6. **PM2 用 `delete + start` 不用 `restart`** (BUG-008, restart 不重读 .env)
7. **tsc 增量编译陷阱**: .js 不会自动清, 部署后必 6 维验证
8. **不要覆盖 .env / .env.production / uploads / exports / logs**
9. **SSH key 立即 mavis-trash** (除永久 key `~/.ssh/id_ed25519`)
10. **winget 在该环境装不上** (InternetOpenUrl 0x80072efd 网络 source 失败), 用 MinGit portable + GitHub releases 直下
11. **PowerShell 5.1 中文路径 silent fail**: 用 `Set-Location` + `& 'C:\Program Files\nodejs\npm.cmd'` 绕过

### 5.3 跨 AI 协作
12. **mavis communication send cap ~400 chars**, 大文件走 Matrix CDN HTTPS URL
13. **mavis mcp call matrix matrix_upload_to_cdn --file args.json** (绕 PS 5.1 unicode escape)
14. **Playwright 走 `--file args.json`** (绕 PS 5.1 unicode escape)
15. **AI 必读根 `AGENTS.md` + `DEV_PROGRESS.md`** (S64+ 强制)
16. **commit message 必带版本号 + BUG 编号**: `vX.Y.Z: <改动> (BUG-NNN + 规范修订)`

### 5.4 🆕 S71-S72 后置坑点 (5 + 3 = 8 个新)
17. **BUG-079 假报告坑** — S71 部署自报"12 维全过" 100% 假, 实际没真动 server dist / DB schema. **修法**: `verify-deploy.sh --strict` 22 维 (S72 batch 6 BUG-090 加维度 22), 任何 1 失败 exit 1, 不再接受自报
18. **BUG-081 状态机迁移必同步 4 处** — S70 v3.0.0.16 改 passthrough (跳过 plan_cn_ready) 时, `imageAgentService.processTurn` allowedStates 没同步, 9 天后用户撞. **修法**: AGENTS.md 铁律 4+ 4 步同步 (allowlist grep + UI case grep + DB schema 兼容 + 一键自检)
19. **BUG-082 React #31 错误对象渲染** — agnes API 返 `{error: {code, message}}` 对象, server 原样存进 messages JSON, web 渲染对象触发 #31. **修法**: AGENTS.md 铁律 8 持久化必 string 归一 + `utils/errorUtils.ts` `extractErrorMessage()` 5 种输入归一 + web 防御渲染 `typeof === 'string' ? : JSON.stringify()`
20. **PowerShell 5.1 写 .ts/.js/.md/.sql 丢 newline 坑** — S71 BUG-079 真实案例: `src/index.ts` 6673 字节挤 3 行, tsc 编译出 11 行 dist, node 启动立即 exit 0. **修法**: 必走 Write 工具 (UTF-8 自动 newline) 或 PS 7+ `[System.IO.File]::WriteAllText` (无 BOM)
21. **systemd unit 硬编码 APP_VERSION 漏改坑** — S70 BUG-077 重构 shipin-APP 走 systemd 时, systemd unit 硬编码 `Environment=APP_VERSION=3.0.29` 但 .env 实际生效 (systemd EnvironmentFile 优先级实测覆盖 [Service] Environment), 3 个月后 V3.0.33 升级才修复. **修法**: 8 处自检 (含 .env + systemd unit), 部署前 `node tools/verify-version-8-points.js` 一键跑 6 本地 + 2 远程
22. **REPORTING 拆分后跨文件引用断裂坑** — v2.3.1 拆分 `模板.md` 到 4 文件后, 自检.md / 原则.md / 主文件 3 处都有跨文件引用, 漏改 1 处断链. **修法**: v2.3 拆分时 grep 验证所有跨文件引用锚点, 提交前必跑 `python3 -c "import pathlib; print(sum(p.read_text().count('模板.md') for p in pathlib.Path('docs/reporting').rglob('*.md')))"` 必为 0 (除已删旧文件)
23. **汇报沟通自我改进循环无验证坑** — v2.2 加 A (主动自查) + B (改前提案) + C (规模警告) 后, 没有自动验证机制, AI 可能自我感觉"已改好"实际没生效. **修法**: v2.2 A 主动自查 + newline 验证 (`python3 -c "data=open(f,'rb').read(); print(data.count(b'\n'))"`) 必跑, 写后必报"newline 数 + 行数"给用户看
24. **Boris Cherny "用户反馈后自动更新 lessons.md" 不适用 shipin-APP 坑** — Claude Code 工具链的 lessons.md 是会话级临时文件, shipin-APP 跨会话靠 HANDOVER.md § 2.1 + DEV_PROGRESS.md, 不要混淆. **修法**: AI 汇报 "已修" 前必跑 `git log -1 --format='%H'` 拿到 commit hash + 确认改动文件确实进了 commit (用 `git show --stat <hash>`)

### 5.5 🆕 S72 batch 4 后置坑点 (1 个新, BUG-083)

25. **BUG-083 dist/changelog.json 字符编码损坏坑** — S72 batch 4 部署时, 生产 dist/changelog.json 400 个 Chinese 全部被替换成 `?` (单字节 0x3F), `/api/version` 返回 invalid JSON. 根因 3 层链: 1) 本地 10 条 highlights 含大量 Chinese 2) scp 或 systemd 容器环境 charset 转换 3) deploy.sh 没强制 `cp -f changelog.json dist/changelog.json` (S72 commit 310098e 补上但对已损坏生产无效). **修法**: 1) deploy.sh 加 `cp -f changelog.json dist/changelog.json` (commit 310098e) 2) verify-deploy.sh 加维度 21 检查 dist/changelog.json UTF-8 完整性 (non-ASCII char 计数 + JSON parse) 3) 重新部署让修法 1 覆盖损坏版. 跨项目通用: **scp / 写远端 JSON 文件必显式 UTF-8 编码, deploy.sh 对文本文件必 `cp` 一次到 dist/**

### 5.6 🆕 S72 batch 4 后置规范坑 (1 个新, 铁律 9)

26. **silent 执行坑 (跨项目通用, 铁律 9 配套)** — AI 接到任务 silent 推理 5-10 步 + 直接出结果, user 中途无法介入, 跑偏 30+ min 才发现. 根因: AI 内部 thinking 块不暴露 + 工具调用结果不报 + 失败/判断点不主动说. **修法 (铁律 9, S72 batch 4 收口 user 硬要求)**: 1) 思考过程显式写到回复 (📋 思考: ...) 2) 工具调用流必报 (做什么+为什么+结果) 3) 失败/重试主动报 (⚠️ 撞墙: 错 X, 试 Y) 4) 自主判断点列选项 (2+ 候选必显式) 5) 测试/验证贴原始输出 (前 5+后 5+关键中间). 跨项目通用: **任何 AI session 默认 full D 模式, silent 执行 = 浪费 10 倍时间**

### 5.7 🆕 S72 batch 5 后置坑点 (1 个新, BUG-087)

27. **BUG-087 mobile config/version.ts 1 行损坏坑 (跟 BUG-079 同根, 跨项目通用)** — mobile `apps/mobile/src/config/version.ts` 跟 web / server 一样是 critical 文件, 但 S72 batch 5 时是 1445 字节 1 行 (newline=0). tsc 报 `TS2306: File .../version.ts is not a module`, 编译出空 module, export undefined, 运行期 `APP_VERSION = undefined`, fetch `?version=undefined`, server `compareVersions('3.0.34', 'undefined')` 解析: `'undefined'.split('.') = ['undefined']` → `Number('undefined')=NaN` → `(NaN || 0) = 0` → `3 > 0 = 1` → needUpdate=true. **修法**: version.ts 改多行 (Write 工具强制 LF) + 新建 `db/updateMemory.ts` 24h 抑制 + showUpdateDialog 异步化 + 删 web version-fixed.ts. **教训**: S71 BUG-079 修了 web version.ts, S72 batch 5 才发现 mobile 没防, **跨端 critical 文件必所有端都跑 `python3 -c "data=open(f,'rb').read(); print(data.count(b'\\n'))"` 验证**. shipin-APP 跨端 4 个 critical version.ts: mobile / web / server config / server index.ts fallback. 跨项目通用: **任何跨端 .ts 配置文件, 改完必跑 newline 验证 + tsc --noEmit 验证 + 实测 import 不为 undefined**

### 5.8 🆕 S72 batch 6 后置坑点 (3 个新, BUG-088/089/090)

28. **BUG-088 Dialog 用普通 View 被 RN 原生 Modal 遮挡坑 (跨项目通用, RN/React/Vue)** — Dialog/DialogHost 等"全局弹窗"组件用普通 `<View>` + `StyleSheet.absoluteFillObject` 模拟, 渲染在 React 视图树中, 永远被 RN 原生 `<Modal>` (走 Android Dialog / iOS UIViewController native 层) 遮挡, 用户看不到 confirm → 功能失效. **修法**: 任何"全局弹窗"必须用 RN `<Modal transparent animationType="none" statusBarTranslucent>` 包装, 走 native 层永远在 React 视图树最上层. shipin-APP 实际位置: `apps/mobile/src/components/Dialog.tsx` line 121-128 (v3.0.36 改). 跨项目通用: 任何"全局"组件 (Dialog/Toast/Sheet/Modal) 都用 RN Modal 包装, 不要用普通 View 模拟. 配套: 多 Modal 嵌套时先关再开 + setTimeout 300ms 等关闭动画, 防 z-order race

29. **BUG-089 polling 完成 auto-load race condition 坑 (跨项目通用, RN/React/SSE/WebSocket)** — polling 完成后紧接 `loadHistory()` → `loadConversation()` 整体覆盖 messages state, 即使 `setMessages(prev)` 已把 streaming → image 写进内存, 也被 loadConversation 拿到的 server 旧 messages 覆盖 (server 写入有微小延迟, userInitiated race). **修法**: 拆 loadHistory 为 loadHistory (首次 auto-load 详情) + refreshHistory (polling 完成只刷列表不覆盖 messages). 配套: polling 完成 alert 关闭后 setTimeout scrollToEnd 200ms, 确保新内容可见. shipin-APP 实际位置: `apps/mobile/src/screens/ImageAgentScreen.tsx` + `VideoAgentScreen.tsx` (v3.0.36 拆函数). 跨项目通用: 任何持续推送 (SSE / WebSocket / setInterval) 完成后只更新局部 state, 不整体 reload, 配 userInitiated flag 区分"用户主动"vs"系统触发"

30. **BUG-090 deploy.sh cp 源是生产目录不是 /tmp/ 坑 (跨项目通用, deploy SOP)** — deploy.sh 第 6 步 `cp -f ${DIST_DIR}/changelog.json dist/changelog.json`, 源是**生产目录** (上次部署留下的老版本), 不是本机 scp 过来的新版本, **每次部署都被旧版本覆盖新版本, changelog 永远滞后 1 个版本**. **修法 (跨项目通用)**: 1) deploy.sh 优先读 `/tmp/changelog.json` (本机 scp 源), fallback 到生产目录时显式 warn 2) 部署 SOP 必加完整 scp 清单: `dist.tar.gz + package.json + changelog.json` 3 个必备 3) 12 维验证必查 /api/version 的 changelog/highlights/buildDate 字段, 不只查 version. shipin-APP 实际位置: `apps/server/deploy.sh:184-198` (v3.0.36 修). 跨项目通用: **生产目录永远是上一版本, deploy.sh 的所有 cp/cp 源都从 /tmp/ 拿**. 配套 BUG-083 (字符编码): 部署链文本文件要 cp + UTF-8 验证

### 5.9 🆕 S72 batch 6 收尾违规坑 (1 个新, BUG-091)

31. **BUG-091 commit message subject 缺 BUG 编号坑 (跨项目通用, 铁律 6 配套)** — 写 `git commit -m "v3.0.36 cleanup: 21 个 untracked 临时文件清理 (...)"` 只在 body 写 `Refs: BUG-079, BUG-083, BUG-090`, 违反 AGENTS.md § 4 铁律 6 格式 `vX.Y.Z: <改动一句话> (BUG-NNN + 规范修订)`. **修法 (跨项目通用)**: 1) commit 前必跑 `python3 tools/check-commit-message.py 1` (永久自检, 1 失败 exit 1, S72 batch 6 收尾违规时新建) 2) 格式记忆法: 5 段缺一不可 — 改了什么 + 改了哪个 BUG + 配套规范修订 3) **body 不算**: subject 才是 git log --oneline 跟 GitHub PR 标题唯一必现的字段, body 是补充, subject 必带 BUG 编号是底线 4) 不能 amend 已 push commit (git safety protocol), 违规后沉淀 BUG-NNN 永久记录 + 后续 100% 遵守. 跨项目通用: **任何 AI session 写 commit 必带 BUG 编号 (或 `+ 规范修订` 字样, 表示无 BUG 触发纯规范修订)**

---

## § 6. 交接模板 (下次 session 收尾时, AI 必追加一段)

```markdown
### S6X (日期) - <一句话标题>

**做了什么**:
- (列 3-5 个关键动作, 引用 commit hash + 文件:行)

**关键决策**:
- (列 1-3 个重要设计决策, 引用 BUG / ADR)

**留下的坑**:
- (列 1-3 个下个 session 必看的点)

**下一步候选**:
- (列 2-4 个候选任务, 等用户拍)
```

---

## § 7. 下一步候选 (S72 batch 4 收尾, BUG-083 修完, 等用户拍)

### A. BUG-082 剩 1 项: mobile 端防御渲染
- 修 `apps/mobile/src/screens/.../AgentChatPanel` (有类似 case 'error' 吗?) 同步防御性渲染
- 防 BUG-082 mobile 版, react-native fetch 也可能撞同类问题
- user 主盯 web, 安卓暂不动; web 稳定后做

### B. 21 个 untracked 临时文件清理
- S63 蓝山测试遗留 (scripts/bs-* + lib/ + AI_TESTING_GUIDE.md) + BUG-079~082 调试 (apps/server/scripts/debug-*.js + NUL + version-fixed.ts)
- mavis-trash 在 reparse point (F:\QiTa\banmu mount) 拒绝, PowerShell Remove-Item 被 permission rule 挡
- 需要 user 手动 PowerShell 强删, 或后续 git stash -u 暂存

### C. 跨端 AGENTS.md § 5.A 活跃任务部署 (S67 BUG-070 跟进)
- 现在 S70/S71 部署都直接 `systemctl restart` 没跑维护模式流程
- 真正有活跃任务时会撞, 需要 S67 BUG-070 维护模式 + S70 systemd 重启 集成
- 待 user 描述使用场景

### D. 新功能开发 (S72 batch 4 收尾后)
- 用户指定新功能 (小说分析 / 生图 / 生视频 / 充值 / VIP / 角色 / 分镜 / 视频合成)
- 价值: 实际业务推进

### E. 性能 / 安全 / 兼容性优化
- server 性能分析 + DB 索引优化
- APK 启动速度 / RN 7 旧设备兼容
- server 端 xss/csrf/rate-limit 强化

### F. 汇报规范继续优化 (S72 后置)
- `docs/REPORTING_STANDARDS.md` 主索引可再瘦 (~59 行 → ~30 行), 把 § 7 跨项目通用性表 + 维护规则挪到 `docs/reporting/原则.md`
- `docs/reporting/原则.md` 当前 53 行, 可加 "AI 跟用户协作的 5 个角色" 段 (执行者/审阅者/挑战者/学习者/记录者)
- `apps/web/AGENTS.md` v1.0 (S72 新建) 待实战验证, 未来加 web 端独有的 React 状态管理 / 路由守卫细节
- 根目录 `CLAUDE.md` (S72 新建) 待 Claude Code CLI 用户验证配置
- 跨项目模板沉淀: 把 REPORTING_STANDARDS.md 7 文件复制一份到 `~/.mavis/agents/` 做通用 AI 沟通规范模板

### G. (本 session 新加) BUG-083 修法全链路验证
- 服务器端跑 `bash scripts/verify-deploy.sh --strict` 跑 22 维 (含 S72 batch 6 BUG-090 新维度 22) 确认全过
- 监控 /api/version 返 valid JSON 持续 24h, 确认 BUG-083 不复发
- S72 batch 4 ADR-0002 11 问题沉淀写进 `docs/standards/ADR/0002-novel-analyze-cancellation-and-error-handling.md` (目前是 git commit 散落, 没正式 ADR)

---

> **本文件维护规则**:
> - 每次重要 session 收尾时, AI 必追加一段到 § 2.1 session 速览表 + § 5 坑点清单
> - 跨端规范变更 (新文档/新 BUG/新 ADR) 时, 同步更新 § 1-5
> - 删除过时内容时, 保留 commit hash 方便追溯
> - 跟 `AGENTS.md` 互补: AGENTS.md = 行为规范, HANDOVER.md = 项目状态

> **最后更新**: 2026-06-26 (S72 batch 7 v1.8, BUG-092/093/094 收 + verify-deploy.sh 22 维 + 9 项版本号同步 + Top 12→16 + 32 坑点, 7 commit push origin main: 182033f/9cb8537/659025d/7e823ac/5c6c1a8/8ceb284/7528dc2/ef0ab60)
> **下次更新**: 用户指定新功能开发任务 + 完成后追加到 § 6

---

## § 8. S72 batch 6 收尾 + 规范自检 (2026-06-26, 本 session 详细记录)

### 做了什么 (7 个完整动作)

- **BUG-088 修**: Dialog.tsx 改用 RN `<Modal>` 包装 + ImageAgentScreen/VideoAgentScreen historyModal 删除按钮 setShowHistory(false) + setTimeout 300ms
- **BUG-089 修**: ImageAgentScreen/VideoAgentScreen 拆 loadHistory 为 loadHistory + refreshHistory + polling 完成 alert 后 setTimeout scrollToEnd 200ms
- **BUG-090 修**: deploy.sh:184-198 优先 /tmp/changelog.json, fallback 显式 warn + 部署 SOP 必加 scp changelog.json
- **9 项版本号同步 v3.0.35→v3.0.36**: mobile version.ts + build.gradle (versionCode 40→41) + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts (APP_VERSION_CODE 40→41) + changelog.json + .env + systemd unit (deploy.sh 自动同步)
- **5 份规范文档修订 + 21 个 untracked 清理**: AGENTS.md v2.10 + HANDOVER.md v1.6 → v1.7 + BUGS_INDEX.md v1.5 → v1.6 + VERSION_MANAGEMENT.md v2.1 → v2.2 (含 § 5.B 完整发版 SOP) + BAOTA_NODE_PROJECT_DEPLOY.md v1.1 + .gitignore 排除 NUL + deploy.sh.original
- **🆕 verify-deploy.sh 升 21→22 维**: 维度 22 BUG-090 防呆 — /api/version 4 字段验证 (version == APP_VERSION + changelog 非通用文案 + highlights ≥ 3 条 + buildDate YYYY-MM-DD), 4 场景 mock 验证全过
- **🆕 规范自检 + BUG-091 沉淀 (本 session 加)**: 跑铁律 3 (9 项版本号) + 铁律 6 (commit message) + 铁律 7 (newline) 三维自检, 发现 commit a5ae183 subject 缺 BUG 编号, 沉淀 BUG-091 (跟 BUG-079/083 同级: AI 行为合规违规永久记录) + 新建永久自检脚本 `tools/check-commit-message.py` (15 行, commit 前必跑, 1 失败 exit 1)
- **7 commit push origin main**: `0ce03f0` (BUG-088/089 修) + `0683dc3` (8 处版本号同步) + `a00602d` (BUG-090 修) + `60a9dad` (5 份规范修订) + `a5ae183` (.gitignore 清理 21 个) + `49ca51c` (verify-deploy 维度 22) + BUG-091 沉淀 commit (本 session 待 push)

### 关键决策 (5 个跨项目通用沉淀)

- **决策 1**: 跨端 8 处版本号同步时, web 端 `APP_VERSION_CODE` 必跟 mobile `build.gradle versionCode` 同步 (S72 batch 5 漏改 38→39, v3.0.36 补 40→41). 8 处 → 9 项自检
- **决策 2**: deploy.sh 的所有 `cp` 源必从 `/tmp/` (本机 scp), 不能从生产目录 (永远是上一版本). 部署 SOP 必加完整 scp 清单 (dist.tar.gz + package.json + changelog.json)
- **决策 3**: 12 维验证必查 `/api/version` 的 `changelog` + `highlights` + `buildDate` 字段, 不只查 `version` 字段 (S71 BUG-083 verify-deploy 维度 21 已有 JSON parse 验证, S72 batch 6 加 changelog 4 字段必查)
- **决策 4**: verify-deploy.sh 加维度 22 强制 4 字段验证, 防 S72 batch 6 BUG-090 复发. 跨项目通用: **每修一个 P0 BUG, 必加一个"以后不能再犯"的 grep/parse 维度到 verify-deploy.sh**. BUG-088/089 是 mobile 端修法 server dist 验证不到, 走 user 装包 E2E (见 apps/mobile/DEPLOY.md), S73 待加 mobile-verify-apk.sh
- **决策 5 (本 session 加)**: **commit 前必跑 `python3 tools/check-commit-message.py 1`** 验证 subject 含 BUG 编号 (AGENTS.md § 4 铁律 6 强制), 不通过禁止 `git commit`. 跟 BUG-079 假报告 + BUG-087 跨端漏改 同类教训: **AI 行为合规必自检 + 沉淀永久记录, 不能"看起来 OK 就过"**

### 留下的坑 (3 个下个 session 必看的点)

- **坑 1**: `apps/server/ecosystem.config.js` 仍是 1 行 minified (跟 S54 BUG-073 那个根因一样). S72 batch 6 部署时未重 build, 2 处 APP_VERSION 都 = 3.0.36 OK, 但是是隐藏 P3, 下次 S73 必先 `wc -l ecosystem.config.js` 看是不是 1 行, 必重写多行 + 走"单文件 tsc + cp"模式部署
- **坑 2**: verify-deploy.sh 当前 22 维 (S72 batch 4 + S72 batch 6 升级). S72 batch 6 已加 1 维 (BUG-090 /api/version 4 字段验证), BUG-088/089 是 mobile 端修法 server dist 验证不到, 走 user 装包 E2E (见 apps/mobile/DEPLOY.md). 配套: 下次 S73 必加 mobile 端 verify-mobile-apk.sh (验证 Dialog RN Modal + loadHistory/refreshHistory 拆分在 mobile bundle 里)
- **坑 3**: `tools/check-commit-message.py` 永久自检脚本 (本 session 新建) 必集成到 husky pre-commit hook (可选, S73 待评估)

### 下一步候选 (S72 batch 6 收尾, 等用户拍)

#### A. ✅ 完成: 5 份文档 + 21 个 untracked 清理 + verify-deploy 22 维 + 规范自检 + BUG-091 沉淀
- 6 commit push origin main (0ce03f0 / 0683dc3 / a00602d / 60a9dad / a5ae183 / 49ca51c) + BUG-091 沉淀 commit (本 session 待 push)

#### B. verify-deploy.sh 已升 21→22 维 (✅ S72 batch 6 完成, S73 待加 mobile 端 verify)
- ✅ 维度 22 (本 session 加): BUG-090 防呆 — /api/version 4 字段验证 (version == APP_VERSION + changelog 非通用文案 + highlights ≥ 3 条 + buildDate YYYY-MM-DD), commit 跟 AGENTS.md v2.10 一起 push origin main
- 📋 S73 待加: 维度 23-25 mobile 端防呆 (BUG-088 Dialog RN Modal + BUG-089 loadHistory/refreshHistory 拆分) — 走 `scripts/verify-mobile-apk.sh` (新文件, server 端 verify-deploy.sh 跑不到 mobile bundle)

#### C. ecosystem.config.js 拆 1 行 minified (P3, 长期)
- 跟 S54 BUG-073 同源, 必重写多行 + 走"单文件 tsc + cp"模式部署
- 跨项目通用: 任何 1 行 minified config 必先重写多行

#### D. 新功能开发 (S73 后, 等用户拍)
- user 提需求: 新功能 / 性能优化 / 安全加固
- 价值: 实际业务推进

#### E. BUG-082 mobile 端防御渲染 (P2, 跟 S72 batch 6 同样)
- mobile `apps/mobile/src/screens/.../AgentChatPanel` 加 typeof 防御渲染
- 防 BUG-082 mobile 版, react-native fetch 也可能撞同类问题
- user 主盯 web 端, 安卓端暂不动; web 稳定后做

#### F. 集成 check-commit-message.py 到 husky pre-commit hook (本 session 加, 可选 P3)
- 改 `.husky/pre-commit` 加 `python3 tools/check-commit-message.py 1`, 任何 AI session commit 前自动验证
- 配套 BUG-091 防呆自动化, 跨项目通用
