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