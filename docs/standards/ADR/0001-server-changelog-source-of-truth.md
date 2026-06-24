# ADR-0001: server changelog 单一来源决策

PLACEHOLDER

状态: Accepted. 日期: 2026-06-24. 决策者: S64 + User.

## 背景 (Context)

server `/api/version` 端点 (apps/server/src/index.ts) 有 2 个问题:

1. version 字段从 process.env.APP_VERSION || 3.0.0-alpha 读, 但 package.json 写了 3.0.0-alpha, env 实际是 3.0.29, 三者不一致 (S17 起 12 个版本未同步)
2. changelog 字段硬编码 "优化性能，修复已知问题" 通用文案, 用户在 /download 页看不到真实更新内容
3. web 端 Layout.tsx / AboutPage.tsx / DownloadPage.tsx 3 处硬编码 v3.0.0 + 5 条 hardcoded changelog bullet, 跟 server 真实版本矛盾

必须在 S64 这次发版解决, 否则下个 3 类发版 (v4.0.0) 会更混乱。


## 决策 (Decision)

我们决定:

1. server package.json version 字段必跟 ecosystem.config.js APP_VERSION 同步, 当前 3.0.29
2. server src/index.ts fallback 必跟当前版本一致, 当前 3.0.29
3. changelog 必真实可读, 从 apps/server/changelog.json 数据源读
   - 新建 apps/server/src/shared/changelog.ts (185 行) 多路径读 changelog.json + 缓存 + fallback 兜底
   - 新建 apps/server/changelog.json (143 行) 维护 11 个版本真实条目
   - /api/version 返回 version, downloadUrl, changelog, highlights[], buildDate, forceUpdate, needUpdate
4. 每个 app 必有自己的 src/config/version.ts 单一来源
   - mobile: 已存在 (S58)
   - web: 新建 apps/web/src/config/version.ts (21 行)
   - server: 用 package.json version 字段
5. 跨端文档统一入口: docs/VERSION_MANAGEMENT.md (S64 新建, 455 行, 9 节完整规范)


## 影响 (Consequences)

### 正面收益 (Positive)

- 运维/包管理器读 package.json 看到正确版本
- /download 页用户看到真实 changelog (v3.0.29 + 5 条 highlights + buildDate=2026-06-24)
- web 端 Layout / AboutPage / DownloadPage 自动跟随 web config 同步 (不再 hardcoded v3.0.0)
- 跨 AI 接手按 VERSION_MANAGEMENT.md § 7.2 6 处自检 (避免改一处忘改其它)
- changelog.json 数据源 + shared/changelog.ts 模块化 (后续版本追加只改 JSON, 不改代码)
- 部署时 dist 复制 changelog.json (cp changelog.json dist/changelog.json)

### 负面代价 (Negative, 必须忍受)

- tsc 不复制 .json 文件, 必须手动 cp changelog.json (部署脚本加 1 行)
- changelog.json 必须人工维护 (每个发版追加条目, 不能完全自动化)
- 5 个新文件 + 6 处代码修订 (S64 工作量: ~2800 行 diff)
- server fallback 改后, dev / prod 行为差异缩小

### 后续风险 (Future Risks)

- changelog.json 跟代码漂移: 如果 AI 只 commit 代码不 commit changelog.json, /download 页会显示老 changelog
- 6 处版本号同步遗漏: 如果 AI 改一处忘改其它, 会引发 BUG-024 (升级死循环)
- 跨端 shared 包 import value 隐患: BUG-005 教训, 当前是各 app 各自维护 version.ts (不上 shared 包), 风险可控


## 一致性 (Compliance)

### 部署前自检 (VERSION_MANAGEMENT.md § 7.2)

```bash
# 6 处版本号同步
grep "APP_VERSION" apps/mobile/src/config/version.ts
grep "versionName" apps/mobile/android/app/build.gradle
grep "version" apps/server/package.json
grep "APP_VERSION" apps/server/src/index.ts
grep "APP_VERSION" apps/web/src/config/version.ts
node -e "const c = require('./apps/server/changelog.json'); const v = c.entries.find(e => e.version === '3.0.29'); !v && console.log('缺 v3.0.29 条目')"
```

### 部署后验证 (5 维, VERSION_MANAGEMENT.md § 5.8)

```bash
curl -s https://ab.maque.uno/api/version
# 期望: version=3.0.29, changelog=真实, highlights=[5条], buildDate=2026-06-24
```

### Code Review checklist

- 6 处版本号都改了?
- changelog.json 追加了新版本条目?
- server fallback 改了?
- web src/config/version.ts 改了?
- mobile build.gradle versionCode +1?


## 替代方案 (Considered Alternatives)

### 方案 0: 不动, 保持 S17 历史 (REJECTED)

- 优势: 0 工作量
- 劣势: /download 页继续显示硬编码 changelog; 12 个版本累计不一致
- 为什么没选: User 在 S64 P0 明确反馈"确保 APP 所有展示的版本号都是统一的"

### 方案 A: 只改 server package.json + index.ts (PARTIAL)

- 优势: 改动量最小 (2 文件 2 行)
- 劣势: web 端硬编码 v3.0.0 仍然存在, user 看到 web 端 v3.0.0 / APK v3.0.29 矛盾
- 为什么没选: User 要求"全部展示版本号统一", 不能只修 server

### 方案 B: server changelog 走数据库 (REJECTED)

- 优势: 不需要手动维护 changelog.json
- 劣势: server 启动时 DB 不一定可用; changelog 应该跟代码一起 commit
- 为什么没选: shipin-APP DB 是用户数据, 不是 changelog 存储

### 方案 C: monorepo shared 包导出 version (REJECTED, BUG-005 教训)

- 优势: 单一来源, 不会 drift
- 劣势: monorepo shared 包 import value 触发 Metro 编译坑 (S58 BUG-005/009 实证)
- 为什么没选: 各 app 各自维护 src/config/version.ts 更稳

### 方案 D (本次采用): 各自 src/config/version.ts + server changelog.json

- 优势: 简单 / 跟各 app 构建工具链匹配 / 不触发 monorepo shared 坑 / changelog 真实可读
- 劣势: 6 处版本号要手动同步 (但 VERSION_MANAGEMENT.md § 7.2 + 自检脚本兜底)
- 为什么选: 跟 BUG-005 教训对齐, 跟 shipin-APP 架构 (单层 server + monorepo apps) 匹配


## 配套变更 (Related Changes)

### BUG

- BUG-066: server package.json version 跟 ecosystem 不一致 (12 个版本未同步)
- BUG-067: web 端硬编码版本号 + 硬编码 changelog

### 规范修订

- 新建 docs/VERSION_MANAGEMENT.md (455 行, 9 节) - 跨端版本管理规范
- 新建 docs/STANDARDS_EVOLUTION.md (S65, 270 行) - 规范自迭代 SOP
- 新建 docs/standards/ADR/0000-adr-template.md + README.md
- 修订 apps/mobile/CODING_STANDARDS.md - 加第 30/31/32 条新规范
- 修订 apps/mobile/BUGS.md - 追加 BUG-066/067/068
- 修订 apps/mobile/AGENTS.md - 引用 VERSION_MANAGEMENT.md
- 冻结 docs/VERSION_POLICY.md (S64)

### 代码改动 (S64 + S65)

| 文件 | 类型 | 改动 |
|---|---|---|
| apps/server/package.json | M | 3.0.0-alpha → 3.0.29 |
| apps/server/src/index.ts | M | fallback 3.0.0-alpha → 3.0.29 + 引入 changelog 读取 |
| apps/server/src/shared/changelog.ts | New | 185 行 |
| apps/server/changelog.json | New | 143 行, 11 个版本 |
| apps/web/src/config/version.ts | New | 21 行 |
| apps/web/src/components/Layout.tsx | M | 删硬编码 v3.0.0 |
| apps/web/src/pages/AboutPage.tsx | M | 删硬编码 const |
| apps/web/src/pages/DownloadPage.tsx | M | 删 fallback + 5 条硬编码 |
| docs/VERSION_MANAGEMENT.md | New | 455 行, 9 节 |
| docs/STANDARDS_EVOLUTION.md | New | 270 行 (S65) |
| apps/web/DEPLOY.md | New | 130 行 (S65) |
| docs/standards/ADR/0000-adr-template.md | New | 模板 (S65) |
| docs/standards/ADR/0001-server-changelog-source-of-truth.md | New | 本 ADR (S65) |
| docs/DEPLOY.md | M | § 6 修 (5/6 维 + SSH key) (S65) |
| docs/APP_RELEASE_GUIDE.md | M | 冻结 + 指向 VERSION_MANAGEMENT (S65) |

### 部署验证

- server pm2 env 0 | grep APP_VERSION → 3.0.29
- curl /api/version → version=3.0.29, changelog=真实, highlights=[5条], buildDate=2026-06-24
- 公网 APK HTTP 200 (SHA256 不变)
- web bundle index-DoXhDwc-.js 部署到 /www/wwwroot/ab.maque.uno/dist/
- Playwright /download 验证通过

### Git commits

- 990e0d5 - v3.0.30: 跨端版本管理统一规范 (BUG-066/067/068) (S64)
- 19681aa - docs(dev): DEV_PROGRESS.md 追加 S64 (S64)
- (S65 pending) - v3.0.30 P2: 部署规范统一 + 规范自迭代 SOP (ADR-0001)

---

> 决策来源: https://github.com/joelparkerhenderson/architecture_decision_record 模板 + shipin-APP S64/S65 实战
