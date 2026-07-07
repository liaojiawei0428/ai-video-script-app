# AGENTS.md — shipin-APP AI Agent 总入口 (跨端统一)

> **本文件**: shipin-APP 项目的 AI Agent 必读总入口 (跨端统一规范).
> **版本**: v2.12 (2026-06-26 S72 batch 7 后, 加 🆕 [`docs/DEPLOY_RELEASE_FLOW.md`](./docs/DEPLOY_RELEASE_FLOW.md) 主入口 SOP)
> **配套**: `apps/mobile/AGENTS.md` (mobile 端独有) + `apps/server/AGENTS.md` (server 端独有) + `apps/web/AGENTS.md` (web 端独有)
> **子项目 AGENTS.md 必读**: 任何 AI 接到 mobile / server / web 端任务, **必先读根 AGENTS.md**, 然后跳转到对应子 AGENTS.md.

> **🆕 部署 + 发布主入口**: 任何部署 / 发布 / APK rebuild 前必读 [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) (项目宪法, 14 段强制清单) + [`docs/DEPLOY_RELEASE_FLOW.md`](./docs/DEPLOY_RELEASE_FLOW.md) (14 段 SOP + 24 维验证 + 9 已知坑 + 5 步跨端同步 + 11 工具脚本)

> **⚠️ 跨项目通用铁律 #36 (🆕 2026-07-07 S84 沉淀, v3.0.99 BUG-176 实战违反)**: 任何 server 端代码改动 → 必走完整 `apps/server/deploy.sh` (非手动 ssh + sed + systemctl restart). 详细必读 [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) § 2 + § 8 + § 10. 详见 mavis memory "S84 v3.0.99 BUG-176 + v3.0.100 BUG-177 实战" + `apps/server/AGENTS.md` § 3 铁律 9 ⚠️ 实战反思 block.

---

## § 1. Thinking & Response Language Constraint (跨端统一)

### 思考过程 (Thought)
你必须在进行逻辑推理、规划和"思考"过程时使用中文（简体中文）。

在采取行动之前，你的每一个推理步骤都必须用中文表述。

强制要求：你必须使用中文进行逻辑推理和思考（Thought 过程），严禁使用英文。

### 回复内容 (Response)
**所有给用户看的输出（解释、报告、错误信息、确认等）必须使用中文。**

包括但不限于：
- 任务实施完成后的状态报告
- 错误排查与解释
- 决策建议与方案对比
- 代码注释外的任何文字输出
- 提交说明 (commit message / PR description)

允许使用英文的场景（必须保持英文原文）：
- 代码本身（变量名、函数名、类名、注释）
- 技术专有名词（如 `git`, `npm`, `webpack`, `JSON`, `WebSocket` 等无法翻译的术语）
- 用户明确使用英文提问时的部分术语
- Git 提交信息中的 `type(scope)` 前缀

禁止在回复中使用：
- 整段英文段落解释
- 英文对话（如 "Hello" 而不用"你好"）
- 英文状态报告

## § 2. Persistence Guard (10 轮后语言漂移防护)

当对话轮次超过 10 轮时，初始指令可能会被上下文窗口压制。
为防止语言漂移回英文，你必须在每个用户提示后追加以下后缀：

(Reminder: Think in Chinese, respond in Chinese)

此后缀确保每次用户提问后，AI 都会重新读取到中文思考与回复的指令，避免上下文窗口压制。

---

## § 3. 跨端必读列表 (AI Agent 必读优先级排序)

> **任何 AI 接手 shipin-APP 任意端任务, 必按以下顺序读** (本表为 S68 收口核心):

| 优先级 | 文件 | 用途 |
|---|---|---|
| 0 | **本文件 `AGENTS.md`** | 跨端统一总入口 (中文/Persistence/铁律/工作流) |
| 1 | **[`docs/STANDARDS_EVOLUTION.md`](docs/STANDARDS_EVOLUTION.md)** (S65 新建) | 规范自迭代 SOP (修订流程 5 步 + ADR 实践 + 责任矩阵) |
| 2 | **[`docs/VERSION_MANAGEMENT.md`](docs/VERSION_MANAGEMENT.md)** (S64 新建) | 跨端版本管理 (6 处版本号 + § 5 发版 SOP + § 5.0 活跃任务部署) |
| 2.5 | **[`docs/REPORTING_STANDARDS.md`](docs/REPORTING_STANDARDS.md)** (S72 v2.3 拆分) | 汇报沟通规范主索引 (元信息 + 跨规范关系 + 维护规则, 主文件 ~50 行) |
| 2.5.1 | **[`docs/reporting/原则.md`](docs/reporting/原则.md)** (S72 v2.3 新建) | 汇报 6 原则 + 做事 4 原则 + C 规模警告 |
| 2.5.2 | **[`docs/reporting/模板-五段式.md`](docs/reporting/模板-五段式.md)** (S72 v2.3.1 拆分) | 五段式模板 (段 1-5) |
| 2.5.2.1 | **[`docs/reporting/模板-任务计划.md`](docs/reporting/模板-任务计划.md)** (S72 v2.3.1 新建) | 任务前先列计划 (3 步以上) |
| 2.5.2.2 | **[`docs/reporting/模板-场景微调.md`](docs/reporting/模板-场景微调.md)** (S72 v2.3.1 新建) | 5 场景微调 (A/B/C/D/E) |
| 2.5.2.3 | **[`docs/reporting/模板-禁用清单.md`](docs/reporting/模板-禁用清单.md)** (S72 v2.3.1 新建) | 禁用清单 + 保留特殊名词 |
| 2.5.3 | **[`docs/reporting/自检.md`](docs/reporting/自检.md)** (S72 v2.3 新建) | 自检清单 15 项 + 改前改后真实案例对照 |
| 3 | **[`apps/mobile/BUGS.md`](apps/mobile/BUGS.md)** (跨端共用) | 历史 BUG 案例库 (BUG-001 ~ BUG-071, 21 个) |
| 4 | **[`apps/mobile/CODING_STANDARDS.md`](apps/mobile/CODING_STANDARDS.md)** | 38 条硬性规范 + BUG 记录强制流程 |
| 5 | **[`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md)** (S68 瘦身) | mobile 端独有 (RN 栈 + 升级 7 铁律 + 改 mobile 代码前后 5 步) |
| 6 | **[`apps/server/AGENTS.md`](apps/server/AGENTS.md)** (S68 瘦身) | server 端独有 (部署 5 项 + 8 铁律 + 5 类任务 SOP + 代码架构) |
| 7 | **[`docs/DEPLOY.md`](docs/DEPLOY.md)** | server 部署完整 SOP (11 节点 + 6 维验证) |
| 8 | **[`apps/mobile/DEPLOY.md`](apps/mobile/DEPLOY.md)** | mobile 端部署 (APK 升级 5 步 + 7 类失败诊断) |
| 9 | **[`apps/web/DEPLOY.md`](apps/web/DEPLOY.md)** (S65 新建) | web 端部署 (本地 build + scp + nginx) |
| 10 | **[`docs/ENV_MANAGEMENT.md`](docs/ENV_MANAGEMENT.md)** (S66) | env 变量管理 (server 用) |
| 11 | **[`docs/PM2_GUIDE.md`](docs/PM2_GUIDE.md)** (S66) | PM2 + ecosystem 规范 (server 用) |
| 12 | **[`docs/DB_MIGRATION.md`](docs/DB_MIGRATION.md)** (S66) | DB schema 迁移 SOP (server 用) |
| 13 | **[`docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)** | 后端 worker 9 条实战约束 (改 server 代码前必读) |
| 14 | **[`docs/standards/ADR/`](docs/standards/ADR/)** (S65 新建) | 架构决策追溯 (0001 server changelog 单一来源) |
| 15 | **`DEV_PROGRESS.md`** | AI 会话追踪表 (开始工作前必读, § 5) |
| 16 | **[`docs/BUGS_INDEX.md`](docs/BUGS_INDEX.md)** (S69 新建) | BUG 案例库 AI 快速查询索引 (30 秒速览 + 按关键字 + 按场景 + Top 10 高频踩坑 + § 4.5 宝塔部署踩坑 Top 5 + 完整 75 BUG 编号) |
| 17 | **[`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](docs/BAOTA_NODE_PROJECT_DEPLOY.md)** (S70 新建, BUG-077 修法) | 🆕 **shipin-APP 部署到宝塔 panel Node 项目标准 SOP (5 步流程 + 12 维验证 + 9 坑 + 紧急回滚 5 min). 任何 server 部署前必读, **不要再走 PM2 路径**!** |
| 18 | **[`scripts/verify-deploy.sh`](scripts/verify-deploy.sh)** (S71 后置, BUG-079 修法) | 🆕 **部署后必跑 14 维验证 + E2E JWT** (含 grep dist 关键字符串 + DB schema + ALTER 应用 + web JS hash). 任何部署完成后必跑, **取代"自报 12 维全过"假报告**. 服务器端 `bash scripts/verify-deploy.sh --strict` (CI 用) |

**ADR 触发**: 任何架构级变更 (新模块 / 重构 / 跨端收口) 必写 ADR-NNN, 模板见 `docs/standards/ADR/0000-adr-template.md`.

> **重要**: 必读第 17 项 `docs/BAOTA_NODE_PROJECT_DEPLOY.md` 是 S70 新建的 **shipin-APP 宝塔 panel Node 项目部署 SOP** (BUG-077 修法):
> - **§ 0 部署架构总览** (一图看懂 shipin-APP 走 systemd unit + 宝塔 panel Node 项目, 不再走 PM2)
> - **§ 1 部署前 5 步必读** (5 个必读文档 + 5 个关键路径 + 6 维预检)
> - **§ 2 部署 5 步标准流程** (本机编译 + scp 上传 + 服务器 systemd 部署 + 12 维验证 + 文档 commit)
> - **§ 3 部署后 4 步交付** (user 报告 + commit message + 后续 TODO)
> - **§ 4 9 个常见坑** (PM2 ❌ / db/default.db ❌ / NODE_PROJECT_NAME 必备 / apt nginx mask / server_name 错 / 自定义 nodejsModel.py 不需要 / shipin_app.pid ❌ / SQL 改 db 没生效 / git push schannel)
> - **§ 5 紧急回滚 SOP** (dist 回滚 / systemd unit 回滚 / site.db config 回滚)
>
> **必读第 16 项 `docs/BUGS_INDEX.md` § 4.5 宝塔部署踩坑 Top 5 + § 4 Top 10**:
> - § 4 Top 10 高频踩坑 (跟 BUG-008/024/068/069/070/071/072/073/074 9 个高频 BUG 直接关联)
> - § 4.5 宝塔部署踩坑 Top 5 (S70 BUG-077 总结: 真实 db 是 site.db / 内存只读 db / NODE_PROJECT_NAME 必备 / 双 nginx 实例 / server_name 别写项目内部名)
> - **§ 1 30 秒速览表** (按编号倒序, 最近 BUG 优先)
> - **§ 2 按关键字索引** (APK / 部署 / 扣费 / server / mobile / web / tsc compile / AGENTS.md / SSH / 宝塔)
> - **§ 3 按场景 SOP** (S0 新 session / S1 改 src / S2 部署 server / S3 部署 APK / S4 改扣费 / S5 改规范 / S6 紧急故障)
> - **§ 5 完整 BUG 列表** (按编号, 锚点链接到 `apps/mobile/BUGS.md` 完整 BUG 库)
> - **§ 6 维护 SOP** (新 BUG 必加索引 5 步)
> - **§ 7 引用文档** (完整 BUG 库 + 跨端总入口 + 跨 session 交接 + 部署 SOP + 规范自迭代)

---

## § 4. 跨端 9 条铁律 (S68 综合 mobile 4 + server 8 + 根 4 去重, S72 batch 4 收口扩 8→9)

> **任何 AI 必遵守, 跨端通用, 跟各 app 独有铁律互补**:

### 铁律 1: 中文思考 + 中文回复 (§ 1)
- 必用中文推理 + 中文报告 (见 § 1)
- 跨 10 轮后追加 Reminder 后缀 (§ 2)

### 铁律 2: 改代码前必读 AGENTS.md + BUGS.md + 跨端规范 (§ 3)
- 必读本文件 + 优先级 1-3 跨端规范 (§ 3)
- mobile 任务追加 `apps/mobile/AGENTS.md` (优先级 5) + `apps/mobile/DEPLOY.md` (8) + `apps/mobile/CODING_STANDARDS.md` (4)
- server 任务追加 `apps/server/AGENTS.md` (优先级 6) + `docs/DEPLOY.md` (7) + `ENV/PM2/DB 3 份规范` (10-12) + `DEPLOYMENT_AND_BACKEND_RULES.md` (13)
- web 任务追加 `apps/web/DEPLOY.md` (优先级 9)
- **必读**: 开始工作前必跑 `Read DEV_PROGRESS.md` (§ 5)

### 铁律 3: APP_VERSION 改 1 处必同步 **9 项** (跨端强约束, S66 BUG-069 + S71 BUG-082 P3 + S72 batch 5/6 教训, v3.0.36 扩 8→9)
- **9 项位置** (v3.0.36 扩 8→9: 🆕 web APP_VERSION_CODE 同步 + changelog scp 必备):
  1. `apps/mobile/src/config/version.ts` (mobile 单一来源)
  2. `apps/mobile/android/app/build.gradle` (versionCode + versionName)
  3. `apps/server/package.json` (`"version"`)
  4. `apps/server/src/index.ts` (fallback `process.env.APP_VERSION || 'X.Y.Z'`)
  5. `apps/server/ecosystem.config.js` (**2 处**: env + env_production, S66 BUG-069 教训)
  6. `apps/web/src/config/version.ts` (web 单一来源 **+ APP_VERSION_CODE 必跟 mobile build.gradle versionCode 同步**, S72 batch 5 BUG-087 漏改 38→39 教训)
  7. **🆕 `/www/wwwroot/shipin-APP/.env`** (APP_VERSION, S71 BUG-082 P3: process.env 实际生效是 .env)
  8. **🆕 `/etc/systemd/system/shipin-app.service`** (Environment=APP_VERSION, S71 BUG-082 P3: S70 BUG-077 写完未同步)
  9. **🆕 `apps/server/changelog.json` 加新版本 entry + 部署时 scp 到 /tmp/changelog.json** (S72 batch 6 BUG-090 教训: 部署 SOP 必加完整 scp 清单 dist.tar.gz + package.json + changelog.json)
- 改完必跑 `VERSION_MANAGEMENT.md § 7.2` **9 项** grep 自检 (v3.0.36 同步)
- 详细 8 步发版 SOP → `VERSION_MANAGEMENT.md § 5` (v3.0.36 同步扩 9 项)
- **🆕 S71 BUG-082 P3 教训**: S70 BUG-077 重构 shipin-APP 走 systemd 时, systemd unit 硬编码 `Environment=APP_VERSION=3.0.29` 但 .env 实际生效 (systemd EnvironmentFile 优先级实测), 3 个月后 V3.0.33 升级才修复. **9 项是底线, ecosystem.config.js 2 处 + .env + systemd unit 1 处都是隐藏 P3**
- **🆕 S72 batch 5 BUG-087 教训**: web `APP_VERSION_CODE` 必跟 mobile `build.gradle versionCode` 同步, S72 batch 5 漏改 38→39, 落后 mobile 1 个版本. 跨项目通用: 跨端 4 个 critical version.ts (mobile/web/server config/server index.ts fallback) 改完必跑 `python3 -c "data=open(f,'rb').read(); print(data.count(b'\\n'))"` 验证 newline + `tsc --noEmit` 验证
- **🆕 S72 batch 6 BUG-090 教训**: changelog.json 必须 scp 到 /tmp/, 部署 SOP 必加 `scp -i <key> apps/server/changelog.json root@<host>:/tmp/changelog.json`. deploy.sh 优先 /tmp/changelog.json (本机 scp 源, 新版本), fallback 到生产目录 (永远是上一版本) 时显式 warn. 12 维验证必查 `/api/version` 的 `changelog` + `highlights` + `buildDate` 字段

### 铁律 4: shipin-APP 部署走 **systemd unit** 不用 PM2 (S70 BUG-077 重构)
- ❌ `pm2 restart` — **S70 起 shipin-APP 不用 PM2**, 走 systemd unit
- ❌ `pm2 restart --update-env` — **shipin-APP 禁用**, 跟 systemd unit 双管会端口冲突
- ✅ `systemctl daemon-reload && systemctl restart shipin-app` (跟宝塔 panel Node 项目 shipin_APP 同步)
- 完整 9 步流程 → [`docs/BAOTA_NODE_PROJECT_DEPLOY.md` § 2](docs/BAOTA_NODE_PROJECT_DEPLOY.md)
- 历史 PM2 规范 → [`docs/PM2_GUIDE.md`](docs/PM2_GUIDE.md) (S70 deprecated, 仅供考古)
- **S58 BUG-008 PM2 env reload 教训仍适用** — server 部署改 env 仍走 `delete + start`, 但 shipin-APP 走 systemd 后这套自动失效

### 铁律 4+: 🔄 状态机迁移必同步 allowlist + response handler (S71 BUG-081 强约束, 跨项目通用)
- **🛑 严禁**: 改 status machine 转换 (`status: 'A' → 'B'` 或 `passthrough` 跳状态) 时, 只改一处 controller/handler, 不更新:
  - 1️⃣ **allowedStates allowlist** (processTurn / processUserAction 哪些 status 允许执行, 例 `apps/server/src/services/imageAgentService.ts:processTurn` 头部 `const allowedStates = [...]`)
  - 2️⃣ **response handler** (前端 web/mobile 根据 status 走不同 UI, 例 `apps/web/src/components/AgentChatPanel.tsx` case 'plan_ready' / 'plan_cn_ready' / 'tool_executing')
  - 3️⃣ **DB 字段迁移脚本** (`apps/server/src/models/db.ts` initTables ALTER + 兼容老 status)
- **✅ 必做**: 任何 status 字段迁移 (新增/删除/改名) 必跑以下 4 步同步:
  1. `grep -rn "allowedStates" apps/server/src/services/` 列出所有 allowlist, 全部更新
  2. `grep -rn "case 'old_status'" apps/web apps/mobile/src` 列出所有 UI 渲染, 全部更新
  3. `grep -rn "status" apps/server/src/models/db.ts` 列出 DB schema, 跑 ALTER + 兼容
  4. `apps/server/scripts/check-status-machine.sh` (待建) 一键自检 3 步
- **真实案例 (S71 BUG-081)**: S70 v3.0.0.16 改 passthrough (跳过 `plan_cn_ready` → 直接 `plan_ready`) 时, `imageAgentService.processTurn` allowedStates 没同步, 9 天后用户撞到 "无法改方案 / An unexpected error occurred". 配套 BUG-082: 状态机迁移必同步 4 处 (allowlist + response handler + DB schema + 错误归一)
- **跨项目通用**: 任何 stateful 系统 (订单状态机 / 工作流引擎 / 协议状态机 / 编译器 AST 状态 / parser 状态) 改 status 字段必同步更新所有引用点. 常见踩坑: 改了 schema 没改 allowlist, 改了 allowlist 没改 UI, 改了 UI 没改 schema. **任意一处漏 = 9 天后用户撞 BUG**

### 铁律 4++: 🌐 Web 主导, APP 跟随 (S72 batch 7 规范反转, 2026-06-26, 跨项目通用 UX 原则)
- **🛑 严禁**: 改 web 端 (`apps/web/`) 任意功能/UI/状态机/接口后, 不检查 app 端 (`apps/mobile/`) 是否同步. 跟之前 "主盯 web, 安卓暂不动" 原则**反转**, 跨端对齐是底线
- **✅ 必做**: 任何 web 端改动必同步检查 app 端是否受影响, 必跑 5 步:
  1. **评估 mobile 端漏修清单**: `diff <(grep -rn '<改动关键字>' apps/web/src) <(grep -rn '<改动关键字>' apps/mobile/src)` 列出 web 有但 app 没有的代码
  2. **修 mobile 端代码**: 跟 web 端 1:1 同步 (状态机 4 态 / API 端点 / UI 文案 / 错误处理)
  3. **跑 mobile tsc + APK rebuild**: `cd apps/mobile && npx tsc --noEmit && gradlew assembleRelease` (5 min 增量编译)
  4. **aapt2 验 versionName**: `aapt2 dump badging app-release.apk` 验 `versionName` 跟 `version.ts` 一致
  5. **scp APK + bump server**: 上传 `https://ab.maque.uno/app/DeepScript_v<X.Y.Z>.apk` + 同步 server `package.json`/`.env` 9 项版本号
- **真实案例 (S72 batch 7)**: BUG-092/094/095/096 全部 web 端修, mobile 端漏 3 BUG (缺"我已付款"按钮 / admin 默认查 pending / React 0 渲染陷阱), user 反馈"APP 没按钮"才被发现. 同样 BUG-088/089/090 S72 batch 6 修 mobile 端, 当时 user 还说"主盯 web, 安卓暂不动", 但实际 BUG-088 mobile Dialog / BUG-089 polling race 都在 mobile 端修过
- **配套**:
  - `apps/mobile/AGENTS.md` 删 "主盯 web, 安卓暂不动" 旧原则 (S72 batch 7)
  - `HANDOVER.md` § 0 + § A + § E 3 处旧原则删 (S72 batch 7)
  - `tools/verify-deploy.sh` 加维度 24: `grep '<web 关键改动关键字>' apps/mobile/src` 必 ≥1 命中 (BUG-092 配套: `notifyRechargePaidApi` / `我已付款` / `STAGE_TEXT` 4 态)
  - `BUGS_INDEX.md` § 4 Top 19+: **Web 主导, APP 跟随, 必同步** (跨项目通用 UX 原则)
  - `STANDARDS_EVOLUTION.md` § 7.5 规范自迭代
  - mavis memory: `Web 主导 APP 跟随 (跨项目通用, 改 web 必同步 app, 列入项目规范)` (S72 batch 7 沉淀)
- **跨项目通用**: 任何 web + mobile + 小程序 + 多端项目, 主端改功能必同步所有端, 必跑 5 步 + 维度 24 自检. 常见踩坑: 改了 web 忘了 mobile / 改了 web mobile 漏状态机 1 态 / 改了 web mobile 漏 API 端点 / 改了 web mobile 漏防御渲染 / 改了 web mobile 漏状态文案. **任意一端漏 = 用户撞 BUG**

### 铁律 4++++: 🔌 server-only hotfix 必 rebuild APK + /api/version 必扫公网真实 APK (S72 batch 31 BUG-131 强约束, 跨项目通用)
- **🛑 严禁**: 改 server 端代码 (即便是 server-only hotfix, 只动 `apps/server/src/`, `apps/web/` + `apps/mobile/src/` 0 业务变化) 时, 不重打 mobile APK + 不重新推到公网 + 不更新 server `/api/version` downloadUrl. 这会导致 `/api/version downloadUrl = DeepScript_v<APP_VERSION>.apk` 但公网没有这 APK → 用户点 APP 内下载 → DownloadManager Status Code 16 ERROR_HTTP_DATA_ERROR (公网 404 HTML 错误页被当 APK 解析失败). 跟 BUG-117 (deploy.py 漏推 APK) 100% 同源, 跟 BUG-103/104 (server bump 漏 rebuild APK) 100% 同源
- **✅ 必做**: server 端任何代码改动, 必跑 4 步配套:
  1. **`getMobileLatestApk()` 配套** (server 启动时扫 `/www/wwwroot/shipin-APP/public/DeepScript_v*.apk`, 取 max version, 5 min LRU cache, fallback `process.env.APP_VERSION`): `apps/server/src/services/apkVersion.ts` (v3.0.62 BUG-131 新增 105 行)
  2. **/api/version 改造**: `downloadUrl` 走 `getMobileLatestApk().url`, 不再信 `process.env.APP_VERSION`. 多返 `mobileLatestApkVersion` (公网真实 APK version) + `mobileLatestApkSource` (public-dir | fallback) 2 字段
  3. **mobile updater 防御层**: catch 块识别 Status Code 16 / 404 → `useDialog.showConfirm` 自动 fallback 浏览器下载 (跟 BUG-117 互补, 任何公网 APK 意外缺失都能 UX 兜底)
  4. **deploy.py 必加 scp 4 件套**: dist.tar.gz + package.json + changelog.json + **🆕 APK** (跟 BUG-117 沉淀一致, deploy.py 必加 4 件套同步升级)
- **真实案例 (S72 batch 31 BUG-131)**: v3.0.61 BUG-130 hotfix 2 是 server-only hotfix (server `imageAgentService.ts` 加 `refImageCount` 字段), 没重打 mobile APK → 公网只有 v3.0.60 APK → 用户点 APP 内下载 → Status Code 16. 修法是把 APK 路径跟公网真实 APK 解耦, server 启动时扫公网目录取最新. **修法虽然带 fallback, 但首选必走 rebuild APK 流程, fallback 是兜底**
- **配套**:
  - `apps/server/AGENTS.md` § 3 加 server 端铁律 9 (跟 BUG-131 配套): server-only hotfix 必 rebuild APK
  - `apps/server/src/services/apkVersion.ts` 新文件 + `clearApkVersionCache()` 给 deploy 调
  - `apps/mobile/src/utils/updater.tsx` catch 块防御层 (跟前文 BUG-117 catch 块对齐)
  - `tools/verify-deploy.sh` 加维度 28 (S72 batch 31 BUG-131 防呆): 公网 HEAD APK 5 维验证 (`downloadUrl 路径 200 OK + Content-Type=application/vnd.android.package-archive + Content-Length > 1MB + SHA256 跟本机一致 + mobileLatestApkVersion 跟 APK 文件名一致`)
  - `BUGS_INDEX.md` § 4 Top 20+: **/api/version downloadUrl 必指向公网真实 APK, 不准拼 server APP_VERSION (跟 BUG-117/103/104 100% 同源)**
  - mavis memory: `server-only hotfix 必 rebuild APK (跨项目通用, /api/version 跟公网 APK 1:1)` (S72 batch 31 BUG-131 沉淀)
- **跨项目通用**: 任何 client 跟 server 版本分离的 mobile/web 项目 (RN APK + server, iOS IPA + server, 小程序 + server), server 端代码改动必 rebuild client 并部署. 常见踩坑: 改 server 没 rebuild client / rebuild client 没 push 公网 / 修了 client 没改 server downloadUrl / 修了 server downloadUrl 没 rebuild client 兜底. **任意一环漏 = 假下载 / Status Code 16 / 用户撞 BUG**

#### 🆕 v3.0.99 BUG-176 实战违反 + v3.0.100 BUG-177 强制升级 modal 死锁修法 (S84 2026-07-07 沉淀, 跟铁律 4+++++ BUG-165 强化配套)

- **🛑 v3.0.99 BUG-176 实战违反本铁律教训**: shipin-APP S83 BUG-176 (DeepSeek `reasoning_content` 污染 `analysis_report`, server-only hotfix) 实战违反铁律 4++++: server 端 `apps/server/src/services/deepseek.ts` +11/-1 一文件, mobile 0 业务变化, 但**没 bump mobile version.ts (仍 3.0.98) / 没 rebuild APK / 没 scp 公网**. 结果: server.version=v3.0.99 但公网 APK=v3.0.98 → **v3.0.99 是个 ghost version (公网 APK 不存在)** → 触发 v3.0.100 BUG-177 客户端强制升级 modal 永远弹 (死锁)
  - **实战反思**: 纸面铁律 + deploy.sh abort 强校验仍然可能被绕过. v3.0.99 实战通过部分手动路径 (改 .env + restart) 走 deploy, 绕过了 deploy.sh § 4.6 端口预检 / § 4 12 维验证 / § 3.5 8 处版本号同步 / § 6.6 1:1 abort, 等于"知道不一致, 但先 ignore, 下次修"
  - **强约束执行纪律 (新加)**: 任何 server 端代码改动 → 必跑完整 `apps/server/deploy.sh` (§ 0-2 5 步 + § 3.5 8 处同步 + § 4 12 维 + § 6 1:1 abort), **不能手动 sed .env + systemctl restart 替代**. deploy.sh abort 是 last-line-of-defense, 触发 abort = 必须推 APK 重做, 不能 ignore

- **🆕 BUG-177 (v3.0.100) client 跟 server 对比字段错位修法**: `apps/mobile/App.tsx` line 297-302 修前用 `info.version` (server-only 进程版本, server hotfix 会变) 跟 `clientVer` (mobile APK 版本) 对比, 跟 server-only hotfix 设计矛盾 (server hotfix 不需要 rebuild APK, 客户端不应强制升级). **修法 line 297-309 改用 `info.mobileLatestApkVersion || info.version` (server 已按需从公网 APK 列表扫到的真实 APK 版本, 跟 BUG-131 v3.0.62 实战扫盘逻辑 1:1 复用)**. v3.0.100 实战验证: `version=3.0.100 + mobileLatestApkVersion=3.0.100` 1:1 一致 ✅

- **跨项目通用铁律 #35 (新沉淀, 跟 BUG-079/131/145/165/166/168 100% 同源)**:
  1. **client 升级对比必用公网真实 APK version (resource version), 不用 server-only 进程 version (process version)**: 跟 server-only hotfix 设计天然兼容, 不会出现 v3.0.99 那种 "server bump 但 client 资源没动" 死锁
  2. **server /api/version 必同时返 2 字段** (v3.0.62 BUG-131 已实现, BUG-177 实战验证修法依赖): `version` (server-only 进程 version) + `mobileLatestApkVersion` (公网真实 APK version). client 端必选对字段用

- **强制升级体系 3 层协同** (跟 BUG-165 + BUG-131 + BUG-177 3 层):
  - **L1 server 扫公网 APK** (BUG-131 v3.0.62): `apps/server/src/services/apkVersion.ts` 启动扫 `/www/wwwroot/shipin-APP/public/DeepScript_v*.apk` 取 max version + 5 min LRU cache + fallback `process.env.APP_VERSION`
  - **L2 server 启动时 console.warn** (BUG-165 v3.0.88): `apps/server/src/index.ts` 启动时 check `.env APP_VERSION` 跟 `changelog.json latest_version` 1:1, 不等 console.warn
  - **L3 deploy.sh 1:1 abort** (BUG-165 v3.0.88): `apps/server/deploy.sh` § 4 升 9 步 → 10 步, deploy 完必查 `mobileLatestApkVersion == currentVersion`, 不等 abort
  - **L4 client 选对字段** (BUG-177 v3.0.100): `apps/mobile/App.tsx` line 297-309 client 必用 `info.mobileLatestApkVersion || info.version` 兜底
  - **跨项目通用**: client + server 架构, 任何 client app 跟 server 真实 version 对比, 必走完整 4 层 chain, 任意 1 层漏 = 卡死 / 假下载 / BUG

- **跨项目通用铁律 #36 (新沉淀, 跟 #35 + shipin-APP 铁律 4++++ 互补)**: 纸上铁律 + 执行纪律缺一不可. deploy script (CI/CD 脚本) abort = last-line-of-defense, 但纪律漏洞 = 部分手动路径绕过 = 触发 ghost version. 必须纪律化: **任何 server 端代码改动 → 必走完整 deploy script 全 12 维**, deploy abort 触发 = 必须重做不能 ignore

### 铁律 4+++++: 🎯 Tab 默认入口必用最新版页面 + 修后必走 UI tree 1-click 验证 + 删死代码前必审计 (S78 BUG-164 强约束, 跨项目通用 UX 原则)
- **🛑 严禁 3 类漏修** (S78 BUG-164 实战教训):
  1. **Tab 默认入口跟最新版页面解耦**: Tab navigator 的 `tabBarComponent: HomeScreen` (老菜单 8 项) 跟 Stack.Screen `ProfileScreen` (新菜单 5 项) 路由分开, 默认入口还在老页面 → 用户从 Tab 进入永远看不到新功能 (要 2-click 才能进). 修法 100% 要把 Tab 默认入口指向最新版页面 (跟 web 端 1:1 镜像)
  2. **删死代码前不审计独占功能**: `git grep -n` + 全项目 grep + App.tsx auth gate 检查, 3 维全通过才能 `mavis-trash`. 漏审计 = 死代码被引用撞 BUG
  3. **修后不跑 UI tree 1-click 验证**: 装 APK → 启动 → Tab 点击 → 是否看到目标页面 → 是否 ≤ 2-click 可达, 不验证 = BUG 漏过 (跟 BUG-163 web bundle 漏 build+deploy 假报告同源)
- **✅ 必做 5 步** (mobile Tab/Stack 路由改动):
  1. **跨端 1:1 镜像审计**: web 端 `ProfilePage` 跟 mobile 端 `ProfileScreen` 5 项服务菜单 (通知+AI助手+账单明细+收费标准+VIP中心) 必 1:1, `diff <(grep -rn 'serviceMenu' apps/web/src) <(grep -rn 'serviceMenu' apps/mobile/src)` 必 0 差异 (跟铁律 4++ 5 步同步 SOP 配套)
  2. **Tab 默认入口 = 新版页面**: `apps/mobile/App.tsx` `tabBarComponent: HomeScreen` 改 `ProfileScreen` (跟 web 端 1:1, 不留中间态)
  3. **删死代码前 3 维审计** (跟 `mavis-trash` 配套): `git grep '<被删文件名>'` + `grep -rn '<被删关键导出>' apps/` + App.tsx auth gate 包裹检查, 3 维全通过才执行 `mavis-trash`
  4. **aapt2 验 APK + adb install + 启动**: `aapt2 dump badging app-release.apk` 验 versionName + `adb install` + `am start` + `screencap` 截图归档
  5. **parse_ui.py 走 UI tree 1-click 验证**: `uiautomator dump` → 解析 clickable=true 元素坐标 → 验证从 Tab 进入目标页面 ≤ 2-click (跟 BUG-164 实战配套)
- **真实案例 (S78 BUG-164)**: S73 BUG-160 v3.0.82 加 mobile 端 5 项新菜单 (通知+AI助手+账单明细+收费标准+VIP中心) → 默认入口是 HomeScreen (老 8 项菜单) → 用户必须 我的 → 头像 (2-click) 才能看到新菜单 → 跨端铁律 4++ 100% 漏修 (跟 BUG-097 mobile 漏修 web 反方向同源, web 端 1-click 镜像没传到 mobile Tab 默认入口). 修法 v3.0.87: 改 App.tsx line 14 删 HomeScreen import + line 136 tabBarComponent 改 ProfileScreen + `mavis-trash` HomeScreen.tsx (693 行) + 6 处版本号同步 v3.0.86→v3.0.87 → 1-click 可达. 死代码审计 3 维通过: HomeScreen login form 不可达 (App.tsx auth gate 已包) + 8 emoji AVATARS 已合并 ProfileScreen PRESET_AVATARS + 全项目 grep `<HomeScreen` 0 命中
- **配套**:
  - `apps/mobile/BUGS.md` BUG-164 段 (line 8423+): 4 条新跨项目通用铁律 + 部署全链路 12 步
  - `apps/mobile/AGENTS.md` § 4.7: 公网 APK 文件名 `DeepScript_v${version}.apk` 跟 APK 内 `versionName` 一致 + 历史 APK 保留 5 个版本
  - `apps/mobile/AGENTS.md` § 4.9: server-only hotfix 必 rebuild APK + 8 处版本号同步 (跟铁律 4++++ 配套)
  - `tools/verify-mobile-apk.sh` 维度 12: 跨项目通用 APK 验证 (CRLF/LF + UTF-8/BOM + 关键字符串 + SHA256 + 公网 HTTP 200 + 9 处版本号 1:1)
  - `tools/parse_ui.py` UI tree clickable 元素坐标解析 (S78 实战沉淀, BUG-164 修法证据)
  - mavis memory: `Tab 默认入口 1:1 镜像 + 删死代码前必审计 (跨项目通用, S78 BUG-164 沉淀)`
- **跨项目通用**: 任何 Tab/Stack/Drawer 路由项目 (RN + iOS + Android + Flutter + Web SPA + 小程序 + Desktop 侧边栏), 默认入口必指向最新功能页面, 修后必走 UI tree 1-click 验证, 删死代码前必审计. 常见踩坑: 改了默认页面忘了 Stack/Drawer / 改了 Stack 忘了 Tab 默认入口 / 删了文件忘了审计独占功能 / 改了路由忘了 adb install + UI tree 验证 / 跨端 web 改了 mobile 漏 1:1. **任意一环漏 = 用户 2-click 才看到新功能 / 死代码被引用撞 BUG / 修法假报告**

#### 🆕 v3.0.88 S78 BUG-165 强化 (强制升级 + 启动必查 1:1, 跟铁律 4+++++ 配套, 跨项目通用铁律)

> **2026-07-06 user 明确要求**: "APP 必须要改成强制升级的模式, 不允许和官网版本不一致, 每次启动 APP 必须要验证版本号, 只要不一致, 必须要升级到最新 APP, 不升级不给使用. 一定要避免这种版本不一致, 无法升级的问题. 检查版本管理规范, 以及相关发布流程, 还有相关规范, 确保这条版本升级的发布流程能执行下去, 同时删除不合时宜的相关规范, 整理好"

> **🆕 强制升级 + 启动必查 1:1 铁律** (跟 BUG-079/087/131/145/164 100% 同源, 跨项目通用):

- **🛑 严禁 4 类** (跟"强制升级"硬冲突的旧规范, BUG-165 实战删除):
  1. **24h 抑制** (v3.0.35 BUG-087): `shouldSuppressUpdateDialog` (RNFS .update_memory 持久化 lastDismissedVersion + lastDismissedAt, 24h 内同版本不弹) → 跟"启动必查 1:1"硬冲突, shipin-APP v3.0.78 实战 user 永远进不了主界面. **必删**, 配套 `mavis-trash apps/mobile/src/db/updateMemory.ts`
  2. **3 按钮 dialog** (v3.0.24): showUpdateDialog 3 按钮 (取消 24h / APP内下载 / 浏览器下载) → 跟"必升级"硬冲突, 改成 2 按钮 (立即升级 / 退出 APP), 没有"取消"或"暂不升级"
  3. **forceUpdate 软升级分支** (v3.0.62 BUG-131): forceUpdate 字段 (跟 needUpdate 同步, UI 隐藏"取消"按钮但还有 2 按钮) → 跟"必升级"硬冲突, 统一为 appForceUpdate 永远 true, 强制 modal 2 按钮
  4. **静默吞错** (v3.0.87 updater.tsx): checkForUpdate catch 静默返 null → user 进主界面, 实际未查 = 漏. 必加重试 (1s/2s/4s exponential backoff, 3 次), throw 真实错误, 启动 gate 拦截

- **✅ 必做 5 步** (mobile 端启动必查 SOP):
  1. **App.tsx startup gate 4 状态机** (跟 BUG-138 跨端 polling owner 修法 1:1 镜像): `checking` (splash, 跑 checkForUpdate 3 次重试) / `network-error` (3 次后仍失败, 渲染重试按钮不允许进主界面) / `update-required` (拿到 updateInfo 但 version 不一致, 渲染强制 modal + 不渲染 NavigationContainer) / `ok` (跟 server 一致, 渲染主界面)
  2. **updater.tsx 强制 modal 2 按钮**: 立即升级 v{version} (绿色) / 退出 APP (红色, BackHandler.exitApp()). 退出 iOS 走 RNExitApp 第三方包, 失败 fallback 弹 alert 让用户手动退
  3. **server /api/version 必返 appForceUpdate 字段**: `appForceUpdate: needUpdate` (跟 needUpdate 同步, 跟 mobile 端 1:1 镜像, 客户端 trust 此字段决定强制 modal). server 启动时 console.warn if .env APP_VERSION != 公网 APK max version (修前 v3.0.78 漏改根本发现不了)
  4. **deploy.sh + verify-deploy.sh 必加 V25 维度**: deploy 完必查 mobileLatestApkVersion == currentVersion, 不等 abort (修前 deploy.sh 只验证 version 字段, 不验证 APK 1:1, 漏 v3.0.78). 配套 verify-deploy.sh 升 25 维 V25 = .env==server==APK 1:1 验证
  5. **删 code 必配套规范沉淀 + 跨项目铁律 cross-reference**: 删 updateMemory.ts → mavis memory 沉淀 "24h 抑制跟强制升级硬冲突 必删" 跨项目铁律; 改 showUpdateDialog 3 按钮 → 2 按钮 → AGENTS.md 铁律 4+++++ 强化 段; 删 forceUpdate → appForceUpdate 统一 → 跟 server 端 /api/version 字段同步

- **真实案例 (S78 BUG-165 v3.0.88)**: 2026-07-06 user 反馈 v3.0.78 server-only hotfix 漏改 .env APP_VERSION (仍 3.0.77 但公网 APK 3.0.78) → 客户端启动查 /api/version 后修前 updater.tsx checkForUpdate 静默吞错 → user 端实际不一致但没任何提示 → user 反复启动反复进老版本. 加上 24h 抑制 (BUG-087), user 取消过就 24h 不弹, 永远进不了主界面. 修法 v3.0.88: ① 删 24h 抑制 + 3 按钮 + forceUpdate 软升级 3 段 ② 改 updater.tsx showForceUpdateDialog 2 按钮 (立即升级 v{version} 绿色 / 退出 APP 红色 BackHandler.exitApp()) ③ 改 App.tsx startup gate 4 状态机, 不通过 = 不渲染 NavigationContainer ④ 改 server /api/version 加 appForceUpdate 字段, 启动时 console.warn if .env != 公网 APK ⑤ 改 deploy.sh + verify-deploy.sh 加 V25 维度, .env==server==APK 1:1 验证 ⑥ 删 apps/mobile/src/db/updateMemory.ts (mavis-trash 死代码) + 6 处版本号同步 v3.0.87→v3.0.88 + mavis memory 清 line 58-99 中文乱码

- **配套**:
  - `apps/mobile/AGENTS.md` § 4.0 (新增): 强制升级铁律 8 条 (跟根 AGENTS.md 铁律 4+++++ v3.0.88 强化 1:1 镜像)
  - `apps/mobile/AGENTS.md` § 4.1 (新增): v3.0.35 (BUG-087 失同步) 24h 抑制 删 - 修法沉淀 (为什么必删, 删法, 跨项目铁律)
  - `apps/mobile/AGENTS.md` § 4.2 (新增): v3.0.62 (BUG-131) forceUpdate 软升级 删 - 修法沉淀 (跟"必升级"硬冲突)
  - `apps/mobile/BUGS.md` BUG-165 段: 5 修法 + 4 跨项目通用铁律 + 部署全链路 12 步
  - `apps/server/src/index.ts` /api/version: 加 appForceUpdate 字段 + 启动时 .env vs 公网 APK 1:1 check
  - `apps/server/deploy.sh`: 升 9 步 → 10 步 (新加 6.6/9 校验 mobileLatestApkVersion == currentVersion, 不等 abort)
  - `scripts/verify-deploy.sh` (远端): 升 24 维 → 25 维, V25 = .env==server==APK 1:1 验证
  - `mavis memory MEMORY.md`: 清 line 58-99 中文乱码 (历史 mavis memory append 失同步留下的 ?? ?????? 占位) + 沉淀 5 条 BUG-165 跨项目通用铁律
  - mavis memory: `强制升级 + 启动必查 1:1 (跨项目通用, S78 BUG-165 沉淀)`

- **跨项目通用**: 任何 client/server 架构项目 (RN + iOS + Android + Flutter + Web SPA + 小程序 + Desktop), 启动必查 client 跟 server 真实 version 1:1, 不一致 = 强制 modal (不渲染主界面) + 删 24h 抑制 (跟"强制"硬冲突) + 删 软升级 (跟"必升级"硬冲突) + server 启动时 .env vs 公网 APK 1:1 check + 删 code 必配套规范沉淀. 常见踩坑: 修了启动必查忘了删 24h 抑制 (BUG-087 失同步) / 删了 24h 抑制忘了删 3 按钮 (跟"必升级"硬冲突) / 删了 3 按钮忘了 server 端 forceUpdate 字段同步 (跟 mobile 端 appForceUpdate 必 1:1) / 加了 startup gate 忘了 deploy.sh 校验 (v3.0.78 漏改根因) / 修了 checkForUpdate 忘了 3 次重试 + throw 真实错误 (跟"必查"硬指标一致). **任意一环漏 = user 反复启动反复进老版本 / 24h 抑制卡死永远进不了主界面 / 假报告假安全**

### 铁律 5: 部署后必跑 5/6/12/14/20 维验证 (S64 + S67 + S70 + **S71 BUG-079/080/082 + S72 batch 6 BUG-090 + S72 batch 31 BUG-131** 升级)
- **跨端 5 维** (`VERSION_MANAGEMENT.md § 5.8`): /health + /api/version + 公网 APK + 6 处版本号 + commit 完整
- **server 6 维** (`docs/DEPLOY.md § 6`): 进程 + 端口 + /health + /api/version + 鉴权 + 日志
- **🆕 server 12 维** (S70 BUG-077): 6 维自身 + 3 维宝塔/nginx/反代/APK + **3 维宝塔 Node 项目 shipin_APP run=True (核心, BUG-077 验收)**
- **🆕🆕 server 14 维** (S71 BUG-079 修法): 6 维自身 + **3 维 server dist 关键字符串 grep (`/api/billing` + `recordConsumption` + `ALTER TABLE`)** + **3 维 DB schema (4 字段 + 2 索引 + 数据)** + 2 维公开 HTTPS/web JS + **E2E JWT 测 /api/billing/transactions + /api/billing/summary 真实数据**
  - **🛑 不再接受"自报 12 维全过"假报告** (S71 BUG-079 教训: 报告 100% 假, 4 层真相)
- **🆕🆕🆕 server 16 维** (S71 BUG-080 P2 修法): 14 维 + **2 维 web 端 dist 手挑字段静态分析 (`.type === 'consumption'` filter pattern + `/api/billing/transactions?type=consumption` E2E 1152 条)**
- **🆕🆕🆕🆕 server 20 维** (S71 BUG-082 修法): 16 维 + **2 维 BUG-082 防呆 (server dist `extractErrorMessage` 3 文件命中 + web dist `JSON.stringify(part.message)` 防御渲染 1 文件命中)** + 2 维 E2E (DB 层 + API 层都验证 error part.message 是 string 不是 object)
  - 一键脚本: 服务器端 `bash scripts/verify-deploy.sh --strict` (CI 用, 任何 1 失败 exit 1)
  - 配套规范: BUGS.md BUG-079/080/082 + `scripts/verify-deploy.sh` 注释
- **🆕🆕🆕🆕🆕 server 22 维** (S72 batch 4 BUG-083 修法): 20 维 + **1 维 dist/changelog.json UTF-8 + JSON parse 双重验证 (non-ASCII char 计数 ≥ 50) + 1 维 server 端 readChangelog 优先级链路** (S72 batch 4 加, 防 BUG-083 字符编码损坏复发)
- **🆕🆕🆕🆕🆕🆕 server 22 维 (S72 batch 6 BUG-090 修法, S73 必升)**: 21 维 + **1 维 BUG-090 /api/version 4 字段验证 (version == APP_VERSION + changelog 非通用文案 + highlights ≥ 3 条 + buildDate YYYY-MM-DD)** (S72 batch 6 加, 防 BUG-090 deploy.sh changelog 滞后复发). BUG-088/089 是 mobile 端修法, server dist 验证不到, 由 user 装包 E2E 验证 (见 apps/mobile/DEPLOY.md)
- **跨项目通用: 每修一个 P0 BUG, 必加一个"以后不能再犯"的 grep 维度到 verify-deploy.sh** — 已加 6 个 BUG 防呆 (BUG-079/080/081/082/083/090, 21 维)
- **活跃任务场景** (S67 BUG-070, `VERSION_MANAGEMENT.md § 5.A`): 部署前必查 `active-tasks`, > 0 必跑 `apps/server/deploy.sh` 维护模式流程 (9 步: 查→公告→维护→等任务→预检→备份→systemd restart + 宝塔同步→12 维验证→恢复)
- **🆕 S72 batch 6 BUG-090 教训**: 12 维验证必查 `/api/version` 的 `changelog` + `highlights` + `buildDate` 字段, 不只查 `version` 字段. changelog 滞后 = 用户看到老版本 changelog, 等同假报告. **必加 1 维 changelog 4 字段验证 (version + changelog + 5 highlights + buildDate)**

### 铁律 6: commit message 必带版本号 + BUG 编号 (跨端统一规范)
- 格式: `vX.Y.Z: <改动一句话> (BUG-NNN + 规范修订)`
- 例: `v3.0.30 P4: server 端 AI 部署入口 (BUG-070 + apps/server/AGENTS.md + 活跃任务部署专项)`
- docs 类提交: `docs(scope): <文档改动> (BUG-NNN)`
- 配套: `DEV_PROGRESS.md` AI 会话追踪表必追加一行 (用单独 commit, 规范修订 commit 跟 docs commit 分离, S66/S67 实践)

### 铁律 7: 🛑 禁止用 PowerShell 5.1 + Out-File 写 .ts/.js/.md/.sql (S71 BUG-079 强约束, 跨项目通用)
- **🛑 严禁**: PowerShell 5.1 (`Out-File -Encoding utf8` / `Set-Content`) 写 .ts/.js/.md/.sql 文件 — 100% 丢 newline, 大文件 1008+ 字节挤 1 行
- **✅ 必用**: Write/Edit 工具 (UTF-8 自动 newline, 工具底层保证 LF) 或 PowerShell 7+ `[System.IO.File]::WriteAllText(path, content, [Text.UTF8Encoding]::new($false))` (无 BOM)
- **验证**: 写后必跑 `python3 -c "data=open('f','rb').read(); print(data.count(b'\n'))"` 或 `bash tools/check-ps51-newline.sh <files>`
- **损坏特征**: 大文件 (>500B) newline < 3 → 必重新用 Write 工具写干净版
- **pre-commit 防呆** (可选): `.husky/pre-commit` 自动跑 `bash tools/check-ps51-newline.sh --staged`, 任何损坏文件 commit 必失败
- **真实案例 (S71 BUG-079)**: `src/index.ts` 6673 字节挤 3 行 (newline=2), `web/version.ts` 1008 字节挤 1 行 (newline=0), tsc 编译出 11 行 dist, node 启动立即 exit 0
- **真实案例 (S72 batch 5 BUG-087)**: `apps/mobile/src/config/version.ts` 1445 字节挤 1 行 (newline=0, 整个文件是 `//` 注释 + `export const ...` 在同一行). tsc 报 `TS2306: File .../version.ts is not a module`, 运行时 `APP_VERSION = undefined`, fetch 发 `?version=undefined`, server `compareVersions` 返 1 → 无限发现新版本弹窗. 同 S71 BUG-079 一模一样的坑, web 修后 mobile 又犯
- **真实案例 (S72 batch 6 BUG-090)**: deploy.sh 第 6 步 `cp -f ${DIST_DIR}/changelog.json dist/changelog.json` 源是**生产目录** (上次部署留下的老版本), 不是本机 scp 过来的新版本, **每次部署都被旧版本覆盖新版本, changelog 永远滞后 1 个版本**. 修法: deploy.sh 优先 `/tmp/changelog.json` (本机 scp 源), fallback 到生产目录时显式 warn. **生产目录永远是上一版本, deploy.sh 的所有 cp 源都从 /tmp/ 拿** (跟 BUG-083 字符编码配套: 部署链文本文件要 cp + UTF-8 验证)
- **跨项目通用**: PowerShell 5.1 是 Windows Server 2016/2019 默认, 任何 AI 用 ssh 写远端文件必走 Write 工具或 `cat > file <<EOF` 避免 PS 5.1 写入

### 铁律 8: 🔌 server 写持久化 JSON 必 string 归一 (S71 BUG-082 强约束, 跨项目通用)
- **🛑 严禁**: 写 messages / logs / DB 字段时, 直接传整个 Error / API 错误对象 (如 `{code, message}`) — 下游渲染 / 解析必炸
- **✅ 必用**: 写之前必过 `extractErrorMessage()` (apps/server/src/utils/errorUtils.ts) 归一, 永远返 string
- **支持 5 种输入**: string / number/boolean / Error / {code, message} 对象 / 嵌套 axios error
- **前端兜底**: 即使 server 修对了, web 渲染 user-supplied data 必 `typeof === 'string' ? : JSON.stringify()` 防御, 防历史脏数据
- **真实案例 (S71 BUG-082)**: agnes API 返 `{error: {code, message}}`, videoAgentService L705 原样存进 DB, web 渲染对象 → React #31, 整个会话 tab 卡死
- **跨项目通用**: 任何 API 边界 (前端 form 后端 / 第三方 API 后端 / WebSocket / MessageQueue) 写持久化时, schema 必归一, 不能透传上游结构

### 铁律 9: 🔍 思考链 + 工具调用流必须 visible (S72 batch 4 收口 user 硬要求, 跨端统一)
- **🛑 严禁**: AI silent 执行 5-10 步突然报错 — user 无法介入, 跑偏 30+ min 才发现, 浪费巨大
- **✅ 必做 (5 场景全覆盖, full D 模式硬要求)**:
  1. **思考过程必报**: 关键推理 (判断依据 / 方案对比 / 风险评估) 必以 `📋 思考: ...` 段显式写到回复, 不允许 silent 推理
  2. **工具调用流必报**: 每个 Bash / Read / Write / Edit / Glob / Grep 工具调用, 必简要说明 `做什么 + 为什么 + 结果` (尤其命令成功也报, 不只报错才报)
  3. **失败/重试必主动报**: 撞墙 → 必发 `⚠️ 撞墙: 错 X, 试 Y` 一条, 不等 user 追问
  4. **自主判断点必列选项**: 有 2+ 候选方案 → 必显式列选项 + 我的推荐 + 理由, 不直接干
  5. **测试/验证必贴原始输出**: tsc / 6 维验证 / grep / curl 这种 5+ 行输出必贴前 5 + 后 5 + 关键中间, 不只报"全过"或"0 ERROR"
- **限制 (防止字数膨胀)**:
  - 重复 5+ 次的 stdout 贴前 5 + 后 5 + 关键中间
  - 短任务 (<3 步) 简报即可
  - 紧急 / 隐私 / 密码 / SSH 密钥 / secret: 简化
- **配套文档** (跟本铁律配套, S72 体系):
  - [`docs/REPORTING_STANDARDS.md`](docs/REPORTING_STANDARDS.md) — 汇报沟通规范主索引 (v2.3, 7 文件)
  - [`docs/reporting/模板-任务计划.md`](docs/reporting/模板-任务计划.md) — 任务前先列计划 (3 步以上)
  - [`docs/reporting/自检.md`](docs/reporting/自检.md) — 自检清单 15 项
  - [`docs/reporting/原则.md § D 规模警告`](docs/reporting/原则.md) — C 规模警告硬要求
- **真实案例 (S72 batch 4 收口)**: user profile "full D 模式" 跨端统一成铁律 9, 5 场景全覆盖, 副作用是字数膨胀由 AI 主动控制 (重复 stdout 截断 / 短任务简报 / 紧急简化)
- **违反代价**: silent 执行 → user 无法介入 → 跑偏 5-10 步才发现 → 浪费 30+ min → 比多打 100 字成本高 10 倍

### 铁律 10: 🔧 外部 SDK 调用必严格对齐官方文档 (S73 BUG-148/149/150/151/152, 2026-07-02, 跨项目通用)

> **背景**: S73 v3.0.78 期间对 shipin-APP 用的所有外部 SDK (DeepSeek / Agnes / JWT / MySQL / Axios) 做官方文档 12 维度对照审查, 发现 ~40 个不规范调用 (错误码包装 / 缺 user_id / 缺 stream_options.include_usage / thinking 模式错 / 错误码细分缺失 等), 实战修法 5 件套 1:1 镜像.

- **12 维度必查** (任何外部 API / SDK 接入):
  1. **base_url** — 文档规定的 API endpoint (避免用老版本/测试环境)
  2. **Authorization** — Bearer Token / API Key 格式严格按文档 (1-char 错就 401)
  3. **model 列表 + 弃用计划** — 必读 "deprecation" 段, 提前 30+ 天发 changelog 警告
  4. **context 上限** (input tokens) + **output 上限** (max_tokens) — 不超官方限制
  5. **并发限流** (TPM/RPM/QPS) — 客户端 必设上限, 不依赖 API 端容错
  6. **计费 / token 换算** (1 中文字符 ≈ 0.6 token, 流式必传 `stream_options.include_usage`)
  7. **SSE 流式格式** (data:[DONE] 收尾 / heartbeat / retry-after)
  8. **deprecated 参数** (frequency_penalty / presence_penalty 等, 传了不报错但不生效)
  9. **错误码语义** (401/402/429/5xx 各自含义 + 重试策略)
  10. **user_id / user 字段** — 内容安全 + KVCache + 调度隔离 (官方强烈建议)
  11. **stream_options.include_usage** — 流式计费准确 (商业硬指标, 不传 = 计费偏低 5-15%)
  12. **弃用警告 + 兼容名** — 提前迁移, 别等 API 升严格校验翻车

- **错误码必严格映射** (不包装 502/500):
  - ❌ 错: throw new Error("API 错误") 把所有 upstream 错误都包成 500
  - ✅ 对: 按 upstream 状态码 1:1 映射到自己的 error code (401 → TOKEN_INVALID / 402 → BALANCE_LOW / 429 → RATE_LIMITED / 5xx → UPSTREAM_ERROR)
  - 透传 upstream error message + request id 字段 (前端调试可见)
  - 真实案例: BUG-148 deepseek.ts 修前所有错误包成 502, 修后 7 子类 enum 1:1 映射 upstream 状态码

- **JWT 必填 4 选项** (算法 + audience + issuer + clockTolerance, BUG-150 实战):
  - `algorithms: ['HS256']` 显式限制, 防 algorithm confusion attack (攻击者用 RS256 公钥伪造 HS256 token)
  - `audience: 'shipin-app'` 跨服务 token 隔离 (走 env 可配)
  - `issuer: 'shipin-APP'` 同上
  - `clockTolerance: 30` 时钟差容忍 (边缘过期用户体验)
  - 错误码 5 子类 (TokenExpiredError / NotBeforeError / JsonWebTokenError aud/iss/sig/alg)

- **跨项目通用铁律沉淀** (跟 S73 BUG-148-152 1:1 镜像):
  - AI API 调用必传 user_id (内容安全 + KVCache + 调度隔离)
  - 错误码必严格映射 (不包装 502/500, 透传 upstream 状态码 + message + request id)
  - 流式必传 stream_options.include_usage (准确计费, 商业硬指标)
  - AI 调官方文档必查 (12 维度 + 错误码 + user_id/弃用 12 维度)
  - 修一个 provider 必 grep 所有 provider 同样模式 (deepseek → agnes → jwt → mysql → axios, 5 BUG 1 次挖深)

### 铁律 11: 🛠️ middleware catch 块必 catch 4 类型 (AppError / MulterError / JsonWebTokenError / MysqlError, S73 BUG-153-157 实战, 跨项目通用)

> **背景**: shipin-APP errorHandler 修前 catch 块统一把任何错误包装成 500 INTERNAL_ERROR, 用户看不到真实错误类型 (是文件超限? token 过期? 数据库死锁? 一概不知道). S73 v3.0.79 BUG-153-157 实战: multer fileFilter 7 子类 + rate-limit 7 维度 + winston 7 维度 + helmet 5 维度 + morgan 5 维度, errorHandler catch 块 1:1 镜像 4 类型.

- **4 类型必 catch**:
  - **AppError** (自定义业务错误) — 透传 code + message + statusCode
  - **MulterError 7 子类** (文件上传): LIMIT_FILE_SIZE 413 / LIMIT_FILE_COUNT 413 / LIMIT_UNEXPECTED_FILE 400 / LIMIT_FIELD_COUNT 400 / LIMIT_FIELD_KEY 400 / LIMIT_FIELD_VALUE 400 / LIMIT_PART_COUNT 413
  - **JsonWebTokenError 3 类型** (JWT 鉴权, 铁律 10 配套): TokenExpiredError / NotBeforeError / JsonWebTokenError
  - **MysqlError 14 错误码** (数据库): 1040 TOO_MANY_CONNECTIONS 503 / 1042 BAD_HOST 500 / 1045 ACCESS_DENIED 500 / 1062 DUPLICATE_ENTRY 409 / 1129 HOST_BLOCKED 403 / 1158-1161/2002-2003/2006/2013 网络错 502 / 1205 LOCK_WAIT_TIMEOUT 503 / 1213 DEADLOCK 503

- **5 维度必填 options** (mysql2 池配置, BUG-151 实战):
  - `timezone: 'Z'` 跨时区 (UTC)
  - `dateStrings: false` DATETIME/TIMESTAMP 返 Date 对象
  - `decimalNumbers: true` DECIMAL 类型返 number (修前 0.1+0.2 字符串拼接出错)
  - `maxIdle: 10` 资源回收 (修前 25 个连接长期 idle)
  - `idleTimeout: 60000` 60s 自动 release

- **winston logger 7 维度** (S73 BUG-155 实战):
  - production 配 Console silent: true (CI 无 TTY 不刷日志)
  - rejectionHandlers + exceptionHandlers (unhandledRejection/uncaughtException 接住不神秘挂)
  - exitOnError: false
  - defaultMeta { service, env }
  - level info

- **express-rate-limit v7 7 维度** (S73 BUG-154 实战):
  - keyGenerator (`u:userId` / `ip:${ipKeyGenerator(req.ip)}` 修 IPv6 实战)
  - standardHeaders 'draft-7' (v7 spec)
  - legacyHeaders false (deprecate X-RateLimit-*)
  - skipFailedRequests true
  - requestWasSuccessful `(req, res) => res.statusCode < 400`
  - handler 返 429 RATE_LIMIT_EXCEEDED
  - validate { trustProxy: true, xForwardedForHeader: true }

- **helmet 5 维度** (S73 BUG-156 实战):
  - crossOriginResourcePolicy 'cross-origin' (shipin-app `<img>` 跨域不挡)
  - crossOriginEmbedderPolicy false
  - crossOriginOpenerPolicy 'same-origin-allow-popups'
  - contentSecurityPolicy (default-src self / img-src self+https+data / script-src self+unsafe-inline / style-src self+unsafe-inline / font-src self+https+data / connect-src self+https)
  - helmet 必 before cors

- **morgan 5 维度** (S73 BUG-157 实战):
  - stream { write: msg => logger.info(msg.trim()) } 接 winston (跟铁律 8 日志聚合一)
  - skip /health /api/version (高频 ping 淹没日志)
  - morgan.token('real-ip') 接 X-Real-IP (nginx 反代 1:1)
  - 'combined' format
  - immediate: false 默认

- **跨项目通用铁律沉淀** (跟 BUG-148-152 1:1 镜像):
  - 修一个 SDK error 必 grep 所有 SDK error 在 errorHandler catch (跨项目通用 #6)
  - middleware catch 块必先 classify 错误类型再决定 HTTP statusCode (跟 BUG-079 假报告 100% 同源)
  - fileFilter 必用 `cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', fieldname))` 7 子类 1:1 映射

### 铁律 12: 🌐 mobile 端任何 hardcode IP 必跟 server IP 同步 + 用域名反代不用 hardcode (S73 BUG-147/159, 2026-07-02, 跨项目通用)

> **背景**: S73 v3.0.78 BUG-147 server 端换公网 IP 159.75.16.110 → 119.91.155.46 (腾讯云 EIP, DeepSeek 风控 ban 老 IP), 配套走了 web + server + 远端 .env + 远端 systemd unit, **但漏改 mobile 端 hardcode IP** (`apps/mobile/src/config.ts:2 DEV_SERVER_IP` + `apps/mobile/src/screens/TaskProgressScreen.tsx:71` WS fallback). 后果: v3.0.74-79 6 个版本所有 mobile APK 装上后连不上 server `/users/login` API → isNetworkError=true → 用户看到登录按钮点击后无响应. S73 v3.0.81 BUG-159 实战回归发现 + 修复闭环.

- **任何 IP 改动必全项目 grep**:
  - 跨项目内 137+ 处 IP 引用, 4 类别分类处理:
    - **运行时** (mobile UploadScreen fallback URL / server .env PAY_NOTIFY_BASE) → ✅ 必改
    - **部署脚本** (deploy_*.py / check_*.py / ssh_*.py / tools/verify-version-8-points.js) → ✅ 必改
    - **规范文档** (CLAUDE.md / AGENTS.md / docs/DEPLOY.md 顶部 IP) → ✅ 必改
    - **历史 BUG 段** (BUGS.md / DEV_PROGRESS.md / 历史 docs) → ⚠️ 保留 + 加 IP 变更注
  - 远端 grep 验证: `ssh root@119.91.155.46 "grep -r '159.75.16.110' /www/server/panel /etc/nginx /etc/systemd /www/wwwroot/shipin-APP/dist 2>&1"`

- **配置文件 hardcode IP 是 anti-pattern**:
  - ❌ 错: `apps/mobile/src/config.ts:2 DEV_SERVER_IP = '119.91.155.46'` 硬同步
  - ✅ 对: 用 `ab.maque.uno` 域名 + nginx 反代 (跟 web 端 1:1 镜像), DNS 自动解析到新 IP
  - 真实案例: BUG-147 BUG-159 修法 1 server .env `PAY_NOTIFY_BASE = 'https://ab.maque.uno'` 替代硬 IP

- **APK 真实打包的 IP 必测** (不是只看 /api/version):
  - E2E install + tap login + 验 network OK (BlueStacks adb install + am start + login E2E)
  - mobile 端 APK 真实打包的 IP 跟 server 端必一致, 必真机回归
  - 不只看 `/api/version` 返回 (那个走的是 hostname, 不一定暴露 hardcode IP)

- **跨项目通用铁律沉淀** (跟 BUG-147/159 100% 同源):
  - 改任何 hardcode IP 必走 changelog.json latest_version 单一字段 (跟 BUG-145 配套, JSON 解析 last-wins)
  - mobile 端 APK 真机回归必跑 (BlueStacks adb install + am start + login E2E), 不能只看 /api/version 返回
  - 腾讯云/阿里云 VM 公网 IP 必走 EIP 弹性方案 (遇风控随时换 IP)

### 铁律 13: 🔍 **跨端 GAP 盘点方向必 web 端当基准** (S75 v1.0, 2026-07-03, 跨项目通用铁律, 跟 S72 batch 7 规范反转 + 铁律 4++ 配套)

> **背景**: S74 O 任务盘点方向反了, 把 "web 端补 mobile 端已有功能" 当 P0, 实际应该是 "mobile 端跟 web 端已有功能" (S72 batch 7 规范反转 2026-06-26 user 明确: Web 主导, APP 跟随). 2026-07-03 user 再次纠正, S75 v1.0 重做盘点方向.

- **跨端铁律 4++ 决定盘点方向**:
  - ✅ 对方向: 拿 web 端 27 page 当唯一基准, 看 mobile 端 39 screen 哪些功能没跟 → 必修 GAP
  - ❌ 反方向: 拿 mobile 39 screen 当基准找 web 缺什么 → 违反规范
  - 盘点结论分 3 类: ✅ 无 GAP / 📋 平台差异合理 / ⚠️ 待 grep 确认

- **跨端铁律 4++ 5 步同步 SOP 强制落地**:
  1. 评估 mobile 端漏修清单 (grep diff web vs mobile)
  2. 修 mobile 端代码 (跟 web 1:1)
  3. `npx tsc --noEmit` 0 错
  4. `aapt2 dump badging` 验证 versionName
  5. scp APK 到公网 + bump server 9 项版本号

- **真实案例**: S72 batch 7 后所有 "web 做了 mobile 没做" GAP 全部修完 (BUG-160 v3.0.82 是最后一个). S75 v1.0 实战盘点: ✅ 无必修 GAP, 仅 📋 12 个 mobile 独有 screen 是平台差异合理 (HomeScreen / CreateScreen / PointsOrderScreen / UserAgreementScreen / DownloadPage / PrivacyPolicyScreen 等) + ⚠️ ChatScreen / ScriptListScreen 重复待 grep 确认

- **跨项目通用铁律沉淀** (跟 S72 batch 7 + 铁律 4++ 配套):
  - 跨端 GAP 盘点方向 = web 端当基准, 不是反过来 (S74 v1.0 反方向错的教训)
  - 盘点结论分 3 类, 不要一刀切"全部要修"
  - 修一处必 grep 另一端 (跟 BUG-097/130/135/143/159/160 教训一致)

---

## § 5. Development Progress Tracker (跨端统一工作流)

### 开始工作前 3 步必做

1. **读取 `DEV_PROGRESS.md`**, 了解项目当前进度
2. 查看"AI 会话追踪"表**下一个任务**是什么
3. 如果 `DEV_PROGRESS.md` 不存在或内容异常, 立即向用户报告

### 每个任务工作周期

```
开始工作前:
  ├─ 读根 AGENTS.md (本文件) — 跨端统一规范
  ├─ 读 DEV_PROGRESS.md — 找下一个待办
  ├─ 读对应子 AGENTS.md (apps/mobile/AGENTS.md 或 apps/server/AGENTS.md)
  └─ 读相关源码 (理解上下文)

工作中:
  ├─ 将 DEV_PROGRESS.md 该任务状态改为 [进展中]
  └─ 实施编码 (按子 AGENTS.md 的任务 SOP 跑)

完成后:
  ├─ 验证 (lint / typecheck / **14 维验证 `bash scripts/verify-deploy.sh --strict`** / 6 处版本号自检)
  ├─ **写 .ts/.js/.md/.sql 文件后必跑 `bash tools/check-ps51-newline.sh <files>`** 验证 newline 正常 (S71 BUG-079 教训, 防 PS 5.1 写入损坏)
  ├─ 将 DEV_PROGRESS.md 该任务状态改为 [已验收]
  ├─ DEV_PROGRESS.md 底部 "AI 会话追踪" 表追加一行
  └─ 中文报告用户完成情况 + 指出下一个任务
```

### 状态变更规则

- 不允许跨过 `[待开始] → [进展中] → [待验证] → [已验收]` 的顺序
- 不允许一次性标记多个步骤为已完成 (必须逐个原子步骤完成)
- 如果遇到阻塞项, 标注 `[阻塞]` + 原因, 继续尝试下一个不影响的任务

### 多个 AI 会话的上下文保持

如果当前 AI 无法完成全部任务 (对话轮次超限 / 中断等), 必须:
1. 将当前正在做的任务状态设为 `[进展中]` (不要设为 `[已验收]`)
2. 在"AI 会话追踪"表中追加会话记录, 精确写明**已做到哪一步**和**被什么阻塞**
3. 在退出前明确告知用户下一个 AI 应当从哪个任务继续

---

## § 6. Worker 后端约束 (改 server 代码前必读, 跨端 worker 9 条)

> 任何 AI 助手在执行部署前必须完整阅读 [`docs/DEPLOY.md`](docs/DEPLOY.md) 与 [`docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md`](docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md)。

`docs/notes/DEPLOYMENT_AND_BACKEND_RULES.md` 记录 **9 条实战约束**:
1. 禁止引入新 npm 依赖
2. tsc 增量编译陷阱 (.js 不清, 部署后 6 维验证)
3. shipin-APP 文件结构 (本地 monorepo vs 生产 flat)
4. 禁止新旧版并存 (v3.0.0.13/16 后死代码清理清单)
5. CharacterDescription 11 维 vs CharacterExtraDescription 4 维
6. v3.0.0 状态机 (12 态, 极简模式跳 3 态)
7. 异步任务无锁 (P0 bug, confirm 重复点会扣多次)
8. ASPECT_DIMENSIONS 文字比例兜底
9. 沟通/汇报 (CDN 大文件 + 中文 reply)

部署规范包含:
- **11 个关键节点** (Pre-Deploy 3 + Execute 5 + Post-Deploy 3)
- **完整 Step-by-Step 流程**
- **宝塔面板操作清单** (用户在宝塔里能做什么)
- **5 分钟回滚预案**
- **常见问题排查** (6 个典型 BUG 及解法)
- **AI 助手必须遵守的 8 条规则**
- **部署后 6 维验证清单** (进程 / 端口 / /health / /api/version / 鉴权 / 日志)

**部署前必须遵守的红线** (跨端统一, 任何端部署都适用):
1. **必须先报告用户**, 等授权
2. **必须先备份** (server 部署: dist + package.json + tsconfig.json + .env + DB; mobile/web 部署: 对应资源)
3. **不覆盖** .env / .env.production / uploads / exports / logs / 历史 APK / 历史 dist
4. **PM2 必须用 `delete + start`**, 不用 `restart` (铁律 4)
5. **部署后 5/6 维验证全通过** 才算完成 (铁律 5)
6. **本地 SSH key 用完立即 `mavis-trash` 删** (除永久 key `~/.ssh/id_ed25519`)
7. **部署后必须更新 `DEV_PROGRESS.md` AI 会话追踪表** (§ 5)
8. **活跃任务场景** 必跑 `apps/server/deploy.sh` 维护模式流程 (S67 BUG-070)

---

## § 7. 代码规范与功能安全原则 (跨端统一)

所有代码修改必须遵循以下原则:

1. **不破坏现有功能**: 除非是经过明确确认的大规模重构任务, 否则所有代码变更必须确保不影响其他功能代码模块
2. **最小侵入原则**: 优先采用对现有代码影响最小的修改方式, 避免改动无关代码
3. **回归验证**: 每次修改后, 必须运行相关测试或验证手段, 确保已开发完毕的功能不受影响
4. **模块隔离**: 新增功能应尽量以独立模块形式添加, 减少对已有模块的耦合和侵入

违反上述原则的代码变更将被拒绝合并。

---

## § 8. 禁止新旧版并存 (跨端统一强制清理规则)

**规则**: 任何模块、组件、字段、API 端点、状态变量、数据结构在迭代时, **必须立即清理旧版实现**, 不得新旧版并存于同一文件/同一接口/同一页面。

### 必须遵守的清理动作

1. **替换式升级**: 升级某模块时, 必须**一次性移除**旧版的 state、UI、handler、API 字段。
   - 错误示例: `CharacterDetailPage.tsx` 同时存在新版 37 字段 `description` 编辑 **和** 旧版 `appearanceDraft/personalityDraft/roleTypeDraft` 编辑块, 两个并存导致用户混乱。
   - 正确做法: 新版上线当 PR 内, 删除旧版 state + UI + 保存字段, 保留迁移代码 (从旧版字段一次性迁移到新版的脚本)。
2. **明确标注**: 如果必须保留旧版代码作过渡 (如 1 周迁移期), 必须在文件顶部注释 `// LEGACY: 计划于 v2.x.x 删除` + 列表说明清理计划。
3. **零冗余代码**: 升级后**禁止**保留未引用的 import、变量、函数、UI 块。
4. **数据库字段**: 旧版字段 (如 `appearance/personality/roleType` 在 v2.5 已合并进 `description` JSON) **不应在前端展示**, 也不再写入。如需保留数据, 加 `_deprecated` 后缀或迁移脚本清理。
5. **PR 自检清单**: 每次提交前, 自行搜索 `(旧版|legacy|fallback|deprecated|旧)` 关键字, 评估是否需要清理。

### 触发清理的时机

- 新版功能已上线
- 用户反馈"功能混乱/不知道用哪个"
- 旧版数据已迁移完成
- 同名字段有两个不同的语义

### 违反此规则的处理

任何 AI 助手在升级时若遗留旧版代码, **必须**在 PR 描述中明确列出:
- 旧版代码位置 (file:line)
- 计划清理时间
- 当前未清理的原因 (如数据迁移未完成)

否则视为违规, 不予通过。

### 历史违规清单 (跨端, 持续更新)

- **v2.5.13 修复** (web 端): `CharacterDetailPage.tsx` 删除 v2.5.0 之前遗留的 `appearanceDraft/personalityDraft/roleTypeDraft` 状态 + 基础信息编辑块, 角色信息统一走 37 字段 `description` JSON。
- **v2.5.22 修复** (web 端): 移除 `v2.5.22 CSS 网格合成` 方案, 因为用户明确要求"1 张图包含所有分镜"。回归到 v2.5.21 风格的单图多格方案 + 通过 portrait aspect 优化网格。
- **v3.0.0 修** (server 端): 12 态状态机替换 v2.5 的 4 态, 极简模式跳 3 态, 旧 `task_status` enum 迁移到 `task_jobs.status` 字段。
- **v3.0.30 修** (server 端): `ecosystem.config.js` APP_VERSION 跟实际 6 处同步, S66 BUG-069 (S64 BUG-066 漏修的第 6 处)。

---

## § 9. 子项目 AGENTS.md 入口 (S68 收口设计)

> **设计原则** (S68 BUG-071 配套): 根 AGENTS.md = 跨端统一规范, 子项目 AGENTS.md = 各 app 独有架构/任务 SOP, 互不重复。
> 任何 AI 接到任务, 必先读根 AGENTS.md (§ 3 跨端必读), 再跳到对应子 AGENTS.md.

| 子项目 | 文件 | 必读场景 | 独有内容 |
|---|---|---|---|
| **mobile** (RN 0.73 + Hermes) | [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) | 改 mobile 代码 / 打 APK / 升级 | RN 栈速览 + 升级链路 7 铁律 + 改 mobile 代码前后 5 步 |
| **server** (Node + Express + MySQL) | [`apps/server/AGENTS.md`](apps/server/AGENTS.md) | 改 server 代码 / PM2 部署 / 调试 | 部署前 5 项 (含维护模式) + server 端 8 条铁律 + 5 类常见任务 SOP + 代码架构速览 |
| **web** (React + Vite) | (无独立 AGENTS.md, 跟随 server) | 改 web 代码 / 部署 | web 端无 AI 独立行为, 走 `apps/web/DEPLOY.md` + 跟 server 同步 |

**收口设计理由** (S68):
1. 跨端通用规范 (中文/Persistence/铁律/工作流) 重复 3 份 → 统一放根, 减少维护成本 (改 1 处 3 处同步)
2. 各 app 独有架构 (mobile RN / server PM2 / web Vite) 不能混在一份, 否则跨端 AI 读到无关内容会困惑
3. 子 AGENTS.md 必读第 0 份 = 根 AGENTS.md, 形成"总入口 → 子入口"两层结构 (跟 GitHub Copilot Coding Agent / Codex / Cursor 标准一致)
4. `BUGS.md` 跟 `CODING_STANDARDS.md` 保留在 `apps/mobile/` (跨端共用, 历史起源 mobile), 跟 `apps/mobile/AGENTS.md` 强引用

---

> **本文档为强制执行规范** (跨端统一). 所有 AI 助手在参与 shipin-APP 项目时必须遵守.
> **最后更新**: 2026-07-03 (v2.20, 加 § 4 铁律 10/11/12/13 = S73 BUG-148-152 外部 SDK 12 维度对照 + middleware catch 4 类型 + mobile 端 hardcode IP 必跟 server IP 同步 + 跨端 GAP 盘点方向必 web 端当基准 (S75 v1.0 实战沉淀), 跟 S73 § 5.10 沉淀的 ~30 条新铁律 1:1 镜像, 配套 husky commit-msg hook S75 #1 集成)
> **下次 review**: 跨端规范有结构性变化 / 新增 app 子项目 (比如 iOS) 时
> **本文档为强制执行规范** (跨端统一). 所有 AI 助手在参考 shipin-APP 项目时必须遵守.
> **最后更新**: 2026-06-30 (v2.17, 加 § 4 铁律 10 选型阶段必调研依赖内部路径 + 反思 v3.0.60→v3.0.66→v3.0.67 反复掉坑, 跟 mobile § 6.16 + server § 3.10 同步)
> **下次 review**: 跨端规范有结构性变化 / 新增 app 子项目 (比如 iOS) 时

## § 4 铁律 10 (v3.0.67 BUG-135 新增): 选型阶段必调研依赖内部路径, 反复掉坑反思 (跨端通用, 跟 BUG-079/097/113/118/130/134 100% 同源)

### § 4.10.1 背景 (v3.0.60 → v3.0.66 → v3.0.67 反复掉坑反思)

shipin-APP 3 个近期 BUG 都跟"选错方案"或"漏改"有关, 反映出一个跨项目通用教训:

| BUG | 版本 | 根因 | 类型 |
|---|---|---|---|
| BUG-130 | v3.0.59 | mobile 端 0 个上传入口 (跟 web 漏镜像) | 漏修 |
| BUG-130 hotfix | v3.0.60 | 选了 image-picker v7.x (内部走 GMS photopicker UI) | 选错方案 |
| BUG-134 | v3.0.66 | ImageAgentScreen 白屏 + mobile version.ts 漏同步 | 漏修 + 漏同步 |
| BUG-135 | v3.0.67 | image-picker v7.x GMS 路径在国产 ROM 翻车 | 修法补救 |

**v3.0.67 BUG-135 终于找到正确方向**: 不依赖第三方 picker 库, 自研 native module 走 Android 系统 Intent.ACTION_OPEN_DOCUMENT. 这是真正稳的方案, 因为 Android SDK API 19+ 100% 兼容, 国产 ROM 全支持.

### § 4.10.2 跨项目通用铁律 5 条 (跟 BUG-079/097/113/118/130/134/135 100% 同源)

1. **选型阶段必调研依赖内部路径** (新铁律, BUG-135 核心): 不要只信官方文档说支持哪些设备/平台. 必做:
   - `npm view <pkg> repository.url` 看源码
   - grep 依赖源码看 `Intent.ACTION_*` / `Photopicker` / `GMS` / `ActivityResultContracts.*` 等关键 API 调用
   - 看依赖最近 6 个月 issue tracker 有没有 "X 设备无法使用" 类报告
   - 国产 ROM 兼容性矩阵 (蓝叠/华为/小米/OPPO/vivo/三星) 至少 5 设备测试

2. **API 兼容性 > 不加重原则 优先级升至选型阶段** (强化, BUG-135): 之前 BUG-130 hotfix 选 image-picker 是错的 (虽然 "不加重原则" 是对的). 真正稳的方案是自研 native module, 不是装新依赖. 跨项目通用铁律: 选型阶段必先 grep 看依赖内部走什么路径 (system Intent / GMS / 第三方 SDK), 不只看官方文档.

3. **国产 ROM 兼容性测试必加** (强化, BUG-135): image-picker v7.x 在蓝叠模拟器 / 海外设备 OK 但国产 ROM 翻车 (GMS photopicker 缺失). 测试矩阵必加 [蓝叠/华为/小米/OPPO/vivo/三星] 至少 5 设备.

4. **依赖选错时的回滚方案** (新铁律, 跟 BUG-130/135 同源): 选错依赖不要硬撑, 必立即回滚到上一个稳定版本. shipin-APP BUG-135 修法: 直接删 image-picker 用法, 写自研 native module.

5. **跨端 8 处版本号同步必跑** (强化, BUG-131/134/135 配套): 改 1 处必同步 8 处, 不能漏. BUG-134 漏 mobile version.ts 导致 APP 端显示老版本, 跟 BUG-131 server-only hotfix 漏 rebuild APK 同源.

### § 4.10.3 选型阶段检查清单 (跨项目通用, 必跑 6 项)

- [ ] **官方文档说支持哪些平台? 跟 shipin-APP 实际部署平台匹配吗?**
- [ ] **依赖源码 grep 关键 API 调用** (Android: Intent.ACTION_* / GMS / ActivityResultContracts; iOS: UIImagePicker / PHPicker)
- [ ] **依赖最近 6 个月 issue tracker 有没有 "X 设备无法使用" 类报告?** (GitHub Issues filter `is:issue is:open label:bug`)
- [ ] **国产 ROM 兼容性矩阵** (蓝叠/华为/小米/OPPO/vivo/三星 至少 5 设备测试)
- [ ] **不加重原则 vs API 兼容性冲突时优先级**: API 兼容性 > 不加重 (BUG-135 教训), 但如果自研成本太高, 退而求其次选"用现有依赖 (已经装) 而不是装新依赖"
- [ ] **回滚方案**: 选错了能立即回滚到上一个稳定版本吗? 不能就 PASS

### § 4.10.4 跟其他铁律的关系

- **铁律 4+** (跨端铁律 4 加号, 跨项目通用 UX 原则) + **铁律 4++** (Web 主导, APP 跟随) + **铁律 8** (持久化必 string 归一) — 都跟 BUG-130/135 同源教训: 加了 UI 但漏消费到所有 render path (状态机迁移, 持久化, 上传入口). 选型阶段调研不深入 = 后续所有修法都跟着错.
- **铁律 4++++** (BUG-131 server-only hotfix 必 rebuild APK) + **铁律 6** (commit message 必带 BUG 编号) — 配套 BUG-134/135 8 处版本号同步.

### § 4.10.5 mavis memory 沉淀 (跟 mobile § 6.16.2 + server § 3.10.5 同步)

```
跨项目通用教训 (v3.0.67 BUG-135 沉淀)
1. 选型阶段必调研依赖内部路径 (grep 源码, 不信文档)
2. API 兼容性 > 不加重原则 优先级升至选型阶段
3. 国产 ROM 兼容性测试必加 (蓝叠/华为/小米/OPPO/vivo/三星)
4. 依赖选错立即回滚, 不要硬撑
5. 跨端 8 处版本号同步必跑 (跟 BUG-131/134 同源)
```## § 4 铁律 11 (v3.0.68 BUG-136 新增): 加载状态 UI 必带视觉层级 (阶段 + 进度 + ETA + 上下文), 不能只有 spinner + 文字 (跨项目通用, 跟 BUG-079/100/118/119/120/123 100% 同源)

### § 4.11.1 背景 (用户报告 2026-06-30)

用户在 Android APP 视频助手页面看到生成动画卡片布局散乱: 中间只有一个普通 spinner 蓝色圆圈, "AI 正在渲染视频..." 文字跟 spinner 位置不协调, 进度信息"⏳ 等待资源..."浮在 spinner 旁边像贴上去的标签, 没有视觉层级, 用户觉得"乱七八糟"。

### § 4.11.2 真根因

`StreamingCard` (mobile) + `StreamingCardImage` (mobile) + `StreamingCard` (web) 都是 BUG-119 v3.0.48 早期实现:
- 整个卡片是 `flexDirection: 'row'` + 一堆元素堆叠, 没有视觉层级
- 中间只有一个默认 GeneratingLoader (简单 spinner)
- 排队信息/等待资源是**浮窗**贴旁边, 不是卡片一部分
- 没有进度条/ETA/阶段指示
- 文字 + 图标 + spinner 没有任何颜色/大小区分

跟 BUG-100 (loading 状态 UX 假修) + BUG-079 (假报告) + BUG-119 (retry 没清理) 同源: 加了 UI 但漏消费到所有相关 render (没阶段徽章, 没进度条, 没比例适配).

### § 4.11.3 加载状态 UI 必带 4 要素 (跨项目通用铁律, 跨端铁律 4++ 1:1 镜像)

```
┌────────────────────────────────────────┐
│ [阶段徽章: 翻译中 / 排队中 / AI 创作中]   │ 1. 阶段指示 (必)
├────────────────────────────────────────┤
│      ╭─╮                                │
│     │◉│ ↻  (1.5s 旋转 spinner)        │ 2. 进度感 (必)
│      ╰─╯                                │
├────────────────────────────────────────┤
│   AI 正在渲染视频                       │ 3. 主副标题
│   通常 1-3 分钟, 请稍候...              │
├────────────────────────────────────────┤
│   ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░  30%       │ 4. 进度条 + ETA (必)
├────────────────────────────────────────┤
│   ⏳ 第 3 位 · 预计 45 秒               │ 5. 上下文整合 (必)
└────────────────────────────────────────┘
```

### § 4.11.4 跨项目通用铁律 3 条 (BUG-136 沉淀)

1. **加载状态 UI 必带视觉层级 (阶段 + 进度 + ETA), 不能只有 spinner + 文字** (新铁律): 加载状态是用户最关注的状态 (焦虑 + 不知道等多久), 必给:
   - **阶段指示**: translating / queueing / generating / polishing 4 阶段, 用颜色 + 图标 + 文字区分
   - **进度感**: 进度条 + 百分比 + ETA + 平均时长
   - **上下文**: 比例 / 第 N 位 / 当前资源 / 平均耗时
   跟 BUG-079 假报告 + BUG-100 loading UX 假修 + BUG-118 status badge 漏配 100% 同源

2. **阶段状态变化必用不同颜色区分 (紫/黄/蓝), 不要单一 spinner 颜色** (新铁律): 阶段变了用户能立刻看出 (purple 翻译 → amber 排队 → blue 生成), 单一颜色看不出状态变化. 跟 AGENTS.md § 6.9 跨端铁律 4++ BUG-118 StatusBadge 配色体系 1:1 镜像

3. **跨端 streaming 卡片必 1:1 镜像 (mobile + web), 不能 mobile 一套 web 一套** (强化): mobile Animated.Value 跟 web CSS @keyframes 行为一致 (timing, easing, duration), 用户体验跨端 1:1. 跟 BUG-118 StatusBadge 1:1 + BUG-120 比例卡片 1:1 + BUG-123 排队 1:1 同源

### § 4.11.5 3 阶段配色体系 (跨项目通用, 跟 BUG-118 1:1 镜像)

| 阶段 | 颜色 | 图标 | 含义 |
|---|---|---|---|
| translating | `#a78bfa` 紫色 | Languages | AI 翻译用户输入成模型能理解的提示词 |
| queueing | `#fbbf24` 琥珀黄 | Hourglass | 排队中, 等资源 |
| generating | `#60a5fa` 蓝色 | Film/ImageDown | 实际生成中 |

跟 BUG-118 StatusBadge 配色体系 1:1 (content_policy 红 / rate_limit 橙 / upstream_busy 琥珀 / 任务失效 深红). 不同 BUG 不同阶段, 同一套色板.

### § 4.11.6 跟其他铁律的关系

- **铁律 4+** (跨端铁律 4 加号, 跨项目通用 UX 原则) + **铁律 4++** (Web 主导, APP 跟随) — 跟 BUG-136 1:1 镜像修法完全配套
- **铁律 4++++** (BUG-131 server-only hotfix 必 rebuild APK) — BUG-136 mobile/web 都改了, 8 处版本号同步必须
- **铁律 6** (commit message 必带 BUG 编号) — BUG-136 配套 commit
- **铁律 10** (选型阶段必调研依赖内部路径) — BUG-136 配套反思, 跟 BUG-135 同源

### § 4.11.7 mavis memory 沉淀

```
跨项目通用铁律: 加载状态 UI 必带视觉层级 (阶段 + 进度 + ETA + 上下文) (v3.0.68 BUG-136 沉淀)
1. 加载状态 UI 必带 4 要素: 阶段徽章 + 进度条 + ETA + 上下文整合, 不能只有 spinner + 文字
2. 阶段状态变化必用不同颜色区分 (紫/黄/蓝), 不要单一 spinner 颜色
3. 跨端 streaming 卡片必 1:1 镜像 (mobile + web), 不能 mobile 一套 web 一套
```

### § 4.12 v3.0.79 新增: 5 个内部中间件实战官方文档调用规范 (跨项目通用铁律 #1-#10, S73 BUG-153-157)

#### § 4.12.1 背景 (S73 v3.0.79 实战)
v3.0.79 commit `4515b6a` 跟 BUG-148-152 (DeepSeek/Agnes/JWT/MySQL/Axios 5 个 SDK 调官方文档) **1:1 镜像实战**: 5 个内部中间件 (Multer + Express-Rate-Limit + Winston + Helmet + Morgan) 调用规范严格对齐官方文档. 之前 multer fileFilter `cb(new Error())` 包装成 generic Error 500 / 5 个 SDK error 全部 catch-all 包装成 500 INTERNAL_ERROR / helmet 默认配置 CSP 跟 shipin-app `<img>` 跨域冲突 / morgan 直接 stdout 没进 winston / winston production 走 Console 巨量 ANSI 控制码 / rate-limit 默认 per-IP 多设备共享 IP 互抢额度.

#### § 4.12.2 跨项目通用铁律 (10 条新铁律, 跟 BUG-148-152 1:1 镜像, 跟 `docs/notes/S73_MIDDLEWARE_DEEP_DIVE_V6.md` 同步)

1. **multer 7 子类 1:1 必填 (铁律 #1, 跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码同源)**: 任何 multer express route 必在 errorHandler 显式 catch `MulterError` + 7 子类 switch (LIMIT_FILE_SIZE 413 FILE_TOO_LARGE / LIMIT_FILE_COUNT 413 TOO_MANY_FILES / LIMIT_UNEXPECTED_FILE 400 INVALID_UPLOAD_FIELD / LIMIT_FIELD_COUNT 400 / LIMIT_FIELD_KEY 400 / LIMIT_FIELD_VALUE 400 / LIMIT_PART_COUNT 413). 不允许通用 Error 500 catch-all (用户看不到真错, BUG-079 假报告同源).

2. **stableFilename 必走 djb2 32 hex (铁律 #2, 跟 BUG-143 src URL 100% 同源)**: `Date.now() + Math.random()` 在 multer storage filename / cache-busting / 任何重传场景都不要用. 全项目统一 `stableFilename(originalName, userId, seed)` (utils/hash.ts `djb2Hash32`), 跟 web/mobile src URL djb2 算法 1:1 (跨端铁律 4++).

3. **multer limits 必填 4 维度 (铁律 #3, 跟 BUG-127 rate-limit 同源)**: `fileSize` (单文件) + `files` (单接口上限, 默认 Infinity 是坑) + `fieldSize` (单 field 字符串, 默认 1MB 也太小) + `parts` (multipart part 总数, 默认 Infinity 是 DoS 隐患). 4 维度必显式写, 不依赖默认.

4. **originalname utf8 修 multer latin1 错 (铁律 #4, 跟 BUG-105 mobile sync description 错 1:1)**: multer 1.4.5-lts.1 默认 latin1 解码 multipart filename, 中文文件名 Windows 客户端 latin1 提交后 server 拿到乱码. 必套 `Buffer.from(req.file.originalname, 'latin1').toString('utf8')`.

5. **express-rate-limit v7 实战 7 维度必填 (铁律 #5, 跟 BUG-127 + BUG-150 + BUG-151 1:1 镜像)**: `keyGenerator` (per-user from JWT) + `standardHeaders: 'draft-7'` + `legacyHeaders: false` (v7 deprecate X-RateLimit-*) + `skipFailedRequests` + `requestWasSuccessful` + `handler` (返 429 RATE_LIMIT_EXCEEDED) + `validate: { trustProxy: true, xForwardedForHeader: true }` 7 维度必填, 跟 shipin-app `app.set('trust proxy', 1)` 1:1.

6. **winston production 7 维度实战 (铁律 #6, 跟 BUG-082 catch 漏归一 + BUG-079 假报告 1:1 镜像)**: production Console `silent: true` (systemd 没 TTY 不刷 ANSI 控制码) + `rejectionHandlers` (接 unhandledRejection) + `exceptionHandlers` (接 uncaughtException) + `exitOnError: false` (production 让 systemd 重启而不是进程 crash) + `defaultMeta: { service, env }` + logrotate (winston-daily-rotate-file) + level production `'info'` development `'debug'`.

7. **helmet v7 实战 5 维度 (铁律 #7, 跟 BUG-079 假报告 1:1 镜像 - 不要默认配置就上生产)**: `crossOriginResourcePolicy: 'cross-origin'` (shipin-app `<img>` 跨域不挡) + `crossOriginEmbedderPolicy: false` (跟 `<img>` 跨域兼容) + `crossOriginOpenerPolicy: 'same-origin-allow-popups'` (OAuth / 支付回调) + `contentSecurityPolicy` 自定义 (shipin-app 有 inline style 兼容) + helmet before cors (顺序敏感).

8. **morgan 实战 5 维度 (铁律 #8, 跟 BUG-155 winston 同源 + BUG-082 1:1)**: `stream` 进 winston logger (不要直接 stdout) + `skip` /health /api/version (避免高频 ping 淹没日志) + `real-ip` token (X-Real-IP, 跟 nginx 反代 1:1) + format `'combined'` (Apache 经典排查攻击必备) + `immediate: false` 默认.

9. **errorHandler 跨 SDK catch 1:1 镜像 (铁律 #9, 跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码 / BUG-153 multer 7 子类 1:1 镜像)**: 修一个 SDK 必 `grep` 所有 SDK 错误 class (MulterError / TokenExpiredError+NotBeforeError+JsonWebTokenError / MysqlError / DeepseekError / AgnesTextError / RateLimitError) 看 errorHandler 是否 catch, catch 后必 1:1 映射到 HTTP statusCode + business code, 不允许 catch-all 包成 500 (跟 BUG-082 漏归一 100% 同源).

10. **修一个 SDK 必 grep 所有 SDK error → errorHandler catch (跨项目通用铁律 #6, v3.0.79 BUG-153-157 核心修法)**: 之前 BUG-150/151 已经分别修了 JWT 5 子类 / mysql 14 错误码 但 errorHandler 同期没 catch, 实战必先 grep `grep -r 'class.*Error' apps/server/src/services/` 列出所有 SDK error class 然后在 errorHandler 一一 catch. 跨项目通用: 不只是 server, 任何 SDK 接入都必走这一套 (CLI / 客户端 SDK / 第三方 service).

#### § 4.12.3 跟其他铁律的关系

- **铁律 4++++ (BUG-131)**: server-only hotfix 必 rebuild APK. v3.0.79 = server-only 改 10 files, 不重打 APK (跟 BUG-131 模式一致).
- **铁律 5 (12 维验证)**: v3.0.79 部署 12 维全过, 见 `docs/notes/S73_MIDDLEWARE_DEEP_DIVE_V6.md` § 9 部署 SOP.
- **铁律 6 (commit message 必带 BUG 编号)**: BUG-153-157 commit `4515b6a` 必带.
- **铁律 7 (禁 PS5.1 + Out-File 写文件)**: 跟 BUG-158 changelog 1:1 同源, PS5.1 写 JSON 破坏数组分隔符.

#### § 4.12.4 mavis memory 沉淀

```
跨项目通用铁律 (v3.0.79 S73 BUG-153-157 沉淀)
1. multer 7 子类 1:1 必填 (跟 BUG-150 JWT 5 子类 / BUG-151 mysql 14 错误码同源)
2. stableFilename 必走 djb2 32 hex (跟 BUG-143 src URL 100% 同源)
3. multer limits 必填 4 维度 (fileSize + files + fieldSize + parts)
4. originalname utf8 修 multer latin1 错 (Buffer.from latin1 -> utf8)
5. express-rate-limit v7 实战 7 维度必填 (keyGen + standard + legacy + skip + success + handler + validate)
6. winston production 7 维度实战 (silent console + rejectionHandlers + exceptionHandlers + exitOnError:false + defaultMeta + logrotate + level)
7. helmet v7 实战 5 维度 (crossOriginResourcePolicy + crossOriginEmbedderPolicy + crossOriginOpenerPolicy + contentSecurityPolicy + helmet before cors)
8. morgan 实战 5 维度 (stream -> winston + skip + real-ip token + combined + immediate)
9. errorHandler 跨 SDK catch 1:1 镜像 (MulterError / JWT 3 类型 / MysqlError / DeepseekError / AgnesTextError / RateLimitError)
10. 修一个 SDK -> grep 所有 SDK error -> errorHandler catch (跨项目通用铁律 #6)
```

### § 4.13 v3.0.80 新增: 写 JSON 必 byte-level JSON.parse 验证 + script fix SOP (S73 BUG-158, 跟 BUG-066/089/114/129/145 1:1 同源)

#### § 4.13.1 背景 (S73 v3.0.80 BUG-158 实战)
shipin-APP 历史 `apps/server/changelog.json` 用 PowerShell 5.1 Out-File / Write 工具写入时, 把每个 highlights 数组元素的 close-quote (`"`) 写成 ASCII `22` + CRLF `0d 0a` 序列, 但**漏掉 array separator `,`**, 导致整个 highlights 数组在第一个元素 close 后立刻接下一个 indent + open-quote, JSON 解析失败. server `src/shared/changelog.ts:55-68` catch JSON parse 错误后 fallback DEFAULT_ENTRY (`{ summary: '本次更新优化性能, 修复已知问题', highlights: [], version: '0.0.0' }`), 用户访问 /api/version 看到的 changelog 跟实际发布完全无关 (跟 BUG-066 硬编码脉络 + BUG-089 假报告 + BUG-079 假报告 100% 同源). 自 v3.0.78 commit `1dc60785` (2026-07-02 16:56:56 +0800) 起所有 highlights 数组都 parse 失败, 所有历史 changelog 数据都是 fallback 给用户.

#### § 4.13.2 跨项目通用铁律 (4 条新铁律, 跟 BUG-066/089/114/129/145 1:1 镜像)

1. **写 JSON 文件必 byte-level JSON.parse 验证 (铁律 #1, 跟 BUG-114 deploy SOP 漏 changelog 同源)**: 不要假设写入工具合规 (PS5.1 Out-File + Write tool + VCS CRLF normalizer + 4 链路都可能污染). 写完必 `node -e "JSON.parse(fs.readFileSync('file.json','utf8'))"` 验证, 失败立刻 Buffer 字节级修复.

2. **Source-of-truth JSON 顶层字段 append 不复制 (铁律 #2, 跟 BUG-145 latest_version + BUG-129 latest_version 漏改孪生)**: changelog.json 顶层 `latest_version` 字段反映历史发布, 不能 copy 多份 (JSON last-wins 行为, 多份拿老的). 只保留单一份.

3. **Node 24 JSON.parse 严格 RFC 8259: CRLF 是合法 whitespace, 但缺 array separator `,` 是错 (铁律 #3)**: 跟 BUG-114 (deploy 链路错) 同源但根因不同 (写入错). 任何一个 PS5.1 + Write 工具写 JSON 时必临验证 parse.

4. **server 模块 catch 后 fallback = 静默丢失业务关键数据, console.warn 是兜底不是报警 (铁律 #4, 跟 BUG-079 假报告 100% 同源)**: 必 throw 上抛或 health-check fail-fast. shipin-APP 的 `src/shared/changelog.ts` 必 throw + health check 加 `/api/changelog-health` 端点报 parse 失败.

#### § 4.13.3 修法 Buffer 级精确修复 (apps/server/scripts/fix-changelog.js 74 行)

byte 序列 `0x22 0x0D 0x0A [whitespace indent] 0x22` (close-quote + CRLF + indent + next-element open-quote) 检测匹配, safety 检查 previous non-whitespace byte 不能是 `,` / `{` / `[` (防 double-comma), 然后在 LF 后注入 `,` 1 个 byte (0x2C), CRLF + indent + next-open-quote 全部保持不变. 修后验证 `entries=44 latest=3.0.79`.

#### § 4.13.4 跟其他铁律的关系

- **铁律 7 (禁 PS5.1 + Out-File 写文件)**: BUG-158 是 PS5.1 写入破坏 JSON 数组分隔符的直接证据. 铁律 7 升级: 写 JSON 文件必 byte-level JSON.parse 验证 (跟修法同源).
- **铁律 8 (JSON 必 string 归一)**: 跟 BUG-082 catch 漏归一 1:1 镜像, 写 JSON 时手动控制字符串转义.
- **mavis memory 沉淀 (跟 BUG-158):** 跟 § 4.13.5 同步.

#### § 4.13.5 mavis memory 沉淀

```
跨项目通用铁律 (v3.0.80 S73 BUG-158 沉淀)
1. 写 JSON 文件必 byte-level JSON.parse 验证 (不要假设 PS5.1 + Write tool 合法)
2. Source-of-truth JSON 顶层字段 append 不复制 (latest_version 跟 entries[0].version 1:1)
3. Node 24 RFC 8259: CRLF whitespace OK 但缺 array separator ',' 是错 (shipin-APP 跟普通 RFC 1:1)
4. server 模块 catch 后 fallback = 静默丢失业务关键数据 (必 throw + health-check fail-fast)
5. apps/server/scripts/fix-changelog.js SOP: Buffer 字节级精确修复 (byte 序列 0x22 0x0D 0x0A [indent] 0x22 -> 在 LF 后注入 ',')
```
### § 4.14 v3.0.88-91 实战: 强制升级铁律 + 9 处版本号同步 + iOS 应急修 + 跨端 deck 部署踩坑 (S77-S78 BUG-164-168, 跨端铁律 4+++++++ + 跨项目通用铁律 #19-22)

#### § 4.14.1 5 个连续实战盲点收口

S77-S78 期间 (2026-07-06) 集中实战 5 个 BUG (BUG-164/165/166/167/168), 都是同一个根因系列: 跨端 9 处版本号一致性 + 跨端导入 sync + 修死模块前的引用审计 + web-only hotfix 顶层 latest_version 边界 + iOS 启动 crash 实战盲点.

**BUG-164 (v3.0.87) mobile Tab 我的 改用 ProfileScreen** (跨端铁律 4++ 漏修, 跟 BUG-097 mobile 漏修 web 同源, 跟 BUG-079 假能力 100% 同源): Tab navigator 我的 老菜单 (HomeScreen) ≠ Profile Stack.Screen (ProfileScreen 新菜单), 用户从 Tab 进入永远看不到 5 项新菜单. 修法: Tab component=HomeScreen 改成 ProfileScreen + mavis-trash HomeScreen.tsx 693 行 (跟 AGENTS.md § 4.14 死代码审计配套).

**BUG-165 (v3.0.88) 强制升级铁律 + 启动必查 + 不一致不允许进入主界面** (user 2026-07-06 商业硬指标, 跟 BUG-087 24h 抑制/BUG-131 forceUpdate 软升级 100% 同源): App.tsx 4 状态机 (checking/network-error/update-required/ok) + updater.tsx 整文件重写 + .env+systemd Environment 1:1 验证配套 deploy.sh.

**BUG-166 (v3.0.89) dismissable=true 强制升级 modal 逃逸漏洞** (跟 BUG-165 强配套, shipin-APP Dialog.tsx dismissable 默认值是实战盲点): 整文件重写 updater.tsx + ForceUpdateModal 组件, 改 module-level state + 自渲染 RN Modal visible=true transparent=false 整屏覆盖 + 公网下架 v3.0.6x-v3.0.87 老 APK.

**BUG-167 (v3.0.90) web AgentChatPanel 视频点击播放 Date.now() 实战盲点** (web-only hotfix, 跟 BUG-143 v3.0.74 mobile buildImageUrl Date.now() 100% 同源): key=stableVideoKey=part.url + djb2HexFilename + 走 /api/download query token 鉴权 + 顶层 latest_version 保持 3.0.89 (跟 server APP_VERSION 1:1).

**BUG-168 (v3.0.91) iOS 启动 crash Requiring unknown module undefined** (本次实战, v3.0.89 BUG-166 修法实战盲点): updater.tsx exitApp() iOS 分支 require react-native-exit-app silent fail + useDialog 兜底调已被删模块 → 改 RN 内置 Alert.alert (零加重, 跟 Dialog.tsx:64 Alert 兜底 1:1 镜像).

#### § 4.14.2 6 条跨项目通用铁律新沉淀

**(跨项目通用铁律 #19) 删模块前必全局 grep 引用零命中再删**: useDialog 死在 v3.0.89 updater.tsx 调用方 catch 兜底路径, v3.0.88 删模块没扫到调用方的兜底路径. 修法: 删模块前必 grep -rn useDialog <src> 0 命中再删.

**(跨项目通用铁律 #20) caller 必 try/catch 兜底 require 静默 fail**: shipin-APP 项目没装 react-native-exit-app → require 抛错 → 兜底 useDialog 调用又错 → silent fail. 修法: 不依赖第三方 react-native-exit-app, 用 RN 内置 Alert.alert + shipin-APP 项目没装的包必先 grep package.json deps/devDeps/yarn.lock 三步确认再 require.

**(跨项目通用铁律 #21) 死模块 cleanup 前必扫三方依赖是否装**: cleanup 时必查 call site + call site 引用清单 + package.json deps + package.json devDeps + yarn.lock 5 维, 缺一就 BUG-168 翻车.

**(跨项目通用铁律 #22) 跨端 dialog 选型必 1:1 镜像** (跨端铁律 4++ 1:1): web 端用 React Portal + CSS transform, mobile 端用 RN Modal + Animated API (BUG-145 v3.0.76+ 修法的跨端铁律 4++). 实战: diff <(grep -rn Dialog apps/web/src) <(grep -rn Dialog apps/mobile/src) 必 0 差异 (除各自 API 名称).

**(跨项目通用铁律 #23) 顶层 latest_version 跟 _web_only_versions 边界** (跟 BUG-131 server-only hotfix 漏重建 APK + BUG-165 启动必查 1:1 100% 同源): web-only hotfix 必须顶层 latest_version 保持旧版 (跟 server APP_VERSION 1:1), 防 mobile 启动查 latestVersion → 访问公网不存在 .apk → 404. 实战: v3.0.90 web-only hotfix 顶层 latest_version 保持 3.0.89, 顶层 _web_only_versions 数组标注 + 配套 spec 字段说明.

**(跨项目通用铁律 #24) deploy tarball 必扁平** (跟 BUG-159 部署路径 100% 同源): cd apps/server/dist 然后 tar -czf output.tar.gz * (-C) 强制扁平顶层为文件, 不要 tar -czf output.tar.gz dist/ 让 dist/ 子目录嵌套 dist/dist/. 实战踩坑: v3.0.91 第一次 deploy 撞 systemd restart failed, 解压嵌套 dist/dist/ 让 systemd ExecStart 找不到.

#### § 4.14.3 3 个部署实战踩坑

**(踩坑 1) deploy tarball 顶层 dist/ 子目录 → 解压嵌套 dist/dist/**: 修前 tar -czf output.tar.gz dist → tar 包顶层有 dist/, deploy.sh tar xzf /tmp/dist.tar.gz -C /www/wwwroot/shipin-APP/dist → 解压成 dist/dist/index.js 而不是 dist/index.js. systemd ExecStart 找不到 → status=1/FAILURE. 修法: 扁平打包 tar -czf output.tar.gz -C apps/server/dist . (顶层是 ./index.js).

**(踩坑 2) changelog.json JSON parse 失败**: line 23-24 多余 { { (上轮 session 崩前 v3.0.91 entry 写到一半). 修法: Edit 删多余 {, 验证 python -c "import json; json.load(open(changelog.json))" 0 错.

**(踩坑 3) systemd restart 撞顶 failed unit**: pkill 后 shipin-app restart counter 撞 5, 触发 Start request repeated too quickly. 修法: ssh 手 systemctl reset-failed shipin-app + systemctl start shipin-app.

#### § 4.14.4 AGENTS.md § 4 各段铁律交叉索引

- § 4.10 (v3.0.60-67 选型教训) — 跨项目通用铁律 #11 (选型决策表)
- § 4.11 (v3.0.43 GeneratingLoader 跨端 1:1) — 跨端铁律 4++ + 跨项目通用铁律 7
- § 4.12 (v3.0.79 中间件官方文档对齐) — 跨项目通用铁律 #1-#5
- § 4.13 (v3.0.80 changelog JSON 字节级验证) — 跨项目通用铁律 #7-#10
- § 4.14 (v3.0.88-91 强制升级 + 跨端一致性) — 跨项目通用铁律 #19-#24 (本段)

#### § 4.14.5 mavis memory 沉淀

```
跨项目通用铁律 (v3.0.88-91 S77-S78 BUG-164-168 实战)
1. 删模块前必全局 grep 引用零命中再删 (cleanup 必审计 call site + package.json + yarn.lock 三步)
2. caller 必 try/catch 兜底 require 静默 fail (shipin-APP RN 端死模块 silent fail 跟 BUG-079 100% 同源)
3. 死模块 cleanup 前 shipin-APP 三方依赖必先扫是否装 (cleanup 时 5 维 audit)
4. 跨端 dialog 选型必 1:1 镜像 (web React Portal + CSS transform 跟 mobile RN Modal + Animated API 1:1)
5. 顶层 latest_version 跟 _web_only_versions 边界 (web-only hotfix 必保顶层 latest_version 跟 server APP_VERSION 1:1)
6. deploy tarball 必扁平 (tar -czf output.tar.gz -C dist . 强制顶层文件, 不要带 dist/ 子目录嵌套)
```

### § 4.15 v3.0.92 实战: mobile UI 必响应式 + APP_NAME 必 GB2312 一级字 + deploy tar 路径必对齐 ExecStart (S80 BUG-170/171/部署踩坑, 跨项目通用铁律 #28-#30)

> **新增 2026-07-06 (S80 v3.0.92)**: 接 S79 v3.0.91 部署加固 + ABCD 全闭环实战后, user 反馈 mobile 端 2 个 UI BUG, 走 user 4 张截图 → AI 8 处版本同步 + 跨端 1:1 镜像 + 12 维验证 → 1.5h 闭环. 累计 30 条跨项目通用铁律 (#28-#30 新增).

#### § 4.15.1 BUG-170 修 mobile 端 ScriptDetailScreen 5 pill 工具栏窄屏文字截断

**根因**: `apps/mobile/src/screens/ScriptDetailScreen.tsx:344-353` v2Toolbar 用 `flexDirection: 'row' + flex: 1` 5 等分 + caption 12px + 4 字中文 (事件图谱) 在 360dp 屏 / 5 = 65dp/pill 撑爆 → Android TextView 截断成 "事件图…". 跨项目 UI 没响应式 = BUG.

**修法 (跨端铁律 4++ 1:1 镜像 web 端 `grid grid-cols-2 md:grid-cols-5`)**:
- v2Toolbar 改 `flexWrap: 'wrap'` + 加 `v2BtnNarrow2` (flexBasis: '48%', 2 列) + `v2BtnWide5` (flexBasis: '18%' + flexGrow: 1, 5 列)
- 加 `isWide` state + `Dimensions.addEventListener('change')` 动态切 (< 600dp 窄屏 2 列, ≥600dp 宽屏 5 列, 跟 web 端 < md:768px / ≥ md 1:1 镜像)
- Text 加 `numberOfLines={1}` + `flexShrink: 1` 兜底防御

**跨项目通用铁律 #28 (新铁律, 跟 BUG-118/120 跨端铁律 4++ 'Mobile UI 必响应式' 100% 同源)**:
- **Mobile UI 必响应式 (不用 flex:1 硬撑, 必 flexWrap grid + Dimensions 动态切)**: 任何 mobile 端横排容器 (toolbar / pill / tabs / list) 必先看屏宽, < 600dp 改 2 列 wrap, ≥ 600dp 改 5 列. 跟 web 端响应式断点 1:1 镜像 (web md: 768px / mobile 600dp)
- **跨端响应式断点必 1:1 镜像**: mobile 600dp 跟 web md:768px 1:1, mobile 480dp 跟 web sm:640px 1:1, mobile 1024dp (平板) 跟 web lg:1024px 1:1
- **4 字中文必加 `numberOfLines={1}` 兜底 (避免 TextView 截断)**: 任何 Text 元素必加 numberOfLines + flexShrink 兜底, 避免窄屏撑爆
- **跨项目 UI 必先 grep web 端响应式断点 1:1 镜像 (修前必先 `grep "grid-cols"` 看 web 端怎么排)**: 修 mobile 端 UI 必先 `grep -rn 'grid-cols\|md:grid\|flex-wrap' apps/web/src` 看 web 端断点, mobile 端 Dimensions.addEventListener 镜像

#### § 4.15.2 BUG-171 修 APP_NAME 含生僻字在国产 ROM 字体兜底成 emoji 乱码

**根因**: `apps/mobile/src/config/version.ts:60` APP_NAME = `'Deep闁告挆鍕嫳'` 含 6 个生僻字 (U+95F7 U+901A U+62D3 U+9315 U+4EB3 U+5A73), **不在 GB2312 一级字库 (2K 常用字)**. 蓝叠/华为/小米/OPPO/vivo ROM 字体不支持 → 兜底成 emoji (🐠) 或豆腐块 → 后续 'v3.0.91' 被截断. 6 处 import APP_DISPLAY_NAME 全部乱码. 推测根因: 之前某次 PowerShell 写入工具 ANSI/UTF-8 编码错 (跟 BUG-131 PowerShell 写 BOM 教训同源).

**修法 (跨端铁律 4++ 1:1 镜像 web 端)**: APP_NAME 还原用户原始意图 `'Deep剧本'` (GB2312 一级字 U+5267 U+672C). 100% 国产 ROM 兼容. web 端 `apps/web/src/config/version.ts:12 APP_NAME = 'Deep剧本'` 已正确 (web 端 BUG-145 v3.0.77 部署时已修过, 这次 mobile 端补做 100% 同源).

**跨项目通用铁律 #29 (新铁律, 跟 BUG-131 + BUG-145 v3.0.76 changelog.json 踩坑 100% 同源)**:
- **APP 品牌字串必用 GB2312 一级字 (2K 常用字), 不用生僻字**: 任何 APP_NAME / brand / 错误文案字符串必先验证字库 (GB2312 一级字 = 2K 常用字 100% ROM 兼容; GB2312 二级 = 4K 次常用字部分国产 ROM 缺失; CJK 扩展区 = 2W+ 生僻字几乎全 ROM 缺失)
- **必先跟 web 端对齐 (避免 1 端修 1 端漏修)**: 改 mobile 端 APP_NAME 必先 `git diff apps/web/src/config/version.ts` 看 web 端是否一致, 必 1:1 同步 (跟 BUG-097 mobile 漏修 web + BUG-130 web 漏修 mobile 100% 同源, 跨端铁律 4++ 加固)
- **改 APP_NAME 必先 `git log --follow` 看历史原始意图 (避免修错方向)**: 修 brand 字符串必先 git log 找用户原本想写什么, 避免修成 ASCII 'DeepScript' 跟用户原始意图 'Deep剧本' 不符
- **任何 PowerShell 写文件后必看 head 3 bytes (避免 ANSI/UTF-8 编码错)**: 跟 BUG-131 教训同源, 改 .ts / .json / .gradle / .tsx 后必跑 `python -c "import sys; print(repr(open(file,'rb').read(3)))"` 验证 head 3 bytes ≠ b'\xef\xbb\xbf' (BOM) 且文件是 UTF-8

#### § 4.15.3 部署踩坑 1 个 (跟 BUG-145 v3.0.76 部署踩坑 100% 同源, 加深 1 步反思)

**踩坑: tar 解压路径不对, 远端 dist/index.js 没更新**: `tar -czf dist-v3.0.X.tar.gz -C dist .` 打包, tar 内 `./index.js` (根级), ssh `cd /www/wwwroot/shipin-APP && tar xzf` 解压到 root (`/www/wwwroot/shipin-APP/index.js`), systemd ExecStart 跑的是 dist/index.js → 读的还是老版本 (sha256 跟本机不匹配). 修法: `cp /www/wwwroot/shipin-APP/index.js /www/wwwroot/shipin-APP/dist/index.js` + `rm /www/wwwroot/shipin-APP/index.js`. **实战教训 (跨项目通用铁律 #30 新增)**: shipin-APP flat 结构部署, tar 包内 `index.js` 路径必跟 systemd ExecStart 路径对齐. 修法: ① 必 `cp tar-extracted/index.js dist/index.js` 兜底 ② deploy.sh 应自动判断 tar 内 index.js 路径决定解压位置, 不要靠 ssh 手动 cd ③ 部署后必 `sha256sum dist/index.js` 跟本机 1:1 验证, 不等 abort (跟 S79 v3.0.91 部署踩坑同源)

**跨项目通用铁律 #30 (新铁律, 跟 BUG-145 v3.0.76 changelog.json 部署踩坑 + S79 v3.0.91 部署踩坑 100% 同源)**:
- **shipin-APP flat 结构部署, tar 包内 index.js 路径必跟 systemd ExecStart 路径对齐**: `tar -czf dist-v3.0.X.tar.gz -C dist .` 打包后, ssh `cd /www/wwwroot/shipin-APP && tar xzf` 解压 index.js 到 root (systemd 跑 dist/index.js 找不到). 修法: 用 `tar xzf -C dist` 解压到 dist/ + 必加 `cp` 兜底双保险
- **deploy.sh 应自动判断 tar 内 index.js 路径决定解压位置, 不要靠 ssh 手动 cd**: deploy.sh 必先 `tar -tzf dist.tar.gz | grep index.js` 看顶层 index.js 还是 dist/index.js, 自动决定解压到 root 还是 dist/
- **部署后必 `sha256sum dist/index.js` 跟本机 1:1 验证, 不等 abort**: 跟 S79 v3.0.91 部署踩坑同源, 部署后必 sha256sum 跟本机 build 1:1 验证, 不一致立即查 tar 路径 (实战 5min 排查 vs 30min 调试)

#### § 4.15.4 v3.0.92 实战 8 处版本号同步清单 (跨端铁律 3, 跟 S79 100% 一致)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.91 | **3.0.92** |
| apps/mobile/android/app/build.gradle versionCode | 92 | **93** |
| apps/mobile/android/app/build.gradle versionName | "3.0.91" | **"3.0.92"** |
| apps/web/src/config/version.ts APP_VERSION | 3.0.91 | **3.0.92** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 92 | **93** |
| apps/server/package.json version | 3.0.91 | **3.0.92** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.91' | **'3.0.92'** |
| apps/server/ecosystem.config.js env.APP_VERSION (2 处) | 3.0.91 | **3.0.92** |
| apps/server/changelog.json 顶层 latest_version | 3.0.91 | **3.0.92** |
| 远端 .env APP_VERSION | 3.0.91 | **3.0.92** (deploy 时 sed) |
| 远端 systemd unit Environment=APP_VERSION | 3.0.91 | **3.0.92** (deploy 时 sed) |
| 公网 APK 文件名 | DeepScript_v3.0.91.apk | **DeepScript_v3.0.92.apk** |

#### § 4.15.5 跨项目通用铁律累计 (S80 收口 30 条, 跟 S73 72 条 + S79 27 条 = 129 条同源索引)

- **跨项目通用铁律 #1-#18 (S73 v3.0.78-82 5 batch 实战)**: 选型决策 / 缓存方案 A+B / 重试边界清理 / 等待动画按比例 / 排队 ETA / 拆企业 key / 限流器 / 视频 poller / retry 终态 / 图像 array / 跨端 1:1 镜像 / ImageWithLoading src 稳定 / 等
- **跨项目通用铁律 #19-#22 (S78 v3.0.88-89 BUG-164-167 实战)**: 删模块前必全局 grep / caller 必 try/catch 兜底 require 静默 fail / 死模块 cleanup 必先扫 shipin-APP 三方依赖 / 跨端 dialog 选型必 1:1 镜像
- **跨项目通用铁律 #23-#27 (S79 v3.0.91 部署踩坑加固)**: 顶层 latest_version 跟 _web_only_versions 边界 / deploy tarball 必扁平 / deploy --strip-components=1 双保险 / systemctl restart 必先 reset-failed / 公网 APK 必唯一
- **跨项目通用铁律 #28 (新, S80 BUG-170)**: Mobile UI 必响应式 (不用 flex:1 硬撑, 必 flexWrap grid + Dimensions 动态切 + 跨端响应式断点 1:1 镜像)
- **跨项目通用铁律 #29 (新, S80 BUG-171)**: APP 品牌字串必用 GB2312 一级字 (不用生僻字 + 必先跟 web 端对齐 + 改 APP_NAME 必先 git log --follow + PowerShell 写文件必看 head 3 bytes)
- **跨项目通用铁律 #30 (新, S80 部署踩坑)**: shipin-APP flat 结构部署, tar 包内 index.js 路径必跟 systemd ExecStart 路径对齐 (deploy.sh 自动判断 + 部署后必 sha256sum 1:1 验证)

#### § 4.15.6 mavis memory 沉淀

```
跨项目通用铁律 (v3.0.92 S80 BUG-170/171 实战)
#28: Mobile UI 必响应式 (不用 flex:1 硬撑, 必 flexWrap grid + Dimensions 动态切)
     实战: 5 pill 工具栏改 grid 2 列 (窄屏 < 600dp) / 5 列 (宽屏 ≥ 600dp), 跨端响应式断点 1:1 镜像 (web md:768px ↔ mobile 600dp)
#29: APP 品牌字串必用 GB2312 一级字 (不用生僻字, 必先跟 web 端对齐, 必先 git log --follow 看历史原始意图)
     实战: 'Deep闁告挆鍕嫳' (6 个生僻字 U+95F7 U+901A U+62D3 U+9315 U+4EB3 U+5A73, 国产 ROM 字体不支持)
     改 'Deep剧本' (2 个 GB2312 一级字 U+5267 U+672C, 100% 国产 ROM 兼容)
#30: shipin-APP flat 结构部署, tar 包内 index.js 路径必跟 systemd ExecStart 路径对齐
     实战: tar -czf dist-v3.0.X.tar.gz -C dist . 打包后, ssh cd /www/wwwroot/shipin-APP && tar xzf 解压到 root (systemd 跑 dist/index.js 找不到)
     修法: 用 tar xzf -C dist 解压到 dist/ + 必加 cp 兜底双保险 + 部署后必 sha256sum 1:1 验证
```

---

### § 4.16 v3.0.96 实战: 强制升级 modal 渲染实战盲点 + 9 维 E2E 闭环 (S80 BUG-172, 跨项目通用铁律 #31 #32, 跟 S78 BUG-165/166 强制升级 + BUG-138 polling owner 100% 同源)

> **实战背景**: S80 v3.0.93-96 强制升级 modal 渲染实战盲点收口, 实战 3 修法 (v3.0.94 absoluteFill + v3.0.95 App.tsx 4 状态机补 ForceUpdateModal + v3.0.96 console.log debug), 9 维 E2E 闭环 (装 v3.0.95 → 弹 modal → tap 升级 → Chrome 下载 → adb install v3.0.96 → 启动 OK → modal 消失 → 进登录页 "Deep剧本 v3.0.96"). 跟 BUG-138 polling owner useState 修法 + BUG-079 假报告 + BUG-165/166 强制升级 100% 同源.

#### § 4.16.1 实战盲点 3 步踩坑链 (v3.0.93/94/95)

**v3.0.93 (失败)**: 蓝叠装 v3.0.92 (老 APK) + server v3.0.93 (latestVersion) → 启动 → logcat 显示 [Updater] checkForUpdate success version=3.0.93 ✅ + [Updater] showForceUpdateDialog state changed visible:true ✅ → **但截图黑屏 + uiautomator dump UI 树空** ❌ (modal 渲染失败).

**v3.0.94 (修法 1, 仍失败)**: 改 pps/mobile/src/utils/updater.tsx ForceUpdateModal 不依赖 RN <Modal> 改用 StyleSheet.absoluteFillObject + zIndex: 9999 + elevation: 9999 普通 View 强制覆盖整屏 (修 RN 0.73 + Hermes + 新架构下 ReactModalHostManager view manager 找不到 generated setter, 跟 BUG-165 实战盲点 100% 同源). 蓝叠装 v3.0.92 → 启动 → logcat success + visible:true ✅ → 仍黑屏 ❌.

**v3.0.95 (修法 2, 成功)**: 关键发现 — pps/mobile/App.tsx line 325-348 update-required 分支**只渲染了 splash 背景, 没渲染 <ForceUpdateModal /> 组件实例**! ForceUpdateModal 是 module-level state 触发的, App.tsx 4 状态机里没把组件实例挂到 render tree → state 变了 = 黑屏 (组件没真渲染). 修法: line 341 加 <ForceUpdateModal />. 蓝叠装 v3.0.95 (新 APK) + server v3.0.95 → 启动 → **截图 335453 bytes (modal 完整渲染成功!)** vs 之前黑屏 17K ✅.

**v3.0.96 (修法 3 debug + 实战收口)**: updater.tsx ForceUpdateModal 加 console.log('[Updater] ForceUpdateModal render', { visible, version }) 测组件是否真渲染 + 备选 useState 替代 module-level state 修法 (跟 BUG-138 polling owner useState 修法 1:1 镜像). 9 维 E2E 闭环实战成功, 关键截图归档 C:\Users\Administrator\AppData\Local\Temp\b172-*.png.

#### § 4.16.2 修法 3 步实战 (跟 BUG-165/166 强制升级 100% 兼容)

**(修法 1 v3.0.94) updater.tsx ForceUpdateModal 改 StyleSheet.absoluteFillObject + zIndex: 9999 替代 RN <Modal>**: 修 RN 0.73 + Hermes + 新架构下 ReactModalHostManager view manager 找不到 generated setter (跟 BUG-165 实战盲点 100% 同源). 改用 absoluteFill + zIndex: 9999 普通 View 强制覆盖整屏 (跟 RN <Modal transparent={false}> 1:1 镜像效果). 跨项目通用铁律: 强制升级 modal 必走 absoluteFill View, 不依赖 RN <Modal> (修 RN 0.73 + 新架构兼容性, 跟 BUG-110/135 教训同源).

**(修法 2 v3.0.95) App.tsx line 341 update-required 分支补 <ForceUpdateModal /> 组件实例**: 关键修法, 4 状态机 (checking/network-error/update-required/ok) 实战盲点 — module-level state (_forceState + _forceSubs 全局变量) 跟 App.tsx 4 状态机组件实例不同步问题, 跟 BUG-138 polling owner 100% 同源. 修法: App.tsx 4 状态机 update-required 分支**必渲染** ForceUpdateModal 组件实例, 组件内部走 useState (跟 BUG-138 pollingOwnerRef useState 修法 1:1) → state 变 = React re-render = modal 渲染. 跨项目通用铁律: 4 状态机组件实例必用 useState 同步, 不用 module-level state (跟 React render 生命周期天然同步).

**(修法 3 v3.0.96) console.log debug + useState 备选**: console.log('[Updater] ForceUpdateModal render', { visible, version }) 测组件是否真渲染 (跟 BUG-113 React Hooks 规则违反 SOP 同源 debug 法), 备选 useState 替代 module-level state 修法 (跟 BUG-138 polling owner useState 修法 1:1 镜像).

#### § 4.16.3 9 维 E2E 闭环验证 (蓝叠 127.0.0.1:5555 真机实测)

| 步骤 | 验证点 | 结果 |
|---|---|---|
| 1 | 装老版 v3.0.95 APK (versionCode 96) | ✅ |
| 2 | 启动 checkForUpdate success | ✅ logcat 200 OK |
| 3 | server latestVersion=3.0.96 > client v3.0.95 | ✅ 触发 modal |
| 4 | ForceUpdateModal 完整渲染 (335KB 截图 vs 黑屏 17K) | ✅ 警告 + 版本 + BUG-172 笔记 + 2 按钮 |
| 5 | tap "立即升级 v3.0.96" (坐标 540, 1612) | ✅ Linking.openURL |
| 6 | Chrome 跳转 ab.maque.uno/app/DeepScript_v3.0.96.apk | ✅ 弹"重新下载文件" |
| 7 | 下载完成 30324752 bytes (DeepScript_v3.0.96.apk) | ✅ /sdcard/Download/ |
| 8 | pm install -r v3.0.96 (versionCode 97) | ✅ Success |
| 9 | 启动 v3.0.96 → modal 消失 → 进登录页 "Deep剧本 v3.0.96" | ✅ |

**关键截图归档 (C:\Users\Administrator\AppData\Local\Temp\b172-*.png)**:
- b172-1 到 b172-6: 17-18K 黑屏 (v3.0.92/94/95/96 装 + server 3.0.95/96, modal 没渲染)
- **b172-7: 335K (v3.0.95 + server v3.0.96 启动, modal 完整渲染成功!)** ✅
- b172-8: 32K (tap "立即升级 v3.0.96" → Chrome 跳转)
- b172-9: 73K (Chrome "重新下载文件? DeepScript_v3.0.96 (1).apk")
- b172-11: 335K (modal 完整内容: 警告 + v3.0.95/96 高亮 + BUG-172 笔记 + 2 按钮)
- **b172-12: 60K (v3.0.96 启动 → 进登录页 "Deep剧本 v3.0.96", modal 消失, E2E 终点)** ✅

#### § 4.16.4 跨项目通用铁律 #31 + #32 新沉淀 (跟 BUG-138/165/166 100% 同源, 累计 13 条)

**(跨项目通用铁律 #31) 修一个 BUG 必跑端到端 E2E, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 UI 树非空 (跟 BUG-079 假报告 + BUG-113 真机回归 SOP 100% 同源)**: 修前 v3.0.93/94 实锤 logcat 显示 success + state changed visible:true (单测指标全 PASS) → 但实际 UI 没渲染 (黑屏 + uiautomator UI 树空). 修后 v3.0.95 必跑完整 E2E: 装老 APK → 启动 → 截图验证 modal 完整渲染 (335KB) + uiautomator dump 解析 UI 树非空 (有 TextView 文本 "版本不一致, 必须升级" 等). 跨项目通用铁律: logcat/console 成功日志不能当 UI 渲染成功标志, 必截图 + UI 树双重验证 (跟 S78 BUG-164 死代码审计 100% 同源, 跟 BUG-079 "假报告" 100% 同源).

**(跨项目通用铁律 #32) 4 状态机组件实例必用 useState 同步, 不用 module-level state (跟 BUG-138 polling owner 实战 1:1 镜像, useState 跟 React render 生命周期天然同步)**: 修前 ForceUpdateModal 走 module-level state (_forceState + _forceSubs 全局变量), App.tsx 4 状态机 update-required 分支渲染 splash 背景 + 不渲染 <ForceUpdateModal /> 组件实例 → state 变了 = 没组件接收 = 黑屏. 修后 App.tsx line 341 补 <ForceUpdateModal /> 组件实例, 组件内部用 useState (跟 BUG-138 pollingOwnerRef useState 修法 1:1) → state 变 = React re-render = modal 渲染. 跨项目通用铁律: 4 状态机 (checking/network-error/update-required/ok) 组件实例必 useState 同步, 不用 module-level state (跟 BUG-138 polling owner 100% 同源, 跟 React render 生命周期天然同步).

#### § 4.16.5 跨端 8 处版本号同步 (跨端铁律 3 必走, 跟 v3.0.92 S80 一致)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.95 | **3.0.96** |
| apps/mobile/android/app/build.gradle versionCode | 96 | **97** |
| apps/mobile/android/app/build.gradle versionName | "3.0.95" | **"3.0.96"** |
| apps/web/src/config/version.ts APP_VERSION | 3.0.95 | **3.0.96** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 96 | **97** |
| apps/server/package.json version | 3.0.95 | **3.0.96** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.95' | **'3.0.96'** |
| apps/server/ecosystem.config.js env.APP_VERSION (2 处) | 3.0.95 | **3.0.96** |
| apps/server/changelog.json 顶层 latest_version | 3.0.95 | **3.0.96** (4 个 BUG-172 entries) |
| 远端 .env APP_VERSION | 3.0.95 | **3.0.96** (deploy 时 sed) |
| 远端 systemd unit Environment=APP_VERSION | 3.0.95 | **3.0.96** (deploy 时 sed) |
| 公网 APK 文件名 | DeepScript_v3.0.95.apk | **DeepScript_v3.0.96.apk** |

#### § 4.16.6 跟 BUG-165/166 强制升级 + BUG-138 polling owner + BUG-079 假报告 100% 同源

- **BUG-165 (v3.0.88) 强制升级铁律** — 启动必查 + 不一致不允许进入主界面, BUG-172 是这个铁律的实战 E2E 闭环验证 (修前 v3.0.93/94 logcat success 但 UI 黑屏, 修后 v3.0.95 完整渲染 + 9 维 E2E 全过)
- **BUG-166 (v3.0.89) dismissable 逃逸漏洞** — BUG-172 修法保留 v3.0.89 的 RN Modal + onRequestClose + 2 按钮 + 强制升级, 没回归
- **BUG-138 (v3.0.70) polling owner useState** — BUG-172 修法 3 用 useState 替代 module-level state, 跟 BUG-138 1:1 镜像
- **BUG-079 假报告** — BUG-172 修法 logcat success ≠ UI 渲染成功, 必截图 + UI 树双重验证, 跟 BUG-079 100% 同源

#### § 4.16.7 mavis memory 沉淀

`
跨项目通用铁律 (v3.0.96 S80 BUG-172 强制升级 modal 渲染实战盲点)
#31: 修一个 BUG 必跑端到端 E2E, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 UI 树非空
     实战: v3.0.93/94 logcat success + visible:true 全 PASS → 但截图黑屏 (17K) + uiautomator UI 树空 = 假报告
     修法: 必跑完整 E2E (装老 → 弹 modal → 截图验证 ≥300KB 完整渲染 + uiautomator dump 解析 UI 树非空)
     跟 BUG-079 假报告 + BUG-113 真机回归 SOP 100% 同源

#32: 4 状态机组件实例必用 useState 同步, 不用 module-level state
     实战: ForceUpdateModal module-level state 触发 → App.tsx 4 状态机 update-required 分支没渲染组件实例 → state 变了 = 黑屏
     修法: App.tsx line 341 补 <ForceUpdateModal /> 组件实例 + 组件内部 useState 替代 module-level state
     跟 BUG-138 polling owner 实战 1:1 镜像, useState 跟 React render 生命周期天然同步

E2E 9 维闭环 (蓝叠 127.0.0.1:5555 真机):
1. 装 v3.0.95 (老) ✅
2. 启动 checkForUpdate success ✅
3. server latestVersion=3.0.96 > 3.0.95 触发 modal ✅
4. modal 完整渲染 335KB 截图 (警告 + v3.0.95/96 + BUG-172 笔记 + 2 按钮) ✅
5. tap "立即升级 v3.0.96" → Linking.openURL ✅
6. Chrome 跳转 ab.maque.uno/app/DeepScript_v3.0.96.apk ✅
7. 下载完成 30324752 bytes (DeepScript_v3.0.96.apk) ✅
8. adb shell pm install -r v3.0.96 (versionCode 97) Success ✅
9. 启动 v3.0.96 → modal 消失 → 进登录页 "Deep剧本 v3.0.96" ✅
`

#### § 4.16.8 关键截图 + commit

- 关键截图: C:\Users\Administrator\AppData\Local\Temp\b172-{7,8,9,11,12}-*.png (S80 BUG-172 实战)
- commit: c73b512 v3.0.96 BUG-172 强制升级 modal 渲染实战盲点收口 (9 文件 73+/22-, 跟 v3.0.92 commit 6c1da98 一脉相承)
- push: 6c1da98..c73b512  main -> origin/main (2026-07-06)
- 配套: HANDOVER § 15 (已写) + BUGS_INDEX BUG-172 行 (已写)
