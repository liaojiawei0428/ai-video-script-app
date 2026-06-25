# HANDOVER.md — shipin-APP 项目交接文档 (跨 AI 协作)

> **本文档**: shipin-APP 项目跨 AI 会话交接文档, 下一个 session 开始前**必读**.
> **维护者**: 每次重要 session 收尾后, AI 必追加一段 (见 § 6 模板).
> **最后更新**: 2026-06-25 (S71 收尾, v1.3, 4 P0 BUG 全修 + 8 处版本号规范自迭代 + 4 教训沉淀 + BUG-081 铁律 4+)

---

## § 0. 30 秒速览 (下个 session 必看)

- **项目**: shipin-APP (`F:\QiTa\banmu\APP\ai-video-script-app`), AI 短剧剧本生成 Web+Mobile+Server
- **当前版本**: v3.0.29 (生产 server 实际版本, S70 部署)
- **最近 6 session**: S64 (跨端版本管理) → S65 (STANDARDS_EVOLUTION + ADR) → S66 (后端部署规范 P0+P1) → S67 (server 端 AI 部署入口 + 活跃任务专项) → S68 (AGENTS.md 跨端收口 v2.0) → **S69 (BUG-071/072/073/074/075 + BUGS_INDEX + systemd unit)** → **S70 (BUG-077 宝塔 panel Node 项目部署 + 路径重构)** ← 新
- **核心交付**: 跨端统一规范体系 (16 份文档), BUGS.md 75 个案例, 跨端 AGENTS.md 2 层结构 (根 v2.0 + mobile/server 瘦身 v2.0)
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

### 2.2 22 个 BUG 分布
- **S58-P10** 7 个: BUG-017/021/022/023/024/025 (APK 升级 7 铁律源头)
- **S60** 4 个: BUG-056 等 (server type 错)
- **S64** 3 个: BUG-066/067/068 (跨端版本 6 处)
- **S65-S66** 1 个: BUG-069 (ecosystem 漏修, S64 教训应用)
- **S67-S68** 2 个: BUG-070/071 (活跃任务 + AGENTS.md 收口)

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

### 5.4 🆕 S71 后置坑点 (5 个新)
17. **BUG-079 假报告坑** — S71 部署自报"12 维全过" 100% 假, 实际没真动 server dist / DB schema. **修法**: `verify-deploy.sh --strict` 21 维, 任何 1 失败 exit 1, 不再接受自报
18. **BUG-081 状态机迁移必同步 4 处** — S70 v3.0.0.16 改 passthrough (跳过 plan_cn_ready) 时, `imageAgentService.processTurn` allowedStates 没同步, 9 天后用户撞. **修法**: AGENTS.md 铁律 4+ 4 步同步 (allowlist grep + UI case grep + DB schema 兼容 + 一键自检)
19. **BUG-082 React #31 错误对象渲染** — agnes API 返 `{error: {code, message}}` 对象, server 原样存进 messages JSON, web 渲染对象触发 #31. **修法**: AGENTS.md 铁律 8 持久化必 string 归一 + `utils/errorUtils.ts` `extractErrorMessage()` 5 种输入归一 + web 防御渲染 `typeof === 'string' ? : JSON.stringify()`
20. **PowerShell 5.1 写 .ts/.js/.md/.sql 丢 newline 坑** — S71 BUG-079 真实案例: `src/index.ts` 6673 字节挤 3 行, tsc 编译出 11 行 dist, node 启动立即 exit 0. **修法**: 必走 Write 工具 (UTF-8 自动 newline) 或 PS 7+ `[System.IO.File]::WriteAllText` (无 BOM)
21. **systemd unit 硬编码 APP_VERSION 漏改坑** — S70 BUG-077 重构 shipin-APP 走 systemd 时, systemd unit 硬编码 `Environment=APP_VERSION=3.0.29` 但 .env 实际生效 (systemd EnvironmentFile 优先级实测覆盖 [Service] Environment), 3 个月后 V3.0.33 升级才修复. **修法**: 8 处自检 (含 .env + systemd unit), 部署前 `node tools/verify-version-8-points.js` 一键跑 6 本地 + 2 远程

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

## § 7. 下一步候选 (S71 收尾, 等用户拍)

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

### D. 新功能开发 (S72+)
- 用户指定新功能 (小说分析 / 生图 / 生视频 / 充值 / VIP / 角色 / 分镜 / 视频合成)
- 价值: 实际业务推进

### E. 性能 / 安全 / 兼容性优化
- server 性能分析 + DB 索引优化
- APK 启动速度 / RN 7 旧设备兼容
- server 端 xss/csrf/rate-limit 强化

---

> **本文件维护规则**:
> - 每次重要 session 收尾时, AI 必追加一段到 § 2.1 session 速览表 + § 5 坑点清单
> - 跨端规范变更 (新文档/新 BUG/新 ADR) 时, 同步更新 § 1-5
> - 删除过时内容时, 保留 commit hash 方便追溯
> - 跟 `AGENTS.md` 互补: AGENTS.md = 行为规范, HANDOVER.md = 项目状态

> **最后更新**: 2026-06-25 (S71 收口 + 4 P0 BUG + 8 处规范自迭代, v1.3)
> **下次更新**: 用户指定新功能开发任务 + 完成后追加到 § 6
