# AGENTS.md — shipin-APP AI Agent 总入口 (跨端统一)

> **本文件**: shipin-APP 项目的 AI Agent 必读总入口 (跨端统一规范).
> **版本**: v2.9 (2026-06-25 S72 batch 4 收口, 加 铁律 9 🔍 思考链 + 工具调用流必 visible, 跨端 6→9 铁律)
> **配套**: `apps/mobile/AGENTS.md` (mobile 端独有) + `apps/server/AGENTS.md` (server 端独有)
> **子项目 AGENTS.md 必读**: 任何 AI 接到 mobile / server / web 端任务, **必先读根 AGENTS.md**, 然后跳转到对应子 AGENTS.md.

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

### 铁律 3: APP_VERSION 改 1 处必同步 **8 处** (跨端强约束, S66 BUG-069 + S71 BUG-082 P3 教训, v3.0.33 扩)
- **8 处位置** (v3.0.33 扩 6→8: 加 .env + systemd unit):
  1. `apps/mobile/src/config/version.ts` (mobile 单一来源)
  2. `apps/mobile/android/app/build.gradle` (versionCode + versionName)
  3. `apps/server/package.json` (`"version"`)
  4. `apps/server/src/index.ts` (fallback `process.env.APP_VERSION || 'X.Y.Z'`)
  5. `apps/server/ecosystem.config.js` (**2 处**: env + env_production, S66 BUG-069 教训)
  6. `apps/web/src/config/version.ts` (web 单一来源) + `apps/server/changelog.json`
  7. **🆕 `/www/wwwroot/shipin-APP/.env`** (APP_VERSION, S71 BUG-082 P3: process.env 实际生效是 .env)
  8. **🆕 `/etc/systemd/system/shipin-app.service`** (Environment=APP_VERSION, S71 BUG-082 P3: S70 BUG-077 写完未同步)
- 改完必跑 `VERSION_MANAGEMENT.md § 7.2` **8 处** grep 自检 (v3.0.33 扩)
- 详细 8 步发版 SOP → `VERSION_MANAGEMENT.md § 5` (v3.0.33 同步扩 8 处)
- **🆕 S71 BUG-082 P3 教训**: S70 BUG-077 重构 shipin-APP 走 systemd 时, systemd unit 硬编码 `Environment=APP_VERSION=3.0.29` 但 .env 实际生效 (systemd EnvironmentFile 优先级实测), 3 个月后 V3.0.33 升级才修复. **8 处是底线, ecosystem.config.js 2 处 + .env + systemd unit 1 处都是隐藏 P3**

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

### 铁律 5: 部署后必跑 5/6/12/14/20 维验证 (S64 + S67 + S70 + **S71 BUG-079/080/082** 升级)
- **跨端 5 维** (`VERSION_MANAGEMENT.md § 5.8`): /health + /api/version + 公网 APK + 6 处版本号 + commit 完整
- **server 6 维** (`docs/DEPLOY.md § 6`): 进程 + 端口 + /health + /api/version + 鉴权 + 日志
- **🆕 server 12 维** (S70 BUG-077): 6 维自身 + 3 维宝塔/nginx/反代/APK + **3 维宝塔 Node 项目 shipin_APP run=True (核心, BUG-077 验收)**
- **🆕🆕 server 14 维** (S71 BUG-079 修法): 6 维自身 + **3 维 server dist 关键字符串 grep (`/api/billing` + `recordConsumption` + `ALTER TABLE`)** + **3 维 DB schema (4 字段 + 2 索引 + 数据)** + 2 维公开 HTTPS/web JS + **E2E JWT 测 /api/billing/transactions + /api/billing/summary 真实数据**
  - **🛑 不再接受"自报 12 维全过"假报告** (S71 BUG-079 教训: 报告 100% 假, 4 层真相)
- **🆕🆕🆕 server 16 维** (S71 BUG-080 P2 修法): 14 维 + **2 维 web 端 dist 手挑字段静态分析 (`.type === 'consumption'` filter pattern + `/api/billing/transactions?type=consumption` E2E 1152 条)**
- **🆕🆕🆕🆕 server 20 维** (S71 BUG-082 修法): 16 维 + **2 维 BUG-082 防呆 (server dist `extractErrorMessage` 3 文件命中 + web dist `JSON.stringify(part.message)` 防御渲染 1 文件命中)** + 2 维 E2E (DB 层 + API 层都验证 error part.message 是 string 不是 object)
  - 一键脚本: 服务器端 `bash scripts/verify-deploy.sh --strict` (CI 用, 任何 1 失败 exit 1)
  - 配套规范: BUGS.md BUG-079/080/082 + `scripts/verify-deploy.sh` 注释
- **活跃任务场景** (S67 BUG-070, `VERSION_MANAGEMENT.md § 5.A`): 部署前必查 `active-tasks`, > 0 必跑 `apps/server/deploy.sh` 维护模式流程 (9 步: 查→公告→维护→等任务→预检→备份→systemd restart + 宝塔同步→12 维验证→恢复)

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
> **最后更新**: 2026-06-25 (S72 batch 4 收口 v2.9, 加 铁律 9 思考链 + 工具调用流必 visible + 跨端 6→9 铁律 + BUG-083 修法配套)
> **下次 review**: 跨端规范有结构性变化 / 新增 app 子项目 (比如 iOS) 时
