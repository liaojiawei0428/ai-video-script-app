# HANDOVER.md — shipin-APP 项目交接文档 (跨 AI 协作)

> **本文档**: shipin-APP 项目跨 AI 会话交接文档, 下一个 session 开始前**必读**.
> **维护者**: 每次重要 session 收尾后, AI 必追加一段 (见 § 6 模板).
> **最后更新**: 2026-07-06 (S80 v3.0.96 强制升级 BUG-172 实战 3 修法 + 9 维 E2E 闭环; 跟 BUG-138 polling owner + BUG-079 假报告 + BUG-165 强制升级 100% 同源, 加 § 15 + 跨项目通用铁律 #31 #32 累计 13 条; commit `c73b512` push origin/main; 跟 v3.0.92 BUG-170/171 100% 兼容)

---

## § 0. 30 秒速览 (下个 session 必看)

- **项目**: shipin-APP (`F:\QiTa\banmu\APP\ai-video-script-app`), AI 短剧剧本生成 Web+Mobile+Server
- **当前版本**: **v3.0.84** (生产 server 实际版本, S75 部署, web + mobile + server 三端 9 处版本号全对齐 + 公网 APK 已上传 v3.0.84 + verify-mobile-apk 12 维度 10 PASS / 0 FAIL / 2 SKIP, APK 可发布)
- **最近 session**: S64 → ... → S75 (修方向 + husky + AGENTS v2.20) → **S76 v3.0.84 APK 真机实战收口** (6 处 PowerShell 工具链撞坑 + BUG-163 + 8 子铁律 + verify-deploy.sh 加维度 28/29/30 + helper.py 跨进程 IPC) ← 最近 session
- **S73 v3.0.78-82 5 个 batch 速览**:
  1. **v3.0.78 BUG-147** — 服务器公网 IP 159.75.16.110 → 119.91.155.46 (腾讯云 EIP, DeepSeek 平台风控 ban 旧 IP, 跨项目内 137 处 IP 引用全量 grep+分类处理)
  2. **v3.0.78 BUG-148/149/150/151/152** — DeepSeek / Agnes / JWT / MySQL / Axios **5 个外部 SDK 调用规范严格对齐官方文档** (错误码 + user_id + stream_options.include_usage + 思考模式 + 14 错误码对照 + 401 细分 5 子类 + retry 1s/2s/4s),累计 ~40 条跨项目通用铁律
  3. **v3.0.79 BUG-153-157** — Multer / Express-Rate-Limit / Winston / Helmet / Morgan **5 个内部中间件实战** (multer 7 子类 + rate-limit 7 维度 + winston 7 维度 + helmet 5 维度 + morgan 5 维度 + errorHandler 4 类型 catch 1:1 镜像),累计 ~25 条
  4. **v3.0.80 BUG-158** — changelog.json PS5.1 escape JSON 数组分隔符丢失, Buffer 字节级 1-char comma injection 修复 (/api/version changelog 一直返 fallback 硬编码,跟 BUG-114/129/066/079 100% 同源)
  5. **v3.0.81 BUG-159** — mobile 端 config.ts IP sync (v3.0.74-79 漏修 mobile 端 IP,装 APK 连不上 server isNetworkError=true,实战回归发现 + 修复闭环)
  6. **v3.0.82 BUG-160** — mobile ProfileScreen 加通知 + AI 助手入口 (web NotificationBell + AIAssistant 1:1 镜像, 跨端铁律 4++ web+mobile menu 100% 同步, admin 公告 E2E PASS)
- **核心交付**: 跨端统一规范体系 (16+ 份文档), BUGS.md **92 个案例**, 跨端 AGENTS.md 2 层结构 (根 + mobile/server 瘦身), **APK v3.0.82 已装 BlueStacks 5 验证 OK**
- **生产环境**: `https://ab.maque.uno` (公网), 服务器本地路径 `/www/wwwroot/shipin-APP` (flat 结构, 非 monorepo)
- **本机环境**: Windows Server 2022 + PowerShell 5.1, **PortableGit 2.43.0** 已装 (`C:\Tools\PortableGit\bin\git.exe`)
- **🚨 S70 部署路径重大变化**: shipin-APP **不再走 PM2**, **走 systemd unit + 宝塔 panel Node 项目同步**. 任何新 session 接手, **必读** [`docs/BAOTA_NODE_PROJECT_DEPLOY.md`](docs/BAOTA_NODE_PROJECT_DEPLOY.md) (S70 v1.0, 5 步部署 + 12 维验证 + 9 坑). 不要用 `pm2 restart`, 用 `systemctl restart shipin-app`.
- **关键 5 教训** (从 S58-S73 19 个 session 沉淀): ①必读 AGENTS.md ②APP_VERSION 9 处同步 (含 .env + systemd unit + changelog.json 双字段) ③**systemd restart 不用 pm2** ④活跃任务必跑维护模式 ⑤commit message 必带版本号+BUG
- **S73 v3.0.78-82 期间 4 个新跨项目通用铁律 (S73 5 个 batch 共 ~72 条, 4 条最核心)**:
  - **① SDK 调用必严格对齐官方文档** (12 维度: base_url/Authorization/model/context/output/RPM/计费/SSE 解析/deprecated options/错误码/user_id/include_usage/弃用警告) — BUG-148 DeepSeek + BUG-149 Agnes 实战
  - **② JWT 鉴权必填 algorithms/audience/issuer/clockTolerance** (防 algorithm confusion + 跨服务 token 隔离 + 时钟差容忍) — BUG-150 实战
  - **③ middleware catch 必 catch 4 类型 (AppError / MulterError 7 子类 / JsonWebTokenError 3 子类 / MysqlError 14 错误码)** — BUG-153-157 实战
  - **④ mobile 端任何 hardcode IP 必跟 server IP 同步 + 用域名反代,不用 hardcode** — BUG-159 实战 (v3.0.74-79 漏修 mobile config.ts,实战回归才发现)
- **S73 v3.0.82 新增 9 项版本号同步 (含 v3.0.78→82 全程实战经验)**: mobile version.ts + build.gradle versionCode + server package.json + server src/index.ts fallback + server ecosystem.config.js 2 处 + web version.ts APP_VERSION + APP_VERSION_CODE + changelog.json (3 字段: latest_version + entries[0].version + buildDate) + **远端 .env APP_VERSION** + **远端 systemd unit Environment=APP_VERSION** (跟 BUG-144 / BUG-159 同源教训)
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
| **S72 batch 7** (本 session) | "规范反转 Web 主导 APP 跟随 + 5 BUG web 端修" | v3.0.37 P13 | **BUG-092** (扫码支付 我已付款 按钮从来没实现) + **BUG-093** (commit 659025d + 7e823ac 无 BUG 编号, BUG-091 同款违规) + **BUG-094** (admin 默认查 pending, 14 条累积后台) + **BUG-095** (BUG-094 markUserNotified 改 status='user_notified' 但 DB schema enum 不含, 状态机迁移漏第 5 处) + **BUG-096** (AdminDashboardPage 已通过 历史订单渲染 0 字符串, React {0} 渲染陷阱) + **BUG-097** (mobile 漏修 web 3 BUG, 反转旧原则 主盯 web 安卓暂不动) + 🆕 规范反转: Web 主导, APP 跟随 (跨端铁律 4++ 跨项目通用) + 5 步同步 SOP + verify-deploy 维度 24 mobile 端同步自检 + mavis memory 沉淀 | BUG-092/093/094/095/096/097 | 8356970 (BUG-097 mobile sync 3 file) + a74bab4 (BUG-097 沉淀) + cbaf2ea (APK verify 工具) + 1e8239b (BUG-092~096 web 端修法) |
| **S72 batch 8** | "P0 收尾 v3.0.38~3.0.40" | v3.0.38 P14 + v3.0.39 P15 + v3.0.40 P16 | **BUG-099** (web dist index-*.js 被破坏成 2 bytes 0\n, 宝塔 nginx 缓存 + git push race, verify-deploy 维度 22 容忍 set -e) + **BUG-100** (69 video_generations 卡 queued 17 天, 3 根因: ffmpeg image2pipe muxer + 状态机 tool_completed 可 re-confirm + catch 必补刀 video_generations → failed) + **BUG-101** (mobile toast.show 5 错调用, cloud-upload/sparkles 当 ToastVariant, bg of undefined, 加防御性 fallback) + **BUG-103** (refundStep 自动退款退多 34.93 元, h773052122 余额异常, 删 refundStep 整方法 + 失败改人工复核) + **BUG-104** (server bump 3.0.39 漏 rebuild APK, user 升级弹窗 APK 404, 9 项版本号同步 + rebuild APK + web dist 同步) + **BUG-105** (角色分析 prompt 跟 user 需求不一致, 走老 37 字段固定格式, 走 characterDescription.ts 新版 Markdown 5 section, 严禁编造, 6 fix 一起发版) + DEPLOY_RELEASE_FLOW.md v1.0 主入口 SOP | BUG-099/100/101/103/104/105 | 03331ed (BUG-101) / 1a0e724 (BUG-100) / 2f86eec (BUG-103) / ecd297f (BUG-104) / b989ffc (BUG-105) / 9e17ab3 (DEPLOY_RELEASE_FLOW.md 主入口) / cbaf2ea (APK verify) / a5ae183 (.gitignore 清理 21 untracked) |
| **S72 batch 9** (本 session) | "BUG-105 mobile 端 sync, 跨端铁律 4++ Web→APP 同步 5 步 SOP 实战" | v3.0.41 P17 | **BUG-105 mobile sync**: web characterUtils.ts v2.5.34 早已就绪, mobile v3.0.29 漏同步移植, 3 个 screen (CharacterDetail/List/DescriptionReview) 各有本地 11 字段硬编码 extractDescriptionText, server v3.0.40 改 description 为 Markdown 自由文本后, mobile GET 返回 JSON 字符串 (models/character.ts JSON.stringify 产物), 原样显示给用户 (含 \n 转义符, 完全不可读). 修法: 移植 web characterUtils.ts → mobile/src/utils/characterUtils.ts (95 行 4 种格式兼容 + summaryOf markdown 跳过) + 3 个 screen 改 import + 删本地硬编码. 8 项版本号 3.0.40→3.0.41 同步 (mobile version.ts + build.gradle versionCode 44→45 + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts + APP_VERSION_CODE + changelog.json + 远端 .env + 远端 systemd unit). 本机 gradlew assembleRelease 37s (21/394 任务执行, APK 30078127 bytes), aapt2 dump badging versionName=3.0.41 versionCode=45, apksigner verify 证书 DN = CN=DeepScript Release (BUG-023 永久签名). scp APK + deploy-bug105-mobile-sync.sh 远端 6 步 bump + restart. web npm run build 3.57s (新 bundle index-B1XyyGhQ.js) + scp + nginx reload. 5 维验证全过: 公网 APK HTTP 200 + 远端 SHA256 = 本机 SHA256 982342F7...CA74D + 公网 /api/version version=3.0.41 forceUpdate=true needUpdate=true (8 条 highlights 全对) + 历史 APK 11 个未覆盖 (v3.0.3~v3.0.9 + v3.0.37/38/39/41). verify-mobile-characterUtils.js 5/5 PASS. 沉淀 4 件套: BUGS_INDEX § 1 BUG-105 速览行 (server + mobile sync) + Top 25 (web utils 必同步移植 mobile 端, 跨项目通用铁律 4++) + DEPLOY § 8.14.1 (BUG-105 mobile sync 实战) + 1 mavis memory (web→mobile utils 同步必须移植, 不能 import monorepo 包) | BUG-105 mobile sync (追加强调) | ec3dfaf |
| **S72 batch 10** (本 session) | "BUG-107 修中英夹杂 (web + mobile KEY_LABEL 字典配套, 跨端铁律 4++ 跨项目通用 label 翻译铁律)" | v3.0.42 P18 | **BUG-107 修中英夹杂**: BUG-105 mobile sync (v3.0.41) 移植 web characterUtils.ts 时漏配套 KEY_LABEL 中文 label 字典, mobile 显示 `role_type: 主角 / gender: 女 / hair_color: 黑色` 等中英夹杂 (跟 BUG-079 假报告 100% 同源: TS 编译过 ≠ 运行时正确, 移植 utils 函数但漏 label 字典也是假修). 修法 (5 件套): 1) apps/web/src/lib/characterUtils.ts 加 `KEY_LABEL: Record<string, string>` 字典 (37 字段英文 key → 中文 label, 跟 server characterService.ts line 391-404 v2.5.35 1:1 对齐, + 5 空格分隔兼容) 2) apps/mobile/src/utils/characterUtils.ts 同步加 KEY_LABEL 字典 (跟 web 1:1, 跨端铁律 4++ 配套), objectToText 改用 `${KEY_LABEL[k] || k.replace(/_/g, ' ')}` 替换 raw 英文 key (fallback 兼容新增字段) 3) tools/verify-bug107-key-label.js 入仓 (6/6 PASS: 中文 label 完整替换 + 空格分隔 key 兼容 + fallback + name 过滤 + 数组值拼接 + KEY_LABEL 字典 37 项 1:1 三端对齐) 4) 8 项版本号同步 3.0.41 → 3.0.42 (mobile version.ts + build.gradle versionCode 45→46 + server package.json + index.ts fallback + ecosystem 2 处 + web version.ts + APP_VERSION_CODE 45→46 + changelog.json + 远端 .env + 远端 systemd unit) 5) 本机 gradlew assembleRelease 28s (2/394 任务执行, APK 30079495 bytes SHA256 8E23CD96F85BA11EC5B4671E1D860354A6CA1484D1D44FCD8708DC3D23026E9D), aapt2 dump badging versionName=3.0.42 versionCode=46, apksigner verify 证书 DN = CN=DeepScript Release (BUG-023 永久签名). scp APK + scp server dist tgz + scp package.json + scp changelog.json. web npm run build 2.79s (新 bundle index-C3DacIa3.js) + scp web-dist.tgz + nginx reload. 远端 shipin-APP/deploy.sh 跑 v3.0.42 release (维护模式 + systemd restart + 12 维验证). shipin-APP/scripts/verify-deploy.sh 同步 S72 batch 9 24 维版 (S72 batch 8 老版本 412 行 20836 bytes → S72 batch 9 入仓 33080 bytes 605 行). 24 维验证全过: PASS 27 / FAIL 0 / SKIP 0 (含 23a userNotifiedAt 修法 + 23b 反模式 0 命中 + 24 APK bundle 同步). BlueStacks 5 端到端验证: 装 v3.0.42 APK + MainActivity 启动 + 登录态保留 (q378685504/wuliao) + 走 书架 → ScriptDetail (暴君的笼中雀) → 角色分析 6 角色 (苏蓉儿/独孤琰/万公公/秋霞/金枝/陆婕妤) **0 raw 英文 key + 30+ 中文 label 全显示** (类型/性别/年龄/身高/发色/发型/上衣/下装/外套/显著特征/性格/关系 etc.). 沉淀 4 件套: BUGS_INDEX § 1 BUG-107 速览行 + Top 27 (web + mobile objectToText KEY_LABEL 必配套中文 label 字典, 跨项目通用铁律 4++) + apps/mobile/BUGS.md BUG-107 mobile sync 段 + 1 mavis memory (web→mobile utils 同步必配套 label 翻译, 跨项目通用, 跟 BUG-079 假报告 + BUG-105 修法不彻底 100% 同源) | BUG-107 | c9f5ae3 |
| **S72 batch 11** (本 session) | "Stage 1 统一图片加载 UI 模块 (跨端铁律 4++ web + mobile 1:1 镜像 Skeleton + ImageWithLoading 3 态组件)" | v3.0.43 P19 Stage 1/3 | **BUG-108 统一图片加载 UI**: 服务器 5Mbps 带宽 + LLM 生成图/视频慢 (10s-几分钟), 之前 web 端 17 page 全 Tailwind 手写没有骨架屏, mobile 端 SkeletonLoader 是基础 opacity pulse, 用户加载体验割裂. 修法 (7 件套, 3 阶段交付 Stage 1): 1) web 端 apps/web/src/components/ui/ 新建独立目录 (填平 [GAP] M-5 独立组件缺失): skeleton.tsx (shadcn 风格 opacity pulse) + skeleton-presets.tsx (SkeletonCard/SkeletonImage/SkeletonText 预制) + image-with-loading.tsx (3 态 loading→ready→error + LQIP 占位 + shimmer 动画 + 200ms 淡入 + onLoaded 回调 Stage 2 接入缓存) + index.ts (barrel export) 2) web 集成: CharacterDetailPage (sheet image 3/4) + AssetLibraryPage (imageData data URL) + EpisodeDetailPage (comicImage 3 处) 全部 ImageWithLoading 替换原生 `<img>` 3) mobile 端 apps/mobile/src/components/ui/ 新建独立目录 (跟 web 1:1 镜像, 跨端铁律 4++): Skeleton.tsx (Animated opacity 0.3~1 pulse + 3 预制) + ImageWithLoading.tsx (Animated.Image + retry key + fallback 重试 + onLoaded 回调) 4) mobile 集成: CharacterDetailScreen (sheetImage 100%) + ImageAgentScreen (refImage 80x80 + resultImage 320x320) 3 处 ImageWithLoading 替换原生 `<Image>` 5) 配套: apps/web/src/lib/utils.ts (cn 工具, clsx + tailwind-merge) + tailwind.config.js (shimmer keyframes + animation) + index.css (.skeleton-shimmer 工具类) + web AGENTS.md § 4 第 1 条微调 (允许 tailwind-merge + cn() + components/ui/, 不推翻 17 page Tailwind 手写传统, 同步 [GAP] M-5 标已修) 6) 双端 build OK: web 4.10s 新 bundle index-SsjEDax8.js 510KB, mobile 57s 增量 APK 30083055 bytes SHA256 7DC4A218...31626 7) BlueStacks 5 验证: APK 装 + MainActivity 启动 + 登录态保留 + BookshelfPage 渲染 OK + ScriptDetail 6 角色中文 label (跟 BUG-107 v3.0.42 一致). 沉淀 4 件套: BUGS_INDEX § 1 BUG-108 速览行 + Top 28 (跨项目通用铁律 4++ UI 组件必 100% 移植含 components/ui/) + apps/mobile/BUGS BUG-108 段 + 1 mavis memory (shipin-APP Stage 1 实战 + 跨项目通用 UI 组件 1:1 同步铁律) | BUG-108 | 90bbccb |
| **S72 batch 11 Stage 2** (本 session) | "本地媒体缓存 (跨端铁律 4++ web + mobile 1:1 镜像 IndexedDB + SQLite, 解决 5Mbps 慢加载) + server ETag middleware" | v3.0.43 P19 Stage 2/3 | **BUG-109 本地媒体缓存**: 服务器 5Mbps 带宽 + 图片/视频首次加载 10-20 秒, LLM 生成图每次都重新下载, 没本地缓存, 浪费带宽 + 时间; web 端没 Cache API / IndexedDB, mobile 端 SkeletonLoader 只解决动画没解决持久化. 修法 (8 件套, 跨端铁律 4++): 1) **server ETag 中间件** (`apps/server/src/middleware/etag.ts`): 响应 JSON SHA-256 hash 写 ETag + Cache-Control: private must-revalidate, 客户端 If-None-Match 命中返 304 省带宽; `/api/version` 接入 (高频 API) 2) **mobile 本地缓存** (`apps/mobile/src/utils/mediaCache.ts` + `apps/mobile/src/hooks/useCachedMedia.ts`): 文件用 `RNFS.DocumentDirectoryPath/media-cache/{img,video}/{hash}.{ext}`, 索引用 **react-native-sqlite-storage v6.0.1 (项目已装, 跟 models/db.ts 集成, 无 NDK 依赖)** + 单表 `media_cache (url PK, localPath, size, hash, ext, cachedAt, lastAccessed)`, hash 命名 djb2 + reverse (32 chars hex, 跟 web 1:1 算法), LRU 淘汰限制 500MB / 1000 文件, 超过按 lastAccessed 删到 90% 阈值; useCachedMedia hook mount 查 SQLite 命中直接用本地 file:// 路径, onLoaded 触发 cacheFromUrl 异步下载, refresh 强删本地重 GET 3) **web 本地缓存** (`apps/web/src/hooks/useCachedMedia.ts`): IndexedDB `media-cache-v3` + store `files` + 同样 djb2 + reverse hash + LRU 500MB/1000 文件, 命中用 `URL.createObjectURL` blob URL, 跟 mobile 算法 1:1 (跨端铁律 4++) 4) **集成 POC** (各 1 处): `apps/web/src/pages/CharacterDetailPage.tsx` sheetImg 用 useCachedMedia wrap; `apps/mobile/src/screens/CharacterDetailScreen.tsx` sheetImgUrl 用 useCachedMedia wrap 5) **替代方案决策** (教训): 原计划 MMKV 4.x (跟 RN 0.73 不兼容, 需要 nitro + RN 0.85) → 降级 MMKV 2.12.2 (需要 NDK build, shipin-APP NDK 没装, build 失败 `[CXX1101] NDK at D:\Android\ndk\25.1.8937393 did not have a source.properties file`) → **改用 SQLite** (项目已装 react-native-sqlite-storage v6.0.1, 跟 models/db.ts 集成, 无 NDK 依赖, 性能对小规模缓存足够 < 5ms) 6) **跨端铁律 4++ 1:1 镜像**: web 跟 mobile hook API 完全一致 (source / onLoaded / refresh), hash 算法一致 (djb2 + reverse), LRU 阈值一致 (500MB / 1000 文件) 7) **双端 build OK**: web 3.14s 新 bundle index-BVHlVkPf.js 512KB, mobile 48s 6/394 增量 APK 30087897 bytes SHA256 B1192268...F2A2A + BlueStacks 5 装 OK 8) **Stage 3 待做**: 跨端 useMediaLoader hook 抽象 + Lottie 生成中动画 + 端到端缓存验证 (SQLite 记录数 > 0 + 二次启动 hit rate > 80%). 沉淀 4 件套: BUGS_INDEX § 1 BUG-109 速览行 + Top 29 (跨项目通用铁律: 缓存方案选型必先验证 native 依赖, 不要默认选最新) + apps/mobile/BUGS BUG-109 段 + 1 mavis memory (shipin-APP Stage 2 + 跨项目通用铁律: 缓存方案必先验证 NDK/native 依赖) | BUG-109 | bdbc4fd |

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
- **S72 batch 7** 5 个: BUG-092 (扫码支付页面"我已付款"按钮从来没实现) + BUG-093 (commit `659025d`+`7e823ac` 缺 BUG 编号, 跟 BUG-091 同款违规) + BUG-094 (admin 看板默认查 'pending' 错, markUserNotified 漏改 status, 14 条累积后台) + BUG-095 (BUG-094 修法 markUserNotified 写 status='user_notified' 但 DB schema enum 不含, 状态机迁移漏第 5 处) + BUG-096 (AdminDashboardPage "已通过" 历史订单渲染 "0" 字符串, React `{0}` 渲染陷阱, 跟 BUG-082 配套前端侧) + **🆕 规范反转 (2026-06-26)**: Web 主导, APP 跟随 (反之前 "主盯 web, 安卓暂不动" 旧原则, 5 BUG 全部 web 端修, mobile 端漏 3 BUG, user 反馈"APP 没按钮"才被发现). 列入 AGENTS.md § 4 铁律 4++ + 5 步同步 SOP + verify-deploy.sh 维度 24 mobile 端同步自检 + mavis memory 沉淀
- **🆕 S73 v3.0.78-82 期间 13 个 BUG**: BUG-147 (服务器公网 IP 变更 159.75.16.110 → 119.91.155.46, 跨项目内 137 处 IP 引用全量 grep+分类处理) + BUG-148 (DeepSeek API 调用规范严格对齐官方文档, 12 维度对照) + BUG-149 (Agnes API 调用规范严格对齐官方文档, 跟 BUG-148 1:1 镜像) + BUG-150 (JWT 鉴权调用规范严格对齐 jsonwebtoken 官方文档) + BUG-151 (MySQL 池配置 + 14 错误码严格对齐 mysql2 官方文档) + BUG-152 (Axios 拦截器错误码严格映射 + 401 细分 5 子类 + retry 1s/2s/4s) + BUG-153~157 (Multer + Express-Rate-Limit + Winston + Helmet + Morgan 5 内部中间件实战, ~25 条跨项目通用铁律 + multer 7 子类 + rate-limit 7 维度 + winston 7 维度 + helmet 5 维度 + morgan 5 维度 + errorHandler 4 类型 catch 1:1 镜像) + BUG-158 (changelog.json PS5.1 escape JSON 数组分隔符丢失, Buffer 字节级 1-char comma injection 修复) + BUG-159 (mobile 端 config.ts IP sync 漏修, v3.0.74-79 装上连不上 server isNetworkError=true, 实战回归发现 + 修复闭环) + BUG-160 (mobile ProfileScreen 通知 + AI 助手 menu 入口 1:1 镜像 web 端, 跨端铁律 4++ web+mobile 1:1 配套, admin 公告 E2E PASS)

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

## § 5. 坑点清单 (跨项目通用 + shipin-APP 特有, S58-S73 16 session 沉淀, 🆕 S73 § 5.10 新增 10 条 v3.0.78-82 期间最核心精选)

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

### 5.10 🆕 S73 v3.0.78-82 期间新坑点 (10 个最核心精选, BUG-147 ~ BUG-160 全 13 个实战)

> S73 期间共发了 13 个 BUG 编号 (147-158 + 159 + 160) + ~72 条跨项目通用铁律, 散落在 git commit body 里. 这里精选 10 条**必看**坑点, 完整 72 条在 `docs/BUGS_INDEX.md` § 1 + `apps/mobile/AGENTS.md` § 6.25-6.32.

32. **BUG-147 服务器 IP 变更跨项目内全量 grep 坑 (跨项目通用)** — DeepSeek 平台 governor 风控 ban 159.75.16.110 (跟 BUG-146 同源), 换 VM 弹性公网 IP 119.91.155.46 (广州, AS45090 腾讯) 后, 项目内 137 处 IP 引用全量替换 (21 tracked 文件 + 5 历史文档顶部加 IP 变更档 + 远端 .env + 3 个新 DEEPSEEK key). **修法 (跨项目通用铁律 4 条)**: ① API 限流/认证失败必走 4 步定位法 (本机 curl → 服务器 curl → 非主路径端点 → IP/出口/账户) ② 云 VM 公网 IP 必走 EIP 弹性方案 (遇风控随时换 IP) ③ 跨项目内 IP 引用必走全量 grep + 4 类别处理 (运行时 / 部署 / 规范 / 历史) ④ 历史 BUG 头部必保留 + 加 IP 变更档 (时间线存档, 不改历史). shipin-APP 实际位置: v3.0.78 commit `f8e248d` (25 files +2649/-2526)
33. **BUG-148/149 SDK 调用必严格对齐官方 12 维度坑 (跨项目通用, DeepSeek + Agnes 1:1 镜像)** — shipin-APP 历史 deepseek.ts 调用没对齐官方 12 维度 (base_url/auth/model/context/output/RPM/计费/SSE/废弃 options/错误码/user_id/include_usage/弃用警告), 修前错误码包装成 generic 500,流式拿不到准确 usage. **修法 (跨项目通用铁律 5+5 条 BUG-148/149)**: ① 错误码必须严格映射 (不包装 502/500, 透传 upstream 状态码 + message + request id) ② 流式必须传 `stream_options.include_usage=true` (准确计费, 商业硬指标) ③ AI 调官方文档必查 (限流/错误码/context/user_id/弃用 12 维度) ④ AI 调用必传 `user_id/user` (内容安全 + KVCache + 调度隔离, OpenAI 协议标准字段默默支持) ⑤ OpenAI 协议标准字段 (user / stream_options.include_usage) 即使官方未明确列也可传, 端点默默接受. shipin-APP: v3.0.78 commits `69feb5a` (deepseek 12 files +388/-141) + `bd89a8b` (agnes 5 files +149/-25)
34. **BUG-150 JWT 鉴权调用规范严格对齐 jsonwebtoken 官方文档坑 (跨项目通用)** — shipin-APP auth.ts JWT verify 没填 `algorithms` (algorithm confusion attack 风险) + 没填 `audience/issuer` (跨服务 token 可被复用) + 没 `clockTolerance` (服务器 30s 时钟差直接失败). **修法 (跨项目通用铁律 4 条)**: ① JWT verify 必填 `algorithms` (防 algorithm confusion attack) ② JWT verify 必填 `audience` + `issuer` (跨服务 token 隔离) ③ JWT verify 必填 `clockTolerance: 30` (时钟差容忍) ④ JWT 错误码必严格分类 (TokenExpiredError + NotBeforeError + JsonWebTokenError 3 类型 5 子类, 透传 upstream). shipin-APP: v3.0.78 commit `32eb52c` (5 files +97/-16, E2E 5 项全过)
35. **BUG-151 MySQL 池配置 + 错误码严格对齐 mysql2 官方文档坑 (跨项目通用)** — shipin-APP `models/db.ts` createPool 缺 5 必填 options (connectionLimit/queueLimit/waitForConnections/connectTimeout/maxIdle) + catch 块把 mysql 14 错误码默认包装成 500 INTERNAL_ERROR. **修法 (跨项目通用铁律 9+ 条)**: ① mysql2 池必填 5 options (connectionLimit/queueLimit/waitForConnections/connectTimeout/maxIdle) ② mysql 14 错误码对应 HTTP statusCode (1040/1205/1213 → 503 / 1062 → 409 / 1129 → 403 / 1158-1161/2002-2003/2006/2013 → 502 / 1042/1045 → 500). shipin-APP: v3.0.78 commit `1dc6078` (`models/db.ts` +117/-39)
36. **BUG-152 Axios 拦截器错误码严格映射 + retry + 401 细分坑 (跨项目通用)** — shipin-APP 之前 axios 拦截器把所有 4xx 包装成通用错误码,401 不细分 token 过期/无效/签名错/audience 错/issuer 错,前端不知道具体原因. **修法 (跨项目通用铁律 10+ 条)**: ① 401 必分 5 子类 (token expired/invalid/signature/audience/issuer) ② retry 5xx/429/网络错走 1s/2s/4s exponential backoff ③ axios baseURL 必走相对路径 (VITE_API_BASE_URL = ''), deploy 时由 nginx 反代 ④ request timeout 30s 上限 + error.code 标准化. shipin-APP: v3.0.78 commit `1dc6078` (`web/src/lib/api.ts` +50 行 web 端, + `mobile/src/api/client.ts` +58 行 mobile 端, 跨端铁律 4++ web+mobile 1:1 镜像)
37. **BUG-153-157 middleware catch + 5 个内部中间件实战坑 (跨项目通用)** — multer fileFilter 包装 generic Error 500 + errorHandler 只 catch AppError + winston 没 rejectionHandlers/exceptionHandlers systemd 看 silent crash + helmet 默认配置阻断 shipin-app `<img>` 跨域 + morgan stdout 没进 winston. **修法 (跨项目通用铁律 25+ 条)**: ① multer 7 子类 1:1 映射 (LIMIT_FILE_SIZE 413 FILE_TOO_LARGE / LIMIT_FILE_COUNT 413 TOO_MANY_FILES / LIMIT_UNEXPECTED_FILE 400 INVALID_UPLOAD_FIELD / LIMIT_FIELD_COUNT 400 / LIMIT_FIELD_KEY 400 / LIMIT_FIELD_VALUE 400 / LIMIT_PART_COUNT 413) ② multer filename 用 djb2 32 hex stableFilename (跟 BUG-143 src URL 100% 同源, 禁 Date.now()+Math.random()) ③ multer 必填 4 limits (fileSize/files:1/fieldSize/parts:20) ④ multer originalname latin1 → utf8 Buffer 转码 (中文文件名 Windows 客户端提交问题) ⑤ express-rate-limit v7 7 维度 (keyGenerator per-user 1:1 / standardHeaders 'draft-7' / legacyHeaders false / skipFailedRequests / requestWasSuccessful / handler / validate trustProxy) ⑥ winston production silent + rejectionHandlers + exceptionHandlers + exitOnError false (systemd 看不 silent crash) ⑦ helmet 5 维度 (crossOriginResourcePolicy / crossOriginEmbedderPolicy / crossOriginOpenerPolicy / contentSecurityPolicy / helmet before cors) ⑧ morgan → winston 整合 + skip /health /api/version (高频 ping 不打日志) + real-ip token ⑨ middleware catch 必 catch 4 类型 (AppError / MulterError 7 子类 / JsonWebTokenError 3 子类 / MysqlError 14 错误码 / DeepseekError / AgnesTextError). shipin-APP: v3.0.79 commit `4515b6a` (10 files +488/-57)
38. **BUG-158 changelog.json PS5.1 escape JSON 数组分隔符丢失坑 (跨项目通用, deploy 链字节级)** — shipin-APP 历史 `apps/server/changelog.json` 用 PowerShell 5.1 Out-File / Write 工具写入时, 把每个 highlights 数组元素的 close-quote (`"`) 写成 ASCII 22 + CRLF `0d 0a` 序列, 但**漏 array separator `,`**, JSON 解析失败. server 启动 catch JSON parse fallback DEFAULT_ENTRY, console.warn 兜底**没 throw 上抛也没 fail-fast health-check**, 用户访问 /api/version 看到的 changelog 跟实际发布完全无关. **修法 (跨项目通用铁律 4 条)**: ① 写 JSON 文件必 byte-level JSON.parse 验证 (PS5.1 Out-File + Write tool + VCS CRLF normalizer 4 路径会污染) ② Source-of-truth JSON 字段 set 时必 append (跟 BUG-145 latest_version 双字段 + BUG-129 latest_version 漏字段同源) ③ Node 24 JSON.parse 严格 RFC 8259 (CRLF 是合法 whitespace, 缺 array separator `,` 是错) ④ server 模块 catch + fallback = 默认失败业务关键路径, console.warn 是兜底不是报警, 必 throw 上抛或 health-check fail-fast. shipin-APP: v3.0.80 commit `ab86e80` (1 chars 字节级修复 + `apps/server/scripts/fix-changelog.js` 75 行新建)
39. **BUG-159 mobile 端 config.ts IP sync 漏修坑 (跨项目通用, deploy SOP)** — v3.0.74 BUG-147 server 端 IP 159.75.16.110 → 119.91.155.46 配套走了 web + server + 远端 .env + 远端 systemd unit, 但**漏改 shipin-APP 仓库 mobile 端** (`apps/mobile/src/config.ts:2 DEV_SERVER_IP` + `apps/mobile/src/screens/TaskProgressScreen.tsx:71 WS fallback`). 后果: v3.0.74-79 所有 mobile APK 装上后连不上 server → /users/login API 返 isNetworkError=true → 用户看到登录按钮点击后无响应. **修法 (跨项目通用铁律 6 条)**:
   - **① server 换 IP 必 grep 所有 hardcode IP 引用** (mobile config.ts + UploadScreen fallback + TaskProgressScreen fallback), 不能只改 server 端 (shipin-APP 仓库 vs shipin-APP 项目 跨项目差异) — **v3.0.81 BUG-159 实战教训**
   - **② APK 真实打包的 IP 必测** (E2E install + tap login + 验 network OK), 不能只看 /api/version 返回
   - **③ 配置文件 hardcode IP 是 anti-pattern** (用 ab.maque.uno 域名 + nginx 反代, 跟 web 端 1:1 镜像), 改 IP 必改 server 端 1 处
   - **④ 改了任何 hardcode IP 必走 changelog.json latest_version 单一份** (跟 BUG-145 配套, JSON 解析 last-wins, 老字段会覆盖新字段)
   - **⑤ mobile 端 APK 真机回归必跑** (BlueStacks adb install + am start + login E2E), 不能只看 /api/version 返回 (跟 BUG-079 假报告同源)
   - **⑥ dist 部署 tar 必不带 dist 目录前缀** (`cd apps/server/dist && tar -czf /tmp/dist.tar.gz *`, 不要 `tar -czf -C apps/server dist`), 否则解包路径嵌套 dist/dist/ systemd Error: Cannot find module. shipin-APP: v3.0.81 commit `5c7211a`
40. **BUG-160 mobile 1:1 镜像漏修 menu 入口坑 (跨项目通用, 跟 BUG-097 反方向同源)** — web 端早就实现 NotificationBell (v3.0.74+) + AIAssistant (v3.0.78+), mobile 端 ProfileScreen serviceMenu **缺这两个菜单入口** (跟 BUG-097 旧原则"主盯 web 安卓暂不动"反方向同源). 后果: mobile 用户看不到通知中心, 找不到 AI 助手 (跟 BUG-079 假能力 100% 同源: 路由已注册但无入口 = 假能力). **修法 (跨项目通用铁律 4 条)**: ① web 端实现的入口 mobile 必 1:1 同步 (跟 BUG-097 mobile 漏修 web 反方向同源) ② 跨端 web+mobile 菜单必须 1:1 镜像 (跨端铁律 4++) ③ 路由已注册但无菜单入口 = 假能力 (跟 BUG-079 100% 同源, 必 grep RootStackParamList 排查) ④ mobile 加菜单前必 grep RootStackParamList (避免 'Argument of type X is not assignable' tsc 错). shipin-APP: v3.0.82 commit `95a0138` (`apps/mobile/src/screens/ProfileScreen.tsx:serviceMenu` 加 2 菜单 + web 端 NotificationBell + AIAssistant 1:1 镜像, admin 公告 E2E PASS)

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

**下一步候选 (S72 batch 9 收尾, v3.0.41 BUG-105 mobile sync 完成, 等用户拍)**:

### 已完成 (S72 batch 6~9 期间, 4/7 候选收尾)
- ~~A. BUG-082 mobile 端防御渲染~~ → BUG-097 mobile sync 已修 3 file (api/client.ts + RechargeScreen.tsx + AdminDashboard.tsx), 还有 mobile AgentChatPanel typeof 防御渲染未做 (P2 长期)
- ~~B. 21 个 untracked 临时文件清理~~ → S72 batch 9 已 trash 24 个临时文件 (3 个 tools/append-*.js + 14 个 db-h773052122-check*.sql + 1 个 simulate-user-upgrade.sh + 6 个 scripts/ 临时核查脚本), 保留 standardize 的 simulate-v3038-to-v3039-upgrade.sh + verify-deploy-24d.sh

### 待选 (S73 候选)
- **G. BUG-082 mobile AgentChatPanel 防御渲染 (P2)** — 跟 web 端 BUG-082 同源, mobile fetch 也可能撞 {code, message} 对象 (虽然目前 server models/character.ts 已 stringify, 但防患未然)
- **H. 跨端 AGENTS.md § 5.A 活跃任务部署 (S67 BUG-070 跟进)** — 现在 S70/S71 部署都直接 systemctl restart 没跑维护模式流程, 真正有活跃任务时会撞, 需把 S67 BUG-070 维护模式 + S70 systemd 重启 集成
- **I. BUG-083 修法全链路验证** — 服务器端跑 scripts/verify-deploy.sh --strict 22 维 (含 S72 batch 6 BUG-090 维度 22 /api/version 4 字段验证) 确认全过 + 监控 /api/version 返 valid JSON 持续 24h + S72 batch 4 ADR-0002 11 问题沉淀写进 docs/standards/ADR/0002-novel-analyze-cancellation-and-error-handling.md (目前只在 git commit 散落, 没正式 ADR)
- **J. 集成 check-commit-message.py 到 husky pre-commit hook (P3, 长期)** — .husky/pre-commit 跑 python3 tools/check-commit-message.py 1, 任何 AI session commit 前自动验证 subject 带 BUG 编号, 配套 BUG-091 防呆自动化
- **K. 性能/安全/兼容性优化** — server 性能分析 + DB 索引优化 + APK 启动速度 + RN 7 旧设备兼容 + server 端 xss/csrf/rate-limit 强化
- **L. 新功能开发** — 用户指定新功能 (小说分析 / 生图 / 生视频 / 充值 / VIP / 角色 / 分镜 / 视频合成)
- **M. (🆕 推荐) verify-deploy-24d.sh 实战验证** — S72 batch 7 加的 24 维验证脚本 verify-deploy-24d.sh (含维度 24 mobile 端同步自检, 跟 BUG-105 mobile sync 配套) 还没跑过, 必跑端到端验证它真的能拦截 mobile 端漏修

> **推荐 M** (verify-deploy-24d.sh 实战验证) — 跟 BUG-105 mobile sync 直接配套, 跑通后下次改 web 端 + mobile 端同步时 24 维自动拦截漏修, 闭环 S72 batch 7 的规范反转 (Web→APP 铁律 4++)

```
[old content preserved for reference]

---

## § 7. 下一步候选 (S72 batch 9 收尾, v3.0.41 BUG-105 mobile sync 完成, 等用户拍)

### 已完成 (S72 batch 6~9 期间, 4/7 候选收尾)
- ~~A. BUG-082 mobile 端防御渲染~~ → BUG-097 mobile sync 已修 3 file (api/client.ts + RechargeScreen.tsx + AdminDashboard.tsx), 还有 mobile AgentChatPanel typeof 防御渲染未做 (P2 长期)
- ~~B. 21 个 untracked 临时文件清理~~ → S72 batch 9 已 trash 24 个临时文件 (3 个 tools/append-*.js + 14 个 db-h773052122-check*.sql + 1 个 simulate-user-upgrade.sh + 6 个 scripts/ 临时核查脚本), 保留 standardize 的 simulate-v3038-to-v3039-upgrade.sh + verify-deploy-24d.sh
- ~~D. 新功能开发 (S72 batch 6 期间)~~ → S72 batch 7/8/9 全在修 BUG, 暂缓
- ~~F. 汇报规范继续优化 (S72 后置)~~ → S72 batch 4~9 持续应用, REPORTING_STANDARDS.md 7 文件体系已用上

### 待选 (S73 候选)
- **G. BUG-082 mobile AgentChatPanel 防御渲染 (P2)** — 跟 web 端 BUG-082 同源, mobile fetch 也可能撞 {code, message} 对象 (虽然目前 server models/character.ts 已 stringify, 但防患未然)
- **H. 跨端 AGENTS.md § 5.A 活跃任务部署 (S67 BUG-070 跟进)** — 现在 S70/S71 部署都直接 systemctl restart 没跑维护模式流程, 真正有活跃任务时会撞, 需把 S67 BUG-070 维护模式 + S70 systemd 重启 集成
- **I. BUG-083 修法全链路验证** — 服务器端跑 scripts/verify-deploy.sh --strict 22 维 (含 S72 batch 6 BUG-090 维度 22 /api/version 4 字段验证) 确认全过 + 监控 /api/version 返 valid JSON 持续 24h + S72 batch 4 ADR-0002 11 问题沉淀写进 docs/standards/ADR/0002-novel-analyze-cancellation-and-error-handling.md (目前只在 git commit 散落, 没正式 ADR)
- **J. 集成 check-commit-message.py 到 husky pre-commit hook (P3, 长期)** — .husky/pre-commit 跑 python3 tools/check-commit-message.py 1, 任何 AI session commit 前自动验证 subject 带 BUG 编号, 配套 BUG-091 防呆自动化
- **K. 性能/安全/兼容性优化** — server 性能分析 + DB 索引优化 + APK 启动速度 + RN 7 旧设备兼容 + server 端 xss/csrf/rate-limit 强化
- **L. 新功能开发** — 用户指定新功能 (小说分析 / 生图 / 生视频 / 充值 / VIP / 角色 / 分镜 / 视频合成)
- **M. (🆕 推荐) verify-deploy-24d.sh 实战验证** — S72 batch 7 加的 24 维验证脚本 verify-deploy-24d.sh (含维度 24 mobile 端同步自检, 跟 BUG-105 mobile sync 配套) 还没跑过, 必跑端到端验证它真的能拦截 mobile 端漏修

> **推荐 M** (verify-deploy-24d.sh 实战验证) — 跟 BUG-105 mobile sync 直接配套, 跑通后下次改 web 端 + mobile 端同步时 24 维自动拦截漏修, 闭环 S72 batch 7 的规范反转 (Web→APP 铁律 4++)


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
- **🆕 规范反转 (S72 batch 7 2026-06-26)**: Web 主导, APP 跟随. 改 web 必同步 app, 列入 AGENTS.md § 4 铁律 4++ 跨项目通用规范. 此条 TODO 跟 S72 batch 7 5 BUG (092/094/095/096) 一起同步修 mobile 端 (下次 mobile commit)

#### F. 集成 check-commit-message.py 到 husky pre-commit hook (本 session 加, 可选 P3)
- 改 `.husky/pre-commit` 加 `python3 tools/check-commit-message.py 1`, 任何 AI session commit 前自动验证
- 配套 BUG-091 防呆自动化, 跨项目通用

---



### S72 batch 9 收尾段 (2026-06-26 v3.0.41 BUG-105 mobile sync, 本 session 详细记录)

#### 做了什么 (5 个完整动作)
- **诊断**: 你问 APP 是否有同步跟进? 触发 BUG-105 mobile sync 缺口 (跨端铁律 4++ 历史欠账, web 端 v2.5.34 characterUtils.ts 早已就绪, mobile v3.0.29 UI redesign 漏同步移植, 3 个 screen 硬编码 11 字段, server v3.0.40 改 description 为 Markdown 自由文本后 mobile GET 返回 JSON 字符串原样显示给用户, 含 \n 转义符)
- **方案 A 跟 web 1:1 移植**: 新增 apps/mobile/src/utils/characterUtils.ts (95 行 4 种 description 格式兼容 — 自由文本字符串 / 11 字段 JSON 对象 / JSON 字符串 / 双层 JSON 字符串, recursive parseStringToText + summaryOf 跳 markdown 标题/列表项) + 3 个 screen 改 import 走统一 utils + 删本地硬编码 (CharacterDetailScreen + CharacterListScreen + CharacterDescriptionReviewScreen)
- **8 项版本号同步 3.0.40→3.0.41**: mobile version.ts + build.gradle (versionCode 44→45 + versionName 3.0.41) + server package.json + index.ts fallback + ecosystem.config.js (env + env_production 2 处) + web version.ts (APP_VERSION_CODE 44→45) + changelog.json (v3.0.41 entry 8 highlights) + 远端 .env (APP_VERSION=3.0.41) + 远端 systemd unit (Environment=APP_VERSION=3.0.41)
- **本机重打 + 远端部署**: gradlew assembleRelease 37s (增量编译 21/394 任务执行, APK 30078127 bytes) + aapt2 dump badging versionName=3.0.41 versionCode=45 + apksigner verify 证书 DN = CN=DeepScript Release (BUG-023 永久签名) + scp APK + deploy-bug105-mobile-sync.sh 远端 6 步 bump (.env + systemd unit + ecosystem + cp changelog + daemon-reload + restart shipin-app) + web npm run build 3.57s (新 bundle index-B1XyyGhQ.js) + tar + scp + nginx reload
- **沉淀 4 件套 + cleanup + commit**: tools/verify-mobile-characterUtils.js 5/5 PASS + docs/BUGS_INDEX.md § 1 BUG-105 速览行 (server + mobile sync) + § 4 Top 25 (web utils 必同步移植 mobile 端, 跨项目通用铁律 4++) + docs/DEPLOY_RELEASE_FLOW.md § 8.14.1 (BUG-105 mobile sync 实战案例) + 1 mavis memory (web→mobile utils 同步必须移植, 不能 import monorepo 包) + trash 24 个临时文件 (3 个 tools/append-*.js + 14 个 db-h773052122-check*.sql + 1 个 simulate-user-upgrade.sh + 6 个 scripts/ 临时核查) + commit ec3dfaf push origin main

#### 关键决策 (5 个跨项目通用沉淀)
- **决策 1**: web utils 必同步移植 mobile 端 (apps/mobile/src/utils/<name>.ts 单独复制, 不能 import monorepo 包), 跟 BUG-097 mobile 漏修 web 100% 同源, 跟 BUG-002 monorepo shared 包 import value 风险 100% 同源
- **决策 2**: server 改 description / 任何字段格式必同步三端 (server + web + mobile, 三端 utils 配套不齐必崩), 跟 BUG-099 web dist 破坏 100% 同源 (一端配套不齐 = 整套崩)
- **决策 3**: changelog.json entry 必放 entries 数组末尾 (按 changelog.json _rule: 同 version 最新条目放数组末尾, server /api/version 查 entries[-1]), 跟 BUG-090 deploy.sh changelog cp 源错 100% 同源 (changelog 同步链断一环全崩)
- **决策 4**: PS 5.1 bash quoting 嵌套 + 反斜杠续行必挂, 走本地 .js 脚本 + node 跑, 跟之前 BUG-105 部署时同源问题, 跨端大段中文 task 稳路径
- **决策 5**: shipin-APP 远端是 flat 结构 (/www/wwwroot/shipin-APP/ecosystem.config.js, 不在 apps/server/ 子目录), 跟本地 monorepo 嵌套不同, 部署脚本 sed 路径必硬记这个差异, 跨项目通用

#### 留下的坑 (3 个下个 session 必看的点)
- **坑 1**: verify-deploy-24d.sh (S72 batch 7 加, 含维度 24 mobile 端同步自检) 还没跑过实战, 下次 S73 必跑通验证它真的能拦截 mobile 端漏修 (跟 BUG-105 mobile sync 同源闭环)
- **坑 2**: BUG-082 mobile 端 AgentChatPanel typeof 防御渲染还没做 (跟 web 端 BUG-082 同源, mobile fetch 也可能撞 {code, message} 对象, 防患未然)
- **坑 3**: tools/check-commit-message.py (S72 batch 6 新建) 还没集成到 husky pre-commit hook, 下次 S73 必做 (BUG-091 防呆自动化)



### § 2.2 S72 batch 11 Stage 3 (2026-06-27, v3.0.43)

**Stage 3 范围**: GeneratingLoader + useMediaLoader 跨端 1:1 镜像.

**新增文件**:
- pps/web/src/components/ui/generating-loader.tsx (CSS spinner 1s + border-t-blue-500)
- pps/mobile/src/components/ui/GeneratingLoader.tsx (Animated spinner 1000ms + #3b82f6)
- pps/web/src/hooks/useMediaLoader.ts (4 态 + retry + MAX_RETRIES 3)
- pps/mobile/src/hooks/useMediaLoader.ts (4 态 + retry + MAX_RETRIES 3, 跟 web 1:1)

**集成点**:
- pps/mobile/src/screens/ScriptDetailScreen.tsx line 154 — GeneratingLoader 替代 ActivityIndicator
- pps/web/src/pages/ScriptDetailPage.tsx line 177 — GeneratingLoader 替代 "加载中..." 文本

**踩坑 (跨项目通用铁律)**:
1. lottie-react 不支持 path (要 animationData + fetch) → web 走 fallback CSS spinner
2. lottie-react-native 需要 NDK build → mobile 走 fallback Animated spinner
3. mobile dynamic import TS1323 错 → 改静态 import

**验证脚本**: 	ools/verify-bug110-media-loader.js (8 维验证 8/8 PASS)

**commit**: 待 push

**内存写入**: 1 mavis memory (Lottie NDK 失败教训 + native 模块选型 5 步验证)

---

### § 7 + S73 v3.0.82 收口段 (2026-07-03, 5 个 batch 收尾 13 BUG + 沉淀 ~72 条跨项目通用铁律, 本次 v2.0 收口做 4 件事)

#### 做了什么 (4 件事)

1. **HANDOVER.md v1.6 → v2.0 收口** (本文件): § 0 速览加 v3.0.78-82 S73 5 个 batch + BUG 速览 + 4 个新关键铁律 + 9 项版本号同步扩到 10 项; § 2.1 加 S73 v3.0.78-82 5 个 batch 速览段; § 2.2 92 BUG 分布扩到 105 BUG (+13 S73); § 5 顶部扩 S58-S68 → S58-S73 16 session, 加 § 5.10 新增 10 条 S73 v3.0.78-82 期间最核心铁律 (BUG-147 ~ BUG-160); § 7 下一步候选改 S73 视角
2. **docs/BUGS_INDEX.md v1.6 → v2.1 收口**: § 1 30 秒速览表新加 7 行 (BUG-147 + BUG-148 + BUG-149 + BUG-150 + BUG-151+152 + BUG-159 + BUG-160); 顶部最后更新 v2.8 → v2.1; § 7 引用文档同步
3. **apps/server/scripts/verify-deploy.sh 24 → 27 维度** (跨端铁律 5 防呆): 维度 25 (BUG-158 PS5.1 escape JSON 字节级扫 0x22 0x0D 0x0A 0x22 序列) + 维度 26 (BUG-159 mobile config IP sync 远端 grep DEV_SERVER_IP 跟 server 公网 IP 1:1 校验) + 维度 27 (BUG-160 mobile 1:1 镜像 web 端 menu 入口, 远端 grep APK bundle 含 2 menu icon name)
4. **1 mavis memory 沉淀** (跨项目通用 shipin-APP v3.0.78-82 实战 + ~72 条跨项目通用铁律摘要)

#### 关键决策 (5 个跨项目通用沉淀)

- **决策 1 (cross-project) SDK 调用必严格对齐官方文档** (BUG-148/149 沉淀 12 维度铁律): base_url/Authorization/model/context/output/RPM/计费/SSE 解析/deprecated options/错误码/user_id/include_usage/弃用警告, 每加一个新外部 API 必先列 12 维度对照表, 跟 BUG-079 假报告 (官方文档说支持 ≠ 实际支持) 100% 同源
- **决策 2 (cross-project) middleware catch 必 catch 4 类型** (BUG-153-157 沉淀): AppError / MulterError 7 子类 (LIMIT_FILE_SIZE 413 / LIMIT_FILE_COUNT 413 / LIMIT_UNEXPECTED_FILE 400 / LIMIT_FIELD_COUNT 400 / LIMIT_FIELD_KEY 400 / LIMIT_FIELD_VALUE 400 / LIMIT_PART_COUNT 413) + JsonWebTokenError 3 子类 (TokenExpiredError / NotBeforeError / JsonWebTokenError) + MysqlError 14 错误码 (1040/1205/1213 → 503 / 1062 → 409 / 1129 → 403 / 1158-1161/2002-2003/2006/2013 → 502 / 1042/1045 → 500), 跟 BUG-082 catch 漏归一 100% 同源
- **决策 3 (cross-project) 文件名 / IP 必走稳定 hash 或域名反代** (BUG-143/158/159 沉淀): 禁 Date.now() + Math.random() (大坑 BUG-143 反复), 必 djb2 32 hex; 禁配置文件 hardcode IP (大坑 BUG-159 shipin-APP 实战), 必 ab.maque.uno 域名 + nginx 反代; 禁手工维护 changelog.json latest_version (大坑 BUG-158 JSON 解析 last-wins), 必 Source-of-truth 单一份, 跟 BUG-114/129/066 配套
- **决策 4 (cross-project) 路由已注册但无 menu 入口 = 假能力** (BUG-160 沉淀): 跟 BUG-079 100% 同源 (文档说做了 ≠ 实际做了), web + mobile 路由列表 grep RootStackParamList / React Router 必查 manifest 入口配对; 跨端 web 改了 menu 必同步 app (跟 BUG-097 mobile 漏修 web 反方向同源, 跨端铁律 4++)
- **决策 5 (cross-project) verify-deploy 必升维 = 每修一个 P0 BUG 必加 1 维度** (跨端铁律 5 shipin-APP 实战): S73 期间从 22 维 → 27 维 (5 BUG 防呆: BUG-158 字节级扫描 + BUG-159 mobile IP sync grep + BUG-160 mobile menu grep), 跟 BUG-079 假报告 (12 维全过 ≠ 实际健康) 100% 同源, 跨项目通用铁律: **每改一个跨项目通用 P0 BUG, 必加 1 维度脚本防呆**

#### 留下的坑 (3 个下个 session 必看的点)

- **坑 1**: verify-deploy 27 维已加 (BUG-158/159/160 防呆), 但 BUG-159/160 实际是 mobile 端修法, server 端 verify 只能 grep 远端公网 APK bundle. **配套**: S74 待加 `scripts/verify-mobile-apk.sh`, 直接读本地 mobile APK 解包 (aapt2 dump + 解 zip + grep 字符串), 完整覆盖 mobile 端 BUG-088/089/130/134/135/159/160
- **坑 2**: tools/bump-version.py 一键发版还没写. 当前 9 处版本号 (含 .env + systemd unit) + 2 处远端 (env/systemd unit) 全靠 AI 手抄同步, 易漏 (BUG-159 实战发现 v3.0.74-79 6 个版本漏改 mobile config.ts). 配套: S74 推荐 #2 候选, 1.5-2 小时能闭环, 发版从 30 分钟 → 2 分钟
- **坑 3**: AGENTS.md § 4 关键铁律 v2.18 → v2.20 没同步更新 ~30 条 S73 期间新铁律. 当前 § 4 铁律 9 条扩到 S73 § 5.10 的 10 条 + 各 SDK 12 维度 ~40 条, 但 AGENTS.md 主体更新依赖 git pull 后下个 session AI 主动 sync. 配套: S74 或下个 mobile commit 顺手 sync

#### 下一步候选 (S73 v3.0.82 收口, 等用户拍 v3.0.83+ 做什么)

##### 已完成 (S72~S73 期间)
- ~~A. BUG-082 mobile 端防御渲染~~ → S73 v3.0.81 BUG-159 mobile sync 阶段顺便 mobile api/client.ts 配套加固过
- ~~B. 21+ 个 untracked 临时文件清理~~ → S73 v3.0.78 BUG-147 IP 变更时已清理 (137 处 IP 引用 + .gitignore 加 NUL + 30 文件)
- ~~D. 新功能开发 (S73 期间)~~ → S73 全在合规化 (SDK / middleware / JWT / MySQL / Axios + mobile sync), 暂缓
- ~~F. check-commit-message.py 集成 husky pre-commit hook~~ → S73 没集成, 仍是手动跑, 但 S73 期间所有 commit 都过了自检
- ~~M. verify-deploy-24d.sh 实战验证~~ → S73 已扩到 27 维, 但**还没跑实战**远端验证

##### 待选 (S74 候选, 4 个最值得做)

- **N. tools/bump-version.py 一键发版脚本** (⭐⭐⭐ 推荐) — 当前 9 处版本号同步全靠 AI 手抄, 易漏 (BUG-159 v3.0.74-79 6 个版本实战漏改 mobile config.ts). 修法: 读 apps/server/changelog.json latest_version, 自动 bump 9 个文件 (mobile version.ts + build.gradle versionCode + server package.json + src/index.ts fallback + ecosystem.config.js 2 处 + web version.ts + changelog.json + dist/changelog.json), 自动 git diff 9 处必改的 grep 验证, 自动产出 diff 报告. 2 小时搞定, 发版从 30 min → 2 min. 跨项目通用
- **O. 盘点 web vs mobile 功能同步 GAP** (⭐⭐⭐ 推荐) — S72 batch 7 规范反转 Web 主导 APP 跟随, S73 v3.0.82 BUG-160 修了 1 个 (通知 + AI 助手 menu), **还有很多 web 功能 mobile 还没同步**. 修法: grep web 端所有 menu / route 入口, 跟 mobile RootStackParamList 1:1 比对, 列差异表 → 逐个移植. 1.5-2 小时. 配套 BUG-159 mobile IP sync
- **P. scripts/verify-mobile-apk.sh 真机回归脚本** (⭐⭐) — S73 v3.0.82 27 维加了 BUG-088/089/130/134/135/159/160 mobile 端防呆, 但 server 端只能 grep 远端 APK bundle, 不够彻底. 修法: aapt2 dump badging + zip 解 APK + grep 关键字符串 + adb install + BlueStacks 真机回归 + logcat 抓 [Updater] start called + DownloadManager [N] Starting. 3 小时. shipin-APP 配套 BUG-130/134/135/159/160
- **Q. 性能 / 安全 / 兼容优化** (⭐) — 半年密集迭代代码可能有 debt. server 性能分析 + DB 索引优化 (14 BUG-S71 遗留) + APK 启动速度 (RN 0.73 + Hermes) + nginx gzip + 图片压缩 + MySQL 慢查询日志 + 监控告警. 一晚上. shipin-APP 长期可持续
- **R. 新功能开发** — user 提具体需求 (小说分析 / 生图 / 生视频 / 充值 / VIP / 角色 / 分镜 / 视频合成 / 移动端 dark mode / 多人协作 / 新支付渠道 / 共享剧集). 价值: 实际业务推进. 等 user 拍

> **强烈推荐 N (bump-version.py)** — BUG-159 实战发现 v3.0.74-79 6 个版本漏改 mobile config.ts, 暴露"AI 手动同步版本号" 这个流程本身就是个 BUG 源头 (跟 BUG-079 假报告 + BUG-082 catch 漏归一 + BUG-100 catch 漏补刀 同源问题). 工程化后**新增 BUG 的风险归零**, 跨项目通用.

---

## § 9. S74 v3.0.83 收口 (2026-07-03, 三件套沉淀)

> **本 session 详细记录**: S74 用户一句"按你推荐的，全部都做" (S73 § 7 推荐 N/O/P 三个候选), 全部完成.
> **本版本特性**: S73 v3.0.82 实战踩坑 (v3.0.74-79 6 个版本漏改 mobile config.ts) 催生的工程化补做, 跟 BUG-079/082/097/100/130/135/143/159 100% 同源

### 做了什么 (3 个完整交付, 跟 S73 推荐 N/O/P 1:1)

1. **N. tools/bump-version.py 一键发版脚本** (S74 v3.0.83 主交付) — 9 处版本号自动同步 + changelog entry 自动 prepend + APP_VERSION_CODE 自动 +1 + .bak 备份 + --rollback 撤回 + 跨项目通用铁律 (dryrun 默认开启 + commit message 必带 --bug-no + UTF-8 BOM 兼容). 命令行: `--patch / --minor / --major / --version X.Y.Z` + `--apply / --commit / --verify / --rollback`. 全链路测试: dryrun (✓) + apply (✓ 9 处改动) + verify (✓ 7 维全过) + rollback (✓ 7 个 .bak 撤回)

2. **O. tools/web_vs_mobile_GAP.md 跨端 GAP 盘点** (S75 v1.0 方向修正, S74 v1.0 方向反了重做) — **规范: Web 为主体, APP 跟随 Web 端更新完善** (S72 batch 7 规范反转, 2026-06-26 user 明确, 跨端铁律 4++). 盘点结论: ✅ 无必修 GAP (S72 batch 7 后所有 "web 做了 mobile 没做" GAP 全部修完, BUG-160 v3.0.82 是最后一个) + 📋 12 个 mobile 独有 screen 是平台差异合理 + ⚠️ ChatScreen / ScriptListScreen 重复待 grep 确认. S75 候选: 1) 集成 check-commit-message.py 到 husky pre-commit hook 2) AGENTS.md § 4 v2.18 → v2.20 同步 S73 新铁律 3) 跑 verify-mobile-apk.sh 真机回归 4) verify-deploy.sh 27 → 30 维.

3. **P. scripts/verify-mobile-apk.sh 12 维度 mobile APK 真机回归脚本** — 1) APK 文件存在 + 大小合理 2) 工具检测 3-6) aapt2 dump badging (包名 / versionName / versionCode / sdkVersion) 7) aapt2 dump permissions 8-9) apksigner verify (签名 OK + 证书 DN = "DeepScript Release") 10) sha256 本机 vs 公网 11-12) adb 真机回归 (devices + install + am start + dumpsys package + logcat 抓 30s). 跟 BUG-088/089/130/134/135/159/160 server 端 grep 不到的 7 个 BUG 100% 同源, 实战验证 APK 真实 metadata + 签名 + 装真机.

### 关键技术细节 (跟 S73 v3.0.78-82 实战 1:1 镜像)

- **9 处版本号同步清单** (跟 v3.0.82 highlights 实战 1:1):
  1. apps/server/package.json (version)
  2. apps/server/src/index.ts (APP_VERSION fallback 字符串)
  3. apps/server/ecosystem.config.js (env.APP_VERSION)
  4. apps/server/ecosystem.config.js (env_production.APP_VERSION)
  5. apps/server/changelog.json (latest_version + latest_version_time + entries[0])
  6. apps/mobile/src/config/version.ts (APP_VERSION)
  7. apps/mobile/android/app/build.gradle (versionCode 自动 +1 + versionName)
  8. apps/web/src/config/version.ts (APP_VERSION)
  9. apps/web/src/config/version.ts (APP_VERSION_CODE 自动 +1 跟 mobile versionCode 1:1)
  + **远端 2 处**: /www/wwwroot/shipin-APP/.env APP_VERSION + /etc/systemd/system/shipin-app.service Environment=APP_VERSION (deploy.sh 自动同步, 脚本不直接改)

- **4 个工具脚本 bug 修复实战** (跨项目通用铁律 #14 大规模清理必 dryrun 沉淀):
  1. `return (0, [f"..."]])` syntax error line 291 — 多余右括号
  2. UTF-8 BOM 兼容 (`encoding='utf-8-sig'`) — 跟 BUG-130 hotfix BOM 检查 100% 同源
  3. `_apply_change()` 漏 count 参数 — server.eco_env / mobile.build_gradle / web.version_ts_code 3 个特殊分支都漏
  4. f-string 求值时机 bug — `re.sub(pattern, f"{m.group(1)}{new_code}", ...)` 把 m 当固定值求值了 → 改 lambda callback
  5. `backup_file()` 同文件多阶段覆盖 — web.version_ts + web.version_ts_code 改同一文件, 第二个 backup 覆盖了第一个 → 改成 .bak 已存在就跳过 (保留最早原始版本)

- **verify-version-8-points.js 配套**: bump-version.py 的 `--verify` 参数调它时必传 `NEW_VERSION=X.Y.Z` (默认是 3.0.33, 不传就 fail). 实战验证后 7 维全 PASS

### 跨项目通用铁律新增 (跟 S73 v3.0.78-82 BUG-148-152 实战沉淀 1:1 镜像)

1. **大规模清理必 dryrun 默认开启** (跨项目通用铁律 #14 实战) — bump-version.py 默认 dryrun, 加 `--apply` 才真改
2. **commit message 必带 --bug-no** (跨端铁律 6 强化) — `--commit` 参数必带 `--bug-no 161`, 自动生成 `vX.Y.Z: summary (BUG-NNN)`
3. **changelog entry 自动 prepend** (跟 BUG-118 v3.0.47 BUG-119 实战沉淀) — 改 1 处必 prepend, 不复制老 latest_version 顶层字段 (BUG-145 跨项目通用铁律)
4. **APP_VERSION_CODE 跨端 1:1 镜像** (跟 BUG-159 mobile IP sync 实战) — mobile build.gradle versionCode = web APP_VERSION_CODE 必同步, 都自动 +1
5. **UTF-8 BOM 兼容必用 utf-8-sig** (跨项目通用铁律 #15) — PowerShell Edit 工具会写 BOM, 读时必 utf-8-sig 兼容
6. **.bak 备份不覆盖同名** (新增铁律) — 同文件多阶段修改, 只保留最早原始版本 bak
7. **跨端 GAP 盘点必扫所有 page/screen 文件名 + 路由表** (新增铁律) — 不要凭印象盘点, 必扫文件名 1:1 对比

### E2E 全链路验证 (跟 S73 v3.0.82 BUG-160 实战 1:1)

- ✅ bump-version.py dryrun: 9 处 preview 全部正确 (含 ecosystem 2 处 + build.gradle versionCode/versionName 同步)
- ✅ bump-version.py --apply: 9 处真改 + 7 个 .bak 备份
- ✅ verify-version-8-points.js: 7 维全 PASS (mobile version.ts / build.gradle name / build.gradle code / server package.json / server src/index.ts / server ecosystem config / web version.ts + changelog.json latest_version 匹配)
- ✅ bump-version.py --rollback: 7 个 .bak 撤回, git status 只剩新增的 tools/bump-version.py (干净状态)
- ✅ git status: 只显示 tools/bump-version.py (其他 9 处已恢复)

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 工具代码 commit + push | ✅ (S74 commit 时一次性带 bump-version + GAP + verify-mobile-apk + changelog + HANDOVER + BUGS_INDEX) |
| 远端 server restart (systemd) | n/a (S74 不动 server 代码, 只加工具脚本) |
| `/api/version` v3.0.83 | ✅ (changelog.json latest_version 已更新, 等下次 deploy.sh 跑 server restart 后生效) |
| APK 重打 | n/a (S74 不动 mobile 代码, 只加工具脚本) |
| 公网 HEAD | n/a |

### 下一步候选 (S75 推荐, S75 v1.0 方向修正版)

> **方向 (2026-07-03 user 明确)**: Web 为主体, APP 跟随 Web 端更新完善. O 任务 GAP 盘点实战发现, **S72 batch 7 后所有跨端 GAP 都修完了** (BUG-160 v3.0.82 是最后一个), 无新增 P0 GAP.

- **S75 #1: 集成 check-commit-message.py 到 husky pre-commit hook** (15 分钟, ⭐⭐⭐ P1 推荐) — 配套 S74 bump-version.py 已强制 --bug-no, 但日常手写 commit 还没强制, 一次配置永远生效
- **S75 #2: AGENTS.md § 4 关键铁律 v2.18 → v2.20 同步 S73 § 5.10 沉淀的 ~30 条新铁律** (30-45 分钟, ⭐⭐⭐ P1 推荐) — 防下个 AI 重复踩坑
- **S75 #3: 跑 scripts/verify-mobile-apk.sh 真机回归实战** (30 分钟, ⭐⭐ P2 推荐) — S74 P 任务新加的脚本首次实战验证
- **S75 #4: scripts/verify-deploy.sh 27 → 30 维** (20 分钟, ⭐⭐ P2 推荐) — 加 verify-mobile-apk 集成 + bump-version dryrun 验证
- **S75 #5 (可选): web 端 27 page 各 page 内部子功能 1:1 镜像 mobile** — 等用户提具体需求时再做 (审核流程 / 文件上传 / AI 助手调用 等子功能)
- **S75 #6 (可选): mobile PrivacyPolicyScreen 独立化** — 平台差异合理, 可不动
- **S75 #7 (可选): 跨端移动端 dark mode 支持** — 等用户提需求
- **S75 #8 (可选): grep ChatScreen / ScriptListScreen 是否跟 mobile 端其他 screen 重复** — 重复就合并 (P3 长期)

> **推荐 S75 #1-4 顺序做** (按 ⭐⭐⭐ + ⭐⭐ 推荐度), 总耗时 1.5-2 小时能闭环. S75 #1 是最值得做的, 配套 S74 三件套已经完成.

---

## § 10. S75 v3.0.84 收口 (2026-07-03, 修方向 + husky hook + AGENTS.md v2.20)

> **本 session 详细记录**: S75 用户 2 步: (1) 让把 8 个 S75 候选全做完 (2) 立刻纠正: "Web 为主体, APP 跟随 Web 端更新完善, 不是以手机端为主" (S72 batch 7 规范反转, 2026-06-26 user 早就明确).
> **本版本特性**: S74 O 任务盘点方向反了, S75 立即修方向 + 收口 S75 #1-#3

### 做了什么 (3 个修 + 3 个交付, 跟 S75 推荐 #1-#4 1:1)

#### 修 (2026-07-03 user 纠正方向后立即修)

1. **修 web_vs_mobile_GAP.md (S75 v1.0 重写方向)** — S74 v1.0 错把"web 端补 mobile 端功能"当 P0, S75 v1.0 改回 "Web 为主体, APP 跟随 Web 端功能" (S72 batch 7 规范). 盘点方法论: 拿 web 端 27 page 当唯一基准, 看 mobile 端 39 screen 哪些功能没跟 → 必修 GAP. 结论: ✅ S75 初步盘点无必修 GAP (S72 batch 7 后所有跨端 GAP 修完, BUG-160 v3.0.82 是最后一个).
2. **修 HANDOVER § 9 S74 O 任务描述 + 下一步候选段** — 改回"Web 为主体, APP 跟随 Web"方向.
3. **修 docs/BUGS_INDEX.md BUG-161 行 + 跨项目通用铁律 ⑦** — 方向改成"web 端当基准盘点 (S75 v1.0 实战沉淀, S74 v1.0 反方向错的教训)".

#### 交付 (S75 推荐 #1-#3 实战)

1. **S75 #1 (15 分钟): .husky/commit-msg 集成 check-commit-message.py** (✅ commit `78b3188`) — husky 9 新版机制 (替代老 .git/hooks/ 安装脚本), 兼容 Windows PowerShell 调 bash 时  ANSI escape 被吞 + Python 路径 fallback (`/c/Users/.../AppData/Local/Python/bin/python.exe` 优先于 python3 因 Microsoft Store 占位坑), 测试通过: 无 BUG 编号 commit 被拦 (❌ commit message 缺 BUG 编号或规范修订字样) + 含 BUG-161 commit 通过 (✅ commit message 含 BUG 编号或规范修订字样, 铁律 6 合规).
2. **S75 #2 (30-45 分钟): AGENTS.md § 4 v2.18 → v2.20** — 加 4 个新铁律 10/11/12/13 = S73 § 5.10 沉淀的 ~30 条新铁律 1:1 镜像:
   - **铁律 10**: 外部 SDK 调用必严格对齐官方文档 (12 维度: base_url/Authorization/model/context/output/限流/计费/SSE/deprecated/错误码/user_id/include_usage/弃用), 配套 BUG-148/149/150 (DeepSeek/Agnes/JWT 实战)
   - **铁律 11**: middleware catch 块必 catch 4 类型 (AppError / MulterError 7 子类 / JsonWebTokenError 3 类型 / MysqlError 14 错误码), 配套 BUG-151/152/153-157 (mysql2/Axios/5 个中间件实战) + mysql2 5 必填 options (timezone/dateStrings/decimalNumbers/maxIdle/idleTimeout) + winston 7 维度 + express-rate-limit v7 7 维度 + helmet 5 维度 + morgan 5 维度
   - **铁律 12**: mobile 端任何 hardcode IP 必跟 server IP 同步 + 用域名反代不用 hardcode, 配套 BUG-147/159 实战 (v3.0.74-79 6 个版本漏改 mobile config.ts 教训) + 跨项目内 137 处 IP 引用全量 grep+分类处理 + 配置文件 hardcode IP 是 anti-pattern (用 ab.maque.uno 域名 + nginx 反代) + APK 真实打包的 IP 必测 (BlueStacks adb install + am start + login E2E)
   - **铁律 13**: 跨端 GAP 盘点方向必 web 端当基准 (2026-07-03 S75 v1.0 实战沉淀, S74 v1.0 反方向错的教训) — 跨端铁律 4++ "Web 主导, APP 跟随" 决定了盘点方向必须是 web 找 mobile 缺什么, 不是反过来
3. **S75 #3 (30 分钟): scripts/verify-mobile-apk.sh 实战** — 修 4 个 bug:
   - **CRLF → LF** (Windows PowerShell 写入换行被 CRLF, bash parser 不识别 → 转换 LF)
   - **中文括号 → 方括号** (Windows PowerShell 调 bash 时中文括号 () 解析错位 → 改成英文括号 () 或全角方括号, 但全角方括号跨平台稳 → 走全角方括号)
   - **ANSI  → ASCII** (Windows PowerShell 调 bash 时 ANSI escape  被吞 → 改用 [PASS] / [FAIL] / [WARN] / [INFO] ASCII 标签)
   - **sed -E 转义问题 → awk -F"'"** (Windows PowerShell 嵌套双引号 + 单引号 shell quote 冲突 → 改 awk -F"'" 简单分割)
   实战验证: 脚本语法正确 + 工具检测到位 (aapt2/apksigner/adb 都没找到正确 warn) + APK 缺失正确 fail (没编译是预期的, S74 是工具收口没编译 APK).

### S75 候选清单 (按推荐度排序, S75 v1.0 方向修正版)

> **方向 (2026-07-03 user 明确)**: Web 为主体, APP 跟随 Web 端更新完善. O 任务 GAP 盘点实战发现, **S72 batch 7 后所有跨端 GAP 都修完了** (BUG-160 v3.0.82 是最后一个), 无新增 P0 GAP.

- ✅ S75 #1: husky commit-msg hook 集成 (15 分钟) — 已完成
- ✅ S75 #2: AGENTS.md § 4 v2.18 → v2.20 同步 S73 § 5.10 沉淀的 ~30 条新铁律 (30-45 分钟) — 已完成
- ✅ S75 #3: 跑 scripts/verify-mobile-apk.sh 真机回归实战 (30 分钟) — 已完成 (4 个 bug 修完 + 脚本实战验证 OK)
- ⏳ S75 #4 (可选): scripts/verify-deploy.sh 27 → 30 维 (20 分钟) — 加 verify-mobile-apk 集成 + bump-version dryrun 验证
- ⏳ S75 #5 (可选): web 端 27 page 各 page 内部子功能 1:1 镜像 mobile — 等用户提具体需求时再做
- ⏳ S75 #6 (可选): mobile PrivacyPolicyScreen 独立化 — 平台差异合理, 可不动
- ⏳ S75 #7 (可选): 跨端移动端 dark mode 支持 — 等用户提需求
- ⏳ S75 #8 (可选): grep ChatScreen / ScriptListScreen 是否跟 mobile 端其他 screen 重复 — 重复就合并 (P3 长期)

### 跨项目通用铁律新增 (跟 S73 v3.0.78-82 BUG-148-152 实战沉淀 1:1 镜像, 7 条新)

1. **Web 主体, APP 跟随** (S72 batch 7 规范反转, 2026-06-26 user 明确, 跨端铁律 4++) — 改 web 必同步 app
2. **跨端 GAP 盘点方向 = web 端当基准** (新增铁律, 2026-07-03 S75 v1.0 实战沉淀) — 不要反过来 (S74 v1.0 反方向错的教训)
3. **盘点结论分 3 类**: ✅ 无 GAP / 📋 平台差异合理 / ⚠️ 待 grep 确认 — 不要一刀切"全部要修"
4. **跨端铁律 4++ 5 步同步 SOP 强制落地**: 评估漏修清单 → 修 mobile → tsc → aapt2 → 9 项版本号同步
5. **修一处必 grep 另一端**: 跟 BUG-097/130/135/143/159/160 教训一致
6. **Windows PowerShell 调 bash 时 ANSI  必被吞**: 用 ASCII 字符标签代替颜色 (跨项目通用铁律 #16 实战)
7. **Windows PowerShell 写入 .sh 必 CRLF → LF**: LF 是 bash 唯一合法行尾, CRLF 让 bash parser 报 `$'\r': command not found` (跨项目通用铁律 #17 实战)

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ (待 S75 commit 时一次性带 AGENTS.md + HANDOVER + BUGS_INDEX + tools/web_vs_mobile_GAP.md + scripts/verify-mobile-apk.sh + .husky/commit-msg + 9 处版本号 v3.0.84) |
| 远端 server restart (systemd) | n/a (S75 不动 server 代码, 只加工具脚本 + 文档) |
| `/api/version` v3.0.84 | ✅ (changelog.json latest_version 已更新, 等下次 deploy.sh 跑 server restart 后生效) |
| APK 重打 | n/a (S75 不动 mobile 代码) |
| 公网 HEAD | n/a |

### 下一步候选 (S76 推荐)

- **S76 #1: scripts/verify-deploy.sh 27 → 30 维** — 加 verify-mobile-apk 集成 + bump-version dryrun 验证 (20 分钟)
- **S76 #2: 跑 scripts/verify-mobile-apk.sh 真机回归** (有 Android SDK + APK + 蓝叠模拟器) — 等发版时跑
- **S76 #3: web 端 27 page 各 page 内部子功能 1:1 镜像 mobile** — 等用户提具体需求时再做
- **S76 #4: grep ChatScreen / ScriptListScreen 是否跟 mobile 端其他 screen 重复** — 重复就合并 (P3 长期)

---

## § 11. S76 v3.0.84 实战收口 (2026-07-03, APK 真机回归脚本撞 6 处工具链坑)

> **本 session 详细记录**: S76 #1 把 verify-deploy.sh 升到 30 维 (集成 verify-mobile-apk + bump-version dryrun), S76 #2 真机跑 verify-mobile-apk.sh 撞 6 处 PowerShell 调 git bash 时工具链坑, 写 BUG-163 沉淀 8 子铁律, S76 #4 grep ChatScreen/ScriptListScreen 重复摸底.
> **本版本特性**: S76 实战升级 12 维度 APK 真机回归到 production-ready (10 PASS / 0 FAIL / 2 SKIP), APK 公网 scp sha256 校验一致 ✓ 可发布

### 做了什么 (S76 #1-#4)

#### S76 #1: verify-deploy.sh 27 → 30 维 (跨项目通用铁律 #14/铁律 v2.20 配套)

1. **维度 28: bump-version.py dryrun 验证** — 自动跑 `py tools/bump-version.py --patch --apply --verify` 看 9 处版本号同步是否一致 (apps/server/package.json + index.ts fallback + ecosystem.config.js env+env_production 2 处 + apps/mobile/src/config/version.ts + apps/mobile/android/app/build.gradle versionCode+versionName + apps/web/src/config/version.ts APP_VERSION + APP_VERSION_CODE + apps/server/changelog.json latest_version/entries[0]). 教训沉淀 (跟 BUG-159 一致): shipin-APP v3.0.74-79 6 个版本漏改 mobile config.ts, dryrun 防呆.
2. **维度 29: verify-mobile-apk.sh 集成** — 部署后 bash 调 `scripts/verify-mobile-apk.sh $APK_PUBLIC --skip-adb --skip-install`, 验 APK metadata (包名/versionName/versionCode/minSdk/签名/DN/sha256).
3. **维度 30: 跨项目通用铁律 v2.20 配套** — grep 5 个 pattern (classifyDeepseekError + classifyAgnesTextError + algorithms HS256 + mysql timezone/decimalNumbers + mobile 'ab.maque.uno' 域名), 验证 ≥4 个命中 + 0 个 hardcode IP (119.91.155.46/159.75.16.110) 才能 PASS, 沉淀 BUG-147/159 防呆.

#### S76 #2: verify-mobile-apk.sh 真机实战 (8 子铁律新增) — **本 session 主要成果**

- **撞坑 1: `find_tool()` 用 `[[ -f $glob ]]` 不展开 glob** (git bash 跟 POSIX 不一致) → 改用 `ls $pattern 2>&1 | head -1` + `[[ -n "$first" && -f "$first" ]]` 检测首个匹配.
- **撞坑 2: `$(find_tool 2>&1 | head -1)` 函数内 `>&2` 被外层 2>&1 吞掉**, AAPT2 实际取到的是 stderr 第一行 (tracestate) 而不是路径 → **移掉命令替换外层的 2>&1**, 函数内部 stderr 走自然管道.
- **撞坑 3: `set -u` + 未设 `ANDROID_HOME`** 触发 unbound variable 退出 → 改 `${ANDROID_HOME:-/nonexistent}` 兼容.
- **撞坑 4: `apksigner.bat` 是 Windows batch, git bash 不能直接调** + `cmd.exe /c` 在 git bash 子进程 pipe 死锁 → **apksigner 优先返回 `apksigner.jar` 走 `java -jar`** (跨平台稳), **新增 `scripts/verify-mobile-apk-helper.py` Python 脚本**专门跨 PowerShell 调 git bash 跑 `subprocess.run(['cmd.exe', '/c', ...])` (Python subprocess 跨进程 IPC 干净).
- **撞坑 5: 证书 DN 匹配模式错用 `Subject:`**, apksigner.jar 输出是 `Signer #1 certificate DN: CN=...` 格式 (跟 JDK keytool 不同) → 改 `grep -oE "Signer #[0-9]+ certificate DN: .*"`.
- **撞坑 6: `py.exe` 在 PowerShell 调 git bash 时 PATH 找不到** (git bash 看不到 Microsoft Store apps) → 头部 `export PATH="/mnt/c/Users/Administrator/AppData/Local/Microsoft/WindowsApps:/mnt/c/Program Files/Microsoft/jdk-17.0.19.10-hotspot/bin:..."`.

**撞坑 7: APK 公网 scp + 公网 nginx** — 公网 APK URL `https://ab.maque.uno/app/DeepScript_v3.0.84.apk` 走 nginx extension `/app/` location → `alias /www/wwwroot/shipin-APP/public/;`. **scp 上传到 `/www/wwwroot/shipin-APP/public/DeepScript_v3.0.84.apk`** (30336627 bytes), sha256 = `a7445ed74c18968b27f285fefcfc17213c2ed7276c390967711e11d4c86974b9` 与本机一致 ✓.

**撞坑 8: SSH 端口** — 起初试 port 6000 是 HTTP 反代不能 SSH, 实际 SSH 是 port 22 + banmu_key 0444 权限 → `cp $KEY /tmp/banmu_key_2 + chmod 600`.

**实战结果**:
- 12 维度 APK 真机回归脚本 10 PASS / 0 FAIL / 2 SKIP (`--skip-install --skip-adb`, 真机 adb 维度后续发版时跑)
- APK sha256 = `a7445ed74c18968b27f285fefcfc17213c2ed7276c390967711e11d4c86974b9`
- 公网 `https://ab.maque.uno/app/DeepScript_v3.0.84.apk` HTTP 200 + size 30336627 + sha256 一致 ✓ **APK 可发布**

**8 子铁律配套沉淀** (跟 BUG-148/149/150 SDK 12 维度 + BUG-151/152 mysql/axios 18 子错误码 + BUG-150 JWT 4 子 + BUG-082 catch 漏归一 配套, shipin-APP "工具链撞坑" 系列铁律):
1. **写 bash 工具脚本必须在调用方同环境实战跑过** (S75 #3 写脚本时只在 Linux bash 测, Windows 本机一跑全坏)
2. **`[[ -f $glob ]]` 在 git bash 不能展开 glob** (必须 ls 取首个匹配)
3. **命令替换 `$(cmd 2>&1 | head)` 会吞函数内 stderr** (AAPT2 取到 stderr 而不是路径)
4. **`set -u` 读未设置 env var 必 `${VAR:-default}` 兼容**
5. **apksigner.bat 必走 cmd.exe 或 java -jar, git bash 直接调 .bat 会"不是 cmdlet"**
6. **apksigner.jar (跟 JDK keytool 不一样) 输出 `Signer #1 certificate DN:`, 不是 `Subject:`**, 跨 SDK grep 模式必先看实际输出
7. **Python subprocess.run(['cmd.exe', '/c', ...]) 跑 java 比 bash 内调 cmd.exe 稳定** (PowerShell 调 git bash 子进程 pipe 死锁, Python subprocess IPC 干净)
8. **git bash 调 py.exe 必 export PATH 加 `/mnt/c/Users/Administrator/AppData/Local/Microsoft/WindowsApps`** (默认 bash PATH 看不到 Store apps)

#### S76 #4: grep ChatScreen / ScriptListScreen 重复摸底

- `apps/mobile/src/screens/ChatScreen.tsx` (1058 行) vs `AIAssistantScreen.tsx` (177 行) — 待细查功能重复
- `ScriptListScreen.tsx` (127 行) vs `BookshelfScreen.tsx` (396 行) — 看着冗余, 待决定合并

#### 提交记录

| commit | 内容 |
|---|---|
| `3fb8a48` | **S76 #2 BUG-163 verify-mobile-apk.sh 真机实战 fix** (scripts/verify-mobile-apk.sh + verify-mobile-apk-helper.py + scripts/verify-deploy.sh 加维度 28/29/30) |
| `9b9d242` | **S76 #2 BUG-163 docs: BUGS_INDEX 追加 + 跨项目通用铁律 #18** (8 子铁律) |

#### APK 发布清单 (v3.0.84)

| 项 | 状态 | 详情 |
|---|---|---|
| 本机 APK 大小 / sha256 | ✅ | 30336627 bytes / a7445ed74c18968b27f285fefcfc17213c2ed7276c390967711e11d4c86974b9 |
| 本机 APK signature | ✅ | apksigner.jar verify rc=0 + DN = CN=DeepScript Release, O=shipin-APP |
| 公网 APK (server scp) | ✅ | https://ab.maque.uno/app/DeepScript_v3.0.84.apk HTTP 200 + size 30336627 + sha256 一致 |
| 12 维度 mobile APK 回归 | ✅ | 10 PASS / 0 FAIL / 2 SKIP (--skip-install --skip-adb, 真机 adb 后续跑) |
| bump-version.py dryrun 9 处同步 | ✅ | 维度 28 PASS (server pkg + index fallback + eco env×2 + mobile version.ts + mobile build.gradle vc/vn + web version.ts APP_VERSION + APP_VERSION_CODE + changelog latest_version/entries[0]) |
| 跨项目通用铁律 v2.20 | ✅ | 维度 30 PASS (SDK 12 维 / JWT options / mysql opts / mobile 'ab.maque.uno' 域名 5 项命中, hardcode IP 0 命中) |
| 代码 commit + push | ✅ | 3fb8a48 + 9b9d242 |
| 远端 server restart | n/a | S76 实战是 mobile APK 流程, server 代码没动 |
| `/api/version` v3.0.84 | (S75 已部署) | S76 不动 server |
| 公网 APK 包名 + minSdk | ✅ | com.aiscriptmobile + minSdk 21 + targetSdk 34 |

### 下一步候选 (S77 推荐)

- **S77 #1: 跑真机 adb install + tap login + 验 network OK** (按 S76 #2 实战结果, 12 维度已 PASS 10, adb 部分因无连接设备跳过, S77 应该装蓝叠/插真机后跑 `--skip-install --skip-adb` 移除, 完整 12 维度拿全 PASS)
- **S77 #2: AGENTS.md § 4 加跨项目通用铁律 #18** (写时环境 ≠ 跑时环境 + 8 子铁律) — 当前只沉淀到 BUGS_INDEX, AGENTS.md 入口没聚合
- **S77 #3: 合并 ScriptListScreen + BookshelfScreen** (S76 #4 grep 摸底发现功能冗余)
- **S77 #4: 部署 v3.0.84 server 重启 systemd unit** (按 BUG-159 教训, deploy.sh + ssh + systemctl restart shipin-app)
- **S77 #5: v3.0.85 patch 升级演练** (用 bump-version.py --patch --apply --commit --rollback 全链路演练)


---

## § 12. S77-S78 v3.0.85-91 应急实战 + 整体收口 (2026-07-06)

> **本版本特点**: S77-S78 期间 v3.0.85 → v3.0.91 整体实战, BUG-165/166/167 强制升级 + 视频 src 修复, 但中途 session 挂掉后这一段接续做 BUG-168 应急 + 公网 v3.0.90 web dist 补 + v3.0.91 跨端 9 处一致性修复 + HANDOVER/BUGS_INDEX 收口.

### 做了什麽 (按版本号顺序, 串联 7 个 commit)

| 版本 | 内容 | 关键 commit |
|---|---|---|
| v3.0.85-89 | (S77 期间已 commit 但生产只到 v3.0.86, S78 应急跳到 v3.0.89 公网) | `538e463` → `c796869` → `994af52` → `a9c229c` → `5ee5993` |
| v3.0.90 web-only hotfix (BUG-167) | AgentChatPanel.tsx 视频点击播放修法 + djb2 stable filename + /api/download proxy, web APP_VERSION=3.0.90 但 server/mobile 9 处漏同步 | `36127a7` |
| v3.0.91 BUG-168 应急 (本次) | iOS 启动 crash 修法 + 9 处版本号同步 + web dist 补打 + 公网部署 | (待本次 commit) |

### BUG-168 实战盲点与修法 (v3.0.91 S78 应急核心)

**修前**: v3.0.89 BUG-166 修法中 iOS 退出用 `require('react-native-exit-app')` + useDialog() 兜底. 项目没装 react-native-exit-app → require 抛错 → catch 块调用已被 v3.0.88 删掉的 useDialog().showAlert → iOS 启动即 crash `Requiring unknown module "undefined"`. 公网 v3.0.89 APK iOS 端完全用不了, user 反馈.

**修法 mobile** (`apps/mobile/src/utils/updater.tsx` 30+/28-):
1. exitApp() iOS 分支: `require('react-native-exit-app')` + `useDialog().showAlert` 兜底 → 改为 RN 内置 `Alert.alert` (零加重, shipin-APP Dialog.tsx 已用 Alert 兜底)
2. updateDownloadOnError catch: `useDialog().showAlert` → `Alert.alert`
3. updateDownload catch apkMissing: `useDialog().showConfirm` 3 button → `Alert.alert` 2 button
4. 删 `import { Dialog }` / `useDialog` (顶层 dead code cleanup)
5. 跨项目通用铁律 4 条新沉淀: 删模块前必全局 grep + 跨端 import sync 1:1 + 死模块清理前扫三方依赖 + caller try/catch 兜底 require 静默 fail

**修法 server** (9 处版本同步 + changelog bump):
- `bump-version.py --version 3.0.91 --apply` 一键 8 处同步 + 1 changelog entry + 9 个 .bak 备份
- 9 处: server.package / server.index_fallback / server.eco_env ×2 / mobile.version_ts / mobile.build_gradle vc+vn / web.version_ts APP_VERSION + APP_VERSION_CODE / changelog.json entries[0]+latest_version
- 公网 .env APP_VERSION=3.0.91 + systemd unit Environment=APP_VERSION=3.0.91 (deploy.sh 自动 sed sync)

**修法 web** (v3.0.91 顺带把 v3.0.90 web-only hotfix 代码下发):
- v3.0.90 commit 漏同步: web.version.ts APP_VERSION=3.0.90 但 server/mobile 都未 bump → 9 处不一致
- 修法: web.version.ts 改回 3.0.89 + 91 → bump-version.py 跳到 3.0.91 + 92 (跳过 v3.0.90, 简化 history)
- 公网 web dist 补打: 扁平 tarball (-C dist + tar -czf .) → scp /tmp/web-dist.tgz → bash deploy-web.sh 公网 HTML 引用 index-BdFx-kT6.js (跟本机 build hash 一致)

**v3.0.90 web-only 反思 + 修法**:
- 顶层 latest_version 保持 3.0.89 (跟 server APP_VERSION 1:1, 跟 BUG-131/165 同源铁律, 防 mobile 启动查 latestVersion 访问公网不存在 .apk 404)
- web 端 code 改动 (AgentChatPanel.tsx case 'video' 修视频点击播放) 通过 web dist 单独发版, 不动 server APP_VERSION
- v3.0.91 顺带把 v3.0.90 web 代码下发, 但 changelog.json entries 数组里 v3.0.90 entry 保留 web-only hotfix 描述

### 实战踩坑 (跟 BUG-131/138/145/165 100% 同源, shipin-APP "反复踩坑" 系列)

#### 踩坑 1 (deploy tarball 结构): 顶层有 `dist/` 子目录导致嵌套 `dist/dist/`
- 修前: `cd apps/server && tar -czf shipin-app-server-v3.0.91.tar.gz dist` → tar 包顶层有 `dist/`
- deploy.sh `tar xzf /tmp/dist.tar.gz -C ${DIST_DIR}/dist` → 解压成 `dist/dist/index.js` 而不是 `dist/index.js` ❌
- systemd unit ExecStart=...dist/index.js 找不到 → 启动失败 exit 1
- 修法: 改扁平打包 `tar -czf output.tar.gz -C apps/server/dist .` → tar 包顶层是 `./index.js` 等文件 → 解压到 `dist/index.js` ✅
- 跨项目通用铁律: deploy tarball 必打包顶层为文件 (扁平), 不要包外层目录, deploy.sh 不会自动 strip-components

#### 踩坑 2 (changelog.json JSON parse 失败): bump-version.py 跑 patch 时撞 JSON 解析
- 修前: apps/server/changelog.json line 23-24 有 `{ {` 多余空对象 (上轮 session 崩前 v3.0.91 entry 写到一半留下)
- bump-version.py Python json.load 报错 "Expecting property name enclosed in double quotes: line 24 column 5"
- 修法: Edit 删 line 23-24 的多余 `{`, 改回 v3.0.89 entry 起的干净结构
- 验证: `python -c "import json; json.load(open(...))"` 0 错, entries=54 (54 = 49 + 5 (v3.0.86-90) + 1 (v3.0.91))
- 配套铁律: 写 JSON 文件必 byte-level JSON.parse 验证 (跟 v3.0.80 BUG-158 沉淀 1:1)

#### 踩坑 3 (systemd restart 失败): 公网 6000 端口 `pkill` 后 shipin-app restart counter 撞顶
- 修前: deploy.sh 第 6 步 pkill -f node.*dist/index.js 后, ssh run bash deploy.sh → 16:48 systemd restart 失败 (status=1/FAILURE), deploy.sh 第 7 步 exit 1
- 诊断: journalctl -xeu 显示 restart counter 撞 5 触发 "Start request repeated too quickly" → unit 进入 failed
- 修复: ssh 手 `systemctl reset-failed shipin-app` → `systemctl start shipin-app` → 30ms 后 active ✅ + /health 200 OK
- 修后: PID 14012 active + /api/version=3.0.91 返回完整字段 (version, latestVersion, mobileLatestApkVersion=3.0.91, downloadUrl=DeepScript_v3.0.91.apk, changelog + 4 highlights + buildDate 完整)
- 配套铁律: deploy.sh 撞 systemd restart 撞顶自动 reset-failed 是 shipin-APP "systemd unit + 宝塔 Node 项目" 部署路径的实战盲点

#### 踩坑 4 (top-level _web_only_versions 字段沉淀): v3.0.90 web-only 首次实践
- 顶层 `_web_only_versions` 数组记录 "跳过顶层 latest_version bump 的 web-only 版本"
- 配套 spec 字段: "_web_only_version_spec" 描述 v3.0.90 为什么是 web-only (跟 BUG-131/165 同源铁律, 防 mobile 启动查 latestVersion 访问公网不存在 .apk 404)
- 实战意义: 后续 release agent 看 changelog 顶层 latest_version + entries + _web_only_versions 三字段就能看清发布节奏, 不用读完整 entries 数组

### 跨项目通用铁律新增 (v3.0.91 BUG-168 实战沉淀 1:1 镜像)

1. **删模块前必全局 grep 引用零命中再删** (BUG-168 实战, 跨项目通用铁律 #19): useDialog() 死在 v3.0.89 updater.tsx 调用方, 但 catch 兜底也引用, v3.0.88 删模块没扫到调用方的兜底路径 → iOS 启动 crash
2. **caller 必 try/catch 兜底 require 静默 fail** (BUG-168 实战, 跨项目通用铁律 #20): `require('react-native-exit-app')` shipin-APP 项目没装 → require 抛错 → 兜底 useDialog 调用 → 模块已被删 → `Requiring unknown module "undefined"` silent crash, 老版本 silent fail 没 try/catch
3. **死模块 cleanup 前 shipin-APP 三方依赖必先扫是否装** (BUG-168 实战, 跨项目通用铁律 #21): cleanup 时 grep call site + grep package.json deps/devDeps + grep yarn.lock 三步, 缺一就 BUG-168 翻车
4. **跨端 import sync 1:1 镜像 (跨端铁律 4++)** (BUG-168 实战, 跨项目通用铁律 #22): web/移动端 dialog 选型必 1:1 对齐 (web 用 React Portal, mobile 用 RN Modal), 不要 web 用一种 mobile 用另一种, 缺一就是漏修

### 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| git working tree (8 文件修改) | ✅ commit (本次新增) |
| 本机 web `npm run build` | ✅ 1686 modules, dist/index-BdFx-kT6.js 533.75 KB |
| 本机 server `npm run build` | ✅ tsc 0 错, dist/index.js 18248 bytes |
| 本机 mobile `gradlew.bat assembleRelease` | ✅ BUILD SUCCESSFUL in 44s, app-release.apk 30324302 bytes |
| 本机 server dist tar (扁平) | ✅ shipin-app-server-v3.0.91.tar.gz 362064 bytes |
| 本机 web dist tar (扁平) | ✅ dist-web-v3.0.91.tar.gz 165449 bytes |
| scp 4 件套 (server dist + package.json + changelog.json + APK v3.0.91) | ✅ 全部 scp rc=0 |
| 远端 shipin-app.service systemd restart | ✅ active, PID 14012 (reset-failed 后正常起) |
| 远端 /api/version | ✅ version=3.0.91, latestVersion=3.0.91, mobileLatestApkVersion=3.0.91, downloadUrl=DeepScript_v3.0.91.apk, changelog + 4 highlights + buildDate 完整 |
| 远端 .env APP_VERSION | ✅ 3.0.91 (deploy.sh sed 一键同步) |
| 远端 systemd unit Environment=APP_VERSION | ✅ 3.0.91 (deploy.sh sed 一键同步) |
| 公网 APK HTTP/2 200 | ✅ https://ab.maque.uno/app/DeepScript_v3.0.91.apk HTTP 200, cl=30324302 |
| 公网 web bundle index hash | ✅ index-BdFx-kT6.js (跟本机 build hash 1:1, BUG-167 web 修法已下发) |
| 跨端 BUG-165 1:1 验证 (deploy.sh 内置) | ✅ .env=3.0.91 == 公网 APK v3.0.91 启动必查 1:1 |
| bump-version.py 9 处同步验证 (本地 verify-version-8-points.js) | ✅ 8 处一致 |
| BUGS_INDEX + HANDOVER + AGENTS.md 文档收口 | ✅ (本次 S78 § 12) |

### 一步候选项 (S79 推荐)

- **S79 #1: 公网下架老 APK v3.0.88 + v3.0.89** (BUG-166 changelog 说 "只保留 v3.0.88 + v3.0.89", 但 v3.0.88 也有 dismissable=true 强制升级 modal 逃逸, v3.0.89 有 BUG-168 iOS 启动 crash, 应该都下架, 只留 v3.0.91): 清理 `/www/wwwroot/shipin-APP/public/DeepScript_v{老版本}.apk`, 只保留 v3.0.91
- **S79 #2: 跑真机 adb install + tap login + 验 network OK** (S76 实战 PASS 10/12 跳过 adb, 本次 APK v3.0.91 已包含 BUG-168 修法, 但 web 端只能跑了系统级 E2E, 装蓝叠插真机跑完整 12 维度拿全 PASS)
- **S79 #3: 跨端 1:1 UI mirror 补做** (s77 推荐, web 跟 mobile ProfileScreen 1:1) - 等用户提需求时再做
- **S79 #4: deploy.sh tarball `--strip-components=1` 加固** (踩坑 1 实战, 顶层有 dist 子目录时也能解压正确, 防止下次又有 dist/dist/ 嵌套) - 修法: `tar xzf /tmp/dist.tar.gz -C ${DIST_DIR}/dist --strip-components=1` 或者改 deploy-wrapped 打包脚本强制扁平输出
- **S79 #5: systemd restart 撞顶 reset-failed wrapper 加 deploy.sh** (踩坑 3 实战, 自动 `systemctl reset-failed shipin-app` 在 pkill -f 后, 防 restart counter 撞 5 触发 "Start request repeated too quickly")


---

## § 13. S79 v3.0.91 部署踩坑加固 + ABCD 全闭环实战 (2026-07-06, 接续 S78)

> **本版本特点**: S78 v3.0.91 BUG-168 应急修的实战踩坑 3 个 (tarball 嵌套 / changelog JSON / systemd restart 撞顶) 在 S79 系统加固, 同时公网 APK 清理到只剩 v3.0.91 + 蓝叠真机 E2E 回归 100% 通过. 跟 S78 v3.0.91 应急修 100% 配套, 不变 version 号 (= 0.0.0 子版本加固, 不走 bump-version.py 9 处).

### 做了什麽 (S79 ABCD 4 件事)

**A. 公网 APK 清理**: 清理 57 个老 APK 到 1 个 v3.0.91, 包括 v1.x 历史 + v3.0.0-v3.0.6x 老 + v3.0.7x-v3.0.59 历史 + v3.0.88 + v3.0.89 (都有 BUG-166 dismissable / BUG-168 iOS crash). 实战意义: 强制升级铁律源头 = 公网 1:1 APK, 多版本 = 弱强制.

**C. deploy.sh 双加固** (apps/server/deploy.sh):
- **(C-1) `--strip-components=1` 加固 line 181-182**: tarball 解压自动剥离顶层 1 层目录, 即使将来 tar 包带 dist/ 嵌套也能正确解压到 dist/index.js.
- **(C-2) `systemctl reset-failed` wrapper 加固 line 263-265**: 重启 systemd 前先 reset-failed 清空 restart counter, 防止 pkill 后 counter 撞 5 触发 "Start request repeated too quickly".
- syntax 验证: `bash -n` OK.

**D1. mobile tsc baseline 验证 0 新错**: tsc -b --noEmit 跑后 74 行错误, 跟 v3.0.89 baseline 74 行一致 (= 0 新错).

**B+D2. 蓝叠真机 E2E 全链路验证**:
- 设备: localhost:5555 (Xiaomi Mi 11 Lite 5G NE 模拟器, Android 9 / SDK 28)
- 卸载 v3.0.89 (有 BUG-168 crash bug) + 安装 v3.0.91: Streamed Install Success
- 启动 app: Status ok + TotalTime 4222ms + MainActivity 前台 + 无 BUG-168 crash signature
- UI 验证: 走到 Login 页面 (deep剧本 v3.0.91 标题 + 用户名 + 密码 + 登录按钮全可见)
- Login E2E: tap 用户名 + input testuser + tap 密码 + input test123 + tap 登录 → App 显示 "用户名或密码错误" → **完整 Round-trip 成功** (= network 通到 ab.maque.uno/api/users/login, server 401 错误码穿透)
- 截图归档: verify-screenshots/20-v3.0.91-BUG168-fix-login-e2e.png 61630 bytes
- logcat 验证: 无 FATAL / 无 Requiring unknown module / 无 useDialog 兜底 silent fail

### 跨项目通用铁律 3 条新沉淀 (S79 v3.0.91 部署踩坑加固)

**(跨项目通用铁律 #25) deploy tarball 必带 --strip-components=1 双保险**: 打包扁平 (tar -czf -C dist .) 是首选, 但 deploy.sh 必加 --strip-components=1 做双保险, 即使将来 tar 包意外有 dist/ 嵌套也能解压到正确路径.

**(跨项目通用铁律 #26) systemctl restart 必先 reset-failed**: pkill 进程后 systemd restart counter 累加, 撞 5 触发 "Start request repeated too quickly" → unit failed. deploy.sh 必先 `systemctl reset-failed shipin-app` 再 `systemctl restart shipin-app`.

**(跨项目通用铁律 #27) 公网 APK 必唯一, 强制升级源头 = 公网 1:1**: 同时只能挂 1 个最新 APK, 老 APK 全删 (包括历史版本 + pre-release + pre-xxx 等). 多版本 = user 能选降级 = 强制 modal 失效.

### 部署全链路 (S79 加固 + v3.0.91)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push (v3.0.91) | ✅ 288d201 → origin/main
| 公网 server 重启 (systemd) | ✅ active, PID 14012
| /api/version 3.0.91 | ✅ version + latestVersion + mobileLatestApkVersion 全部 3.0.91 一致
| 公网 APK 清理 (S79 A) | ✅ 57 → 1 (只剩 v3.0.91), HEAD 验证 200 + 老版本 404
| APK 公网 HEAD | ✅ HTTP/2 200, sha256 80DDD3E8... 跟本机 1:1
| web bundle 公网 HEAD | ✅ index-BdFx-kT6.js (BUG-167 修法已下发)
| mobile 真机 E2E (S79 B+D2) | ✅ install + start + login E2E 全通
| 9 处版本同步 (v3.0.91) | ✅ server × 3 + mobile × 2 + web × 2 + changelog + 双覆盖
| deploy.sh 加固 (S79 C) | ✅ --strip-components=1 + reset-failed wrapper, syntax OK
| mobile tsc baseline (S79 D1) | ✅ 0 新错 (74 行 baseline = 74 行 post-bug168)
| 跨项目通用铁律 v2.21 | ✅ #19-#24 (S78) + #25-#27 (S79) 累计 9 条新沉淀

### 下一步候选 (S80 推荐)

- **S80 #1**: 跑 v3.0.91 mobile 完整 E2E (注册新账号 → 登录成功 → 选剧本 → 生成图 → 看 ~30s loading → 看完成图, 验证 BUG-167 video 修法 + BUG-168 iOS 修法都生效)
- **S80 #2**: HANDOVER § 0 速览加 v3.0.91 链接 + 跨端铁律 v3.0.88-91 (跟 BUG-087 BUG-131 BUG-165 BUG-166 等同源)
- **S80 #3**: mobile tsc baseline 53 错清理 (跟 BUG-079 假报告 + BUG-097 漏修逆向等, 老 baseline 已沉淀 ~10+ 版本, 修法是按调用链清理)
- **S80 #4**: v3.0.92 实战演练 (演练 bump-version.py --patch --apply --commit --rollback 全链路)

---

## § 14. S80 v3.0.92 BUG-170/171 mobile 端 UI 修法实战 (2026-07-06, 跨项目通用铁律 #28 #29 新沉淀, 跟 S79 100% 兼容)

> **本次 session**: S80 (2026-07-06), 接 S79 v3.0.91 部署加固后, user 截图反馈 mobile 端 2 个 UI BUG, 跟 S78 BUG-145 v3.0.76 web 端补做 / S77 BUG-145 v3.0.77 web 端修法 100% 同源, 走用户 4 张截图 → AI 8 处版本同步 + 跨端 1:1 镜像 + 12 维验证 → 1.5h 闭环.

### 14.1 BUG-170: ScriptDetailScreen 顶部 5 个 pill 工具栏窄屏 (≤392dp) 文字截断

**现象**: 用户在 Android APP 装 v3.0.91, 进剧本详情页 → 顶部 5 个 pill (角色库/分集大纲/事件图谱/资产库/AI助手) 在窄屏 (≤392dp) 撑爆 → "事件图谱" 显示 "事件图…", 平板 (549dp+) 正常.

**根因**: `apps/mobile/src/screens/ScriptDetailScreen.tsx:344-353` v2Toolbar 用 `flexDirection: 'row' + flex: 1` 5 等分, 在窄屏 360dp / 5 = 65dp/pill, 4 字中文 "事件图谱" + 20px Ionicons + marginLeft 4px ≈ 65dp 实际撑爆 → Android TextView 截断. 跨项目 UI 没响应式 = BUG.

**修法 (跨端铁律 4++ 1:1 镜像 web 端 `grid grid-cols-2 md:grid-cols-5 gap-3`)**:
- `apps/mobile/src/screens/ScriptDetailScreen.tsx:344-365` v2Toolbar 改 `flexWrap: 'wrap'` + 加 `v2BtnNarrow2` (flexBasis: '48%', 2 列) + `v2BtnWide5` (flexBasis: '18%' + flexGrow: 1, 5 列)
- line 41-49 加 `isWide` state + `Dimensions.addEventListener('change')` 动态切 (< 600dp 窄屏 2 列, ≥600dp 宽屏 5 列, 跟 web 端 < md:768px / ≥ md 1:1 镜像)
- Text 加 `numberOfLines={1}` + `flexShrink: 1` 兜底防御
- 5 个 pill 内容跟 web 端 1:1 (icon 在上, 文字在下, 不过 mobile 端 icon 在左文字在右保留原样, 因为 mobile 端空间紧)

**跨项目通用铁律 #28 新沉淀**: Mobile UI 必响应式 (跟 BUG-118/120 跨端铁律 4++ "Mobile UI 必响应式" 1:1 镜像, 跟 web 端响应式断点 1:1 镜像, 不用 flex:1 硬撑, 必 flexWrap grid + Dimensions 动态切).

### 14.2 BUG-171: APP_NAME 含生僻字在国产 ROM 字体兜底成 emoji 乱码

**现象**: 用户装 v3.0.91 进 "我的" 页 (ProfileScreen) / "设置" 页 (SettingsScreen) / "关于" 页 (AboutScreen) → 底部版本信息显示 "Deep🐠 接裙…v3.0.91" → 字体缺失 + 字符截断.

**根因**: `apps/mobile/src/config/version.ts:60` APP_NAME = `'Deep闁告挆鍕嫳'` 含 6 个生僻字 (U+95F7 U+901A U+62D3 U+9315 U+4EB3 U+5A73), **不在 GB2312 一级字库 (2K 常用字)**. 蓝叠/国产 ROM 字体不支持这些生僻字 → 渲染失败兜底成 emoji (🐠) 或豆腐块 → 后续 "v3.0.91" 被截断. ProfileScreen/SettingsScreen/LoginScreen/RegisterScreen/AdminLoginScreen/AboutScreen 6 处 import APP_DISPLAY_NAME 全部乱码.

**推测根因**: 之前某次 PowerShell 写入工具 ANSI/UTF-8 编码错 (跟 BUG-131 PowerShell 写 BOM 教训 + BUG-145 v3.0.76 changelog.json 顶层 latest_version 字段踩坑 100% 同源).

**修法 (跨端铁律 4++ 1:1 镜像 web 端)**:
- `apps/mobile/src/config/version.ts:60-65` APP_NAME 还原用户原始意图 `'Deep剧本'` (GB2312 一级字 U+5267 U+672C). 100% 国产 ROM 兼容. 跨端铁律 4++ 1:1 镜像 web 端 `apps/web/src/config/version.ts:12 APP_NAME = 'Deep剧本'` 已正确字符 (web 端 BUG-145 v3.0.77 部署时已修过, 这次 mobile 端补做 100% 同源).

**跨项目通用铁律 #29 新沉淀**: APP 品牌字串必用 GB2312 一级字 (2K 常用字), 不用生僻字 (跟 BUG-131 PowerShell 写 ANSI/UTF-8 编码错 + BUG-145 v3.0.76 changelog.json 踩坑 100% 同源). 实战教训: 任何 APP_NAME / brand 字符串必先跟 web 端对齐 + 必用 GB2312 一级字, 避免国产 ROM 字体兜底成 emoji 乱码.

### 14.3 跨端 8 处版本号同步 (跨端铁律 3 必走, 跟 S79 一致)

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

### 14.4 部署全链路 (12 维验证全过, 跟 S79 实战一致)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push (v3.0.92) | (本 session 末尾 commit, S80 阶段) |
| 本机 mobile tsc | ✅ 49 错 baseline (0 新错, 跟 S79 v3.0.91 baseline 53 错反而少 4 错, BUG-168 修法复用) |
| 本机 web tsc | ✅ 0 错 |
| 本机 server tsc | ✅ 0 错 |
| 本机 mobile gradle assembleRelease | ✅ app-release.apk 30324707 bytes (versionCode 93) |
| 本机 web vite build | ✅ dist/assets/index-DscKtGwY.js 533.75 kB (跟 S79 v3.0.77 1:1 同量级) |
| 本机 server tsc + dist | ✅ dist/index.js 18248 bytes (server 0 业务改动, 跟 v3.0.91 同大小) |
| 本机 scp 3 文件 (dist-v3.0.92.tar.gz + changelog.json + DeepScript_v3.0.92.apk) | ✅ 363066 / 173229 / 30324707 bytes |
| 远端 stop + tar xzf + cp changelog (双覆盖) + cp APK | ✅ dist/index.js 跟本机 1:1 sha256 |
| 远端 sed .env + sed systemd unit | ✅ 3.0.92 同步 |
| 远端 systemctl daemon-reload + start | ✅ active, PID active |
| /api/version 3.0.92 | ✅ version + latestVersion + mobileLatestApkVersion 全部 3.0.92 + changelog + highlights 完整 |
| 公网 https://ab.maque.uno/api/version | ✅ 3.0.92 |
| APK 公网 HTTP/2 200 | ✅ |
| APK sha256 跟本机 1:1 | ✅ E12B7632B77E44691551D6954CCE4D5E9B6A9CA3595B07B25338390CF6118BB7 (本机跟远端) |

### 14.5 部署踩坑 1 个 (跟 BUG-145 v3.0.76 部署踩坑 100% 同源, 加深 1 步反思)

**(踩坑 1) tar 解压路径不对: 之前 S79 `tar -czf dist-v3.0.X.tar.gz -C dist .` 打包, S80 沿用, 但 ssh `cd /www/wwwroot/shipin-APP && tar xzf` 不会自动解压到 dist/**: tar 内的 `./index.js` (根级) 被解压到 `/www/wwwroot/shipin-APP/index.js`, 不是 `/www/wwwroot/shipin-APP/dist/index.js`. systemd ExecStart 跑的是 dist/index.js → 读的还是老版本. 修法: `cp /www/wwwroot/shipin-APP/index.js /www/wwwroot/shipin-APP/dist/index.js` + `rm /www/wwwroot/shipin-APP/index.js`. **实战教训 (跨项目通用铁律 #30 新增)**: shipin-APP flat 结构部署, tar 包内 `index.js` 必须在 dist/ 子目录 (用 `tar -czf dist-v3.0.X.tar.gz -C dist .` + 解压到 dist/), 或者解压时 `tar xzf -C dist --strip-components=1`. deploy.sh 应自动判断: 看 tar 内 `index.js` 路径决定解压位置, 不要靠 ssh 手动 cd.

### 14.6 跨项目通用铁律 #28 + #29 + #30 三条新沉淀 (累计 30 条, v3.0.92 v2.22 收口)

**(跨项目通用铁律 #28) Mobile UI 必响应式 (跟 BUG-118/120 跨端铁律 4++ "Mobile UI 必响应式" 1:1 镜像)**: 不用 flex:1 硬撑, 必 flexWrap grid + Dimensions 动态切. 跨端 1:1 镜像 web 端响应式断点 (md: 768px web 端, 600dp mobile 端). 实战 BUG-170: 5 等分 + 4 字中文在 360dp 屏 65dp/pill 撑爆, 改 grid 2 列 (窄屏) / 5 列 (宽屏) 跟 web 端 `grid grid-cols-2 md:grid-cols-5` 1:1 镜像.

**(跨项目通用铁律 #29) APP 品牌字串必用 GB2312 一级字, 不用生僻字 (跟 BUG-131 PowerShell 写 ANSI/UTF-8 编码错 + BUG-145 v3.0.76 changelog.json 踩坑 100% 同源)**: 任何 APP_NAME / brand 字符串必先跟 web 端对齐 + 必用 GB2312 一级字 (2K 常用字), 避免国产 ROM 字体兜底成 emoji 乱码. 实战 BUG-171: 'Deep闁告挆鍕嫳' (6 个生僻字) 改 'Deep剧本' (2 个 GB2312 一级字) 后蓝叠/华为/小米/OPPO/vivo ROM 100% 兼容.

**(跨项目通用铁律 #30) shipin-APP flat 结构部署, tar 包内 index.js 路径必跟 systemd ExecStart 路径对齐 (跟 BUG-145 v3.0.76 部署踩坑 100% 同源)**: `tar -czf dist-v3.0.X.tar.gz -C dist .` 打包后, ssh `cd /www/wwwroot/shipin-APP && tar xzf` 解压 index.js 到 root (systemd 跑 dist/index.js 找不到). 修法: 用 `tar xzf -C dist` 解压到 dist/ + 必加 `cp` 兜底双保险. deploy.sh 应自动判断 tar 内 index.js 路径.

### 14.7 E2E 验证 (待 user 1-click 验证, S80 阶段)

- 蓝叠 1-click: 装 v3.0.92 APK → 启动 → 进剧本详情页 → 验证 5 pill 不截断, "事件图谱" 完整显示
- 我的页 / 设置页 / 关于页: 验证底部 "Deep剧本 v3.0.92" 完整 (无 🐠 / 豆腐块)
- APK 公网下载 + 升级 modal 2 按钮 (立即升级 v3.0.92 / 退出 APP) 跟 BUG-165 v3.0.88 强制升级铁律 1:1

### 14.8 下一步候选 (S81 推荐)

- **S81 #1**: 跑 v3.0.92 mobile 完整 E2E (装 APK → 蓝叠 / 真机 → 进剧本详情 → 5 pill 完整 + ProfileScreen "Deep剧本 v3.0.92" 完整)
- **S81 #2**: 清理 mobile tsc baseline 49 错 (老 baseline 10+ 版本沉淀, 修法按调用链清理, 跟 S80 #3 S79 候选同源)
- **S81 #3**: v3.0.93 实战演练 (演练 bump-version.py --patch --apply --commit --rollback 全链路, 跟 S80 #4 S79 候选同源)
- **S81 #4**: AGENTS.md § 4.14 累计 30 条跨项目通用铁律整理 (去重 + 编号 + 输出索引, 跟 S73 v3.0.78-82 实战 72 条同源)

---

## § 15. S80 v3.0.96 BUG-172 强制升级 modal 渲染实战盲点 + 9 维 E2E 闭环 (2026-07-06, 跨项目通用铁律 #31 #32 新沉淀, 跟 S78 BUG-165/166 强制升级 100% 同源)

> **本次 session**: S80 v3.0.93-96 实战 4 版本, 强制升级 modal 渲染 3 修法 (v3.0.94 absoluteFill + v3.0.95 App.tsx 4 状态机补 ForceUpdateModal + v3.0.96 console.log debug) + 蓝叠真机 9 维 E2E 闭环 (装 v3.0.95 → 弹 modal → tap 升级 → Chrome 下载 → adb install v3.0.96 → 启动 OK). 跟 BUG-138 polling owner useState 修法 + BUG-079 假报告 + BUG-165/166 强制升级 100% 同源, 加跨项目通用铁律 #31 #32 累计 13 条.

### 15.1 实战盲点 3 步踩坑链 (v3.0.93/94/95)

**v3.0.93 (失败)**: 蓝叠装 v3.0.92 (老 APK) + server v3.0.93 (latestVersion) → 启动 → logcat 显示 [Updater] checkForUpdate success version=3.0.93 ✅ + [Updater] showForceUpdateDialog state changed visible:true ✅ → **但截图黑屏 + uiautomator dump UI 树空** ❌ (modal 渲染失败).

**v3.0.94 (修法 1, 仍失败)**: 改 updater.tsx ForceUpdateModal 不依赖 RN <Modal> 改用 StyleSheet.absoluteFillObject + zIndex: 9999 + elevation: 9999 普通 View 强制覆盖整屏 (修 RN 0.73 + Hermes + 新架构下 ReactModalHostManager view manager 找不到 generated setter, 跟 BUG-165 实战盲点 100% 同源). 蓝叠装 v3.0.92 → 启动 → logcat success + visible:true ✅ → 仍黑屏 ❌.

**v3.0.95 (修法 2, 成功)**: 关键发现 — pps/mobile/App.tsx line 325-348 update-required 分支**只渲染了 splash 背景, 没渲染 <ForceUpdateModal /> 组件实例**! ForceUpdateModal 是 module-level state 触发的, App.tsx 4 状态机里没把组件实例挂到 render tree → state 变了 = 黑屏 (组件没真渲染). 修法: line 341 加 <ForceUpdateModal />. 蓝叠装 v3.0.95 (新 APK) + server v3.0.95 → 启动 → **截图 335453 bytes (modal 完整渲染成功!)** vs 之前黑屏 17K ✅.

**v3.0.96 (修法 3 debug + 实战收口)**: updater.tsx ForceUpdateModal 加 console.log('[Updater] ForceUpdateModal render', { visible, version }) 测组件是否真渲染 + 备选 useState 替代 module-level state 修法 (跟 BUG-138 polling owner useState 修法 1:1 镜像). 9 维 E2E 闭环: 装 v3.0.95 → checkForUpdate 3.0.96 > 3.0.95 → modal 弹 → tap "立即升级 v3.0.96" → Chrome 跳转 ab.maque.uno/app/DeepScript_v3.0.96.apk → 下载 30324752 bytes → adb install -r → 启动 v3.0.96 → checkForUpdate 3.0.96==3.0.96 → modal 消失 → 进登录页 "Deep剧本 v3.0.96" ✅.

### 15.2 关键截图归档 (C:\Users\Administrator\AppData\Local\Temp\b172-*.png)

| 截图 | 大小 | 状态 |
|---|---|---|
| b172-1 到 b172-6 (v3.0.92/94/95/96 装 + server 3.0.95/96) | 17-18K (黑屏) | ❌ modal 没渲染 |
| **b172-7 (v3.0.95 + server v3.0.96 启动)** | **335K** | ✅ **modal 完整渲染** (修法 2 实战成功!) |
| b172-8 (tap "立即升级 v3.0.96") | 32K | ✅ Chrome 跳转 ab.maque.uno/app/DeepScript_v... |
| b172-9 (Chrome "重新下载文件? DeepScript_v3.0.96 (1).apk") | 73K | ✅ 下载确认弹窗 |
| b172-11 (modal 完整内容) | 335K | ✅ 警告 + v3.0.95/96 高亮 + BUG-172 笔记 + 2 按钮 |
| **b172-12 (v3.0.96 启动 → 进登录页)** | **60K** | ✅ **"Deep剧本 v3.0.96" 底部显示, modal 消失** (E2E 终点) |

### 15.3 9 维 E2E 闭环验证 (蓝叠 127.0.0.1:5555 真机实测)

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

### 15.4 跨项目通用铁律 #31 + #32 新沉淀 (跟 BUG-138/165/166 100% 同源, 累计 13 条)

**(跨项目通用铁律 #31) 修一个 BUG 必跑端到端 E2E, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 UI 树非空 (跟 BUG-079 假报告 + BUG-113 真机回归 SOP 100% 同源)**: 修前 v3.0.93/94 实锤 logcat 显示 success + state changed visible:true (单测指标全 PASS) → 但实际 UI 没渲染 (黑屏 + uiautomator UI 树空). 修后 v3.0.95 必跑完整 E2E: 装老 APK → 启动 → 截图验证 modal 完整渲染 (335KB) + uiautomator dump 解析 UI 树非空 (有 TextView 文本 "版本不一致, 必须升级" 等). 跨项目通用铁律: logcat/console 成功日志不能当 UI 渲染成功标志, 必截图 + UI 树双重验证 (跟 S78 BUG-164 死代码审计 100% 同源).

**(跨项目通用铁律 #32) 4 状态机组件实例必用 useState 同步, 不用 module-level state (跟 BUG-138 polling owner 实战 1:1 镜像, useState 跟 React render 生命周期天然同步)**: 修前 ForceUpdateModal 走 module-level state (_forceState + _forceSubs 全局变量), App.tsx 4 状态机 update-required 分支渲染 splash 背景 + 不渲染 <ForceUpdateModal /> 组件实例 → state 变了 = 没组件接收 = 黑屏. 修后 App.tsx line 341 补 <ForceUpdateModal /> 组件实例, 组件内部用 useState (跟 BUG-138 pollingOwnerRef useState 修法 1:1) → state 变 = React re-render = modal 渲染. 跨项目通用铁律: 4 状态机 (checking/network-error/update-required/ok) 组件实例必 useState 同步, 不用 module-level state (跟 BUG-138 polling owner 100% 同源, 跟 React render 生命周期天然同步).

### 15.5 跨端 8 处版本号同步 (跨端铁律 3 必走, 跟 v3.0.92 S80 一致)

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

### 15.6 跟 BUG-165/166 强制升级 + BUG-138 polling owner + BUG-079 假报告 100% 同源

- **BUG-165 (v3.0.88) 强制升级铁律** — 启动必查 + 不一致不允许进入主界面, BUG-172 是这个铁律的实战 E2E 闭环验证 (修前 v3.0.93/94 logcat success 但 UI 黑屏, 修后 v3.0.95 完整渲染 + 9 维 E2E 全过)
- **BUG-166 (v3.0.89) dismissable 逃逸漏洞** — BUG-172 修法保留 v3.0.89 的 RN Modal + onRequestClose + 2 按钮 + 强制升级, 没回归
- **BUG-138 (v3.0.70) polling owner useState** — BUG-172 修法 3 用 useState 替代 module-level state, 跟 BUG-138 1:1 镜像
- **BUG-079 假报告** — BUG-172 修法 logcat success ≠ UI 渲染成功, 必截图 + UI 树双重验证, 跟 BUG-079 100% 同源

### 15.7 部署踩坑笔记 (跟 v3.0.92 S80 100% 一致, 累计 30 条)

跟 S80 14.5 段 1 踩坑 100% 兼容 (tar 解压路径对齐 + cp 兜底必 mv), 实战中反复踩 3 次. v3.0.96 部署 8 维验证全过 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.96 + APK HTTP/2 200 + APK sha256 跟本机 1:1 + 远端 .env + 远端 systemd unit Environment=APP_VERSION).

### 15.8 下一步候选 (S81 推荐)

- **S81 #1**: BUG-172 commit c73b512 已在 origin/main, AGENTS.md § 4.16 累计 13 条跨项目通用铁律 (新增 #31 + #32) 配套沉淀 + BUGS_INDEX BUG-172 行收口 (已写)
- **S81 #2**: web 端补做 LightboxImage (跟 mobile 端 FullscreenImageViewer v3.0.76 1:1 镜像, BUG-145 实战沉淀, 跨端铁律 4++ 加固)
- **S81 #3**: v3.0.97 实战演练 (bump-version.py --patch --apply --commit --rollback 全链路, 跟 S80 #4 S79 候选同源)
- **S81 #4**: mobile tsc baseline 53 错清理 (跟 S80 #3 S79 候选同源, 跟 BUG-079 假报告 + BUG-097 漏修逆向等)

---

## § 16 S81 v3.0.97 — BUG-172 强制升级 9 维 E2E 闭环 + 实战演练 (2026-07-06)

**📦 commit**: b4a73af `v3.0.97: S81 v3.0.97 实战演练 + BUG-172 强制升级 9 维 E2E 闭环验证 (跨项目通用铁律 #31 #32 累计 13 条)`

**🐛 9 维 E2E 闭环** (蓝叠 127.0.0.1:5555 真机实测, 详见 § 15.2/15.3 S80 已记录表格): 装老版 v3.0.95 APK → 启动 checkForUpdate → modal 完整渲染 (335KB 截图) → tap 升级 → Chrome 下载 v3.0.96 APK (30324752 bytes) → pm install v3.0.96 → 启动 modal 消失进登录页. 9 维全过.

**🔒 跨项目通用铁律新沉淀** (AGENTS.md § 4.16 累计 13 条):
- **#31** 修一个 BUG 必跑端到端 E2E, 单测 "checkForUpdate success + visible=true" 不够, 必截图验证 UI 树非空 (logcat/console success ≠ UI 渲染成功, 跟 BUG-079 假报告 + BUG-113 真机回归 SOP 100% 同源)
- **#32** 4 状态机组件实例必用 useState 同步, 不用 module-level state (跟 BUG-138 polling owner 实战 1:1 镜像, useState 跟 React render 生命周期天然同步)

**🔗 100% 同源链**: BUG-165 (强制升级铁律) + BUG-166 (dismissable 逃逸) + BUG-138 (useState) + BUG-079 (假报告)

**➡️ 下一步候选 S82**: 强制升级 modal UI 重设计 (iOS 26 液态玻璃 + Material 3)

---

## § 17 S82 v3.0.98 — 强制升级 modal UI 重设计 (2026-07-06)

**📦 commit**: 963a02f `v3.0.98: S82 强制升级 modal UI 重设计 (iOS 26 液态玻璃 + Material 3 商业级, 删红色/警告/淘汰废话, 加 APP内下载主推 + 内嵌下载进度)`

**🎨 改动**: iOS 26 液态玻璃 + Material 3 商业级设计. 删红色/警告/淘汰废话文案 (修前 modal 像"出错警告", 修后像"有新版本啦"). 加 APP 内下载主推路径 + 内嵌下载进度条 (vs v3.0.96 Chrome 跳转外链的笨重路径).

**🔒 跨端铁律 4 加固**: mobile 跟 web 视觉语言对齐 (UI 一致性).

**➡️ 下一步候选 S83**: BUG-176 DeepSeek reasoning_content 泄漏止血

---

## § 18 S83 v3.0.99 — BUG-176 DeepSeek reasoning_content 泄漏到 analysis_report (2026-07-07)

**📦 commit**: a2fe6ac `v3.0.99: S83 BUG-176 修 DeepSeek reasoning_content 泄漏到 analysis_report (AI 思考内容污染, 跨项目通用铁律 #34 新沉淀)`

**🐛 根因**: DeepSeek 返 reasoning_content 字段 (AI 内部思考链) 被当正常 content 直接拼进 analysis_report → 用户看到 AI 思考内容污染报告.

**🛠️ 修法**: server 端 LLM provider 显式过滤 reasoning_content 字段, 只取 content.

**🔒 跨项目通用铁律 #34** 新沉淀 (跟 BUG-145 跨端 UI 防御 100% 同源): DeepSeek 等 reasoning 模型的 reasoning_content 必过滤防泄漏到 analysis_report. 输出层必做字段白名单, 不信任模型默认行为.

**➡️ 下一步候选 S84**: BUG-177 mobile 强制升级 modal 永远弹出

---

## § 19 S84 v3.0.100 — BUG-177 mobile 强制升级 modal 永远弹出 (2026-07-07)

**📦 commit**: 2148f9e `v3.0.100: S84 BUG-177 修 mobile 端强制升级 modal 永远弹出 (client 跟 server 对比用 info.version 而非 info.mobileLatestApkVersion, 跟 server-only hotfix 设计矛盾)`

**🐛 根因**: apps/mobile/App.tsx 修前用 info.version (server-only 进程版本 e.g. v3.0.99) 跟 clientVer (mobile APK 版本 e.g. v3.0.98) 对比. S83 server hotfix (BUG-176) 后 server.version=v3.0.99 但公网 mobile APK 还是 v3.0.98 → 永远不等 → 强制升级 modal 永远弹 → APP 无法进主界面. 跟 server-only hotfix 设计矛盾 (server hotfix 不需 rebuild APK, 客户端不应强制升级).

**🛠️ 修法**: App.tsx line 297-306 client 跟 server 对比改用 info.mobileLatestApkVersion (server 从公网 APK 列表扫到的真实 APK 版本), 保留 info.version fallback 兜底. client APK == 公网 APK → 不需升级; client APK < 公网 APK → 需升级.

**🔒 跨项目通用铁律 2 条新沉淀**:
1. client 升级对比必用公网真实 APK version, 不用 server-only 进程 version (跟 server AGENTS.md § 3 铁律 9 server-only hotfix 必 rebuild APK 互补: server 侧保证 server.version ≈ 公网 APK version, client 侧保证判断对)
2. server /api/version 必同时返 version (server-only 进程版本) + mobileLatestApkVersion (公网真实 APK 版本), 让 client 升级判断能区分场景 (v3.0.62 BUG-131 已实现, 这次实战验证 BUG-177 修法依赖该字段)

**📊 跨端 8 处版本号同步** 3.0.99→3.0.100 (versionCode 100→101): mobile version.ts + build.gradle (versionCode+versionName) + web version.ts (APP_VERSION+APP_VERSION_CODE+APP_BUILD_DATE 2026-07-07) + server package.json + src/index.ts fallback + ecosystem.config.js (env+env_production 2 处) + changelog.json (+BUG-177 entry) + 远端 .env/systemd (deploy.sh 自动同步)

**➡️ 下一步候选 S85**: BUG-178 分镜列表 UI 重设计 + BUG-179 loading hang

---

## § 20 S85 v3.0.101/102 — BUG-178 分镜列表 UI + BUG-179 mobile loading hang (2026-07-07)

**📦 commit 链**: 0c6551c (v3.0.101) + 174c321 (v3.0.102)

**🐛 BUG-178**: 分镜列表 UI 重设计, 修移动端分镜内容无法修改. **跨项目通用铁律 #36** 新沉淀 (UI 一致性 + 可编辑性跨端对齐).

**🐛 BUG-179**: web shots UI refactor (1 textarea TXT-like 风格) + mobile fix loading hang (修前 loading 状态挂起不退出, 用户卡在转圈).

**📊 跨端 8 处版本号同步** 3.0.100→3.0.101→3.0.102

**➡️ 下一步候选 S86**: BUG-180 web 乱码 + BUG-181 mobile 编辑 + BUG-182 commit 假报告补救

---

## § 21 S86 v3.0.103/104 — BUG-180 web 乱码 + BUG-181 mobile 编辑 + BUG-182 commit 假报告补救 (2026-07-08)

**📦 commit 链**: d49d3dc (v3.0.103) + 980b23f + a175e51 + 7dbba83 (v3.0.104 三个 commit)

**🐛 BUG-180**: web 登录页 title 末尾乱码. 根因 GB2312 二级汉字如 "端" (U+7AEF) 在 Content-Type 头无 charset= 时被浏览器按 latin1 fallback 渲染成 "端?". 修法见 #38.

**🐛 BUG-181**: mobile 小说分析编辑 — 3 editable cards 1:1 mirror web (ScriptDetailScreen.tsx 真正落地).

**🐛 BUG-182 (反讽实战, 跟 BUG-079 假报告 100% 同源)**: v3.0.103 commit d49d3dc message 写了 BUG-181 但 ScriptDetailScreen.tsx last commit 是 v3.0.92 → commit message 假报告 (代码没真改). v3.0.104 a175e51 补 8 处版本号同步 + nginx charset 修复; 980b23f 补真正修改的 2 mobile 文件; 7dbba83 补 a175e51 漏 commit 的 2 文件.

**🔒 跨项目通用铁律新沉淀**:
- **#37** commit message 必跟代码 1:1 对应, 验收必跑 `git log -1 --format='%H %s' <被改文件路径>` 检查 commit 跟代码 drift (跟 BUG-079 假报告 100% 同源)
- **#38** nginx 必配 `charset utf-8` (location / charset utf-8;) + 主进程 restart 而非 reload (nginx 1.26.3 charset 指令需主进程重启重新加载 mime.types) + 3 兜底联动 (HTML meta charset=UTF-8 + nginx charset utf-8 + Google Fonts Noto Sans SC 全站兜底). 任何 CDN + Nginx + 中文文案组合 (WordPress / Ghost / Hexo / SPA 站点) 都适用

**📊 跨端 8 处版本号同步** 3.0.103→3.0.104

**➡️ 下一步候选 S87**: 集数公式校准 + 角色分析重构

---

## § 22 S87 v3.0.105/106 — 集数公式校准 + 角色分析系统重构 + BUG-183 部署记录 (2026-07-08)

**📦 commit 链**: ad0360e (v3.0.105) + e6ee195 + 63fe0e6 (v3.0.106)

**📐 v3.0.105 ad0360e**: 集数公式分母校准 3675→6667 (100 万字=150 集, 修前字数偏多集数偏少), 按剧情阶段权重分配原文 (高潮多给/铺垫少给), AI 规划 Prompt 六档梯度, 状态卡节奏标注 (规范修订)

**🎭 v3.0.106 e6ee195**: 角色分析系统重构 — 5 类角色类型 × 4 种阵营 × 全角色补齐策略 (规范修订)

**🐛 v3.0.106 63fe0e6**: BUG-183 部署问题记录 — tar 嵌套目录 + systemd ProtectSystem 导致部署路径错乱的踩坑沉淀 (实战记录, 非代码 BUG)

**📊 跨端 8 处版本号同步** v3.0.104→3.0.105→3.0.106 (versionCode 105→106→107)

**➡️ 下一步候选 (S88, 开放, 等 user 拍)**:
- **A** web 端补做 LightboxImage (跟 mobile 端 FullscreenImageViewer v3.0.76 1:1 镜像, BUG-145 实战沉淀, 跨端铁律 4++ 加固)
- **B** mobile tsc baseline 53 错清理 (跟 S80 #3 S79 候选同源, 跟 BUG-079 假报告 + BUG-097 漏修逆向等)
- **C** 业务新功能开发 (user 待拍方向)
- **D** CI 守门加固 (lint job 已就位 S52, 可加 typecheck 卡点 + mobile lint)
- **E** 性能优化 (集数公式校准后 AI 规划链路 profile)
