# apps/mobile/AGENTS.md — Mobile 端 AI Agent 必读 (S68 瘦身)

> **本文件**: mobile 端 (React Native) AI Agent 独有规范. 跟根 AGENTS.md + server AGENTS.md 对称.
> **必读顺序** (S68 收口后):
> 0. **[`../../AGENTS.md`](../../AGENTS.md)** — 跨端统一总入口 (中文/Persistence/铁律/工作流, **必先读**)
> 1. 本文件 — mobile 端独有 (RN 栈 + 升级 7 铁律 + 改 mobile 代码前后 5 步)
> 2. **[`./BUGS.md`](./BUGS.md)** — 跨端共用 BUG 案例库 (21 个 BUG, 跟 server 端共用)
> 3. **[`./CODING_STANDARDS.md`](./CODING_STANDARDS.md)** — 38 条硬性规范 (含 BUG 记录强制流程)
> 4. **[`./DEPLOY.md`](./DEPLOY.md)** — mobile 部署 (APK 升级 5 步 + 7 类失败诊断)
> 5. **[`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)** — 跨端版本管理 (6 处版本号 + § 5 发版 SOP)

> **跨端规范 (中文/Persistence/铁律/工作流/Worker 9 条/代码 4 原则/禁新旧版) → 看根 [`../../AGENTS.md`](../../AGENTS.md), 本文件不重复**.

---

## § 1. mobile 项目速览 (RN 0.73 + Hermes)

- **栈**: React Native 0.73 + Hermes + TypeScript + React Navigation 6 (Stack + BottomTabs)
- **包名**: `com.aiscriptmobile` (applicationId + namespace)
- **目录**:
  - `App.tsx` — 根组件, 5 Tab (书架/进度/生图/视频/上传/我的) + Auth gate
  - `src/screens/` — 30+ screen .tsx
  - `src/api/client.ts` — axios + auth
  - `src/config/version.ts` — **APP_VERSION 唯一来源** (跟 web 端 src/config/version.ts 同步)
  - `src/config.ts` — `API_BASE_URL = http://159.75.16.110:6000/api`
  - `src/utils/updater.tsx` — 在线升级弹窗 (DownloadManager + Modal + 通知栏)
  - `android/app/src/main/java/com/aiscriptmobile/` — **MainApplication.kt + MainActivity.kt (必修)**
  - `android/app/release.keystore` — **永久 release 签名 (BUG-023)**, 别名 `release`, 密码 `deepscript2026`
- **monorepo 共享包** (本仓库 `packages/shared-types` + `packages/shared-utils`, 通过 npm workspaces 链接):
  - `@ai-script/shared-types` — **只放 TS type**, 不要 import value (参考 BUG-005)
- **依赖 server**:
  - `apps/server/` (shipin-APP prod)
  - `apps/web/` (web 端, 镜像 mobile UI)

## § 2. 改 mobile 代码前 5 步必做

1. `Read ../../AGENTS.md` 跨端统一规范 (S68 收口后必先读)
2. `Read BUGS.md` 全部 (跨端共用) + `Read CODING_STANDARDS.md` 38 条 + `Read DEPLOY.md` 升级流程 + `Read ../../docs/VERSION_MANAGEMENT.md` 跨端规范
3. `Read 目标文件` 完整内容
4. `Grep 关键 import` 是否引用真源 (不要臆造字段, 不要从 monorepo 拿 value)
5. **如果触发 VERSION_MANAGEMENT.md § 7 任一条件** (改 version.ts / 加依赖 / 改 /api/version / 改 updater.tsx / 改 DownloadPage 或 AboutPage), 必跑 § 7.2 6 处自检 + § 7.5 commit message 带版本号 + **同步修订对应规范文档** (按 STANDARDS_EVOLUTION.md § 3 5 步 SOP)

## § 3. 改 mobile 代码后 5 步必做 (升级部署流程)

1. **改 6 处版本号** (跨端铁律 3) — `version.ts` + `build.gradle` (versionCode + versionName) + 其他 4 处
2. `gradlew assembleRelease` 重打 APK (3-5 min 增量编译)
3. `aapt2 dump badging app-release.apk` 验 versionName 跟 `version.ts` 一致, `apksigner verify --print-certs` 验证书 DN = `CN=DeepScript Release`
4. **scp 上传 + bump server** (PM2 env 切 APP_VERSION) — 详见 `DEPLOY.md` § 3
5. **5 维验证** (跨端铁律 5) — 公网 APK 200 + SHA256 跟本机一致 + /api/version 触发升级 + 弹窗按钮数 3 + 历史 APK 不覆盖

## § 4. 升级链路 7 条铁律 (mobile 独有, S58 P10 BUG-021/022/023/024/025 总结)

> **跨端铁律 4 跨端 PM2 铁律不适用 mobile, 7 条独有铁律如下**:

1. **弹窗代码 100% 走 `react-native-blob-util` + `useDownloadManager: true`** (BUG-021/022)
2. **release APK 必用 `signingConfigs.release`**, 不用 debug (BUG-023)
3. **试纸 / 新版本必重打包**, 不 cp 旧包 (BUG-024)
4. **装 APK 必用 `_state.destPath` 不用 `res.path()`** (BUG-025)
5. **公网 APK 文件名 `DeepScript_v${version}.apk` 跟 APK 内 `versionName` 一致** (防 BUG-017 覆盖错位)
6. **不批量覆盖历史 APK**, 部署只上传当前版本 (防 BUG-017)
7. **历史 APK 文件保留**, 至少留 5 个版本, 用户回滚有路

## § 5. 跨端版本管理 4 处铁律 (mobile 视角, S64 P3 BUG-066/067/068 总结)

> 跨端铁律 3 (6 处版本号同步) 是 § 4 展开, 4 处铁律是 mobile 视角的强化:

1. **每个 app 必有自己的 `src/config/version.ts` 单一来源** — 禁硬编码 (BUG-067)
2. **server package.json version 跟 src/index.ts fallback 必同步当前版本** — 不能留 S17 历史残留 (BUG-066)
3. **changelog 必真实可读** — 严禁硬编码通用文案, 走 apps/server/changelog.json (BUG-067)
4. **跨 AI 协作必读 docs/VERSION_MANAGEMENT.md** — 不能依赖 PR 描述或聊天记录 (BUG-068)

---

**详细 5 步流程 + 7 类失败诊断 + 完整命令模板** → [`./DEPLOY.md`](./DEPLOY.md)
**跨端版本管理 9 节完整规范** → [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)
**mobile 硬性规范 38 条** → [`./CODING_STANDARDS.md`](./CODING_STANDARDS.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

> **最后更新**: 2026-06-24 (S68 收口, v1.1 瘦身版)
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时
