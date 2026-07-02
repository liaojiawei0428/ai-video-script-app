# apps/mobile/AGENTS.md — Mobile 端 AI Agent 必读 (S68 瘦身, S72 batch 7 加部署主入口)

> **本文件**: mobile 端 (React Native) AI Agent 独有规范. 跟根 AGENTS.md + server AGENTS.md 对称.
> **必读顺序** (S68 收口后, S72 batch 7 加 🆕 部署主入口 + 铁律 4++ Web→APP 同步):
> 0. **[`../../AGENTS.md`](../../AGENTS.md)** — 跨端统一总入口 (中文/Persistence/铁律/工作流, **必先读**)
> 0.5. **[`../../docs/DEPLOY_RELEASE_FLOW.md`](../../docs/DEPLOY_RELEASE_FLOW.md)** — 🆕 **S72 batch 7 部署 + 发布主入口 SOP (含 mobile APK 发布 § 4 + 自动给更新机制 § 5 + 铁律 4++ 跨端同步 § 10 + APK 签名错 应急处理 § 12.3)**
> 1. 本文件 — mobile 端独有 (RN 栈 + 升级 7 铁律 + 改 mobile 代码前后 5 步)
> 2. **[`./BUGS.md`](./BUGS.md)** — 跨端共用 BUG 案例库 (21+ 个 BUG, 跟 server 端共用, **BUG-097 必读**)
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
- **🆕 S72 batch 7 规范反转 (2026-06-26)**: **Web 主导, APP 跟随** (跟之前 "主盯 web, 安卓暂不动" 旧原则反转). 改 web 端任意功能/UI/状态机/接口后, 必同步 app 端. 详见根 `AGENTS.md` § 4 铁律 4++ 跨项目通用 UX 原则 + 5 步同步 SOP

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

## § 6. 跨端铁律 4+ / 8 / 3-8 处 (mobile 视角, S71 后置, 跟根 AGENTS.md 一致)

> **跨端规范全在根 `AGENTS.md` § 4 铁律 4+ / 8 / 3, 本节只列 mobile 视角引用, 详细必看根 AGENTS.md**:

1. **铁律 4+** 🔄 状态机迁移必同步 allowlist + response handler (S71 BUG-081 强约束, 跨项目通用)
   - mobile 端必查 `apps/mobile/src/screens/` + `apps/mobile/src/api/client.ts` 跟 server status 字段同步
   - 例: server 加新 status `plan_review`, mobile case 必加 `'plan_review'` 分支, 不加 UI 空白
   - 4 步同步: server allowedStates grep → web/mobile case grep → DB schema 兼容 → 一键自检 `apps/server/scripts/check-status-machine.sh`
2. **铁律 8** 🔌 持久化必 string 归一 (S71 BUG-082 强约束, 跨项目通用)
   - mobile 端 axios POST 必 `typeof payload.message === 'string'` 校验, 防 server 返对象 React #31
   - 防御渲染: `{typeof part.message === 'string' ? part.message : JSON.stringify(part.message)}`
3. **铁律 3 (v3.0.33 扩 6→8)** APP_VERSION 改 1 处必同步 8 处
   - mobile 视角: `version.ts` + `build.gradle` (versionCode + versionName) + 6 处其他 (server package.json / index.ts / ecosystem / web version.ts / .env / systemd unit)
   - 必跑 `node tools/verify-version-8-points.js` (本地 6 + 远程 2)

## § 6.5 v3.0.43 Stage 2 新增: 本地媒体缓存规范 (S72 batch 11 Stage 2)

> **新增 2026-06-27 (S72 batch 11 v3.0.43 Stage 2)**: 解决 5Mbps 带宽 + 图片/视频加载慢 (10-20 秒).
> **背景**: shipin-APP 没本地缓存层, 每次都重新下载, 重复看同一张图要等 N 次.

### § 6.5.1 缓存架构 (3 层)

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: useCachedMedia hook (apps/mobile/src/hooks/)    │
│  - mount 查 SQLite media_cache 表                         │
│  - 命中 → 用本地 file:// 路径 (省 10s 网络)              │
│  - 未命中 → 用原 URL + onLoaded 触发 cacheFromUrl         │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 2: mediaCache 工具 (apps/mobile/src/utils/)        │
│  - 文件存储: RNFS.DocumentDirectoryPath/media-cache/{img,video}/{hash}.{ext}
│  - 索引存储: SQLite media_cache.db (单表)                  │
│  - Hash 命名: djb2 + reverse (32 chars hex, 跟 web 1:1)   │
│  - LRU 淘汰: 500MB / 1000 文件, 删到 90% 阈值            │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 3: SQLite + RNFS (项目已装, 无 NDK 依赖)          │
│  - react-native-sqlite-storage v6.0.1 (跟 models/db.ts 同架构)
│  - react-native-fs v2.20.0 (跟 shipin-APP 现有用法一致)   │
└──────────────────────────────────────────────────────────┘
```

### § 6.5.2 替代方案决策 (踩坑教训, 跨项目通用铁律)

| 方案 | 状态 | 原因 |
|---|---|---|
| MMKV 4.x | ❌ 失败 | 需要 nitro + RN 0.85 (shipin-APP RN 0.73 不兼容) |
| MMKV 2.12.2 | ❌ 失败 | 需要 NDK build, shipin-APP NDK 没装 `source.properties` ([CXX1101] 错误) |
| AsyncStorage | ⚠️ 备选 | 0 新依赖, 但查询慢 30x (跟 MMKV 比) |
| **react-native-sqlite-storage v6.0.1** | ✅ **采用** | 项目已装, 跟 models/db.ts 集成, 无 NDK 依赖, 性能 < 5ms |

**跨项目铁律**: 缓存方案选型必先验证 native 依赖 (peerDeps + engines + NDK + 跑 build 验证 5 步).

### § 6.5.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Hook API | `useCachedMedia(url) → { source, onLoaded, refresh }` | 同左 | ✅ |
| Hash 算法 | djb2 + reverse (32 chars hex) | 同左 | ✅ |
| LRU 阈值 | 500MB / 1000 文件 | 同左 | ✅ |
| 索引存储 | IndexedDB `media-cache-v3` | SQLite `media-cache-v3.db` | 概念一致, 实现不同 |
| 文件 hash 命名 | djb2(url) | djb2(url) | ✅ |

### § 6.5.4 使用规范

1. **新组件加图片必用 useCachedMedia**, 不要直接用 `<Image source={{ uri }} />`:
   ```tsx
   import { useCachedMedia } from '../hooks/useCachedMedia';
   const { source } = useCachedMedia(imageUrl);
   return <ImageWithLoading src={source || imageUrl} ... />;
   ```

2. **不要手动改 media_cache 表**, 走 mediaCache.ts 提供的 API:
   - `getCached(url) → string | null` (查缓存)
   - `cacheFromUrl(url) → string` (下载 + 存)
   - `refresh(url) → string` (强删 + 重 GET)
   - `clearAll() → void` (用户手动清)
   - `getStats() → CacheStats` (统计)

3. **改 hash 算法必 web + mobile 同步**, 跑 `tools/verify-bug109-media-cache.js` 验证 (8 维).

4. **LRU 阈值变更必双端同步**, 跑 verify 脚本验证.

5. **不要在 cacheFromUrl 内部 try/catch swallow 错误** — 失败必须 throw, 让上层 retry 触发.

### § 6.5.5 跨项目通用 (跟 BUG-079 假报告 + BUG-097 mobile 漏修 web 100% 同源)

- **改 utils 必 100% 移植含缓存** — Stage 1 加 UI 但没缓存 = 假修, Stage 2 补完整 (跟 BUG-079 100% 同源)
- **跨端铁律 4++ 缓存必 1:1 镜像** — API / hash / LRU 三一致, 缺一就是 漏修
- **Hash 命名是版本同步核心** — SHA256(url), server 改 URL 自动失效, 不依赖 server 配合 (跟 BUG-104 100% 同源)
- **server ETag 跟 client cache 配套** — server ETag + Cache-Control, 客户端 If-None-Match 命中 → 304
- **LRU 必加** — 500MB / 1000 文件 + lastAccessed 删到 90% 阈值, 防用户磁盘占满
- **Cache key 必 1:1** — web djb2 = mobile djb2, 跨端不可用不同 hash 算法

### § 6.5.6 验证脚本 (跟 shipin-APP 历史 verify 一致)

`tools/verify-bug109-media-cache.js` (8 维验证):
1. djb2 hash 32 chars hex (跟 web 1:1 算法)
2. ext 推断 (.jpg/.png/.mp4/.webm)
3. hash 失效机制 (server 改 URL 参数 → 自动 miss)
4. LRU 淘汰算法 (按 lastAccessed ASC 排序)
5. LRU 阈值 (500MB / 1000 文件上限)
6. 跨端 hook API 一致 (web + mobile 都返回 {source, onLoaded, refresh})
7. server ETag 中间件 (响应 JSON hash + 304 处理)
8. Stage 2 集成 POC (web + mobile 各 1 处 useCachedMedia wrap)

跑法: `node tools/verify-bug109-media-cache.js` (期望 PASS: 8 / FAIL: 0)

## § 6.6 v3.0.43 Stage 3 新增: GeneratingLoader + useMediaLoader 跨端 1:1 (S72 batch 11 Stage 3)

> **新增 2026-06-27 (S72 batch 11 v3.0.43 Stage 3)**: AI 生成中动画 + 跨端 1:1 媒体加载抽象.

### § 6.6.1 跨端 1:1 镜像 (跟 web 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| 组件 | `components/ui/generating-loader.tsx` | `components/ui/GeneratingLoader.tsx` | ✅ 1:1 |
| Hook | `hooks/useMediaLoader.ts` | `hooks/useMediaLoader.ts` | ✅ 1:1 |
| 4 态 type | `idle/loading/ready/error` | 同左 | ✅ 1:1 |
| Hook 返回 | `{source, state, error, retry, refresh, onLoaded, retryCount}` | 同左 | ✅ 1:1 |
| Spinner 风格 | CSS `border-t-blue-500` + `animationDuration: 1s` | Animated `borderTopColor: #3b82f6` + `duration: 1000` | ✅ 1:1 |
| MAX_RETRIES | 3 | 3 | ✅ 1:1 |

### § 6.6.2 useMediaLoader 跟 useCachedMedia 的关系

```
useMediaLoader (Stage 3)  ← 高阶封装, 4 态 + retry
   └─ useCachedMedia (Stage 2)  ← 单一职责, 缓存 + URL state
       └─ mediaCache (mobile SQLite / web IndexedDB)
```

**不要直接用 useMediaLoader 当 cache hook** — 只在 UI 层需要 4 态显示时用. 纯缓存场景用 useCachedMedia 即可.

### § 6.6.3 集成示范 (跨端 1:1)

- mobile: `ScriptDetailScreen.tsx` line 154 用 `<GeneratingLoader size="lg" label="正在加载剧集..." />` 替代原 ActivityIndicator
- web: `ScriptDetailPage.tsx` line 177 用 `<GeneratingLoader size="lg" label="正在加载剧集..." />` 替代原 "加载中..." 文本

### § 6.6.4 使用规范

1. **AI 生成中/loading 场景必用 GeneratingLoader**, 替代原 ActivityIndicator / "加载中..." 文本
2. **跨端 1:1 风格** — 不要 web 用一种, mobile 用另一种, 都要走 GeneratingLoader
3. **MAX_RETRIES / 1s 周期 / 蓝色 跨端一致** — 改阈值必双端同步
4. **Lottie 暂时走 fallback spinner** — lottie-react-native 需要 NDK build 验证 (Stage 3.5 接入)

### § 6.6.5 跨项目通用 (跟 BUG-079/097 100% 同源)

- **跨端铁律 4++ 必 web + mobile 同步** — Stage 3 跨端 1:1 8 维一致
- **改 hook 必 100% 移植 4 态 + retry + 集成点** — 缺一就是漏修
- **Lottie 接入 5 步验证** — 1) peerDeps 2) engines 3) NDK 4) build 5) fallback 兜底

### § 6.6.6 验证脚本 (跟 shipin-APP 历史 verify 一致)

`tools/verify-bug110-media-loader.js` (8 维验证):
1. GeneratingLoader 跨端文件存在 (web + mobile 1:1)
2. useMediaLoader 跨端 hook 文件存在 (封装 useCachedMedia + 4 态 + retry)
3. useMediaLoader 跨端 API 1:1 (返回 {source, state, error, retry, refresh, onLoaded, retryCount})
4. 4 态 type 一致 (idle/loading/ready/error 跨端 1:1)
5. MAX_RETRIES 阈值一致 (web + mobile 都 3)
6. 集成 ScriptDetailScreen (mobile) + ScriptDetailPage (web) 用 GeneratingLoader
7. CSS spinner + Animated spinner 1:1 风格 (1s 周期 + 蓝色 + 轨道)
8. components/ui/index.ts 跨端 barrel export GeneratingLoader (跨端铁律 4++)

跑法: `node tools/verify-bug110-media-loader.js` (期望 PASS: 8 / FAIL: 0)

## § 7. 跨端铁律 4 (升级链路 mobile 独有, 跟 server 视角区分)
> **不冲突**: 跨端铁律是数字共享, 但内容按端类型分场景.

---

**详细 5 步流程 + 7 类失败诊断 + 完整命令模板** → [`./DEPLOY.md`](./DEPLOY.md)
**跨端版本管理 9 节完整规范** → [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)
**mobile 硬性规范 38 条** → [`./CODING_STANDARDS.md`](./CODING_STANDARDS.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

**🆕 S68 收口 + S71 后置**: 跨端通用规范 (中文/Persistence/铁律/工作流) 已收口到根 [`../../AGENTS.md`](../../AGENTS.md). S71 后加铁律 4+ / 8 / 3-8 处, **未来 AI 改 mobile 必同步看根 AGENTS.md § 4 铁律, 跟 server 视角统一**.

---

## § 6.7 v3.0.45 新增: 缓存方案 A — 本地优先 + novel_hashes + djb2 hash (S72 batch 16 BUG-115)

> **新增 2026-06-27 (S72 batch 16 v3.0.45 BUG-115)**: 解决"用户每次进 app 都重新 fetch 整本小说, 浪费带宽 + SQLite re-render 副作用".

### § 6.7.1 背景

Stage 2 (BUG-109) 加了媒体缓存 (图片/视频本地化), 但**整本小说数据**还是每次都全量 fetch + 全量 setState + 全量 INSERT OR REPLACE 写 SQLite:
- `fetchNovels()` 每 10/30s re-fetch → 即使 server 没变
- 全量 setState → UI re-render 副作用 (Skeleton 闪烁 / 图片重载)
- 全量 INSERT OR REPLACE → SQLite 写锁 + re-render

### § 6.7.2 缓存架构 (3 层 + djb2 hash)

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: screens fetch 流程 (BookshelfScreen + CharacterListScreen) │
│  - mount → getLocalNovels() / getLocalCharacters() (本地优先)          │
│  - 同时 → fetchNovels() / fetchCharacters() 后台异步 (秒级响应)      │
│  - 后台 fetch 完 → diffNovelsByHash() 比对, 只写 SQLite 变化的         │
│  - 没变 → 不写 SQLite → 不触发 re-render                              │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 2: hashNovel + diffNovelsByHash (apps/mobile/src/db/sqlite.ts)  │
│  - hashNovel(title, status, updatedAt, totalChars, summary, ...)        │
│  - 算法: djb2 + reverse (32 chars hex, 跟 web 1:1 算法)                 │
│  - diffNovelsByHash(serverNovels) → { changed: [], unchanged: [] }     │
│  - 没变 → 不写 SQLite, 跳过 INSERT OR REPLACE                          │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 3: SQLite novel_hashes 表 (id PK + hash + updated_at)           │
│  - CREATE TABLE IF NOT EXISTS novel_hashes (...)                        │
│  - saveNovelHash(id, hash, updated_at) → INSERT OR REPLACE              │
│  - getNovelHash(id) → hash | null                                       │
└──────────────────────────────────────────────────────────┘
```

### § 6.7.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | mobile 端 | web 端 | 一致性 |
|---|---|---|---|
| Hash 算法 | djb2 + reverse (32 chars hex) | 同左 | ✅ 1:1 |
| Hash 输入字段 | title + status + updatedAt + totalChars + summary.length + genre/theme/style/tone | 同左 | ✅ 1:1 |
| 本地存储 | SQLite `novel_hashes` 表 + `characters` 表 (description/extra_description/updated_at) | IndexedDB `novel_hashes` store + `characters` store | 概念一致, 实现不同 |
| diff 函数 | diffNovelsByHash(serverNovels) | diffNovelsByHash(serverNovels) | ✅ 1:1 |
| Server ALTER | `ALTER TABLE characters ADD COLUMN description/extra_description/updated_at` (BUG-115 A.1) | 跟 mobile 同步 | ✅ 1:1 |

### § 6.7.4 使用规范

1. **新 screen 必先 getLocalData 再 fetch**, 走"本地优先 + diff" 模式 (跟 BookshelfScreen 1:1)
2. **fetchNovels / fetchCharacters 必带 diffNovelsByHash 检查**, 没变不写 SQLite
3. **hash 算法 djb2 + reverse 不可改**, 改必 web + mobile 同步, 跑 verify-cache-local-data.js (8 维 38 子项)
4. **server 表必加 updated_at 字段**, 跟 mobile cache_meta 配套 (BUG-115 A.1 ALTER)
5. **server model create/update 必维护 updated_at = Date.now()** (BUG-115 A.1), ETag/304 依赖
6. **新接口必返完整字段** (description/extra_description/updated_at), 漏字段走 silent fail (跟 BUG-105/115 同源)

### § 6.7.5 跨项目通用 (跟 BUG-079/097/115 100% 同源)

- **本地优先必先 server 表 schema 配套** — mobile saveCharacters 跟 server characters 表 1:1, 漏字段丢数据
- **djb2 hash 不可改** — 跨端不可用不同 hash 算法, 改必双端同步
- **fetchInterval 必设上限** — 10/30s 太频繁, 改 5min 后台 polling + mount 即时本地
- **server updated_at 自动维护** — model create/update 不维护 → ETag/304 失效 (跟 BUG-115 A.1 同源)
- **verify-cache-local-data.js 必跑** — 8 维 38 子项: server ALTER 6 + mobile ALTER 3 + mobile characters 函数 4 + mobile novel_hashes 5 + mobile screens 5 + web IndexedDB 8 + 跨端 hash 3 + 跨项目铁律 4

### § 6.7.6 验证脚本 (S72 batch 16 BUG-115 A.6)

`tools/verify-cache-local-data.js` (8 维 38 子项 PASS):
1. server characters ALTER 6 字段 (description/extra_description/updated_at + INDEX)
2. server shots ALTER updated_at + INDEX
3. server characterModel.create/update 自动维护 updated_at
4. mobile characters 表 ALTER 3 字段
5. mobile characters 函数 4 个 (saveCharacters/getCharacters/updateCharacter/deleteCharactersByNovel)
6. mobile novel_hashes 表 + hashNovel/diffNovelsByHash/saveNovelIfChanged 5 函数
7. mobile screens 接入 (BookshelfScreen + CharacterListScreen 本地优先)
8. web IndexedDB 8 维 + 跨端 hash djb2 1:1

跑法: `node tools/verify-cache-local-data.js` (期望 PASS: 38 / FAIL: 0)

---

## § 6.8 v3.0.46 新增: 缓存方案 B — cache_meta + ETag/304 + axios interceptor (S72 batch 17 BUG-116)

> **新增 2026-06-27 (S72 batch 17 v3.0.46 BUG-116)**: 解决"服务器变了才重新加载"核心痛点, ETag/304 短路带宽 + axios interceptor 自动管理缓存.

### § 6.8.1 背景

Stage 2 (BUG-109) + 缓存方案 A (BUG-115) 解决了"本地优先"和"减少 SQLite 写", 但**只要 fetch 就走全量**:
- 列表页 mount → fetchNovels() 必下载整本 (即使 5 分钟前刚下过)
- server 没变也照样下载, 浪费 5Mbps 带宽
- 跨端 Web→App 同步缺统一缓存层 (axios 都各自处理)

**Etag/304** 标准 HTTP 缓存机制: server 响应 ETag header, 客户端下次 fetch 带 If-None-Match, server 比对 ETag 没变 → 返 304 不传 body. 跨项目通用, 老牌可靠.

### § 6.8.2 缓存架构 (cache_meta + axios interceptor)

```
┌──────────────────────────────────────────────────────────┐
│  Layer 1: screens fetch 流程 (BookshelfScreen + CharacterListScreen) │
│  - mount → getLocalData (本地优先)                                       │
│  - fetchNovels / fetchCharacters → client.get('/api/novels')             │
│  - response.headers['x-cache'] === 'HIT-304' → skip setState + skip saveDb│
│  - 没变化 → 不写 SQLite + 不 re-render (跟 BUG-115 闭环)                  │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 2: axios interceptor (apps/mobile/src/api/client.ts)              │
│  - request interceptor: 自动从 cache_meta 读 ETag → If-None-Match header │
│  - response 200: 存 ETag + body 到 cache_meta (setCachedResponse)        │
│  - response 304: 构造假 200, 返 cached body + x-cache: HIT-304 header    │
│  - 401 跨端同步 (跟 web 端 1:1, BUG-082 铁律 8 配套)                    │
└──────────────────────────────────────────────────────────┘
                          ↓ 依赖
┌──────────────────────────────────────────────────────────┐
│  Layer 3: cache_meta 表 (SQLite) + cacheMeta.ts 7 API                     │
│  - url PK + etag TEXT + body TEXT + status_code + updated_at              │
│  - INDEX idx_cache_meta_updated_at                                       │
│  - 7 API: setCachedResponse/getCachedETag/getCachedBody/deleteCachedResponse│
│           clearAllCacheMeta/trimCacheMeta/getCacheMetaStats              │
└──────────────────────────────────────────────────────────┘
                          ↑ 配套
┌──────────────────────────────────────────────────────────┐
│  server 端: etagMiddleware (apps/server/src/middleware/etag.ts)          │
│  - 11 个 routes 加 etagMiddleware (novels/tasks/episodes/chat/users/...) │
│  - SHA-256 前 16 hex → setHeader('ETag', 'W/"<16hex>"')                  │
│  - Cache-Control: private, must-revalidate, max-age=0                    │
│  - If-None-Match 命中 → 304 不传 body                                    │
└──────────────────────────────────────────────────────────┘
```

### § 6.8.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | mobile 端 | web 端 | 一致性 |
|---|---|---|---|
| Interceptor | axios interceptor in `src/api/client.ts` | axios interceptor in `src/lib/api.ts` | ✅ 1:1 |
| Cache 存储 | SQLite `cache_meta` 表 + IndexedDB `cache_meta` store | IndexedDB `cache_meta` store + (本地 file) | ✅ 1:1 |
| Cache key | `client.getCacheKey(url)` (method + url + params) | 同左 | ✅ 1:1 |
| ETag 头 | `If-None-Match` + `x-cache: HIT-304` | 同左 | ✅ 1:1 |
| Cache API | setCachedResponse/getCachedETag/getCachedBody/deleteCachedResponse/clearAllCacheMeta/trimCacheMeta/getCacheMetaStats | 同左 7 API | ✅ 1:1 |
| Server ETag | `etagMiddleware` (SHA-256 前 16 hex) | 同左 | ✅ 1:1 |

### § 6.8.4 使用规范

1. **fetch API 必走 axios interceptor**, 不要直接 fetch/RNFetchBlob (跟 BUG-117 公网 APK 教训一致, **fetch 是盲查**)
2. **response 必查 x-cache header**: `HIT-304` → skip setState + skip saveDb (跟 BUG-115 diffNovelsByHash 闭环)
3. **cache_meta 必加 INDEX** (`idx_cache_meta_updated_at`) — 大数据量 LRU 淘汰时查询 < 5ms
4. **server 必返 ETag + Cache-Control 头** — 缺一个 ETag/304 机制废
5. **新增 route 必加 etagMiddleware** — 11 个 routes 是基线, 新增必跟 deploy SOP 同步 (BUG-117 教训)
6. **client.getCacheKey 必 method + url + params** — 缺任一参数 cache key 错位

### § 6.8.5 跨项目通用 (跟 BUG-079/090/097/104/115/116 100% 同源)

- **fetch 必走 axios interceptor** — 不要直接 fetch/RNFetchBlob, interceptor 自动管 ETag + cache_meta
- **server etagMiddleware 必加** — 任何新 route 必同步加, 否则客户端 ETag 永远不命中
- **cache_meta 必加 INDEX** — 大数据量 LRU 淘汰查询慢 30x
- **fromCache 检查必 skip setState + skip saveDb** — 不 skip 等于没缓存 (跟 BUG-079 假报告 100% 同源)
- **verify-cache-etag.js 必跑** — 8 维 49 子项: server etagMiddleware 12 + etag.ts 4 + /api/version 字段 2 + mobile cache_meta 8 + mobile axios 5 + mobile screens 3 + web axios+IndexedDB 9 + 跨端 1:1 6
- **deploy.py 必加 scp 4 件套 + 公网 HEAD 验证 (BUG-117)** — 跨项目通用铁律, deploy.py 必同步升级 deploy.sh 路径 (scp APK + nginx reload + 公网 200 OK + Content-Type + Content-Length)

### § 6.8.6 验证脚本 (S72 batch 17 BUG-116 B.6)

`tools/verify-cache-etag.js` (8 维 49 子项 PASS):
1. server etagMiddleware 12 routes (novels/tasks/episodes/chat/users/recharge/admin/feedback/notifications/characters/pricing/billing)
2. server etag.ts 4 函数 (computeETag/etagMiddleware/setCacheControl/setETagHeader)
3. server /api/version 字段 2 (latestVersion + highlights)
4. mobile cache_meta 表 schema 8 (url PK + etag + body + status_code + updated_at + INDEX)
5. mobile cacheMeta.ts 5 API (setCachedResponse/getCachedETag/getCachedBody/deleteCachedResponse/getCacheMetaStats)
6. mobile axios interceptor 5 (request If-None-Match + response 200 存 + response 304 读 + x-cache header + 401 同步)
7. mobile screens 3 (BookshelfScreen + CharacterListScreen + fromCache check)
8. web axios + IndexedDB 9 (跟 mobile 1:1)

跑法: `node tools/verify-cache-etag.js` (期望 PASS: 49 / FAIL: 0)

### § 6.8.7 跟其他 BUG 关系

- **BUG-090** deploy.sh changelog.json cp 源错 (cp 用生产目录不是 /tmp/) — BUG-116 deploy.py 也跟 deploy.sh 配套升级
- **BUG-097** mobile 漏修 web — BUG-116 web + mobile 同步 (跨端铁律 4++)
- **BUG-104** server bump 漏 rebuild APK — BUG-117 公网 APK 教训, deploy.py 必加 scp 4 件套
- **BUG-115** 缓存方案 A (本地优先) — BUG-116 缓存方案 B (cache_meta + ETag/304) 是 A 的闭环
- **BUG-117** deploy.py 漏 scp APK — deploy.py v3.0 重写, scp 4 件套 + 公网 HEAD 验证

## § 6.9 v3.0.47 新增: videoAgent tool_throttled 细分 (S72 batch 19 BUG-118)

> **新增 2026-06-29 (S72 batch 19 v3.0.47 BUG-118)**: 修 videoAgent "限流暂停" 误标 404 task not found — 后端 error_msg 模板化 + ERR_TYPE 前缀 + 前端 parse 决定 label 颜色.

### § 6.9.1 背景

用户在 https://ab.maque.uno/video-agent 看到 2 个会话 (`ad9aad5b` / `6bec5aae`) 显示 "限流暂停" 橙色 chip, 怀疑真限流还是后端卡住.
- **真根因**: agens 上游 404 `task not found` (不是真 429 限流, 不是后端卡住)
- **代码层 bug** `videoAgentService.ts:795-803` (修前): 任何连续失败 5 次都标 `tool_throttled`, 文案写死 "API 限流 / 持续失败", 但 404/5xx/timeout 都算失败, 没区分
- **生产日志** (`/www/wwwroot/shipin-APP/logs/combined.log`) 实锤: 2 个 session 命中都是 `Agnes Video query error (404)`, 24h 全局错误 44/10/6 (429/404/400)
- 跟 BUG-079 假报告 + BUG-097 mobile 漏修 web 100% 同源: 前端 label 跟实际错误类型不匹配 = 用户被误导

### § 6.9.2 修法架构 (4 文件 + 8 处版本号 + 3 端 0 错)

```
┌──────────────────────────────────────────────────────────┐
│  server videoAgentService.ts: classifyPollingError(err)  │
│  - tag: '404' | '429' | '5xx'                             │
│  - error_msg 模板: `[${tag}] ${msg}, 已暂停轮询 (${n} 次). ${建议}`  │
│  - 404: 建议手动重试 (重新生成会创建新任务)                │
│  - 429: 请 1-2 分钟后手动重试                              │
│  - 5xx: 请稍后手动重试                                     │
└──────────────────────────────────────────────────────────┘
                          ↓ 1:1 镜像
┌──────────────────────────────────────────────────────────┐
│  web AgentChatPanel.tsx: statusBadge(s, errorMsg?)        │
│  - tool_throttled 子 label:                                │
│    [404] → 任务失效 (bg-red-100 text-red-700)             │
│    [429] → 限流暂停 (bg-orange-100 text-orange-700)       │
│    [5xx] → 上游异常 (bg-amber-100 text-amber-700)         │
│    无前缀 → 暂停 (老数据 fallback)                         │
│  - title=errorMsg 鼠标 hover 看全文                        │
└──────────────────────────────────────────────────────────┘
                          ↓ 1:1 镜像 (跨端铁律 4++)
┌──────────────────────────────────────────────────────────┐
│  mobile VideoAgentScreen.tsx: StatusBadge({ status, error_msg })  │
│  - THROTTLED_SUBTYPE_MAP 跟 web 1:1 镜像                  │
│  - 头部 convErrorMsg state (loadConversation + polling 同步) │
│  - 列表项 item.error_msg                                  │
└──────────────────────────────────────────────────────────┘
```

### § 6.9.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | mobile 端 | web 端 | 一致性 |
|---|---|---|---|
| 状态枚举 | tool_throttled (保持, DB 0 改) | 同左 | ✅ 1:1 |
| 细分维度 | error_msg 前缀 [404]/[429]/[5xx] | 同左 | ✅ 1:1 |
| 头部 status 同步 | convErrorMsg state (loadConversation + polling 同步) | currentErrorMsg state (syncConv 同步) | ✅ 1:1 |
| 列表项 | item.error_msg | c.errorMsg | ✅ 1:1 |
| label 文案 | 任务失效/限流暂停/上游异常 | 同左 | ✅ 1:1 |
| 颜色 (red/orange/amber) | 同 web | 同左 | ✅ 1:1 |

### § 6.9.4 使用规范

1. **error_msg 必带 ERR_TYPE 前缀**: 不要写死 "限流" 误导用户, 必先 classify 错误类型再决定文案
2. **后端 catch 块必先 classify**: 404/429/5xx/timeout 是不同语义, 不要一刀切
3. **UI label 必跟 status 字段 1:1 镜像**: 跨端 web + mobile 同步, 加 status 加 label 加映射
4. **不要给用户误导文案**: 跨项目通用, 文案错了用户白忙活
5. **短路 SQL 救活**: 后端没 "resume from throttled" 端点时, 用 SQL UPDATE 拉回 plan_ready (用户能重试)
6. **新 status 字段加 label 映射必 web + mobile 同步**: 加一处忘另一处 = 漏修 (跟 BUG-097 mobile 漏修 web 同源)

### § 6.9.5 跨项目通用 (跟 BUG-079/097/103/104/115/116/117 100% 同源)

- **error_msg 模板化 + ERR_TYPE 前缀**: 跨项目通用, 前端 parse 决定 UI 状态
- **后端 catch 块必先 classify**: 不要一刀切, 404/429/5xx 是不同语义
- **UI label 必跟 status 字段 1:1 镜像**: 跨端 web+mobile 同步
- **不要给用户误导文案**: 文案错了用户白忙活 (跟 BUG-079 假报告同源)
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3, v3.0.46→v3.0.47)
- **顺手修阻塞 deploy 的 pre-existing 错**: BookshelfPage Link import 1 行修复, tsc 失败阻塞 web build
- **mobile APK 必重打 跨端铁律 4++**: v3.0.47 mobile 代码已 push, 下次发版时 assembleRelease 一次性带出 (避免 mobile 用户看老 label 跟 web 不一致)

### § 6.9.6 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-118 用户被误导文案 100% 同源
- **BUG-097** mobile 漏修 web — BUG-118 加 status 字段时 web + mobile 同步 label
- **BUG-103** 自动退款漏刷 APK — BUG-118 mobile APK 此次未重打 已知遗留, 下次发版合并
- **BUG-115/116** 缓存方案 A+B — BUG-118 是新维度, 跟缓存方案同源跨项目通用铁律
- **BUG-117** 公网 APK 404 — BUG-118 跨端铁律 4++ mobile APK 必重打 (跟 deploy.py 必加 scp 4 件套配套)

---

**🆕 S68 收口 + S71 后置 + S72 batch 16/17/19/20/21/22 缓存方案 A+B + BUG-118 细分 + BUG-119 跨端 retry 清理 + 动画补齐 + BUG-120 等待卡片按比例显示 + BUG-121 agens-image image 数组对齐**: 跨端通用规范 + 缓存方案完整闭环 + 错误分类细分 + retry 边界清理 + 1:1 动画补齐 + ratio 维度补齐 + 文档字段格式对齐. **未来 AI 改 mobile 必同步看根 AGENTS.md § 4 铁律 + 本文件 § 6.5/6.6/6.7/6.8/6.9/6.10/6.11/6.12 跨端规范, 跟 server 视角统一**.

## § 6.12 v3.0.50 新增: agens-image-2.1-flash 图生图 image 字段从 string 改成 string[] 数组 (S72 batch 22 BUG-121)

> **新增 2026-06-29 (S72 batch 22 v3.0.50 BUG-121)**: 修 agnesImageProvider.ts:107 `body.extra_body.image = refImg` 改成 `body.extra_body.image = [refImg]` — 严格按文档 (8.3/8.4/8.5 三个例子) extra_body.image 必须是 string[] 数组, shipin-APP 单次只取 1 张主角参考图但 API 仍要求 array 形式.

### § 6.12.1 背景

用户审查 Agnes Image 2.1 Flash 最新文档 (https://wiki.agnes-ai.com/llms.txt),发现 shipin-APP agnesImageProvider.ts:107 传单 string, 文档明确要求 `image: ["url"]` array. 实际 agens API 容错接受 string 形式 (跑了 1 年没 400), 但严格按文档是 array 形式.

### § 6.12.2 修法架构 (1 行 server 修复 + 8 处版本号)

```
apps/server/src/services/agnesImageProvider.ts (line 107)
├─ 修前: body.extra_body.image = refImg;            (传 string, 1 年没 400)
└─ 修后: body.extra_body.image = [refImg];          (传 array, 严格按文档 8.3/8.4/8.5)

调用方链保持不变 (string[] 接口 → agnesImageProvider 单层取第 1 张后包成 array):
├─ imageProvider.ts:21 interface ImageGenOptions.referenceImages?: string[]
├─ imageAgentService.ts:581 referenceImages: refImages?.slice(0, 1)         (传 string[])
├─ comicService.ts:255 referenceImages: referenceImage ? [referenceImage] : undefined (传 string[])
├─ scriptService.ts:1175 referenceImages: referenceImages.length > 0 ? ... : undefined (传 string[])
├─ agnesImageProvider.ts:102 let refImg = options.referenceImages[0]            (取第 1 张, shipin-APP 业务保持"1 张图"逻辑)
└─ agnesImageProvider.ts:107 body.extra_body.image = [refImg]                 (BUG-121 修, 改传 array)
```

### § 6.12.3 跨端铁律 4++ 镜像

| 维度 | server 端 (修法源) | mobile/web 端 | 一致性 |
|---|---|---|---|
| 调用方接口 `referenceImages?: string[]` | `imageProvider.ts:21` | n/a (shipin-APP API 字段) | ✅ 跟 BUG-118 调用方链保持一致 |
| API 字段 `image: string[]` (8.3/8.4/8.5 文档) | `agnesImageProvider.ts:107` 修 | n/a | ✅ 1:1 镜像文档 |
| shipin-APP 业务"1 张图" | `options.referenceImages[0]` 取第 1 张 | n/a | ✅ 业务逻辑不变, 只改 API 字段格式 |

### § 6.12.4 使用规范

1. **API 容错不能当文档不一致挡箭牌, 必对齐**: agens 接受单 string 形式跑了 1 年没 400, 但严格按文档是 array 形式, 修后避免 agens 升级严格校验时突然 400 报错
2. **文档改了必同步改代码 (跟 BUG-118 v3.0.0 fix 字段路径同源)**: 5 年前修过 1 次"response_format/image 必须在 extra_body 内" 的字段路径 bug, 这次是同源"image 必须是 array" 的字段格式 bug
3. **调用方接口 string[] 跟 API 字段 image string[] 双向对齐**: `imageProvider.ts:21` 接口定义 `referenceImages?: string[]` 已经是数组, 但 `agnesImageProvider.ts:107` 这一层取了第 1 张后传单 string, 修后包成 array 保持双向一致
4. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 (跨端铁律 3)**: 哪怕只是 1 行 bug 修复, 也必走 v3.0.50 流程
5. **mobile 代码无变化也必重打 APK (跨端铁律 4++)**: versionCode 53→54 必走, 否则公网 404, shipin-APP 强制流程
6. **图生图 image 字段必走数组 (跟 BUG-118 v3.0.0 fix 字段路径同源)**: shipin-APP 业务"1 张图" + API 字段"array 数组" 双向对齐

### § 6.12.5 跨项目通用 (跟 BUG-079/082/096/097/103/115/116/117/118/119/120 100% 同源)

- **API 容错不能当文档不一致挡箭牌, 必对齐**: 跨项目通用铁律, 容错久了不修 = 风险
- **文档改了必同步改代码**: 跨项目通用铁律, 跟 BUG-118 同源
- **调用方接口跟 API 字段双向对齐**: 跨项目通用铁律, 缺一就是 bug
- **改了 server 端代码必升 v3.0.X + 8 处版本号同步**: 跨端铁律 3
- **mobile 代码无变化也必重打 APK**: 跨端铁律 4++

### § 6.12.6 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-121 API 容错接受 string 形式但严格按文档应 array 100% 同源
- **BUG-097** mobile 漏修 web — BUG-121 web + mobile 同步 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-121 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-121 跨项目通用铁律同源
- **BUG-118** v3.0.0 fix 字段路径 (response_format/image 必须在 extra_body 内) — BUG-121 教训同源 "文档改了必同步改代码"
- **BUG-119** retry 清理 + GeneratingLoader 全屏集成 — 跟 BUG-121 跨项目通用铁律同源
- **BUG-120** 等待动画卡片按比例显示 — 跟 BUG-121 跨项目通用铁律同源

## § 6.13 v3.0.51 新增: 拆 3 个 Agnes 企业 API Key + 增大 AI_MAX_CONCURRENT 并发 (S72 batch 23 BUG-122)

> **新增 2026-06-29 (S72 batch 23 v3.0.51 BUG-122)**: 修 shipin-APP 高并发时 (3+ 任务同时跑) Agnes API 偶尔 429 限流 — 用户采购 3 个独立企业 key (text/image/video), 替换老 1 key 调 3 模型共享配额, 改后 3 key 各自独立配额互不抢, 并发提升约 3x. AI_MAX_CONCURRENT=10→20.

### § 6.13.1 背景

shipin-APP 端 3 个 Agnes provider (text/image/video) 都读统一 `AGNES_API_KEY` fallback `AGNES_IMAGE_API_KEY` (v3.0.0 兼容老名). **1 把 key 调 3 模型共享配额**:
- text 端跑长任务 (剧本生成) + image 端跑长任务 (生图) + video 端跑长任务 (生视频) 都用同一把 key
- 三模型并发时互抢 QPS 上限, 高峰期 3+ 任务同时跑 → 429 限流
- AI_MAX_CONCURRENT=10 偏低, 适配普通版 key 浪费企业 key 配额
- 用户采购 3 个独立企业 key, 每个 key 配额独立不互抢, 企业版 QPS 上限更高

**3 重真根因**:
1. **shipin-APP 端 3 provider 用 1 key**: text/image/video 抢同一把 key QPS
2. **AI_MAX_CONCURRENT=10 偏低**: 适配企业版 key 必须放大 (10→20)
3. **provider 读 key 优先级没拆**: v3.0.0 设计 "1 把 key 通用所有端点" (跟 Agnes 文档一致), 但企业版实测拆开更稳

### § 6.13.2 修法架构 (4 文件 + 8 处版本号 + 1 changelog + .env 3 新字段)

```
┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesTextProvider.ts (line 44)            │
│  - 修前: apiKey || AGNES_API_KEY || AGNES_IMAGE_API_KEY             │
│  - 修后: apiKey || AGNES_TEXT_API_KEY || AGNES_API_KEY || AGNES_IMAGE_API_KEY │
│  - 优先级: AGNES_TEXT_API_KEY (企业 text 专用) > AGNES_API_KEY (统一, 兼容老) > AGNES_IMAGE_API_KEY (历史) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesImageProvider.ts (line 32)           │
│  - 字段名复用 = 专用 + 老兼容合并 (不破坏老配置)                     │
│  - apiKey || AGNES_IMAGE_API_KEY || AGNES_API_KEY                   │
│  - shipin-APP 老配置就有 AGNES_IMAGE_API_KEY 字段, 不改名直接用      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/agnesVideoProvider.ts (line 54)           │
│  - apiKey || AGNES_VIDEO_API_KEY || AGNES_API_KEY || AGNES_IMAGE_API_KEY │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/src/services/imageProvider.ts (line 177 autoInitProvider)│
│  - 同步改字段名, 加注释标记 v3.0.51 BUG-122                          │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  apps/server/.env.example + .env.production + 远端 .env                │
│  - AGNES_TEXT_API_KEY=wk-Cxl2htXZQo3EDLWwvz0zHgb6hDLv7AOYV5c0CZRVGOqWrgmb (新增) │
│  - AGNES_IMAGE_API_KEY=wk-vjuIS1Tc8NZ6LLxe5EwThLOIVpIF1lHjOMPsgLmQ5zb8OgYa (替换老)│
│  - AGNES_VIDEO_API_KEY=wk-u9LBnjvKj8Ppo2XGPzaRCFW1NJlGKVx2OY0fhptLceWpv32c (新增) │
│  - AI_MAX_CONCURRENT=10 → 20                                       │
│  - CHUNK_CONCURRENT=10 → 20 (DeepSeek 3 key 轮换池跟 Agnes 共享) │
└──────────────────────────────────────────────────────────┘
```

### § 6.13.3 跨端铁律 4++ 镜像 (跨端规范沉淀)

| 维度 | shipin-APP server 端 | mobile/web 端 | 一致性 |
|---|---|---|---|
| 3 个独立 key 字段 | AGNES_TEXT_API_KEY / AGNES_IMAGE_API_KEY / AGNES_VIDEO_API_KEY | n/a (server 配置) | ✅ BUG-122 新规范 |
| Key 优先级链 | 专用 > 统一 > 老兼容 | n/a | ✅ BUG-122 新规范 |
| AI_MAX_CONCURRENT | 10 → 20 (企业版适配) | n/a | ✅ BUG-122 性能规范 |
| CHUNK_CONCURRENT | 10 → 20 (跟 Agnes 共享) | n/a | ✅ BUG-122 性能规范 |
| 跨端部署 | server 改 → 必升 v3.0.X + 8 处版本号 + 重打 mobile APK | n/a | ✅ 跨端铁律 4++ 强制 |

### § 6.13.4 使用规范

1. **多 provider 配额独立必拆字段**: 1 个 key 调多模型 = 共享配额, 拆 N key = 各模型独立配额. 这是简单暴力方案, 但实测有效
2. **企业版 key 配 client 端并发放大**: AI_MAX_CONCURRENT=10 适配普通版, 配企业版必须放大 (10→20), 否则浪费配额
3. **.env 字段名复用不破坏老配置**: 字段名同名 (AGNES_IMAGE_API_KEY 既是专用名也是老兼容名) 是设计, 不是 bug. shipin-APP 老部署不用改任何 .env
4. **拆 key 字段映射必带 fallback 链**: AGNES_*_API_KEY (新企业专用) → AGNES_API_KEY (统一, 兼容老) → AGNES_IMAGE_API_KEY (历史兼容, 最老). 老部署升级零成本
5. **企业 key 实测 E2E 必做**: deploy 完必跑真实 API 调用 (text + image + video) 确认 key 生效, 不要只验证 /api/version
6. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK (跨端铁律 4++)**: 哪怕只改 env key 字段映射, 也必走 v3.0.51 流程
7. **跨端铁律 8 配套**: shipin-APP 端代码没池化 (每请求直调 Agnes), 限流问题在 API 端 + 客户端并发限制 2 个方向都有责任, 不能把 429 当 "客户端不需要限制" 的借口

### § 6.13.5 跨项目通用 (跟 BUG-079/097/103/115/116/117/118/119/120/121 100% 同源)

- **API 限流不能当客户端并发不限制挡箭牌**: 跨项目通用铁律, 限流是 API 端 + 客户端双向问题
- **多 provider 配额独立必拆字段**: 跨项目通用铁律, 1 key 共享配额 = 风险
- **企业版 key 配 client 端并发放大**: 跨项目通用铁律, 配普通版配置 = 浪费配额
- **.env 字段名复用不破坏老配置**: 跨项目通用铁律, 老部署零成本升级
- **拆 key 字段映射必带 fallback 链**: 跨项目通用铁律, 兼容性是硬指标
- **企业 key 实测 E2E 必做**: 跨项目通用铁律, /api/version 不够, 必须真实 API 调用
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
- **mobile 代码无变化也必重打 APK (跨端铁律 4++)**: 跨项目通用铁律
- **deploy.sh `systemctl reset-failed` 必须**: 连续 5 次 restart 失败后卡住, reset-failed 之后才能 start (BUG-117 教训)

### § 6.13.6 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-122 同样 "API 端容错 = 客户端不需要限制" 的反模式
- **BUG-097** mobile 漏修 web — BUG-122 web + mobile 同步 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-122 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-122 跨项目通用铁律同源
- **BUG-118/119/120/121** 一系列 server 端修复 — BUG-122 是最后一块: 之前都是修单点 (字段路径/retry/动画/ratio/image array), BUG-122 修"基础设施层 (key + 并发)"

### § 6.13.7 实战 E2E 验证 (deploy 后实测)

- ✅ /api/version: 3.0.51, latestVersion=3.0.51
- ✅ /api/pricing: 3.0.51, characterVariant=0.1
- ✅ Agnes TEXT API 实测: HTTP 200, "Hi!" reply, 260 tokens (AGNES_TEXT_API_KEY=wk-Cxl2h...)
- ✅ Agnes IMAGE API 实测: HTTP 200, has image URL (AGNES_IMAGE_API_KEY=wk-vjuI...)
- ✅ Agnes VIDEO API 实测: HTTP 200, task queued (AGNES_VIDEO_API_KEY=wk-u9LB...)
- ✅ 公网 APK v3.0.51 下载: HTTPS HTTP/2 200, size=30230467 bytes
- ✅ 公网 sha256: 29328F5280F270A49EEFB353B76F597C5969ED06342B5F090AD94DF269B96B43

---

## § 6.14 v3.0.52 新增: Agnes API 限流排队 image 40/min + video 2/min (S72 batch 24 BUG-123)

> **新增 2026-06-29 (S72 batch 24 v3.0.52 BUG-123)**: 修 shipin-APP 高并发 (3+ 任务同时跑) Agnes API 偶发 429 限流 — 跟 BUG-122 拆企业 key 配套, 客户端必加 sliding window 限流器 + FIFO 队列 + ETA 估算 + 跨端 UI 排队位置展示. 用户体验: "第 N 位 · 预计 X 秒".

### § 6.14.1 背景 (跟 web § 5.9.1 1:1)

BUG-122 拆 3 个企业 key 后, 高并发仍偶发 429 — 企业版配普通客户端并发 = 限流. Agnes API 端实际限流:
- image generation: 40 次/分钟 (RPM)
- video generation: 2 次/分钟 (RPM)

shipin-APP 端 6 个 provider 调用点 (5 image + 1 video) 全部 "fire-and-forget", 无任何客户端限流/排队机制. 3 个用户同时点 "生成图片" = 3 个并发 image 调用, 40+ 任务时必撞限流.

**3 重真根因**:
1. **客户端无队列机制**: 6 个 provider 调用点全部 "fire-and-forget"
2. **限流器缺失**: 依赖 Agnes API 端 429 错误 + retry (5min × 3 retry 太长, 用户体验差)
3. **限流状态不可见**: 用户看不到 "我在排队" / "前面有 N 个人" / "预计等待 X 秒", 跟前端 UX 不闭环

### § 6.14.2 修法架构 (4 新文件 + 6 调用点包装 + 2 API + 跨端 UI)

```
┌──────────────────────────────────────────────────────────┐
│  apps/server/src/utils/rateLimiter.ts (新建, 核心)                       │
│  - SlidingWindowLimiter 类 (timestamp 滑动窗口 + FIFO 队列)         │
│  - acquire(taskId): Promise<RateLimitSlot>                            │
│    - 有 slot 立即返回 (timestamp 入 sliding window)                   │
│    - 满 Promise 排队, 5min 超时 reject                                │
│  - release() 自动调用, timestamp 保留至 windowMs 过期 (严格 1 分钟)   │
│  - getStatus(): { active, waiting, limit, oldestEtaMs, avgDurationMs, estimatedWaitMs } │
│  - getQueuePosition(taskId): 1-based, null = 不在队列                  │
│  - getTaskQueueInfo(taskId): { position, etaSeconds }                │
│  - getAgnesImageLimiter() 单例 (40/min)                              │
│  - getAgnesVideoLimiter() 单例 (2/min)                               │
│  - ETA: estimatedWaitMs = ceil(max(oldestEtaMs, avgDurationMs) × waiting / max(1, active)) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  包装 5 个 image 调用点 + 1 个 video 调用点                          │
│  - imageAgentService.ts:576: rateLimitedGenerate({ taskId, label: 'imageAgent', imageOptions }) │
│  - scriptService.ts:1168: rateLimitedGenerate({ taskId: shot.id, label: 'shot:N', ... }) │
│  - comicService.ts:248: rateLimitedGenerate({ taskId, label: 'comic:pageN', ... }) │
│  - characterService.ts:618 (sheet): rateLimitedGenerate({ taskId: characterId, label: 'characterSheet' }) │
│  - characterService.ts:800 (shot): rateLimitedGenerate({ taskId: shotId, label: 'shotImage' }) │
│  - videoAgentService.ts:547: agnesVideoProvider.createTaskWithLimit(opts, conversationId, 'videoAgent') │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  2 个 API 端点                                                       │
│  - GET /api/admin/rate-limit-status (admin auth)                    │
│    → { image: { active, waiting, limit, oldestEtaMs, avgDurationMs, estimatedWaitMs }, video: 同 } │
│  - GET /api/tasks/:taskId/queue (user auth)                         │
│    → { taskId, inQueue, image: { position, etaSeconds }, video: { position, etaSeconds }, global: {...} } │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  跨端 UI 集成 (跨端铁律 4++ 1:1 镜像 web + mobile)                    │
│  - apps/web/src/hooks/useQueueStatus.ts (新建, 3s 轮询 hook)         │
│  - apps/web/src/components/AgentChatPanel.tsx                       │
│    case 'streaming' 改用 <StreamingCard part={stage, kind, isUser, conversationId}> │
│    新组件 StreamingCard 集成 useQueueStatus + GeneratingLoader + 排队 amber 卡片 │
│  - apps/mobile/src/hooks/useQueueStatus.ts (新建, 1:1 镜像 web)     │
│  - apps/mobile/src/screens/VideoAgentScreen.tsx                     │
│    case 'streaming' 改用 <StreamingCard kind="video" ...>            │
│  - apps/mobile/src/screens/ImageAgentScreen.tsx                    │
│    case 'streaming' 改用 <StreamingCardImage ...>                    │
│  - 跨端排队 UI 文案: "⏳ 排队中: 第 N 位 · 预计 X 秒 (生图 40 次/分钟)" (amber 配色) │
│  - 自动停止轮询: 任务不在队列时 useQueueStatus 内部 clearInterval      │
└──────────────────────────────────────────────────────────┘
```

### § 6.14.3 跨端铁律 4++ 镜像 (跟 web § 5.9.3 1:1)

| 维度 | server (源) | mobile | web | 一致性 |
|---|---|---|---|---|
| Hook API | n/a (服务端) | useQueueStatus (3s 轮询, return {status, loading, error}) | useQueueStatus (1:1 镜像) | ✅ 1:1 |
| Hook 返回值 | n/a | { status: QueueStatus, loading, error } | 同左 | ✅ 1:1 |
| Hook 自动停止 | n/a | inQueue=false 时 clearInterval | 同左 | ✅ 1:1 |
| QueueStatus 类型 | n/a | { taskId, inQueue, image: { position, etaSeconds }, video: { position, etaSeconds }, global: {...} } | 同左 (跟 server API 1:1) | ✅ 1:1 |
| 排队 UI 文案 | n/a | "⏳ 排队中: 第 N 位 · 预计 X 秒 (生图 40 次/分钟)" | 同左 | ✅ 1:1 |
| 排队 UI 颜色 | n/a | amber (#fef3c7 bg + #fbbf24 border + #92400e text) | amber (amber-50 bg + amber-200 border + amber-700 text) | ✅ 1:1 配色 |
| API client | n/a | getTaskQueueStatus(taskId) (axios interceptor 自动 401 同步) | getTaskQueueStatusApi(taskId) | ✅ 1:1 |
| StreamingCard 集成 | n/a | VideoAgentScreen + ImageAgentScreen 用 useQueueStatus hook | AgentChatPanel 用 useQueueStatus hook | ✅ 1:1 |
| 排队 UI 触发条件 | n/a | position !== null && position > 0 | 同左 | ✅ 1:1 |

### § 6.14.4 使用规范 (跟 web § 5.9.4 1:1)

1. **API 限流不能当客户端不限制挡箭牌**: shipin-APP 客户端代码没池化 (每请求直调), 限流问题在 API 端 + 客户端并发限制 2 个方向都有责任. 拆企业 key (BUG-122) + 限流器 (BUG-123) 双管齐下
2. **严格 sliding window > 纯并发限流**: timestamp 保留至 windowMs 过期 (不是 release 时删除). 匹配 Agnes API 端 "1 分钟 40 次" 严格语义. 纯并发限流当 API 端真限流时必踩坑
3. **FIFO 队列 + 排队超时必加**: 不超时 → 永远卡死; 不 FIFO → 不公平. 5min 排队超时 reject 是默认
4. **ETA 估算必基于 oldestEtaMs + avgDurationMs**: 不能瞎拍脑袋. 客户端跟服务端 1:1 一致, 不能让前端误算
5. **限流状态必暴露给前端 UI**: admin 全局 + 单 task detail 2 个 API. 用户看不到排队 = 假修 (跟 BUG-079 同源)
6. **限流配置化 (.env 4 字段)**: AGNES_IMAGE_RATE_LIMIT / AGNES_IMAGE_RATE_WINDOW_MS / AGNES_VIDEO_RATE_LIMIT / AGNES_VIDEO_RATE_WINDOW_MS. 不硬编码
7. **跨端排队 UI 必 1:1 镜像 web + mobile**: hook API + QueueStatus type + UI 文案 + 配色 4 维一致 (跨端铁律 4++)
8. **新加 provider 调用必走 rateLimitedGenerate**: 不准直接调 imageProvider.generate() / agnesVideoProvider.createTask(), 否则绕过限流器
9. **useQueueStatus 自动停止轮询**: inQueue=false 时自动 clearInterval. 不要在 UI 层手写定时器, 走 hook
10. **改了 server 端代码必升 v3.0.X + 8 处版本号同步 + 重打 mobile APK + 重 build web dist**: 哪怕只加一个 .env 字段, 也必走 v3.0.52 流程
11. **排队 UI 配色必 amber (黄/警告)**: 跟 "任务失效" red / "限流暂停" orange / "上游异常" amber BUG-118 配色体系一致, 别乱用色
12. **APK 必传 shipin-APP/public/**: nginx `location ^~ /app/` → `alias /www/wwwroot/shipin-APP/public/`. deploy.sh 默认错路径, 必手动 scp (BUG-117 教训)

### § 6.14.5 跨项目通用 (跟 BUG-079/082/096/097/103/104/115/116/117/118/119/120/121/122 100% 同源)

- **API 限流不能当客户端不限制挡箭牌**: 跨项目通用铁律, 限流是 API 端 + 客户端双向问题
- **严格 sliding window > 纯并发限流**: 跨项目通用铁律, 严格 1 分钟 N 次语义
- **FIFO 队列 + 排队超时必加**: 跨项目通用铁律, 避免永远卡死
- **ETA 估算必基于 oldestEtaMs + avgDurationMs**: 跨项目通用铁律, 不能瞎拍
- **限流状态必暴露给前端 UI**: 跨项目通用铁律, 用户看不到 = 假修
- **限流配置化 (.env 4 字段)**: 跨项目通用铁律, 不硬编码
- **跨端排队 UI 必 1:1 镜像**: 跨端铁律 4++, hook + type + UI + 配色 4 维
- **新加 provider 调用必走 rateLimitedGenerate**: 跨项目通用铁律, 不准绕过限流器
- **8 处版本号同步必走**: 跨端铁律 3, 改 1 处必同步 8 处
- **mobile 代码无变化也必重打 APK**: 跨端铁律 4++
- **web dist 必重 build + scp + nginx reload**: web 端独有 (跟 mobile APK 同等重要, 跨端铁律 4++)
- **APK 必传 shipin-APP/public/**: 跨项目通用铁律, nginx `location ^~ /app/` 路径
- **strip UTF-8 BOM from build.gradle + package.json**: 跨项目通用铁律
- **deploy.sh `systemctl reset-failed` 必须**: 跨项目通用铁律, BUG-117 教训
- **排队 5min 超时 reject**: 跨项目通用铁律, 避免永远卡死
- **单进程 in-memory limiter**: 多进程需 Redis (跨项目通用铁律, 当前 shipin-APP 单进程 systemd 不需要)

### § 6.14.6 跟其他 BUG 关系 (跟 web § 5.9.6 1:1)

- **BUG-079** 假报告 — 跟 BUG-123 同样 "API 端容错 = 客户端不需要限制" 的反模式
- **BUG-097** mobile 漏修 web — BUG-123 web + mobile 1:1 镜像 (跨端铁律 4++)
- **BUG-103** 自动退款漏刷 APK — BUG-123 此次已重打 mobile APK
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-123 跨项目通用铁律同源
- **BUG-118** 细分 status label UI — BUG-123 排队 UI 配色 amber 跟 BUG-118 限流暂停 orange / 任务失效 red / 上游异常 amber 体系一致
- **BUG-119** retry 清理 + GeneratingLoader — BUG-123 排队 UI 集成在 BUG-119 GeneratingLoader 同位置 (跨端铁律 4++)
- **BUG-120** 等待动画卡片按比例显示 — BUG-123 排队 UI 在 BUG-120 比例卡片下方 (跨端铁律 4++)
- **BUG-121** agens-image image array — BUG-123 是基础设施层, BUG-121 是字段格式层, 互补
- **BUG-122** 拆 3 企业 key — BUG-123 拆限流器, BUG-122 拆 key 字段, 互补 (跨端铁律 4++)

### § 6.14.7 实战 E2E 验证 (deploy 后实测)

- ✅ /api/version: 3.0.52, latestVersion=3.0.52
- ✅ /api/pricing: 3.0.52, characterVariant=0.1
- ✅ 12 维验证全过 (systemd active + 6000 LISTEN + /health 200 + /api/version 3.0.52 + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ 限流器模块加载: image limit 40/60s + video limit 2/60s
- ✅ 42 个并发 image acquire E2E: 40 立即入 active, task-40/task-41 入队 (position=1/2, etaSeconds=2/3)
- ✅ 公网 APK v3.0.52 下载: HTTPS HTTP/2 200, size=30233025 bytes
- ✅ 公网 sha256: 020B61E3D7342DC2A1518E09DC02585B171CC2700956AEDF5504A8B9441CA39C (本机跟远端 1:1 一致)
- ✅ web dist 部署: index-BdFAwImD.js (535KB) + index-CnPZ-cNl.css (43KB), https://ab.maque.uno/ HTTP/2 200

---

## § 6.11 v3.0.49 新增: 等待动画卡片按用户选的比例显示 (S72 batch 21 BUG-120)

> **新增 2026-06-29 (S72 batch 21 v3.0.49 BUG-120)**: 修视频/生图助手等待动画卡片按用户选的比例显示 — 跨端 web + mobile 1:1 加 `aspectRatio.ts` util (跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 镜像), streaming 卡片容器按 1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / 2K / 4K / 8K 比例显示, auto 默认 image 1:1 / video 16:9.

### § 6.11.1 背景 (跟 web § 5.8.1 1:1)

用户选了 16:9 横屏比例, 点"确认方案" → 等待动画卡片是 mobile 默认 360x202 横向 (不是 16:9 实际比例 1152×768) → 等 1-3 分钟完成 → 视频变成 16:9 实际比例 → 跳变感强, 用户感觉"等待跟完成不一致".

**根因**: 修前 `case 'streaming'` 渲染用固定样式 (mobile `styles.streamingBox` 固定 flex row 容器, web `p-4 rounded-lg` 自适配) — 不读用户选的 selectedRatio. 跟 BUG-118/119 教训 100% 同源 (加了 state 但漏消费到所有相关 render).

### § 6.11.2 修法架构 (5 文件 + 2 新建 + 8 处版本号)

```
┌──────────────────────────────────────────────────────────┐
│  apps/mobile/src/utils/aspectRatio.ts (新建, 跟 web + server 1:1) │
│  - ASPECT_RATIO_DIMS: 10 ratio → 实际 w/h              │
│  - parseAspectDims(ratio, kind): 支持 '16:9' / '2K' / 'WxH' 3 格式 │
│  - defaultRatioForKind(kind): auto fallback (image 1:1 / video 16:9) │
│  - getMobileAspectStyle: 返 { aspectRatio: number, width, height } │
│    (RN 0.73 aspectRatio number, 缩到 1/3 显示)          │
└──────────────────────────────────────────────────────────┘
                          ↓ 1:1 镜像 (跨端铁律 4++)
┌──────────────────────────────────────────────────────────┐
│  VideoAgentScreen.tsx + ImageAgentScreen.tsx streaming 渲染   │
│  - import getMobileAspectStyle from '../utils/aspectRatio'│
│  - <View style={{ aspectRatio, width, alignSelf: 'center' }}>│
│  - selectedRatio 是 component state, renderPart 闭包访问  │
└──────────────────────────────────────────────────────────┘
```

### § 6.11.3 跨端铁律 4++ 镜像 (跟 web § 5.8.3 + server `imageAspectRatio.ts` 1:1)

| 维度 | web 端 | mobile 端 | server 端 (真源) | 一致性 |
|---|---|---|---|---|
| Util 文件 | `apps/web/src/lib/aspectRatio.ts` | `apps/mobile/src/utils/aspectRatio.ts` | `apps/server/src/prompts/imageAspectRatio.ts` (SUPPORTED_RATIOS) | ✅ 1:1 |
| ASPECT_RATIO_DIMS 10 项 | 1:1=1024², 16:9=1152×768, 9:16=768×1152, 4:3=1024×768, 3:4=768×1024, 2:3=768×1152, 3:2=1152×768, 2K=1280², 4K=2048², 8K=2048² | 同左 | 同左 (SUPPORTED_RATIOS map) | ✅ 1:1 |
| parseAspectDims 3 格式 | '16:9' / '2K' / 'WxH' | 同左 | 同左 (parseAspectToDims) | ✅ 1:1 |
| defaultRatioForKind | image 1:1, video 16:9 | 同左 | 同左 (DEFAULT_ASPECT) | ✅ 1:1 |
| getStyle 返值 | `{ aspectRatio: 'W / H', maxWidth, maxHeight }` CSS | `{ aspectRatio: number, width, height }` RN 0.72+ | n/a (server 不渲染) | ✅ 1:1 跨端 (web/mobile 风格略不同) |
| 缩放 | max 480px (max edge) | 1/3 显示 | n/a | ✅ 1:1 |

### § 6.11.4 使用规范 (跟 web § 5.8.4 1:1)

1. **等待动画卡片尺寸必跟用户选的比例 1:1, 完成后的 result 不能跟等待时比例跳变**: 用户在 confirm 前选了什么比例, streaming 卡片就用什么比例
2. **ratio 字典必 web + mobile + server 三端 1:1 同步**: 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 镜像, 改必双端+server 三端同步
3. **跨端铁律 4++ 1:1 镜像**: helper API (parseAspectDims) / getStyle 入口 (getWebAspectStyle + getMobileAspectStyle) / 10 ratio 字典 跨端一致
4. **auto fallback 默认值 web + mobile + server 1:1**: image 走 1:1, video 走 16:9
5. **加了 state 必消费到所有相关 render**: 跟 BUG-118/119 教训同源, selectedRatio 之前是 state 但 streaming 卡片没消费
6. **CSS aspectRatio (web) 用 'W / H' 字符串, RN aspectRatio (mobile) 用 number**: 跨端 1:1 但实现细节不同 (web Tailwind 3 支持 / RN 0.72+ 支持 number)
7. **prop drilling vs 闭包访问**: web AgentChatPanel 走 prop drilling (顶层 → MessageBubble → PartSafeView → PartView), mobile 走闭包访问 (selectedRatio 是 state, renderPart 直接用). 效果一致
8. **alignSelf: 'center' 必加 (mobile)**: 容器按比例缩后, 必须居中显示
9. **<View style={[styles.streamingBox, { aspectRatio, width, alignSelf: 'center' }]}> (mobile)**: 合并 streamingBox 基础样式 + aspectRatio 覆盖, 1 行搞定

### § 6.11.5 跨项目通用 (跟 BUG-079/082/096/097/103/115/116/117/118/119 100% 同源)

- **等待动画卡片尺寸必跟用户选的比例 1:1**: 不 1:1 就有跳变感
- **ratio 字典必 web + mobile + server 三端 1:1 同步**: 跨项目通用铁律, 改必双端+server 三端同步
- **跨端铁律 4++ 1:1 镜像**: 跨端铁律 4++
- **auto fallback 默认值跨端 1:1**: image 1:1 / video 16:9
- **加了 state 必消费到所有相关 render**: 跨项目通用铁律, 跟 BUG-118/119 同源
- **CSS aspectRatio 用字符串, RN aspectRatio 用 number**: 实现细节不同, 跨端 1:1 但用对工具
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
- **strip UTF-8 BOM from build.gradle + package.json**: 跨项目通用铁律

### § 6.11.6 跟其他 BUG 关系 (跟 web § 5.8.6 1:1)

- **BUG-079** 假报告 — 跟 BUG-120 selectedRatio 没消费到 streaming 100% 同源
- **BUG-097** mobile 漏修 web — BUG-120 web + mobile 同步 (跨端铁律 4++)
- **BUG-110** GeneratingLoader Stage 3 — BUG-120 在 Stage 3 基础上按比例显示
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-120 跨项目通用铁律同源
- **BUG-118** 细分 status 字段但漏加 status label UI — BUG-120 教训同源 "加了 state 漏消费"
- **BUG-119** retry 清理 + GeneratingLoader 全屏集成 — BUG-120 补上 ratio 维度

## § 6.10 v3.0.48 新增: videoAgent/imageAgent retry 边界清空旧 result part + GeneratingLoader 跨端 1:1 集成补齐 (S72 batch 20 BUG-119)

> **新增 2026-06-29 (S72 batch 20 v3.0.48 BUG-119)**: 修视频助手 retry 视频堆叠 + 补标准生成中动画 — 跨端 web + mobile 1:1 加 `clearResultParts(parts)` helper (retry 前先清空 last assistant 的 video/image-result/error/旧 streaming, 避免堆叠 2 张卡片), streaming 渲染改用 GeneratingLoader (Stage 3 v3.0.43 组件, 之前只集成 ScriptDetailPage 一处, AgentChatPanel + VideoAgentScreen + ImageAgentScreen 漏集成).

### § 6.10.1 背景

用户在 https://ab.maque.uno/video-agent BUG-118 修后 (ad9aad5b / 6bec5aae SQL 救活成 plan_ready) 点"确认方案" retry → 等待 → 完成后页面同时显示 2 个 0:00/0:15 视频卡片 (堆叠 2 张, 内容相同). 同时流式卡片是 "AI 渲染视频, 别关页面..." + Loader2 文字 (不是 BUG-110 Stage 3 设计的标准 spinner 动画).

**双 BUG 100% 同源 (跟 BUG-079/082/096/097/103/104/115/116/117/118 同源)**:
- **BUG-A (retry 边界没清空旧 result part)**: 修前 `confirmAndGenerate` / `confirm` / `confirmGenerate` 找 last assistant message 的 `plan` part 替换为 `streaming`, 但**该 message 之前的 video / error / image result part 不清空**. 第二次完成时 push 新 video, 跟旧 video 一起渲染 → 2 个堆叠
- **BUG-B (stage 3 BUG-110 GeneratingLoader 组件漏集成)**: v3.0.43 stage 3 BUG-110 加了 `components/ui/GeneratingLoader.tsx` (web + mobile 1:1) + AGENTS.md § 5.4 / § 6.6.4 强约束 "AI 生成中/loading 场景必用 GeneratingLoader, 替代 ActivityIndicator / 加载中文本". **实际只集成在 `ScriptDetailPage.tsx` (web) + `ScriptDetailScreen.tsx` (mobile) 一处**, AgentChatPanel.tsx `case 'streaming'` 用 `Loader2 size={28}` (lucide-react) + VideoAgentScreen / ImageAgentScreen 用 `ActivityIndicator size="small"`

### § 6.10.2 修法架构 (5 文件 + 8 处版本号 + 3 端 0 错 + 12 维验证全过)

```
┌──────────────────────────────────────────────────────────┐
│  web AgentChatPanel.tsx (image+video 共用, 改一处两边都修)        │
│  - import GeneratingLoader from './ui'                    │
│  - module scope: clearResultParts(parts)                  │
│    └─ filter 掉 video / error / streaming / image(role=result)│
│  - confirmAndGenerate + confirm + status effect 3 处都先 strip │
│  - case 'streaming' 改用 GeneratingLoader 替代 Loader2+Sparkles │
└──────────────────────────────────────────────────────────┘
                          ↓ 1:1 镜像 (跨端铁律 4++)
┌──────────────────────────────────────────────────────────┐
│  mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx (分开)│
│  - import GeneratingLoader from '../components/ui'       │
│  - module scope: clearResultParts(parts) 跟 web 1:1      │
│  - confirmGenerate + polling 终态 2 处都先 strip         │
│  - case 'streaming' 改用 GeneratingLoader 替代 ActivityIndicator│
└──────────────────────────────────────────────────────────┘
```

### § 6.10.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Helper API | `clearResultParts(parts): AgentPart[]` (module scope) | 同左 (module scope) | ✅ 1:1 |
| Filter 逻辑 | `video` / `error` / `streaming` / `image(role=result)` 4 类 | 同左 | ✅ 1:1 |
| 集成点 | confirmAndGenerate + confirm + status effect 3 处 | confirmGenerate + polling 终态 2 处 (imageAgentScreen 同 2 处) | ✅ 1:1 (web AgentChatPanel 是 image+video 共用, 改 1 处两边都修; mobile image+video 分开) |
| GeneratingLoader 渲染 | `<GeneratingLoader size="md" label="..." />` 替代 Loader2 | `<GeneratingLoader size="md" label="..." />` 替代 ActivityIndicator | ✅ 1:1 |
| 1s 周期 + 蓝色 | CSS spinner 1s | Animated 1000ms | ✅ 1:1 |
| MAX_RETRIES / size 选项 | sm/md/lg | 同左 | ✅ 1:1 |

### § 6.10.4 使用规范

1. **retry 边界必清空旧 result part (前端不能 append, 要 replace)**: 找 `plan` 替成 `streaming` 之前, 先 `cleaned = clearResultParts(last.parts)` 再 push 新 streaming. 不 strip 就是堆叠
2. **AI 生成中/loading 场景必用 GeneratingLoader 跨端 1:1, 不准裸用 Loader2/ActivityIndicator**: AGENTS.md § 5.4 (web) + § 6.6.4 (mobile) 强约束
3. **加了 component 必集成到所有相关 screen, 不留半成品**: 写完 GeneratingLoader 必 grep 找 "ActivityIndicator" / "Loader2" / "加载中" 字符串, 全部替换
4. **跨端改一处必同步 web+mobile 1:1 镜像 (跨端铁律 4++)**: web AgentChatPanel 是 image+video 共用, 改一处两边都修; mobile image+video 是分开, 必须 ImageAgentScreen + VideoAgentScreen 都改
5. **status effect / polling 终态替换也要 strip 旧 result (兜底)**: race / page refresh 后 polling 进来时残留
6. **in-flight (tool_queued / tool_executing) 不动 messages**: 终态 push 新 result, in-flight 直接 return prev
7. **PowerShell Edit 工具会写 UTF-8 BOM, 必 strip**: gradle 解析 build.gradle line 1 报 "Unexpected character '?'"; python3 json 解析 package.json 报 "Unexpected UTF-8 BOM (decode using utf-8-sig)". 部署前必 strip 跟 gradle/python 相关的所有 .gradle / .json 文件
8. **APK 必传对路径**: nginx `location ^~ /app/` → `alias /www/wwwroot/shipin-APP/public/`, 不是 `/www/wwwroot/ab.maque.uno/dist/`. deploy.sh 默认错路径, 必手动 scp 到 shipin-APP/public/
9. **server deploy.sh `systemctl reset-failed` 必须**: 连续 5 次 restart 失败后 "Start request repeated too quickly" 卡住, reset-failed 之后才能 start
10. **verify-version-8-points.js changelog 验证看 latest_version 不是 entries[length-1]**: 跨项目通用, BUG-118 之后默认 prepend 顺序, 验证逻辑必看 latest_version (server `/api/version` 实际读这个)

### § 6.10.5 跨项目通用 (跟 BUG-079/082/096/097/103/104/115/116/117/118 100% 同源)

- **retry 边界必清空旧 result part**: 跨项目通用铁律, 不 strip 就是堆叠
- **AI 生成中/loading 场景必用 GeneratingLoader 跨端 1:1**: AGENTS.md § 5.4/§ 6.6.4 强约束, 不准裸用 Loader2/ActivityIndicator
- **加了 component 必集成到所有相关 screen, 不留半成品**: 跨项目通用铁律, grep + 全部替换
- **跨端改一处必同步 web+mobile 1:1 镜像**: 跨端铁律 4++, 缺一就是漏修
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
- **strip UTF-8 BOM from build.gradle + package.json**: 跨项目通用铁律, PowerShell Edit 工具会写 BOM
- **APK 必传 shipin-APP/public/**: 跨项目通用铁律, nginx `location ^~ /app/` alias 路径

### § 6.10.6 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-119 retry 边界没清理 100% 同源 (前端没真反映后端状态)
- **BUG-082/096** 假渲染陷阱 — 跟 BUG-119 retry 堆叠 100% 同源
- **BUG-097** mobile 漏修 web — BUG-119 跨端铁律 4++ 修法, web + mobile 同步
- **BUG-103** 自动退款漏刷 APK — BUG-119 此次已重打 mobile APK, 修法完整闭环
- **BUG-110** Stage 3 GeneratingLoader — BUG-119 把 component 补集成到所有 streaming 场景
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-119 跨项目通用铁律同源 (沉淀一致)
- **BUG-117** 公网 APK 404 — BUG-119 跨项目通用铁律新一条 "APK 必传对路径"
- **BUG-118** 细分了 status 字段但漏加 status label UI — BUG-119 教训同源 "加了 component 漏集成"

---

## § 6.15 v3.0.59 新增: mobile 端生图/视频助手补"上传参考图"功能, 跟 web 1:1 镜像 (S72 batch 30 BUG-130)

> **新增 2026-06-30 (S72 batch 30 v3.0.59 BUG-130)**: 修 mobile 端 ImageAgentScreen + VideoAgentScreen 0 个上传参考图入口 — 跟 web 端 AgentChatPanel 1:1 镜像, 补 S72 batch 7 web→mobile 同步漏修. web 端 v3.0.0 就有完整功能, mobile 端从 v3.0.24 S60 一直 0 个, 跨端铁律 4++ "web 主导 mobile 跟随" 漏修 1+ 年.

### § 6.15.1 背景 (跟 web § 5.10.1 1:1)

用户在 https://ab.maque.uno/image-agent + /video-agent 能正常上传参考图 (📎 按钮 + 缩略图 + send 拼接), 但在 Android 客户端的生图助手 + 视频助手里, 看不到 📎 按钮, TextInput 只能输入文字, send 后 server plan 的 refImageCount 永远 = 0.

**双 BUG 100% 同源**:
- **BUG-A (mobile 端 0 个上传入口)**: `ImageAgentScreen.tsx:275` send() 写 `imageAgentChatApi(conversationId, [userPart], ...)` — 只发 1 个 text part; `VideoAgentScreen.tsx:329` send() 同款只发 text. 没有 `pendingRefs` state, 没有 image picker, 没有 upload API 调用
- **BUG-B (S72 batch 7 web→mobile 同步漏修)**: web 端 AgentChatPanel.tsx 完整功能 1+ 年 (v3.0.0), 但 S72 batch 7 规范反转"web 主导 mobile 跟随"后, 这条一直没补. 跟 BUG-097 mobile 漏修 web 100% 同源 (漏修方向反转)

### § 6.15.2 修法架构 (3 文件, server 端 0 改)

```
apps/mobile/src/api/client.ts (新加 22 行)
├─ import PendingRef interface (跟 web 1:1)
└─ export function uploadAgentReferenceApi(file: { uri, name, type? }): Promise<{ data: { data: { url, publicUrl? } } }>
   ├─ 走 XMLHttpRequest + FormData (跟 UploadScreen.tsx 已用 XHR 模式 1:1, RN 0.73 上 axios multipart 不稳)
   ├─ 模拟 axios response shape (r.data = server body = { data: { url, publicUrl } })
   └─ 调用方 r.data?.data?.url 拿 url (跟 web 1:1)
   注: 不装 react-native-image-picker 不用新加相机权限, 用现有 react-native-document-picker types.images (跟 BUG-097 '用现有依赖不加重' 教训一致)

apps/mobile/src/screens/ImageAgentScreen.tsx (新加 4 段 + 改 2 处 + 6 styles)
├─ import DocumentPicker + uploadAgentReferenceApi + PendingRef
├─ useState<PendingRef[]>([]) 加 pendingRefs state
├─ 新加 pickAndUploadImages() (跟 web onPickFiles 1:1): DocumentPicker.types.images 选图, 4 张上限, 立即显示本地预览, 异步 upload → 替换为 server URL, 失败 showAlert + 移除占位
├─ 新加 removePendingRef(filename) (跟 web 1:1)
├─ 改 send() (跟 web 1:1): 允许只发图不发文字, 校验 uploading 中, 构造 parts (text 在前, image role='reference' 在后), setPendingRefs([]) 清空待发送, 把 parts 整个传给 imageAgentChatApi
├─ 改 sendBtn disabled: (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)
├─ inputBar 上面加 📎 上传按钮 + thumbnail bar (跟 web AgentChatPanel 1:1 镜像)
└─ styles 新加 uploadBtn + pendingRefsBar + pendingRefItem + pendingRefThumb + pendingRefOverlay + pendingRefRemoveBtn 6 个

apps/mobile/src/screens/VideoAgentScreen.tsx (1:1 镜像 ImageAgentScreen)
└─ 跟 ImageAgentScreen 1:1 完全同步 (跨端铁律 4++), 唯一区别是 send() 调 videoAgentChatApi 不是 imageAgentChatApi

server 端: imageAgentService + videoAgentService 0 改动 (refImageUrlsFromParts + referenceImages 透传 早就在 BUG-128 走通过完整链路)
```

### § 6.15.3 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Upload API | `uploadAgentReferenceApi(file: File)` (axios FormData) | `uploadAgentReferenceApi(file: { uri, name, type? })` (XHR FormData, 模拟 axios response) | ✅ API 1:1 |
| Response shape | `Promise<AxiosResponse<{ data: { url, publicUrl? } }>>` → `r.data?.data?.url` | `Promise<{ data: { data: { url, publicUrl? } } }>` → `r.data?.data?.url` | ✅ 调用方 1:1 |
| State type | `pendingRefs: { url, localPreview, filename, uploading? }[]` (web) | `PendingRef: { url, localPreview, filename, uploading? }` (mobile, 单独 export) | ✅ 类型 1:1 |
| State 上限 | 4 张 | 4 张 | ✅ 1:1 |
| Image picker | `<input type="file" accept="image/*" multiple>` | `DocumentPicker.pick({ type: [DocumentPicker.types.images], allowMultiSelection: true })` | ✅ 行为 1:1 (不用 image-picker, 跟 BUG-097 教训一致) |
| 本地预览 | `URL.createObjectURL(file)` (web) | `f.fileCopyUri || f.uri` (mobile, DocumentPicker 返的 file://) | ✅ 行为 1:1 |
| Send 拼接 parts | text + image role='reference' | 同左 | ✅ 1:1 |
| sendBtn disabled | `!input.trim() && pendingRefs.length === 0` | 同左 + `pendingRefs.some(x => x.uploading)` | ✅ 1:1 |
| UI 位置 | inputBar 上方 (📎 + thumbnail bar) | 同左 | ✅ 1:1 |
| 服务端调用 | `chatApi(conversationId, userMsg.parts, aspectRatio, durationSec?)` | 同左 (mobile `imageAgentChatApi` + `videoAgentChatApi` API 名字不同, 行为 1:1) | ✅ 1:1 |

### § 6.15.4 使用规范 (跟 web § 5.10.4 1:1)

1. **web + mobile 镜像功能必双端同步实现 (S72 batch 7 规范反转铁律)**: web 做了 mobile 没做 = 漏修, check_list 必查 "web 端 X 功能有 mobile 端有没有?" (跟 BUG-097 100% 同源)
2. **XHR 优于 axios 上传文件 (RN 0.73)**: RN 0.73 上 axios multipart 兼容性不稳, 走 XMLHttpRequest + FormData 是稳路径, 跟 UploadScreen.tsx 已跑的 XHR 模式 1:1
3. **document-picker types.images 优于 image-picker (RN 0.73)**: 不装 react-native-image-picker 不用加相机权限, 走 react-native-document-picker types.images 选图, 跟 BUG-097 "用现有依赖不加重" 教训一致
4. **server 端 0 改动原则**: mobile 端补 UI 入口后, server 端代码早就接住 (`imageAgentService.refImageUrlsFromParts` line 137 + `videoAgentService` refImageUrls 抽取), 不要重复造轮子. 修前端 API 必先 grep server 是否已支持
5. **Response shape 模拟 axios 1:1**: mobile XHR upload 必返 `Promise<{ data: { data: { url } } }>` 跟 axios 一致, 调用方才能 `r.data?.data?.url` 跟 web 1:1
6. **inputBar 上方加 📎 + thumbnail bar**: 跟 web AgentChatPanel 1:1 镜像, 缩略图 size 56x56 (mobile) 跟 web 56px (h-14 w-14) 1:1
7. **允许只发图不发文字**: `send()` 校验条件改 `(!content && pendingRefs.length === 0)`, 跟 web 1:1
8. **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3, 3.0.58 → 3.0.59)
9. **BOM 检查必跑**: PowerShell Edit 工具会写 BOM, 改 build.gradle / package.json / version.ts 后必跑 python 脚本查 head 3 bytes ≠ EF BB BF (AGENTS.md § 6.10.4 第 7 条)
10. **mobile tsc 0 新错**: 改完 mobile screen 必跑 `npx tsc --noEmit`, 只允许 pre-existing 错增加, 不允许新错 (我 BUG-130 修后 2 改 screen 0 新错, 2 pre-existing 错不动)

### § 6.15.5 跨项目通用 (跟 BUG-079/082/097/124/128 100% 同源, 沉淀 mavis memory)

- **web + mobile 镜像功能必双端同步实现**: 跨项目通用铁律, 漏修方向 = S72 batch 7 后 web 做了 mobile 漏修 (跟 BUG-097 mobile 漏修 web 同源)
- **XHR 优于 axios 上传文件 (RN 0.73)**: 跨项目通用铁律, RN 项目上传文件必走 XHR
- ~~**document-picker types.images 优于 image-picker (RN 0.73)**~~: 跨项目通用铁律 ❌ **v3.0.60 BUG-130 hotfix 推翻**: document-picker v9.x Android 端 Intent.ACTION_GET_CONTENT, Android 9 模拟器/真机不可用. **API 兼容性 > "不加重" 原则**, 跨项目通用铁律优先级: 用户体验 > 依赖数量
- **API 兼容性 > "不加重" 原则 (v3.0.60 BUG-130 hotfix 新增)**: 跨项目通用铁律, 跟 BUG-097 "不加重" 冲突但优先级更高. RN 项目选图必装 react-native-image-picker (走系统 photo picker / 兼容性硬指标), 跟 BUG-079 用户体验优先教训一致
- **server 端 0 改动原则**: 跨项目通用铁律, 修前端 API 必先 grep server 是否已支持
- **Response shape 模拟 axios 1:1**: 跨项目通用铁律, mobile XHR 上传必返 axios response shape 让调用方跟 web 1:1
- **文档说做了, 代码必须真做 (v3.0.61 BUG-130 hotfix 2 新增)**: 跨项目通用铁律, 跟 BUG-079 假报告同源. 文档跟代码不一致 = 假修, E2E 实测必查字段一致性. BUG-128 修法 4 文档说"加 refImageCount 字段"但 imageAgentService.ts 漏写, E2E 才发现 refImageCount=0 跟 refImageUrls.length=1 不一致
- **跨项目通用铁律优先级 (新增)**: 用户体验 (API 兼容性) > 依赖数量 ("不加重") > 文档跟代码一致 (E2E 实测). 跨项目铁律冲突时按这个优先级
- **inputBar 上方加 📎 + thumbnail bar**: 跨项目通用铁律, 跟 web AgentChatPanel 1:1 镜像
- **8 处版本号同步必走**: 跨端铁律 3
- **BOM 检查必跑**: 跨项目通用铁律, AGENTS.md § 6.10.4 第 7 条
- **mobile tsc 0 新错**: 跨项目通用铁律, 改完 mobile screen 必查没新错

### § 6.15.6 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-130 "web 早就做完了 mobile 一直 0 个" 100% 同源, server 端 refImageUrlsFromParts 在 mobile 没传时永远抽空 = 假功能
- **BUG-082/096** 假渲染陷阱 — 跟 BUG-130 "UI 没入口但 server 端 API 通了" 同源, 前端没真反映后端能力
- **BUG-097** mobile 漏修 web — BUG-130 是这条的 100% 同源 (漏修方向反转: 之前 mobile 漏修 web, BUG-130 web 做了 mobile 漏修)
- **BUG-103** 自动退款漏刷 APK — BUG-130 此次重打 mobile APK (web 已有功能, mobile 补齐)
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-130 跨项目通用铁律同源
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129** — BUG-130 是这一系列 server 端修的延伸, 这次终于轮到 mobile 端 UI 入口补齐
- **BUG-128** VIDEO_PROMPT_REF_IMAGE_SYSTEM — BUG-130 直接受益, mobile 现在能传 ref image 给 video, server VIDEO_PROMPT_REF_IMAGE_SYSTEM 立刻可用 (修前 mobile 用户根本传不上图, BUG-128 的 LLM 优化层 100% 跑 generic 路径)

> **最后更新**: 2026-06-30 (S72 batch 30 v3.0.59 BUG-130, 加 § 6.15 mobile 端生图/视频助手补"上传参考图"功能, 跟 web 1:1 镜像, 跟根 AGENTS.md v2.16 同步)
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时
> **最后更新**: 2026-06-30 (S72 batch 31+ v3.0.66 BUG-134 + v3.0.67 BUG-135, 加 § 6.16 mobile 端生图助手白屏修法 + 自研通用图片选择 native module 完全不用 GMS, 跟根 AGENTS.md 同步)
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时

## § 6.16 v3.0.66+67 新增: 修 ImageAgentScreen 白屏 (BUG-134) + 自研通用图片选择 native module 完全不用 GMS (BUG-135) (S72 batch 32+33, 2026-06-30)

### § 6.16.1 BUG-134 (v3.0.66) 修 ImageAgentScreen ReferenceError 白屏 (跟 VideoAgentScreen 1:1 镜像漏修)

#### 背景
用户在 Android APP 进"生图" tab, 立即白屏 + 控制台报 `ReferenceError: Property 'conv' doesn't exist`. 跟 BUG-118/119/132 教训 100% 同源 (加了 state 但漏消费到所有相关 render).

#### 真根因
`apps/mobile/src/screens/ImageAgentScreen.tsx` line 612 修前:
```tsx
{convStatus ? <StatusBadge status={convStatus} error_msg={conv?.error_msg} /> : null}
```
`conv` 是 `loadConversation`/`polling useEffect` 内**局部变量** (line 208, 243), 不在 React render scope. tap 进生图 tab → render 触发 → 找不到 `conv` → ReferenceError → 白屏.

跟 BUG-132 (v3.0.64) 已修法 1:1 镜像: `VideoAgentScreen.tsx` 早就有 `convErrorMsg` state (line 180) + sync 4 处 (line 255/271/289/478/859) + line 633 `<StatusBadge error_msg={convErrorMsg} />`. **ImageAgentScreen 漏修**, 同样的修法但 image 端没复制.

#### 修法 (1 文件 6 处 edits, 跟 VideoAgentScreen 1:1 镜像)

```
apps/mobile/src/screens/ImageAgentScreen.tsx
├─ line 144: 加 state (跟 VideoAgentScreen line 180 1:1)
│   const [convErrorMsg, setConvErrorMsg] = useState<string | null>(null);
├─ line 216: loadConversation sync (跟 VideoAgentScreen line 255 1:1)
│   setConvErrorMsg(conv.error_msg || null);
├─ line 232: createConversation 清空 (跟 VideoAgentScreen line 271 1:1)
│   setConvErrorMsg(null);
├─ line 252: polling useEffect sync (跟 VideoAgentScreen line 289 1:1)
│   setConvErrorMsg(conv.error_msg || null);
├─ line 618: 改用 state (跟 VideoAgentScreen line 633 1:1, 这是修前的 BUG)
│   <StatusBadge status={convStatus} error_msg={convErrorMsg} />
└─ line 826: deleteCurrent 清空 (跟 VideoAgentScreen line 478 1:1)
    setConvErrorMsg(null);
```

#### 跨项目通用铁律 4 条新沉淀 (跟 BUG-118/119/132 100% 同源)

1. **render scope 内只能用 state/callback ref, 不能用 useEffect 局部变量** (新铁律, BUG-134): React render 时 useEffect callback 内声明的局部变量不在 scope, 引用必 throw ReferenceError. 必须用 useState (同步效果) 或 useRef / useCallback (异步). 跟 BUG-113 React Hooks 规则违反 SOP 100% 同源
2. **同一文件改了 BUG 必 grep 所有相似位置, 不能只改一处** (强化, BUG-134): BUG-132 修了 VideoAgentScreen 的 `conv` 问题, ImageAgentScreen 1:1 镜像结构, 漏修. 修 BUG 必 `Select-String -Pattern '\bconv\b' ImageAgentScreen.tsx` 全局搜, 不能只看自己关心的行
3. **加了 state 必消费到所有相关 render path** (强化, 跟 BUG-118/119 同源): BUG-134 修前 `convStatus` state 已经被多处消费, 但 `conv.error_msg` 这个新字段没单独抽 state, 直接引用 `conv` 局部变量. 必抽 state 才能 render scope 用
4. **修 BUG 必查 sibling 镜像代码** (新铁律, 跟 BUG-097 同源): web/mobile 镜像 + image/video 镜像 (ImageAgentScreen + VideoAgentScreen) + service 镜像, 修一处必 `grep` 同模块所有相似文件

### § 6.16.2 BUG-135 (v3.0.67) 通用图片选择 native module, 完全不用 GMS, 国产 ROM 全支持

#### 背景
用户在 Android APP 视频助手页面点 📎 上传参考图, 弹 "An unexpected error occurred" 对话框 + "参考图上传失败". 跟 BUG-130 v3.0.59 修法不完整 + v3.0.60 hotfix 选了错的依赖有关.

#### 真根因 (跟 BUG-130/097/079 100% 同源, 但更深入)
`react-native-image-picker v7.2.3` 在 Android 13+ 走 androidx `ActivityResultContracts.PickVisualMedia` contract, fallback 到 GMS (Google Play Services) photopicker UI (`com.google.android.gms/.photopicker.ui.PhotoPickerActivity`). 蓝叠/部分国产 ROM (华为精简版/小米海外版/平板) 没装 GMS → `Download of container feature photopicker_activity is disabled` → 显示 "An unexpected error occurred" 英文错误.

logcat 实锤 (修前):
```
START u0 {act=androidx.activity.result.contract.action.PICK_IMAGES typ=image/* cmp=com.google.android.gms/.photopicker.ui.PhotoPickerActivity} from uid 10070
Download of container feature photopicker_activity is disabled.
```

修后 logcat:
```
START u0 {act=android.intent.action.OPEN_DOCUMENT cat=[android.intent.category.OPENABLE] typ=image/* flg=0x3000001 cmp=com.android.documentsui/.picker.PickActivity (has extras)} from uid 10070
```

#### 修法 (3 native 文件 + 2 JS 文件 + 8 处版本号, 完全自研)

```
apps/mobile/android/app/src/main/java/com/aiscriptmobile/
├─ PickImageModule.kt (~199 行) - 自研 native module, Intent.ACTION_OPEN_DOCUMENT + createChooser
└─ PickImagePackage.kt (~14 行) - 注册 module 到 RN bridge (跟 ApkInstallerPackage 同模式)

apps/mobile/src/utils/
└─ pickImage.ts (~70 行) - JS bridge 包 React Native NativeModules.PickImageModule

apps/mobile/src/screens/
├─ ImageAgentScreen.tsx - launchImageLibrary → pickImages (跟 image-picker 1:1 替换)
└─ VideoAgentScreen.tsx - launchImageLibrary → pickImages

apps/mobile/android/app/src/main/java/com/aiscriptmobile/MainApplication.kt
└─ packages.add(PickImagePackage())
```

#### 国产 ROM 兼容性 (核心)

Intent.ACTION_OPEN_DOCUMENT 是 Android SDK API 19+ 通用 API, 国产 ROM 全支持 (跟 Android 9-14 全兼容):
- 华为 EMUI / 鸿蒙 HarmonyOS: ✅ 自带 "文件" / "图库" 应用
- 小米 MIUI / HyperOS: ✅ 自带 "文件管理" / "相册"
- OPPO ColorOS / Realme UI: ✅ 自带 "文件管理" / "相册"
- vivo Funtouch / OriginOS: ✅ 自带 "文件" / "相册"
- 魅族 Flyme: ✅ 自带 "文件中心"
- 三星 OneUI: ✅ 自带 "我的文件" / "相册"
- 蓝叠 Android 9: ✅ com.android.documentsui
- Google Pixel Android 13+: ✅ Documents UI

**完全不需要 GMS**, 跟 GMS photopicker 解耦. Intent.createChooser 会弹列表让用户选 [系统文件 / 系统相册 / 第三方文件管理器] 任意一个.

#### 权限 0 加重 (符合 Android 13+ Scoped Storage)
- ❌ 不需要 READ_EXTERNAL_STORAGE
- ❌ 不需要 WRITE_EXTERNAL_STORAGE
- ❌ 不需要 READ_MEDIA_IMAGES (Android 13+)
- ✅ Intent.ACTION_OPEN_DOCUMENT + FLAG_GRANT_READ_URI_PERMISSION 单次 read 权限即可
- ✅ ContentResolver.openInputStream 自动处理 content:// URI

#### content:// URI 上传兼容 (server 端 0 改)
- RN 0.65+ fetch/XHR FormData 原生支持 content:// URI (内部用 ContentResolver.openInputStream 读 bytes)
- server 端 multer 接 file://, content:// 跟它 1:1 兼容
- 跟 web uploadAgentReferenceApi (axios FormData) 行为 1:1, 调用方 `r.data?.data?.url` 不变

#### 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/097/130/134 100% 同源)

1. **系统选择器优先用 Intent.ACTION_OPEN_DOCUMENT 自研 native module, 不依赖第三方 picker 库** (新铁律, BUG-135 核心): 第三方 picker 库内部可能走 GMS / Android 13+ PickVisualMedia 等不通用路径, 自研 Intent.ACTION_OPEN_DOCUMENT + Intent.createChooser 是 100% 通用方案. Android SDK API 19+ 兼容, 国产 ROM 全支持.
2. **国产 ROM 兼容性测试必加, 不能只在蓝叠/海外设备测** (强化, BUG-135): image-picker v7.x 在蓝叠模拟器 / 海外设备 OK 但国产 ROM 翻车, 测试矩阵必加 [蓝叠/华为/小米/OPPO/vivo/三星] 至少 5 设备
3. **KDoc 注释内不允许出现 `*/` 序列** (新铁律, BUG-135 配套): Kotlin KDoc 跟 Java 一样是块注释, KDoc 内 `["image/*"]` 的 `*/` 会提前关闭注释. 跨项目通用铁律: KDoc 内字符串必用 `image/<all>` 或 `image/&#42;` 绕过
4. **API 兼容性 > 不加重原则 优先级升至选型阶段** (强化, BUG-135): 之前 BUG-130 hotfix 选 image-picker 是错的, 真正稳的方案是自研, 不是装新依赖. 跨项目通用铁律: 选型阶段必先 grep 看依赖内部走什么路径, 不只看官方文档说支持哪些设备

#### KDoc 注释坑修复 (新铁律)
Kotlin KDoc 注释里 `["image/*"]` 的 `*/` 会提前关闭注释, 导致 PickImageModule.kt:199 Unclosed comment. 改成 `["image/<all>"]` 绕过. 这是 Kotlin 跨项目通用铁律: KDoc 内不允许出现 `*/` 序列.

#### 8 处版本号同步 (跨端铁律 3)

| 位置 | 修前 | 修后 |
|---|---|---|
| apps/mobile/src/config/version.ts APP_VERSION | 3.0.65 | **3.0.67** |
| apps/mobile/android/app/build.gradle versionCode | 67 | **69** |
| apps/mobile/android/app/build.gradle versionName | "3.0.65" | **"3.0.67"** |
| apps/web/src/config/version.ts APP_VERSION | 3.0.65 | **3.0.67** |
| apps/web/src/config/version.ts APP_VERSION_CODE | 67 | **69** |
| apps/server/package.json version | 3.0.65 | **3.0.67** |
| apps/server/src/index.ts APP_VERSION fallback | '3.0.65' | **'3.0.67'** |
| apps/server/ecosystem.config.js env.APP_VERSION | '3.0.65' | **'3.0.67'** |
| apps/server/ecosystem.config.js env_production.APP_VERSION | '3.0.65' | **'3.0.67'** |
| apps/server/changelog.json | (top v3.0.65) | **+ v3.0.67 + v3.0.66 prepend** |
| 远端 .env + systemd unit Environment=APP_VERSION | 3.0.65 | 3.0.67 (deploy 同步) |
| 公网 APK | DeepScript_v3.0.65.apk | **DeepScript_v3.0.67.apk** |

#### 跟其他 BUG 关系

- **BUG-079 (v3.0.13)** 假报告 — BUG-135 修前用户被 GMS 错误误导, "看起来上传了但实际失败"
- **BUG-097 (S72 batch 6)** mobile 漏修 web — BUG-135 web 端不需要改, mobile 端自研 native module 跟 web 端 uploadAgentReferenceApi 1:1 兼容
- **BUG-130 (v3.0.59)** mobile 端补参考图上传入口 — BUG-135 是 BUG-130 修法的 bug 修复 (image-picker 选错导致 GMS 路径翻车)
- **BUG-131 (v3.0.62)** server-only hotfix 必 rebuild APK — BUG-135 server 端 0 改, 但 native module 是新代码, mobile APK 必重打
- **BUG-134 (v3.0.66)** mobile 端 ImageAgentScreen 白屏 — BUG-135 跟 BUG-134 都是 ImageAgentScreen 修法, 同期部署
- **BUG-113 (S72 batch 12)** React Hooks 规则违反真机回归 SOP — BUG-135 KDoc 注释坑跟这个类 bug 100% 同源 (文档说做了但实际编译失败)

#### 为什么反复掉坑 (反思 v3.0.60 → v3.0.66 → v3.0.67 的连环教训)

1. **v3.0.60 BUG-130 hotfix 选 image-picker 替代 document-picker**: 当时是基于 "image-picker v7.x 走系统 photo picker (Android 9+ ACTION_PICK_IMAGES), 兼容性硬指标". 但实际调研不够深入, 没看 image-picker v7.x 内部代码. 真坑: image-picker v7.x 在 Android 13+ 走 androidx `PickVisualMedia` contract, fallback 到 GMS photopicker UI.
2. **v3.0.66 BUG-134 修法完整但漏了 mobile version.ts 同步**: 修了 ImageAgentScreen 白屏, 但 mobile/src/config/version.ts 没同步从 3.0.64 → 3.0.65 → 3.0.66. 跟 BUG-131 同源教训: server-only hotfix 必 rebuild APK + 8 处版本号同步.
3. **v3.0.67 BUG-135 终于找到正确方向**: 不依赖第三方 picker 库, 自研 native module 走 Android 系统 Intent. 这是真正稳的方案, 因为 Android SDK API 1+ 100% 兼容.

**跨项目通用教训**: 选型阶段必先 grep 看依赖内部走什么路径 (system Intent / GMS / 第三方 SDK), 不只看官方文档说支持哪些设备. 选错了, 修法会跟着错, 反复掉坑.

#### mavis memory 沉淀

```
BUG-135 (v3.0.67 mobile 端自研通用图片选择 native module, 完全不用 GMS, 国产 ROM 全支持)
- 跨项目通用铁律: 系统选择器优先用 Intent.ACTION_OPEN_DOCUMENT 自研, 不依赖第三方 picker 库
- 国产 ROM 兼容性测试必加 (蓝叠/华为/小米/OPPO/vivo/三星 至少 5 设备)
- KDoc 注释内不允许出现 */ 序列 (Kotlin 块注释规则)
- API 兼容性 > 不加重原则 优先级升至选型阶段
```

## § 6.17 v3.0.68 新增: 重设计"生成中"动画卡片 (跨端 1:1 镜像, 8 段视觉层级) (S72 batch 34 BUG-136, 2026-06-30)

### § 6.17.1 背景 (跟 web § 5.13.1 1:1)

BUG-119 v3.0.48 老卡片布局散乱: spinner 普通 + 文字位置突兀 + 排队信息浮窗贴旁边 + 没进度感 + 没 ETA + 没比例适配. 用户看后反馈 "重新做, 要看到生成卡片布局散乱, 给我重设计".

### § 6.17.2 真根因 (跟 BUG-119/079/100 100% 同源, 但更深入)

老 `StreamingCard` 函数只做 4 段视觉 (spinner + 标题 + 副标题 + 进度条), 缺:
- 顶部状态栏 + 阶段徽章 (颜色不跟 BUG-118 StatusBadge 体系一致)
- 流光边框背景 (没视觉冲击)
- 双层旋转 ring (单一 spinner 没"AI 在工作"感知)
- 中心阶段图标 (转圈圈没意义, 看不出当前阶段)
- ETA + 排队信息整合到卡片底部 (浮窗贴旁边视觉散乱)
- aspectRatio 1:1 适配 (跟 BUG-120 比例卡片 1:1)

### § 6.17.3 修法 (8 段视觉层级, mobile+web 1:1 镜像)

1. **顶部状态栏 + 阶段徽章**: 颜色跟 BUG-118 StatusBadge 1:1 镜像 (translating 紫 #a78bfa / queueing 琥珀黄 #fbbf24 / generating 蓝 #60a5fa), 跟 BUG-118 StatusBadge 配色体系 1:1
2. **流光边框背景**: Animated CSS pulse-glow 1.5s in-out, opacity 0.35-0.85 + scale 1-1.15
3. **中部双层旋转 ring**: 72x72 (1.5s linear spin), 内外双圈反向旋转
4. **中心 48x48 圆 + 阶段图标**: Languages/Hourglass/Film/ImageDown 4 阶段对应图标
5. **主标题 + 副标题**: 15px #e4e4f0 (主) + 12px #9090a8 (副)
6. **进度条**: 4px track + stageColor fill, 1.2s out-cubic (跟 BUG-119 老款同款进度条但颜色跟阶段)
7. **排队信息整合到卡片底部一段**: 不再浮窗贴旁边 (BUG-119 老款散乱根因), 整合到卡片底部一段, 含 position + etaSeconds + speedHint
8. **aspectRatio 1:1 适配**: 跟 BUG-120 比例卡片 1:1, 按用户选的比例 (16:9/9:16/1:1) 渲染

### § 6.17.4 跨端 1:1 镜像 (mobile + web)

| 段 | mobile (React Native) | web (CSS) |
|----|------------------------|-----------|
| 流光边框 | `Animated.Value + Easing.inOut(Easing.ease)` 1.5s loop | `@keyframes pulse-glow` 1.5s ease-in-out |
| 双层旋转 | `Animated.loop(Animated.timing(rotate, {toValue:1,duration:1500,easing:Easing.linear,useNativeDriver:true}))` | `@keyframes spin { to { transform: rotate(360deg) } }` 1.5s linear |
| 进度条 | `Animated.timing(progress,{duration:1200,easing:Easing.out(Easing.cubic),useNativeDriver:false})` | `@keyframes pulse-dot` 1.5s ease-in-out + width transition 1.2s |
| 配色 | 跟 BUG-118 StatusBadge 同色板 #a78bfa/#fbbf24/#60a5fa | 同 |
| 阶段图标 | `lucide-react-native` Languages/Hourglass/Film/ImageDown | `lucide-react` 同名 |

keyframe 名跨端同名: pulse-glow / pulse-dot / spin, 跨端铁律 4++ 加固.

### § 6.17.5 跨项目通用铁律 (跟 BUG-079/100/119/118 100% 同源, 但更深入)

- **加载状态 UI 必带 8 段视觉层级**: 阶段徽章 + 流光边框 + 双层旋转 ring + 中心图标 + 主副标题 + 进度条 + ETA + 比例适配. 不能只有 spinner + 文字 (跟 BUG-079/100 假状态同源, 跟 BUG-119 老设计反例)
- **阶段配色必跟同项目 StatusBadge 1:1 镜像**: translating/queueing/generating 三阶段配色 必跟 BUG-118 StatusBadge 同色板, 不同 BUG 不同阶段同一套色板
- **跨端 streaming 卡片必 1:1 镜像**: mobile React Native Animated.Value + Easing 跟 web CSS @keyframes 行为一致 (1.5s spin + 1.5s pulse + 1.2s progress, keyframes 名同名)
- **排队信息不要做浮窗贴旁边**: 视觉散乱, 整合到卡片底部一段
- **不用 Lottie 动画** (跟 BUG-130 教训): NDK build 不稳, 用 RN Animated/CSS keyframes 替代, 行为 1:1 镜像
- **8 处版本号同步必走 mobile version.ts** (跨端铁律 3 + 跨端铁律 6): BUG-136 13 文件 914 增 86 删, 8 处同步含 mobile version.ts APP_VERSION + APP_VERSION_CODE

### § 6.17.6 mavis memory 沉淀

```
BUG-136 (v3.0.68 跨端重设计生成中动画卡片, 8 段视觉层级, 跨端 1:1 镜像):
- 跨项目通用铁律: 加载状态 UI 必带 8 段视觉层级 (阶段徽章 + 流光边框 + 双层旋转 ring + 中心图标 + 主副标题 + 进度条 + ETA + 比例适配)
- 阶段配色 必跟 同项目 StatusBadge 1:1 镜像 (跨端铁律 4++ 加固)
- 跨端 streaming 卡片必 1:1 镜像: mobile RN Animated + web CSS @keyframes 行为一致
- 排队信息不要做浮窗贴旁边, 整合到卡片底部一段
- 不用 Lottie 动画, 用 RN Animated/CSS keyframes 替代
```## § 6.18 v3.0.70 新增: 跨端 AgentChatPanel 后台 polling 不取消, 切换会话旧 polling 污染新会话 UI (BUG-138, 2026-07-01)

> **新增 2026-07-01 (v3.0.70 BUG-138)**: 修 web + mobile 跨端 AgentChatPanel 后台 polling 切换会话时不取消 → 旧 polling tickStatus 把全局 status 改回 tool_queued → 触发 statusEffectTimerRef useEffect 给新会话 push streaming part → 新会话一直显示"提示词方案正在生成".

### § 6.18.1 背景 (跨端铁律 4++ 1:1 镜像)

用户反馈: 提示词正在生成方案时, 无论新建多少个会话框, 都一直显示"提示词方案正在生成". 无论切到哪个会话都卡在"正在生成"状态. 跟 BUG-079/100/118/119/120/123/130/134/135/136/137 100% 同源 (前端 UI 没真反映后端状态).

### § 6.18.2 修前根因 (2 重, 跟 BUG-097 mobile 漏修 web 反向同源)

**BUG-A (web AgentChatPanel.tsx)**: `confirmAndGenerate` / `confirm` 函数的后台 polling 是 **fire-and-forget** 的 (while + await setTimeout), 切换会话时不会被自动取消. 4-5s 后旧 polling poll 拿到 ConvA.status (还是 'tool_queued'/'tool_executing') → `tickStatus(cur.status)` → 全局 status 被改回去 → 触发 statusEffectTimerRef useEffect → 给 ConvB 的 messages 最后一个 push streaming part → ConvB 显示"正在生成方案".

**BUG-B (mobile ImageAgentScreen + VideoAgentScreen)**: `loadConversation` 函数没重置 `pollingConvId`. polling useEffect 依赖 `pollingConvId` 没变 → 不 cleanup, setInterval 还在跑 → 每 3s `setConvStatus` / `setMessages` 改新会话 UI.

### § 6.18.3 修法 (跨端铁律 4++ 1:1 镜像)

```
apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 主修):
├─ 加 activeConvIdRef + pollingOwnerRef (追踪活跃会话 + polling owner)
├─ startNew / loadConversation 入口清 pollingOwnerRef (cancel 旧 polling)
├─ confirmAndGenerate / confirm 进入: 捕获 capturedConvId + 设 pollingOwnerRef
├─ while 循环每次 poll 前 check (if pollingOwnerRef !== capturedConvId) break
├─ tickStatus / setStatus / setMessages 前 check pollingOwnerRef
└─ statusEffectTimerRef useEffect push streaming 前 check pollingOwnerRef === conversationId

apps/mobile/src/screens/ImageAgentScreen.tsx + VideoAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
└─ loadConversation 入口加 setPollingConvId(null), 切历史会话时取消旧 polling
```

### § 6.18.4 跨端铁律 4++ 镜像 (跟 web AGENTS.md 同步)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Polling owner 追踪 | `pollingOwnerRef = useRef<string \| null>(null)` | `pollingConvId` state | 概念 1:1, 实现细节不同 |
| Cancel 旧 polling 入口 | `startNew` / `loadConversation` 设 `pollingOwnerRef.current = null` | `loadConversation` 入口 `setPollingConvId(null)` | ✅ 行为 1:1 |
| Polling while / setInterval poll 前 check | `if (pollingOwnerRef.current !== capturedConvId) break` | useEffect 依赖 `pollingConvId` 变 → cleanup | ✅ 1:1 (mobile useEffect 自动, web manual ref) |
| statusEffectTimerRef / useEffect push streaming 前 check | `if (pollingOwnerRef.current !== conversationId)` (跳过 push) | mobile 没有 (mobile useEffect 自动 cleanup) | web 端独有 (因为 fire-and-forget) |
| 修法行数 | activeConvIdRef + pollingOwnerRef + 6 处 check | loadConversation 1 行 `setPollingConvId(null)` | web 改动大 (修 fire-and-forget), mobile 改动小 (补 cleanup) |

### § 6.18.5 使用规范

1. **后台 polling 必须有 cancel 机制 (useEffect-based 优于 fire-and-forget)**: React useEffect cleanup 必清 setInterval, 切会话 / unmount / 重新挂载 都会自动取消. fire-and-forget while 循环是"野指针", 没法响应 React state 变化. 跨项目通用铁律 (跟 BUG-079/100/118/119/130/134/135 100% 同源)
2. **fire-and-forget async 任务必捕获 owner context**: 任何后台 async 任务必须捕获 start 时的 conversationId / userId / requestId, 跟当前 React state / 当前用户比较. 不匹配就立即退出, 不污染全局 state. 泛化的铁律, 适用于 polling / retry / 上传任务 / 任何"长跑"的 async 操作
3. **跨端轮询逻辑必 1:1 镜像, 修一处必同步双端**: web 修了 polling cancel, mobile 端必然有同样问题 (跟 BUG-097 mobile 漏修 web 反向). 跨端铁律 4++ 1:1 镜像修法, web 用 pollingOwnerRef, mobile 用 setPollingConvId(null), 效果一致
4. **加了 useEffect 必查 cleanup 路径, 没 cleanup = polling 跨会话泄漏**: useEffect cleanup 必 return () => clearInterval. fire-and-forget polling 必手动加 owner check
5. **新代码必走 useEffect 不用 fire-and-forget**: shipin-APP 老代码 (v3.0.0) 用了 fire-and-forget 是历史包袱, 新代码必走 useEffect 路径

### § 6.18.6 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/097/100/119/130/134/135 100% 同源)

1. **useEffect-based polling 优于 fire-and-forget polling**: React 组件内的 polling 必走 useEffect + setInterval + cleanup return. useEffect cleanup 在 unmount + dependency 变化时自动跑, 防止"野指针 polling" 跨会话污染
2. **fire-and-forget async 任务必捕获 owner context**: 任何后台 async 任务必须捕获 start 时的 conversationId + owner ref, 跟当前 React state 比较. 不匹配就立即退出
3. **跨端代码改一处必同步双端 + E2E 验证**: web 修了 polling cancel, mobile 端必然有同样问题. BUG-138 1:1 镜像修法 + E2E 同时验证两端
4. **加 useEffect 必查 cleanup 路径**: 没 cleanup = polling 跨会话泄漏. fire-and-forget polling 必手动加 owner check

### § 6.18.7 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-138 同源 "UI 状态跟实际后端状态不一致"
- **BUG-097** mobile 漏修 web — BUG-138 反方向漏修 (web 修了 mobile 没修), 跨端铁律 4++ 1:1 镜像修法
- **BUG-100** loading UX 假修 — 同源 "loading 状态 UI 必真实反映后台"
- **BUG-119** retry 边界清理 — BUG-138 跟 BUG-119 配套, 都是"切换会话时清旧状态"
- **BUG-120** 等待动画卡片按比例显示 — statusEffectTimerRef push streaming 前 check 跟 BUG-120 1:1 镜像
- **BUG-123** Agnes API 限流排队 — BUG-138 是更上层的"轮询生命周期管理"
- **BUG-130** mobile 端补参考图上传入口 — mobile 修法跟 BUG-130 跨端铁律 4++ 同源
- **BUG-131** server-only hotfix 必 rebuild APK — BUG-138 此次已重打 mobile APK
- **BUG-132** video/image retry 策略细化 — retry 终止条件跟 BUG-132 同源
- **BUG-135** 自研 native module 完全不用 GMS — 跟 BUG-138 都是 mobile 端基础设施层修法
- **BUG-136** 生成中动画卡片重设计 — statusEffectTimerRef push streaming 前 check 跟 BUG-136 配套
- **BUG-137** Agnes API 调用规范 — 跨项目通用铁律 "useEffect-based > fire-and-forget" 跟 BUG-137 "API 协议规范" 同源 (都是基础设施层)

### § 6.18.8 mavis memory 沉淀

```
BUG-138 (v3.0.70 跨端 AgentChatPanel 后台 polling 不取消, 切换会话旧 polling 污染新会话 UI):
- 跨项目通用铁律: 后台 polling 必须有 cancel 机制 (useEffect-based > fire-and-forget)
- 跨项目通用铁律: fire-and-forget async 任务必捕获 conversationId + owner ref, 切会话时 check 不污染全局
- 跨项目通用铁律: 跨端轮询逻辑必 1:1 镜像 (mobile pollingConvId useEffect 跟 web pollingOwnerRef 1:1), 修一处必同步双端
- 跨项目通用铁律: 加 useEffect 必查 cleanup 路径, 没 cleanup = polling 跨会话泄漏
- 修前根因: web confirmAndGenerate/confirm 是 fire-and-forget while 循环, 切换会话不会被取消
- 修法 web: 加 activeConvIdRef + pollingOwnerRef, startNew/loadConversation 清 pollingOwnerRef, while 循环 poll 前 check (if pollingOwnerRef !== capturedConvId) break, tickStatus/setMessages/setStatus 前 check pollingOwnerRef, statusEffectTimerRef push streaming 前 check pollingOwnerRef === conversationId
- 修法 mobile: loadConversation 入口加 setPollingConvId(null), 切历史会话时取消旧 polling
- E2E 验证: ConvB 立即 + 15s 后都是 awaiting_clarification 无 streaming part, ConvA 正常 tool_completed
```

### § 6.18.9 E2E 验证 (deploy 后实测)

- ✅ /api/version: 3.0.70, mobileLatestApkVersion: 3.0.70, downloadUrl: https://ab.maque.uno/app/DeepScript_v3.0.70.apk
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256080
- ✅ systemd shipin-app active (running), Main PID 8265
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错
- ✅ web build: dist/index-B2cs5aH1.js (528KB) + dist/index-fvkPNNko.css (44KB)
- ✅ E2E (image agent, testuser_bug138):
  - ConvA: 发"卡通猫" → plan_ready (2s) → confirm → tool_executing → tool_completed (15s)
  - ConvB (立即创, 模拟用户切换): status=awaiting_clarification (✅ 没被旧 polling 污染)
  - ConvB 15s 后: status=awaiting_clarification, messages count=1, 无 streaming part (✅ 旧 polling 持续运行也没污染)
  - ConvA 15s 后: status=tool_completed (✅ 正常完成)
  - **PASS**: BUG-138 已修, 跨端轮询生命周期管理规范化

### § 6.18.10 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ `5647add` (ae961b8 → 5647add) → origin/main |
| 远端 server restart (systemd) | ✅ active, Main PID 8265 |
| `/api/version` 3.0.70 | ✅ version=3.0.70, mobileLatestApkVersion=3.0.70 |
| APK 重打 (gradle assembleRelease) | ✅ `app-release.apk` 30256080 bytes (versionCode 72, versionName 3.0.70) |
| scp APK 到 `/www/wwwroot/shipin-APP/public/` | ✅ `DeepScript_v3.0.70.apk` |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256080 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.70 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.70 |
## § 6.19 v3.0.71 新增: server 修 UPSTREAM_BUSY 文案 + 加 10 秒自动重试, 客户端 StatusBadge 1:1 镜像 (S72 batch 36 BUG-139, 2026-07-01)

> **新增 2026-07-01 (v3.0.71 BUG-139)**: 跟 web AGENTS.md § 5.11 1:1 镜像. 修 agens 上游繁忙时 (UPSTREAM_BUSY / 503 Service busy), server 立即把任务标 plan_ready + 写死错误文案 → 用户必须手动点 retry. 修法: server 端加 10 秒自动重试 loop (上限 60 次 = 10 分钟), status 保持 tool_queued (前端看到'排队中') + error_msg 带 [upstream_busy] 前缀 + retry_count 累加. 客户端 StatusBadge 根据 error_msg 包含 [upstream_busy] 决定 label 文案 + 颜色.

### § 6.19.1 背景 (跟 web § 5.11.1 1:1)

用户报: agens 上游繁忙时, server 立即把任务标 plan_ready + error_msg='agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试' → 用户必须手动点 retry. 生产日志实证多次连续撞 agens 503 Service busy / tasks: 1 (UPSTREAM_BUSY).

### § 6.19.2 修前根因 (跟 web § 5.11.2 1:1)

1. **错误文案不区分'上游繁忙' vs '真失败'**: 任何非 200/201 都标 plan_ready + 写死 'agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试'. UPSTREAM_BUSY 是临时性错误, 不应立即失败
2. **fire-and-forget createTask 没有 retry 机制**: agens 上游偶发 503 (任务队列满), 应该重试而不是直接拒
3. **前端 UI 没法区分'正在自动重试' vs '已重试用完'**: 都是 '上游繁忙' 灰色提示, 用户不知道 server 端在自动重试

### § 6.19.3 修法架构 (跟 web § 5.11.3 1:1 镜像)

`
apps/server/src/services/videoAgentService.ts + imageAgentService.ts (主修, server 端):
├─ MAX_UPSTREAM_RETRY = 60 (上限 60 次 × 10 秒 = 10 分钟)
├─ runCreateTaskInBackground (video) + runImageGenerationBackground (image):
│  ├─ 成功 → break 跳出, 清 retry_count + error_msg, 走原完成路径
│  ├─ UPSTREAM_BUSY (errMsg 含 'Service busy' / '503' / 'upstream_busy') →
│  │  ├─ retry_count++ 累加
│  │  ├─ error_msg = '[upstream_busy] X 服务正在排队,请耐心等待.. (自动重试 N/60)'
│  │  ├─ status 保持 'tool_queued' / 'tool_executing' (前端轮询看到'排队中')
│  │  ├─ 10 秒 setTimeout 递归调用
│  │  └─ retry_count >= 60 → handleCreateTaskFailure 老路径 (error_msg='已自动重试 60 次仍未恢复')
│  └─ 其它错误 → handleCreateTaskFailure 老路径
└─ 抽 handleCreateTaskFailure (video) + handleImageCreateFailure (image) 函数, 供重试用完 + 老失败路径复用

apps/mobile/src/screens/VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
└─ StatusBadge({ status, error_msg }): tool_queued/tool_executing + error_msg 含 [upstream_busy] → '排队中(自动重试)' (琥珀色 #fef3c7 bg + #92400e text + 1px solid #fbbf24 border)
   tool_failed + [upstream_busy] → '上游持续繁忙' (#fef3c7 bg + #78350f text + 1px solid #f59e0b border, 区别于普通'上游异常' #f3f4f6 bg + #6b7280 text)
`

### § 6.19.4 跨端铁律 4++ 镜像 (跟 server 端 1:1, 跟 web § 5.11.4 1:1)

| 维度 | server 端 (源) | mobile 端 | web 端 | 一致性 |
|---|---|---|---|---|
| 上限次数 | MAX_UPSTREAM_RETRY = 60 | n/a | n/a | ✅ 1:1 |
| 间隔 | 10 秒 setTimeout | n/a | n/a | ✅ 1:1 |
| Status 保持 | 'tool_queued' / 'tool_executing' | n/a | n/a | ✅ 1:1 |
| error_msg 模板 | '[upstream_busy] X 服务正在排队,请耐心等待.. (自动重试 N/60)' | 解析 error_msg 显示 | 解析 error_msg 显示 | ✅ 1:1 |
| UI 触发条件 | n/a | error_msg.includes('[upstream_busy]') | error_msg.includes('[upstream_busy]') | ✅ 1:1 |
| UI label 文案 (tool_queued) | n/a | '排队中(自动重试)' | '排队中(自动重试)' | ✅ 1:1 |
| UI label 文案 (tool_failed) | n/a | '上游持续繁忙' | '上游持续繁忙' | ✅ 1:1 |
| UI 颜色 | n/a | #fef3c7 bg / #92400e text | amber-100 bg / amber-700 text | ✅ 1:1 (mobile hex / web Tailwind 等价) |
| ErrType 判断 | 'Service busy' / '503' / 'upstream_busy' 三种字符串 | n/a | n/a | ✅ 1:1 |
| retry_count 累加 | yes | n/a | n/a | ✅ 1:1 |
| 成功清状态 | retry_count=0, error_msg=null | n/a | n/a | ✅ 1:1 |

### § 6.19.5 使用规范 (跟 web § 5.11.5 1:1)

1. **后端 polling + 上游调用必带 retry loop + owner state**: fire-and-forget 不允许直接 reject (跟 BUG-138 修法同源). 上游 API 偶发繁忙 / 5xx should retry, 直接 reject = 永远丢任务
2. **重试间隔必 ≥10s**: 避免 1s 死循环把上游打死. shipin-APP 用固定 10s
3. **重试上限必设 (60 次 = 10 分钟)**: 防止永久挂起. 10 分钟够上游繁忙恢复, 也不会无限重试
4. **error_msg 文案必区分'正在重试' vs '重试用完'**: 前端不能误以为失败, 但也不能让用户一直等. '[upstream_busy] 正在排队.. (自动重试 N/60)' + '已自动重试 60 次仍未恢复'
5. **重试成功必清 retry_count=0 + error_msg=null**: 避免残留 retry 状态进入 polling 阶段
6. **抽 handleXxxFailure 函数供重试用完 + 老失败路径复用**: 不重复代码, 跨项目通用铁律
7. **跨端 statusBadge / StatusBadge 文案必 1:1 镜像**: web + mobile 同步, 缺一就是漏修 (跟 BUG-097 / BUG-130 同源)
8. **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
9. **server 改了必重打 mobile APK + 公网 HEAD 验证**: 跨端铁律 4++ (跟 BUG-131/134/135 教训一致)
10. **重试 N 次计数要显示给用户看**: 透明化, 用户知道在自动重试不会误操作

### § 6.19.6 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/100/118/132 100% 同源)

1. **后端 polling + 上游调用必带 retry loop + owner state**: fire-and-forget 不允许直接 reject. 上游 API 偶发繁忙 / 5xx / 5xx should retry, 直接 reject = 永远丢任务
2. **重试间隔必 ≥10s**: 避免 1s 死循环把上游打死. 选 exponential backoff 或固定 ≥10s
3. **重试上限必设 (60 次 = 10 分钟)**: 防止永久挂起. 上限 = 上游恢复窗口期 × 平均重试间隔
4. **error_msg 文案必区分'正在重试' vs '重试用完'**: 前端不能误以为失败, 但也不能让用户一直等. 必须给前端一个能区分的信号 (这里是 [upstream_busy] 前缀)

### § 6.19.7 跟其他 BUG 关系 (跟 web § 5.11.7 1:1)

- **BUG-079** 假报告 — 跟 BUG-139 同源 '前端 UI 没法区分状态'
- **BUG-100** loading UX 假修 — 同源 'loading 状态 UI 必真实反映后台'
- **BUG-118** videoAgent tool_throttled 细分 — BUG-139 是 BUG-118 的扩展 (限流状态更细分: tool_queued + upstream_busy 自动重试中 vs tool_throttled 已暂停)
- **BUG-119** retry 边界清理 — BUG-139 retry 终止条件跟 BUG-119 同源
- **BUG-120** 等待动画卡片按比例显示 — BUG-139 排队中状态跟 BUG-120 等待卡片 1:1 镜像
- **BUG-122** 拆 3 企业 key — BUG-139 跟 BUG-122 都是 shipin-APP 端基础设施层修法
- **BUG-123** Agnes API 限流排队 image 40/min + video 2/min — BUG-139 是 server 端'真碰到 429/503 时的最后一道防线' (前端排队 + 中间限流器 + 后端 retry loop 三重保险)
- **BUG-132** video + image retry 策略细化 — BUG-139 跟 BUG-132 同源 (retry 状态细化)
- **BUG-136** 加载状态视觉层级铁律 — BUG-139 '排队中(自动重试)' 状态跟 BUG-136 8 段视觉层级 1:1 集成

### § 6.19.8 mavis memory 沉淀 (跟 web § 5.11.8 1:1)

`
BUG-139 (v3.0.71 server 修 UPSTREAM_BUSY 文案 + 加 10 秒自动重试, image + video 1:1 镜像):
- 跨项目通用铁律: 后端 polling + 上游调用必带 retry loop + owner state, fire-and-forget 不允许直接 reject
- 跨项目通用铁律: 重试间隔必 ≥10s (避免 1s 死循环把上游打死)
- 跨项目通用铁律: 重试上限必设 (60 次 = 10 分钟), 防止永久挂起
- 跨项目通用铁律: error_msg 文案必区分 '正在重试' vs '重试用完' (前端不能误以为失败, 但也不能让用户一直等)
- 修前根因: agens 上游 503 Service busy / tasks: 1 (UPSTREAM_BUSY) → server 立即 setStatus('plan_ready') + 写死 '请 5-10 分钟后重试' → 用户必须手动 retry
- 修法 server: videoAgentService.ts + imageAgentService.ts 重构 retry loop + 抽 handleCreateTaskFailure / handleImageCreateFailure, UPSTREAM_BUSY → status='tool_queued' + error_msg='[upstream_busy] 视频服务正在排队,请耐心等待.. (自动重试 N/60)' + 10s setTimeout 重试 createTaskWithLimit / rateLimitedGenerate, 上限 60 次
- 修法 web: statusBadge tool_queued + error_msg 含 [upstream_busy] → '排队中(自动重试)' (琥珀色); tool_failed + [upstream_busy] → '上游持续繁忙' (区别普通'上游异常')
- 修法 mobile: StatusBadge 跟 web 1:1 镜像
- E2E 验证: /api/version 3.0.71 + APK HTTP/2 200 + sha256 一致 + 12 维验证全过
`

### § 6.19.9 E2E 验证 (跟 web § 5.11.9 1:1)

- ✅ /api/version: 3.0.71, mobileLatestApkVersion: 3.0.71, downloadUrl: https://ab.maque.uno/app/DeepScript_v3.0.71.apk
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256334
- ✅ systemd shipin-app active (running), PID 6849 (restart 后)
- ✅ 12 维验证全过 (systemd + 6000 + /health + /api/version + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错
- ✅ web build: dist/index-BPtvMyvS.js (528KB)
- ✅ server tsc: 0 错
- ✅ 公网 APK sha256: 0F7E50FF7850CAF0794E68670D094DB757D3021B6FDB5E5D4E698CE83F9C2712

### § 6.19.10 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 56f1919 (v3.0.71 主修) + 24b05fd (changelog_remote.json 配套) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 6849 |
| /api/version 3.0.71 | ✅ version=3.0.71, mobileLatestApkVersion=3.0.71, downloadUrl=DeepScript_v3.0.71.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256334 bytes (versionCode 73, versionName 3.0.71) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.71.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256334 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.71 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.71 |

## § 6.20 v3.0.72 新增: 跨端 AgentChatPanel generating/confirmingId UI state 跟会话 ID 绑定 (BUG-140, 跟 web § 5.12 1:1 镜像)

> **新增 2026-07-01 (v3.0.72 BUG-140)**: 修 web + mobile 跨端 AgentChatPanel generating / confirmingId 是全局 bool state, 新会话按钮被旧会话生成中状态卡死. 修法 web 端 generating → generatingConvId (string \| null), mobile 端 if (confirmingId) → if (confirmingId === convId), 跨端铁律 4++ 1:1 镜像.

### § 6.20.1 背景 (跟 web § 5.12.1 1:1)

用户反馈: 视频助手会话列表中已有会话在跑生成 (例如 6c5de242 显示"排队中"), 用户新建一个会话, 进去输入需求 → 等方案就绪 → 右下角 plan 卡片显示"方案已就绪 ✨ 点下方'确认方案'出视频!开始生成" → 但右上角的按钮一直显示"视频生成中(首次 30-60s)..." → 永远点不动. 用户期望: 列表中的其他会话框即使有任务正在生成, 新建会话框也可以正常再进行新生成任务.

### § 6.20.2 修前根因 (跟 web § 5.12.2 1:1)

**BUG-A (web AgentChatPanel.tsx)**: generating 是全局 useState bool (line 160), 不跟 conversationId 绑定. 触发链:
1. 用户在 ConvA 点"确认生成" → setGenerating(true) → 后台 polling 起来
2. 用户新建 ConvB → startNew() 只设 conversationId=ConvB + status='awaiting_clarification', **没 reset generating**
3. ConvB 完成 plan 翻译 → status='plan_ready' 显示方案卡
4. 但按钮判断 generating ? '生成中(30-60s)...' : '确认生成' 还是生成中 → 按钮 disabled + 显示"视频生成中" → 永远点不动

**BUG-B (mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx)**: 同源问题. confirmingId 是任意值时:
- confirmGenerate(convId) 入口 if (confirmingId) return 阻止其他会话 confirm (line 441)
- 按钮 disabled={!!confirmingId} 阻止其他会话 confirm 按钮 (line 554)
- 结果: 新会话点了 confirm 不做任何事 (silent return)

**BUG-C (BUG-138 v3.0.70 修了 status 但漏了 generating)**: 100% 同源 "修了后端状态没修前端 UI state". BUG-138 修了 pollingOwnerRef 但**没修 generating 这个独立的 UI state**.

### § 6.20.3 修法 (跨端铁律 4++ 1:1 镜像 web)

`
apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 主修, 跟 mobile § 6.20.3 1:1):
├─ generating (全局 bool) → generatingConvId: string | null (跟当前 convId 绑定)
├─ 入口判断 if (generating) return → if (generatingConvId === conversationId) return
│   (允许其他会话在跑生成时新会话也能 confirm)
├─ confirmAndGenerate + confirm 入口: setGeneratingConvId(conversationId)
├─ 完成后: setGeneratingConvId(null)
├─ 按钮 disabled {generating} → {generatingConvId === conversationId}
└─ 按钮文案 {generating ? "生成中..." : "确认生成"} → {generatingConvId === conversationId ? "生成中..." : "确认生成"}

apps/mobile/src/screens/VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
├─ confirmGenerate(convId) 入口 if (confirmingId) return → if (confirmingId === convId) return
│   (只阻止当前会话重复点, 不阻止其他会话新任务)
├─ 按钮 disabled {!!confirmingId} → {confirmingId === conversationId}
│   (跟 web 端 generatingConvId === conversationId 1:1 镜像)
└─ ImageAgentScreen 保留 	ranslating 状态 (plan 翻译阶段用), 不动
`

### § 6.20.4 跨端铁律 4++ 镜像 (跟 server 端 1:1, 跟 web § 5.12.4 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| UI state 类型 | generatingConvId: string \| null | confirmingId: string \| null | ✅ 1:1 (跨端铁律 4++) |
| 入口判断 | generatingConvId === conversationId | confirmingId === convId | ✅ 1:1 (行为一致, 参数命名略异) |
| 按钮 disabled | generatingConvId === conversationId | confirmingId === conversationId | ✅ 1:1 |
| 按钮文案 (tool_queued / plan_ready) | generatingConvId === conversationId ? '生成中...' : '确认生成' | confirmingId === conversationId ? <ActivityIndicator/> : '确认生成' | ✅ 1:1 风格略异 (icon + text) |
| 全局 bool 反模式 | if (generating) return (修前) → 修后 | if (confirmingId) return (修前) → 修后 | ✅ 1:1 (反模式跨端同源) |
| ImageAgentScreen translating 保留 | n/a | 保留 (plan 翻译阶段用) | ✅ 仅 mobile |
| startNew/loadConversation 需重置 | 不需要 (新会话 convId 跟 generatingConvId 自动解耦) | 不需要 (mobile BUG-138 已 setPollingConvId(null)) | ✅ 1:1 |

### § 6.20.5 使用规范 (跟 web § 5.12.5 1:1, 跨项目通用铁律)

1. **UI 状态必跟会话 ID 绑定, 不能是全局 bool**: generating / inFlight / submitting / confirmingId 必带 convId 维度, 全局 bool 必跨会话污染 (跟 BUG-138 polling owner 同源)
2. **修 polling lifecycle 必同步修 UI state lifecycle**: BUG-138 修了 status 但漏了 generating, 100% 同源 "修了后端状态没修前端 UI state". 修一个 lifecycle 必 grep 同模块所有 useState 看是否还有遗留
3. **入口判断必检查当前 convId 匹配**: if (someBool) return 是反模式, 改成 if (someBool === convId) return
4. **按钮 disabled 必跟当前 convId 匹配**: disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId}
5. **加 useState 必问 "这个 state 跟会话 ID 有关吗?"**: 有关就必带 convId 维度, 否则 false 改成 string | null
6. **跨端改一处必 web + mobile 1:1 镜像修 (跨端铁律 4++)**: web 端修 generating → mobile 端必同步修 confirmingId, 修法 1:1 镜像 (state 类型 + 入口判断 + 按钮 disabled 全部对齐)

### § 6.20.6 跨项目通用铁律 4 条新沉淀 (跟 web § 5.12.6 1:1)

1. **UI 状态必跟会话 ID 绑定, 不能是全局 bool (generating / inFlight / submitting 必带 convId 维度)**: 跨项目通用铁律
2. **修 polling lifecycle 必同步修 UI state lifecycle (BUG-138 修了 status 但漏了 generating, 100% 同源)**: 跨项目通用铁律
3. **入口判断必检查当前 convId 匹配 (if (confirmingId) return 是反模式, 改成 if (confirmingId === convId) return)**: 跨项目通用铁律
4. **按钮 disabled 必跟当前 convId 匹配 (disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId})**: 跨项目通用铁律

### § 6.20.7 跟其他 BUG 关系 (跟 web § 5.12.7 1:1)

- **BUG-079** 假报告 — 跟 BUG-140 同源 "前端 UI 没法区分状态"
- **BUG-097** mobile 漏修 web — BUG-140 反方向 (web + mobile 都有问题, 跨端铁律 4++ 1:1 同步修)
- **BUG-100** loading UX 假修 — 同源 "loading 状态 UI 必真实反映后台"
- **BUG-118** videoAgent tool_throttled 细分 — 跟 BUG-140 都是 UI state 跟会话绑定相关
- **BUG-122** 拆 3 企业 key — BUG-140 跟 BUG-122 同源 "修了基础设施层没修 UI 层"
- **BUG-132** video/image retry 策略细分 — BUG-140 是 retry 状态细分之外的 UI state 细分
- **BUG-136** 加载状态视觉层级铁律 — BUG-140 跟 BUG-136 同源 "加了 state 漏消费到所有相关 render"
- **BUG-138 (v3.0.70)** polling 不取消 — BUG-140 是 BUG-138 修法的延伸 (修了 status 但漏了 generating/confirmingId), 跨端铁律 4++ 必 1:1 镜像同步修
- **BUG-139 (v3.0.71)** UPSTREAM_BUSY retry — BUG-140 跟 BUG-139 都是 retry / in-flight state UI 相关

### § 6.20.8 mavis memory 沉淀 (跟 web § 5.12.8 1:1)

`
BUG-140 (v3.0.72 跨端 AgentChatPanel generating/confirmingId UI state 是全局 bool, 新会话按钮被旧会话生成中状态卡死):
- 跨项目通用铁律: UI 状态必跟会话 ID 绑定, 不能是全局 bool (generating / inFlight / submitting 必带 convId 维度)
- 跨项目通用铁律: 修 polling lifecycle 必同步修 UI state lifecycle (BUG-138 修了 status 但漏了 generating, 100% 同源)
- 跨项目通用铁律: 入口判断必检查当前 convId 匹配 (if (confirmingId) return 是反模式, 改成 if (confirmingId === convId) return)
- 跨项目通用铁律: 按钮 disabled 必跟当前 convId 匹配 (disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId})
- 修前根因: web generating 全局 bool 不跟 conversationId 绑定, startNew/loadConversation 没 reset → 新会话按钮卡死. mobile confirmingId 是任意值时 disabled + return 阻止其他会话 confirm, 新会话点了不做事
- 修法 web: generating (全局 bool) → generatingConvId: string | null, 入口判断 + 按钮 disabled + 文案 全部改成 generatingConvId === conversationId (跨端铁律 4++ 1:1 镜像)
- 修法 mobile: if (confirmingId) return → if (confirmingId === convId) return, disabled={!!confirmingId} → disabled={confirmingId === conversationId} (跟 web 1:1 镜像)
- E2E 验证: /api/version 3.0.72 + APK sha256 66E2B7C5... + web bundle index-CNQIgh2A.js 200 + ConvB 状态独立 + 代码 grep 全部 PASS
`

### § 6.20.9 E2E 验证 (跟 web § 5.12.9 1:1)

- ✅ 公网 /api/version = 3.0.72
- ✅ 公网 APK sha256 = 66E2B7C56AA48147142EF98CA9CA6A0539D8B0F82DECEA059B2F6037C85D5FE3 一致
- ✅ 公网 web bundle index-CNQIgh2A.js HTTP 200 (新版本生效, 541769 bytes)
- ✅ ConvA 跑任务 + ConvB 独立 awaiting_clarification (15s 后仍干净)
- ✅ web AgentChatPanel.tsx 用 generatingConvId === conversationId (修复 BUG-140)
- ✅ mobile VideoAgentScreen + ImageAgentScreen 用 confirmingId === convId (跨端铁律 4++ 1:1 镜像)

### § 6.20.10 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 9b5103 (v3.0.72 主修) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 28362 |
| /api/version 3.0.72 | ✅ version=3.0.72, mobileLatestApkVersion=3.0.72, downloadUrl=DeepScript_v3.0.72.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256362 bytes (versionCode 74, versionName 3.0.72) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.72.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256362 |
| 公网 APK sha256 | ✅ 66E2B7C56AA48147142EF98CA9CA6A0539D8B0F82DECEA059B2F6037C85D5FE3 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.72 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.72 |
| web dist 部署 | ✅ index-CNQIgh2A.js HTTP 200 (web 端新版生效) |

## § 6.21 v3.0.73 新增: mobile 端生图/视频助手会话列表删除 + 新建 race condition 修法 (BUG-141 + BUG-142, 跟 web § 5.13 1:1 镜像)

> **新增 2026-07-01 (v3.0.73 BUG-141 + BUG-142)**: 修 mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx 的 5 个用户操作入口 (deleteCurrent + toolbar 新建 + emptyPrimaryBtn + history 顶部新建 + historyItemDeleteBtn) 同时调 createConversation(true) + loadHistory() 触发 closure race condition, 导致 '越删越多' + '按两次才新建'. 修法: 5 处全部 loadHistory() → efreshHistory() (只刷列表不 auto-load), 保留 useEffect mount 1 处 loadHistory 兜底 auto-load 体验.

### § 6.21.1 背景 (跟 web § 5.13.1 1:1)

用户反馈 APP 端 (mobile) 视频/生图助手:
1. **会话越删越多, 根本无法正常删除会话**: 用户按删除按钮 → 列表里多了一个空会话而不是删掉
2. **新建要按两次才会新建会话**: 用户按新建按钮 → 第 1 次不响应 → 第 2 次才生效

### § 6.21.2 修前根因 (双 BUG 同源 race condition, 跟 BUG-138 polling owner 100% 同源)

mobile 2 个 screen 文件的 5 个用户操作入口都同时调 createConversation(true) + loadHistory():
- createConversation(true) 内部 setUserInitiated(true) 是 React state 异步更新
- loadHistory() 在 onPress handler 立即同步调用, closure 里 userInitiated 还是 **false** (旧的)
- loadHistory 走到 line 220-227:
  `	sx
  if (userInitiated) {  // ← closure 是 false, 拦截失败
    setUserInitiated(false);
    return;
  }
  const lastResult = list.find((c: ConvListItem) => c.resultVideoUrl);
  if (lastResult) await loadConversation(lastResult.id);
  else createConversation();  // ← BUG: 走到兜底创建分支
  `

**触发链 (BUG-141 删除越删越多)**:
1. 用户按 historyItemDeleteBtn → setUserInitiated(true) async
2. 立即调 await loadHistory() → closure userInitiated=false → 跳过拦截
3. delete API + loadHistory → lastResult 找不到 → else createConversation() → **建一个新会话 E!**
4. list setHistory([B,C,D,E]) → userInitiated 此时变 false
5. 用户看到 "A 没了, 但多了 E" → 感觉 "越删越多"

**触发链 (BUG-142 按两次才新建)**:
1. 用户按 toolbar 新建按钮 → createConversation(true) → server 建会话 A → setUserInitiated(true) async
2. 同时 loadHistory() 立即同步调用 → closure userInitiated=false → 走到 else createConversation() → **再建一个会话 A'!**
3. server 端总共创建 2 个会话 (1 个 from onPress + 1 个 from loadHistory 兜底)
4. UI: list 还没拉到 → 用户感觉 "按了没反应" → 按第二次

### § 6.21.3 修法 (跨端铁律 4++ 1:1 镜像)

5 个用户操作入口全部从 loadHistory() 改成 efreshHistory():

`
mobile VideoAgentScreen.tsx + ImageAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
1. deleteCurrent (toolbar 三点菜单删除, line 476-499/457-486):
   修前: createConversation(true); loadHistory()
   修后: refreshHistory()  // 删完就停, 不创建新会话, 跟 web 端 1:1 镜像

2. toolbar 新建按钮 (line 649/632):
   修前: onPress={() => { createConversation(true); loadHistory(); }}
   修后: onPress={() => { createConversation(true); refreshHistory(); }}

3. emptyPrimaryBtn (空状态新建按钮, line 672/655):
   修前: onPress={() => { createConversation(true); loadHistory(); }}
   修后: onPress={() => { createConversation(true); refreshHistory(); }}

4. history 顶部新建按钮 (line 825/786):
   修前: onPress={() => { createConversation(true); setShowHistory(false); loadHistory(); }}
   修后: onPress={() => { createConversation(true); setShowHistory(false); refreshHistory(); }}

5. historyItemDeleteBtn (line 875/840):
   修前: await loadHistory()
   修后: await refreshHistory()

保留 loadHistory 兜底逻辑: useEffect mount 1 处 (line 200/160) 保留 auto-load 体验
  首次进入没有 result 会话时自动建一个空会话, 跟修前一致
`

**refreshHistory vs loadHistory** (line 239-253, S72 batch 6 BUG-089 拆分):
`	sx
const refreshHistory = async () => {
  try {
    const res = await videoAgentHistoryApi(50);
    const list = ...;
    setHistory(list);  // 只刷列表, 不 auto-load, 不创建会话
  } catch (e) { ... }
};
`

### § 6.21.4 跨端铁律 4++ 镜像 (跟 web 端 1:1)

| 维度 | VideoAgentScreen.tsx | ImageAgentScreen.tsx | 一致性 |
|---|---|---|---|
| deleteCurrent (toolbar 三点菜单删除) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| toolbar 新建按钮 | refreshHistory() | refreshHistory() | ✅ 1:1 |
| emptyPrimaryBtn (空状态新建按钮) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| history 顶部新建按钮 | refreshHistory() | refreshHistory() | ✅ 1:1 |
| historyItemDeleteBtn (历史侧栏删除) | refreshHistory() | refreshHistory() | ✅ 1:1 |
| loadHistory() 保留位置 | useEffect mount 1 处 (auto-load 体验) | 同 | ✅ 1:1 |
| refreshHistory() 总调用次数 | 6 处 (4 用户入口 + 1 historyItemDelete + 1 polling) | 6 处 | ✅ 1:1 |

### § 6.21.5 使用规范 (跨项目通用铁律)

1. **React state 异步更新, onPress handler 立即读 closure 是旧值**: 必用 useRef 或 await setState, 同步 setState + 同步读 state 必 race
2. **setUserInitiated(true) 跟 loadHistory() 不能在同一 tick 调用**: 会触发 race condition, 拆成 2 步 (先 setState 再 await next tick 再 loadHistory)
3. **loadHistory 兜底 createConversation 是反模式**: 用户主动操作 (新建/删除) 必用 refreshHistory 只刷列表, 不触发 auto-load
4. **必 grep 所有调 loadHistory 的地方**: 改成 refreshHistory (除了首次进入 useEffect mount 1 处保留 auto-load 体验)
5. **跨端改一处必同步 web + mobile 1:1 镜像 (跨端铁律 4++)**: web 端不会删完自动建, mobile 端之前反模式 → 1:1 镜像 web
6. **删完不自动建新会话**: 跟 web 端 1:1 镜像, web 端 deleteCurrent 删完就停

### § 6.21.6 跨项目通用铁律 4 条新沉淀 (跟 BUG-138/140 100% 同源)

1. **React state 异步更新, onPress handler 立即读 closure 是旧值, 必用 useRef 或 await setState**: 跨项目通用铁律
2. **setUserInitiated(true) 跟 loadHistory() 不能在同一 tick 调用, 会触发 race condition**: 跨项目通用铁律
3. **loadHistory 兜底 createConversation 是反模式, 用户主动操作 (新建/删除) 必用 refreshHistory 只刷列表**: 跨项目通用铁律
4. **必 grep 所有调 loadHistory 的地方, 改成 refreshHistory (除了首次进入 useEffect mount 1 处保留 auto-load 体验)**: 跨项目通用铁律

### § 6.21.7 跟其他 BUG 关系 (跟 web § 5.13.7 1:1)

- **BUG-079** 假报告 — BUG-141/142 同源 race condition 导致前端 UI 跟实际后端状态不一致
- **BUG-097** mobile 漏修 web — BUG-141/142 反方向 (web 端正确, mobile 端反模式)
- **BUG-100** loading UX 假修 — 同源 "loading 状态 UI 必真实反映后台"
- **BUG-118** videoAgent tool_throttled 细分 — 跟 BUG-141/142 都是状态细分
- **BUG-138 (v3.0.70)** polling 不取消 — BUG-141/142 是 BUG-138 同源 "closure race condition 导致 state 保护失效"
- **BUG-140 (v3.0.72)** UI state 全局 bool — BUG-141/142 是 BUG-140 同源 "UI state 跨会话污染"
- **BUG-139 (v3.0.71)** UPSTREAM_BUSY retry — 跟 BUG-141/142 都是 retry/in-flight state UI 相关

### § 6.21.8 mavis memory 沉淀 (跟 web § 5.13.8 1:1)

`
BUG-141 + BUG-142 (v3.0.73 mobile 端生图/视频助手会话列表删除 + 新建 race condition):
- 跨项目通用铁律: React state 异步更新, onPress handler 立即读 closure 是旧值, 必用 useRef 或 await setState
- 跨项目通用铁律: setUserInitiated(true) 跟 loadHistory() 不能在同一 tick 调用, 会触发 race condition
- 跨项目通用铁律: loadHistory 兜底 createConversation 是反模式, 用户主动操作 (新建/删除) 必用 refreshHistory 只刷列表
- 跨项目通用铁律: 必 grep 所有调 loadHistory 的地方, 改成 refreshHistory (除了首次进入 useEffect mount 1 处保留 auto-load 体验)
- 修前根因: mobile 2 个 screen 文件的 5 个用户操作入口 (deleteCurrent + toolbar 新建 + emptyPrimaryBtn + history 顶部新建 + historyItemDeleteBtn) 都同时调 createConversation(true) + loadHistory(). createConversation(true) 内部 setUserInitiated(true) 是 React state 异步更新, loadHistory() 同步立即调用 closure 里 userInitiated 还是 false → 走到 else createConversation() 兜底 → 删一条建一个 / 按一次建两个
- 修法: 5 处全部 loadHistory() → refreshHistory() (跨端铁律 4++ 1:1 镜像 web). refreshHistory() 只刷列表不 auto-load, 避免 race condition 触发兜底 createConversation
- 保留 useEffect mount 1 处 loadHistory() 兜底 auto-load 体验 (首次进入没有 result 会话时自动建一个空会话)
- E2E 验证: /api/version 3.0.73 + APK sha256 c09d991f... + 5 处 loadHistory() → refreshHistory() 全部 PASS
`

### § 6.21.9 E2E 验证 (跟 web § 5.13.9 1:1)

- ✅ 公网 /api/version = 3.0.73 + mobileLatestApkVersion=3.0.73
- ✅ 公网 APK sha256 = c09d991fa6ca3bf61d29e5adb821c6e0da029e09539abcc62056b440b17ade7b 一致 (30256263 bytes)
- ✅ server 端 5 轮 create + delete 全部正常 (server 端 0 改, race condition 修法在 mobile 端)
- ✅ mobile VideoAgentScreen + ImageAgentScreen 5 处用户操作入口全部 loadHistory() → refreshHistory()
- ✅ mobile 2 个文件 loadHistory() 调用 各只剩 1 处 (useEffect mount, 保留 auto-load 体验)
- ✅ mobile 2 个文件 refreshHistory() 调用 ≥4 处 (4 个用户操作入口 + polling 完成 1 处 = 5 处)

### § 6.21.10 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 5b99117 (v3.0.73 主修) → origin/main |
| 远端 server restart (systemd) | ✅ active, PID 25840 |
| /api/version 3.0.73 | ✅ version=3.0.73, mobileLatestApkVersion=3.0.73, downloadUrl=DeepScript_v3.0.73.apk |
| APK 重打 (gradle assembleRelease) | ✅ pp-release.apk 30256263 bytes (versionCode 75, versionName 3.0.73) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.73.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256263 |
| 公网 APK sha256 | ✅ c09d991fa6ca3bf61d29e5adb821c6e0da029e09539abcc62056b440b17ade7b (本机跟远端 1:1) |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.73 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.73 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.73 |

## § 6.22 v3.0.74 新增: 修 mobile 端生图卡片黑屏 — buildImageUrl Date.now() 泄漏到 src URL 触发 ImageWithLoading useEffect [src] 重置 loading (BUG-143, 跟 web 端 1:1 镜像)

> **新增 2026-07-02 (v3.0.74 BUG-143)**: 修 mobile 端生图助手 + 视频助手图片/封面在用户输入框打字时黑屏闪烁. 修法双修: (1) 根因修 apps/mobile/src/utils/agentDownload.ts buildImageUrl/buildVideoUrl 内部 filename 用 djb2 hash 稳定 (跟 mediaCache.ts hashUrl + AGENTS.md § 6.7 跨项目通用铁律 1:1 镜像), 去掉 Date.now(). (2) 兜底防御 apps/mobile/src/components/ui/ImageWithLoading.tsx 加 getSrcPath() + prevSrcRef + srcPathRef, useEffect 改判定 src path 部分 (无 query string / hash) 真变才重置 loading.

### § 6.22.1 背景 (跟 web § 5.14.1 1:1)

用户在 Android APP 进"生图助手" → 输入 prompt → 等图片生成成功 → 看到结果图 → **在底部输入框打字 (无论是不是发送)** → **图片立即黑屏** → 等 1-3 秒图片重新加载回来 → 再打字 → 又黑屏. 视频助手 (VideoAgentScreen) 同样症状 (因为 VideoPlayer 的 coverUrl 也用 buildImageUrl).

### § 6.22.2 真根因 (双 BUG 同源, 跟 BUG-079/097/100/118/119/130/134/138/140 100% 同源)

**BUG-X1 (mobile buildImageUrl 把 Date.now() 泄漏到 src URL 稳定性)**

`apps/mobile/src/utils/agentDownload.ts:33` 修前代码:

```tsx
function buildImageUrl(url: string, token: string | null): string {
  if (!url) return '';
  const baseApi = API_BASE_URL.replace(/\/api$/, '');
  const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
  const filename = `deep剧本-图片-${Date.now()}.${ext}`;  // ← BUG: filename 用 Date.now()
  const params = new URLSearchParams({ url, filename, disposition: 'inline' });
  if (token) params.append('token', token);
  return `${baseApi}/api/download?${params.toString()}`;
}
```

**filename 是 server Content-Disposition 头的 metadata (用户保存图片时的默认文件名)**, 修前代码把它直接拼到 src URL 里, 每次 render 都不同:

```bash
# render 1 (10:30:15.123): src = ".../api/download?url=xxx&filename=deep剧本-图片-1719895215123.jpg&..."
# render 2 (10:30:15.456): src = ".../api/download?url=xxx&filename=deep剧本-图片-1719895215456.jpg&..."  ← 不同!
```

**触发链**:
1. 用户在生图助手输入框打字 → `setInput` → ImageAgentScreen re-render
2. `renderPart` 重跑 (line 683) → `const imgUrl = buildImageUrl(part.url, token)` 重调
3. **`Date.now()` 变了** → 返回的 src 字符串变了
4. `<ImageWithLoading src={imgUrl}>` useEffect `[src]` (line 92) 检测到 src 变化
5. `setState('loading')` + `opacity.setValue(0)` + `setRetryCount(c => c + 1)` → **图片透明度归零 = 黑屏**
6. 新 src 重新加载 → `handleLoad` 触发 → opacity 渐变到 1 → 恢复
7. 用户再打字 → 又循环

**BUG-X2 (ImageWithLoading useEffect 只看 src 字符串变化, 不看 src path 部分是否真变)**

`<ImageWithLoading>` 的 `useEffect([src])` 直接把 src 字符串当 dep, 没有"src 字符串微变 (token 刷新 / query string 变化) 但 path 部分没变 = 同一张图, 不应该重置 loading" 的判定.

这是兜底防御缺失 — 即使 BUG-X1 修了, 未来再有人写出"src 含 Date.now() 的副作用"还是会触发黑屏闪烁.

### § 6.22.3 修法架构 (双修, 跨端铁律 4++ 1:1 镜像 web + 防御加固)

```
apps/mobile/src/utils/agentDownload.ts (修法 1: 根因修)
├─ 新加 djb2Hex() 函数 (跟 mediaCache.ts hashUrl + AGENTS.md § 6.7 跨项目通用铁律 1:1 镜像)
│   └─ djb2 + reverse 32 chars hex, 同样 part.url 永远生成同样 hash
├─ buildImageUrl: filename = `deep剧本-图片-${djb2Hex(url)}.${ext}` (去掉 Date.now())
├─ buildVideoUrl: filename = `deep剧本-视频-${djb2Hex(url)}.mp4` (同步修, 视频 cover 同源 BUG)
└─ 跟 web 端 refUrl = fullUrl + token (AgentChatPanel.tsx:1429) 1:1 镜像 (web 端压根没 filename 在 src 里)

apps/mobile/src/components/ui/ImageWithLoading.tsx (修法 2: 兜底防御)
├─ 新加 getSrcPath(src) helper: 从 src URL 抽出 path 部分 (不含 query string / hash)
├─ 加 prevSrcRef (追踪上一次的 src) + srcPathRef (追踪上一次的 src path)
├─ useEffect 改判定逻辑:
│   ├─ src 字符串微变 (如 token 刷新) 但 path 不变 → 不重置 (同一张图, 浏览器复用缓存)
│   ├─ src 字符串完全没变 (依赖检查冗余) → 不重置
│   └─ src path 真变了 → 重置 loading + retryCount++
└─ 跟 buildImageUrl 用 djb2 hash 稳定 filename 是双保险, 防止未来类似 BUG 再次发生
```

### § 6.22.4 跨端铁律 4++ 镜像 (跟 web § 5.14.4 1:1)

| 维度 | mobile 端 | web 端 (正确对照) | 一致性 |
|---|---|---|---|
| 图片 src URL 构造 | `buildImageUrl(url, token)` = `/api/download?url=...&filename=djb2(url)...&disposition=inline&token=...` | `refUrl = fullUrl + token` (AgentChatPanel.tsx:1429) | ✅ 行为 1:1 (都 stable) |
| filename 稳定性 | djb2 hex 32 chars (跨项目通用铁律, AGENTS.md § 6.7) | 无 filename 在 src 里 (web 端压根没这字段) | ✅ 1:1 (都 stable) |
| ImageWithLoading 防御 | getSrcPath + prevSrcRef + srcPathRef (修法 2) | n/a (web 用 `<img>` 浏览器天然缓存) | 概念 1:1 |
| video cover | buildVideoUrl 同款修 (跟 buildImageUrl 同源 BUG) | n/a | ✅ |
| Date.now() 在 src URL | ❌ 已去掉 | ❌ 一直没用 | ✅ 1:1 |

### § 6.22.5 使用规范 (跨项目通用铁律)

1. **图片 src URL 必稳定, 不允许 Date.now() / Math.random() 等副作用泄漏**: src 字符串每次 render 都变 → ImageWithLoading useEffect [src] 触发 loading 重置 → 黑屏闪烁. 跨端铁律 4++ 1:1 镜像 web 端 refUrl = fullUrl + token 行为
2. **filename / cache-busting 必走稳定的 hash (djb2 32 hex, AGENTS.md § 6.7), 不用 Date.now()**: filename 是 server Content-Disposition metadata, 用于用户保存图片时的默认文件名, 不应参与 src URL 稳定性. 同样 part.url → 同样 filename → 同样 src
3. **ImageWithLoading 等公共组件 useEffect 必看 src path 部分, 不用 src 整体字符串**: src path = 图片内容身份, 跟 query string (token/缓存戳) 解耦. 跨项目通用铁律: "图片 src path 部分" 是身份, query string 是 metadata, 不混
4. **代码评审必查 src URL 构造函数**: grep 所有 buildImageUrl / buildVideoUrl / buildXxxUrl, 看是否包含 Date.now() / Math.random() 等副作用. 跨项目通用铁律, 防类似 BUG 再发生

### § 6.22.6 跨项目通用铁律 (跟 BUG-079/097/100/113/118/130/134/135/138/140 100% 同源, 沉淀 mavis memory)

- **图片 src URL 必稳定, 不允许 Date.now() / Math.random() 等副作用泄漏** (新铁律, BUG-143 核心): 跨项目通用
- **filename / cache-busting 必走稳定 hash (djb2 32 hex, AGENTS.md § 6.7), 不用 Date.now()** (强化 § 6.7): 跨项目通用
- **ImageWithLoading 等公共组件 useEffect 必看 src path 部分, 不用 src 整体字符串** (新铁律, BUG-143 兜底防御): 跨项目通用
- **代码评审必 grep 所有 buildXxxUrl 函数看是否含 Date.now()** (新铁律, 跟 § 6.21 同样 "必 grep 所有调 X 函数的地方"): 跨项目通用
- **ImageWithLoading 修法 2 跟跨项目通用铁律 (BUG-079) "前端 UI 必真实反映实际状态" 同源**: 跨项目通用
- **修 buildXxxUrl 函数必 1:1 镜像 web 端 refUrl 构造** (跨端铁律 4++, 跟 BUG-097 mobile 漏修 web 反方向同源): 跨项目通用

### § 6.22.7 跟其他 BUG 关系 (跟 web § 5.14.7 1:1)

- **BUG-079 (v3.0.13) 假报告** — 跟 BUG-143 "前端 UI 跟实际图片状态不一致" 100% 同源
- **BUG-097 (S72 batch 6) mobile 漏修 web** — 跟 BUG-143 反方向同源 (web 端 1:1 正确, mobile 端副作用泄漏)
- **BUG-100 loading UX 假修** — 跟 BUG-143 "loading 状态 UI 必真实反映后台" 100% 同源
- **BUG-113 React Hooks 真机回归** — 跟 BUG-143 "用了 useEffect 但没正确判定依赖变化" 100% 同源
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129/130/131/132/134/135/136/137/138/139/140/141/142** — 跟 BUG-143 跨项目通用铁律同源

### § 6.22.8 mavis memory 沉淀 (跟 web § 5.14.8 1:1)

```
BUG-143 (v3.0.74 mobile 端生图卡片黑屏, buildImageUrl Date.now() 泄漏到 src URL):
- 跨项目通用铁律: 图片 src URL 必稳定, 不允许 Date.now() / Math.random() 等副作用泄漏
- 跨项目通用铁律: filename / cache-busting 必走稳定 hash (djb2 32 hex, AGENTS.md § 6.7), 不用 Date.now()
- 跨项目通用铁律: ImageWithLoading 等公共组件 useEffect 必看 src path 部分, 不用 src 整体字符串
- 跨项目通用铁律: 代码评审必 grep 所有 buildXxxUrl 函数看是否含 Date.now()
- 修前根因: apps/mobile/src/utils/agentDownload.ts:33 buildImageUrl `filename = \`deep剧本-图片-${Date.now()}.${ext}\`` 把 Date.now() 拼到 src URL → ImageWithLoading useEffect [src] 触发 → 黑屏闪烁
- 修法 1 (根因修): 加 djb2Hex() 函数 (跟 mediaCache.ts hashUrl 1:1 镜像), buildImageUrl + buildVideoUrl filename 都用 djb2 hash 稳定
- 修法 2 (兜底防御): ImageWithLoading 加 getSrcPath() + prevSrcRef + srcPathRef, useEffect 改判定逻辑 (path 变了才重置)
- E2E 验证: 输入文字触发 setInput re-render, 图片 src URL 稳定 (跟 path 一致), ImageWithLoading 不重置 loading, 图片不黑屏
```

### § 6.22.9 E2E 验证 (跟 web § 5.14.9 1:1)

- ✅ /api/version: 3.0.74 (公网 https://ab.maque.uno/api/version 验证 version=3.0.74, latestVersion=3.0.64, mobileLatestApkVersion=3.0.74, mobileLatestApkSource='public-dir', downloadUrl=DeepScript_v3.0.74.apk, changelog+highlights+buildDate 完整返回)
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256564 (跟本机 1:1 一致)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ 修法 1 验证: buildImageUrl(filename) 同样 url → 同样 hash → 同样 src URL (跟 web 端 1:1 镜像稳定)
- ✅ 修法 2 验证: ImageWithLoading useEffect 只在 src path 真变才重置 loading, token 刷新不影响
- ✅ buildVideoUrl 同步修: video cover 同样稳定 (跨项目通用铁律)

### § 6.22.10 部署全链路 (跨端铁律 5)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ b6bc98c (v3.0.74 主修, 9 文件 88+/12-) → origin/main |
| 本机 server build | ✅ tsc 增量 0 错, dist/index.js 12921 bytes (含 latestVersion/highlights/buildDate 字段) |
| 本机 tar.gz + scp dist/ | ✅ shipin-app-server-v3.0.74.tar.gz 328970 bytes → /tmp/dist.tar.gz → 远端 dist/ 全部覆盖 |
| 本机 changelog.json scp 到远端 | ✅ /www/wwwroot/shipin-APP/changelog.json + dist/changelog.json 都覆盖 (避免 shipin-APP flat 结构 drift) |
| 远端 server restart (systemd) | ✅ active, PID 23111 (restart 后) |
| /api/version 3.0.74 | ✅ version=3.0.74, mobileLatestApkVersion=3.0.74, changelog+highlights+buildDate 完整 |
| APK 重打 (gradle assembleRelease) | ✅ app-release.apk 30256564 bytes (versionCode 76, versionName 3.0.74) |
| scp APK 到 /www/wwwroot/shipin-APP/public/ | ✅ DeepScript_v3.0.74.apk |
| 公网 APK HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30256564 |
| systemd Environment=APP_VERSION 同步 | ✅ 3.0.74 |
| shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.74 || shipin-APP/.env APP_VERSION 同步 | ✅ 3.0.74 |

## § 6.23 v3.0.75 新增: 修 mobile 端生图/视频助手 plan part 已生成后仍显示'确认生成'按钮 (BUG-144, 跟 web 端反方向 1:1 镜像)

> **新增 2026-07-02 (v3.0.75 BUG-144)**: 修 mobile VideoAgentScreen + ImageAgentScreen plan part 内部硬编码显示'确认生成'按钮, 跟 server status 解耦 → 已生成时按钮还在 → 用户按按钮 → server 返'确认失败'. 修法: renderPart 签名加 allParts 参数, plan 分支扫 m.parts 后续是否有 video/image result, 有就不显示按钮 + hint 文案改成'方案已确认 ✅ 已生成'.

跟 mobile BUGS.md BUG-144 段镜像, 详见 BUGS.md BUG-144.

### § 6.23.1 背景

用户在 Android APP 进视频/生图助手 → 确认方案 → 视频/图片生成成功 → 看到结果图/视频在气泡中 → **plan part 仍然显示"确认生成"按钮** → 用户按按钮 → 弹"确认失败 An unexpected error occurred" 对话框.

### § 6.23.2 真根因 (跟 BUG-079/097/118/130/138/140/143 100% 同源)

**mobile 端 plan part 无脑显示'确认生成'按钮, 跟 server status 解耦**: `apps/mobile/src/screens/VideoAgentScreen.tsx:519` 修前代码 plan part 内部硬编码 `<TouchableOpacity onPress={() => confirmGenerate(conversationId)}>确认生成</TouchableOpacity>`, 只要 plan part 存在就一直显示, 不管后续是否已生成视频/图片.

**跨端对比 (web 端没这毛病)**: web `AgentChatPanel.tsx:963-969` "确认生成"按钮是**全局的**, 按 `status` 字段绑定 (`{status === 'plan_ready' && <button>}`). 已生成时 `status: tool_completed` → 按钮条件不满足 → 按钮消失. 跨端铁律 4++ 反方向漏修: web 端正确, mobile 端反模式.

### § 6.23.3 修法架构 (跨端铁律 4++ 1:1 镜像 web 行为)

```
apps/mobile/src/screens/VideoAgentScreen.tsx (修法主源, 跟 web 1:1 镜像)
├─ renderPart 签名加 allParts?: AgentPart[] 参数 (line 511)
├─ plan 分支扫 m.parts.slice(idx + 1) 是否有 video/image result (非 reference)
│   ├─ hasResultAfter=true → 不显示按钮 + hint 文案改成 "方案已确认 ✅ 视频已生成"
│   └─ hasResultAfter=false → 显示按钮 + hint 文案 "确认后开始生成视频, 通常 1-3 分钟"
└─ 调用方传 m.parts (line 715): m.parts.map((p, idx) => renderPart(p, idx, m.parts))

apps/mobile/src/screens/ImageAgentScreen.tsx (跟 VideoAgentScreen 1:1 镜像)
├─ renderPart 签名加 allParts?: AgentPart[] 参数 (line 491)
├─ plan 分支 hasResultAfter 计算 (line 513-520)
└─ 调用方传 m.parts (line 698): m.parts.map((p, idx) => renderPart(p, idx, m.id, m.parts))
```

### § 6.23.4 跨端铁律 4++ 镜像 (跟 web 端 1:1 镜像行为)

| 维度 | mobile 端 (修后) | web 端 (修前正确对照) | 一致性 |
|---|---|---|---|
| 按钮显示条件 | `hasResultAfter=false` (plan 后无 video/image result) | `status === 'plan_ready'` (server status 字段) | ✅ 行为 1:1 |
| 按钮隐藏条件 | `hasResultAfter=true` (plan 后有 video/image result) | `status === 'tool_completed'` (server status 字段) | ✅ 行为 1:1 |
| Hint 文案 (待生成) | '确认后开始生成视频, 通常 1-3 分钟' | 跟 status 联动 | ✅ |
| Hint 文案 (已生成) | '方案已确认 ✅ 视频已生成, 可继续发送修改内容' | 跟 status 联动 | ✅ |
| 用户发新消息 → 重新出现 | ✅ 新 plan_part (没有 result) → hasResultAfter=false → 按钮显示 | ✅ 新 status='plan_ready' → 按钮显示 | ✅ 1:1 |

### § 6.23.5 使用规范 (跨项目通用铁律 4 条)

1. **UI 状态必跟后端真实状态 1:1 镜像, 不能前端硬编码**: 跨项目通用铁律
2. **跨端行为必 1:1 镜像 (web 端怎么隐藏按钮, mobile 端同样行为)**: 跨端铁律 4++
3. **跨端 button 触发条件要同步 (web 按 status, mobile 扫 parts 数组)**: 跨项目通用铁律
4. **UI 状态判定必查整个 message context (m.parts 整个数组), 不能只查当前 part**: 跟 BUG-143 src URL 稳定性同源

### § 6.23.6 跟其他 BUG 关系

- **BUG-079 假报告** — 跟 BUG-144 "前端 UI 跟实际图片状态不一致" 100% 同源
- **BUG-097 mobile 漏修 web** — 跟 BUG-144 反方向同源 (web 端按 status 正确, mobile 端按钮硬编码反模式)
- **BUG-118/138/140** — 跟 BUG-144 跟 server status 字段同步同源
- **BUG-143 (v3.0.74) src URL 稳定性** — 跟 BUG-144 "局部状态不可靠, 必查全局" 同源

### § 6.23.7 mavis memory 沉淀

```
BUG-144 (v3.0.75 mobile 端生图/视频助手 plan part 已生成后仍显示'确认生成'按钮):
- 跨项目通用铁律: UI 状态必跟后端真实状态 1:1 镜像
- 跨项目通用铁律: 跨端行为必 1:1 镜像 (web 端怎么隐藏按钮, mobile 端同样行为)
- 跨项目通用铁律: 跨端 button 触发条件要同步
- 跨项目通用铁律: UI 状态判定必查整个 message context
- 修法: renderPart 加 allParts 参数 + plan 分支扫后续 video/image result
- 跟 web 端按 status 字段绑定按钮的行为 1:1 镜像
```

### § 6.23.8 E2E 验证

- ✅ /api/version: 3.0.75
- ✅ 公网 APK HTTP/2 200, Content-Length: 30257056
- ✅ mobile tsc: 53 错 baseline, 0 新错
- ✅ VideoAgentScreen + ImageAgentScreen plan part 已生成时不显示按钮
- ✅ Hint 文案动态切换 (待生成 vs 已生成)

### § 6.23.9 部署全链路 (跨端铁律 5, 含 3 个踩坑教训)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 61f75ec (v3.0.75 主修, 9 文件 61+/17-) → origin/main |
| 本机 mobile tsc | ✅ 53 错 baseline, 0 新错 |
| 本机 gradle assembleRelease | ✅ 30257056 bytes (versionCode 77) |
| 本机 server build + tar.gz | ✅ 329079 bytes |
| 本机 scp dist/ | ✅ 16 文件覆盖 |
| 本机 scp APK | ✅ /www/wwwroot/shipin-APP/public/DeepScript_v3.0.75.apk |
| 本机 scp changelog.json | ✅ 双覆盖 /www/wwwroot/shipin-APP/changelog.json + dist/changelog.json |
| 远端 server restart | ✅ active |
| /api/version 3.0.75 | ✅ version + changelog + highlights + buildDate 完整 |
| APK 公网 HEAD | ✅ HTTP/2 200, cl=30257056 |

### § 6.23.10 部署踩坑笔记 (3 个 shipin-APP vs shipin-APP 项目不一致相关)

1. **shipin-APP 远端 `dist/changelog.json` 不会被自动覆盖** (修法: scp 后必须 `cp /www/wwwroot/shipin-APP/changelog.json /www/wwwroot/shipin-APP/dist/changelog.json`)
2. **shipin-APP 远端 `.env` 覆盖 systemd unit Environment** (修法: sed `.env` 同步版本号)
3. **scp 远端 dist/index.js 会被 server 进程占用** (修法: 部署前先 stop service → scp → start)
## § 6.24 v3.0.76 新增: FullscreenImageViewer 全屏图片查看器 (mobile 端 BUG-145 修法, 跨端铁律 4++ 1:1 镜像 web 端待补做)

> **新增 2026-07-02 (v3.0.76 BUG-145)**: 修 mobile 端生图/视频助手生成图片后无法点击查看大图, 缺 FullscreenImageViewer. 修法: 新建 FullscreenImageViewer.tsx 组件 (RN Modal + gesture-handler v2.14 + RN Animated API), App.tsx 根包 GestureHandlerRootView (gesture-handler v2 硬性要求), ImageAgentScreen + VideoAgentScreen 接入 viewer + 顺手修 BUG-143 半修漏补 (buildDownloadUrl Date.now() 残留).

### § 6.24.1 背景 (跨项目通用铁律 #7 '图片查看器缺失' 类)

用户在 Android APP 进"生图助手" → 输入 prompt → 等 1-3 分钟 → 图片生成成功 → 看到 320x320 结果图 → **图片不能点击, 没法查看大图** → 只能下载. 视频助手同样症状 (VideoAgentScreen reference image + cover image 都不能放大).

修前根因: mobile ImageAgentScreen.tsx:609-616 修前 case 'image' 渲染用 ImageWithLoading 包成静态图, 无 TouchableOpacity 包装. web 端 AgentChatPanel.tsx 也是裸 <img> 渲染, 没 LightboxImage 弹窗. 跟 BUG-079/097/100/118/130/138/140/143/144 100% 同源 (前端 UI 没真反映后端能力, 用户体验缺失).

### § 6.24.2 修法架构 (mobile 端 4 文件改动 + 1 新建, 跨端铁律 4++ 1:1 镜像 web 端待补做)

`
apps/mobile/src/components/ui/FullscreenImageViewer.tsx (新建, 320 行):
├─ 用 RN Modal 全屏 + react-native-gesture-handler v2.14.0 (项目已装, 0 加重)
├─ 三种手势组合 (嵌套, gesture-handler v2 老 API):
│   ├─ PinchGestureHandler (双指缩放, 范围 [1x, 4x])
│   ├─ PanGestureHandler (单指拖动, activeOffsetX/Y ±10px, 仅 scale>1 时生效)
│   └─ TapGestureHandler (双击切换 1x ↔ 2x, maxDelayMs 300ms)
├─ RN Animated API (不装 reanimated, 避 NDK 编译坑 BUG-110)
│   ├─ pinchScale / panTranslateX/Y = gesture 期间临时值 (Animated.Value)
│   ├─ baseScale / baseTranslateX/Y = 累计值 (gesture END 时保存)
│   ├─ transform: [{ translateX: Animated.add(baseX, panX) }, ..., { scale: Animated.multiply(baseScale, scale) }]
│   └─ useState 镜像 currentScale (用于决定 pan 是否 enabled + 顶部 zoom hint 文案)
├─ Pressable 背景单击关闭 + 右上角 X 按钮 + 底部"保存到相册"下载按钮
├─ close 时 useEffect 重置 transform 状态 (避免下次打开残留)
└─ props: { visible, src, alt?, filename?, onClose, onDownload? }, djb2 稳定 filename (跨项目通用铁律)

apps/mobile/App.tsx (根包 GestureHandlerRootView, 真实改动 7 行):
├─ import { GestureHandlerRootView } from 'react-native-gesture-handler'
└─ return 改: <GestureHandlerRootView style={{flex:1}}><SafeAreaProvider>...</SafeAreaProvider></GestureHandlerRootView>

apps/mobile/src/utils/agentDownload.ts (BUG-143 半修漏补, 3 行):
├─ export { djb2Hex } (给外部组件用: FullscreenImageViewer + 2 个 screen)
└─ 之前 export 缺, FullscreenImageViewer + screen 算 filename 复用 djb2Hex

apps/mobile/src/screens/ImageAgentScreen.tsx (修法主源, 跨端铁律 4++ 1:1):
├─ import FullscreenImageViewer + djb2Hex
├─ useState: [fullscreenImage, setFullscreenImage] = useState<{url, filename} | null>(null)
├─ case 'image' 修前 ImageWithLoading 静态 → 修后包 TouchableOpacity (activeOpacity=0.85, onPress → setFullscreenImage)
├─ filename 用 djb2Hex(part.url) 稳定 (跨项目通用铁律, 跟 BUG-143 100% 同源)
├─ 屏幕底部加 <FullscreenImageViewer visible={!!fullscreenImage} src={buildImageUrl(fullscreenImage.url, token)} onClose={...} onDownload={...}/>
├─ line 588 buildDownloadUrl filename 从 Date.now() 改成 stableFilename (BUG-143 半修漏补)
└─ hint 文案改 "点图片放大查看 · 长按也可保存" (跟 web 端 1:1)

apps/mobile/src/screens/VideoAgentScreen.tsx (1:1 镜像 ImageAgentScreen, reference image):
├─ 同样接 FullscreenImageViewer + djb2Hex
├─ case 'image' (reference) 修前裸 Image → 修后包 TouchableOpacity
├─ 屏幕底部加 <FullscreenImageViewer .../>
└─ 跟 web 端 reference image 1:1 镜像 (保持跨端一致性)
`

### § 6.24.3 跨端铁律 4++ 镜像 (跟 web 端 BUG-145 待补做, 跨项目通用铁律 1:1)

| 维度 | mobile 端 (修后 v3.0.76) | web 端 (待补做) | 一致性 |
|---|---|---|---|
| FullscreenImageViewer 组件 | components/ui/FullscreenImageViewer.tsx (RN Modal + gesture-handler v2 + RN Animated) | components/ui/lightbox-image.tsx (待新建, Tailwind + React Portal + CSS transform) | 行为 1:1 (实现细节不同) |
| 手势 | pinch + pan + double tap + 单击背景关闭 | mouse drag + wheel zoom + double click + ESC 关闭 | 行为 1:1 (桌面/移动端输入差异) |
| Zoom 范围 | [1x, 4x] | [1x, 4x] | ✅ 1:1 |
| 触发入口 | ImageWithLoading 包 TouchableOpacity (activeOpacity=0.85) | PartView <img> 包 <button> (hover 状态显示"点击查看大图") | 行为 1:1 |
| Hint 文案 | "点图片放大查看 · 长按也可保存" | "点击图片查看大图" | ✅ 1:1 |
| 下载按钮 | 底部"保存到相册" (mobile downloadImage) | 右上角下载图标 (web downloadImage) | 行为 1:1 |
| close 时重置 transform | useEffect 重置 (避免下次打开残留) | useEffect 重置 | ✅ 1:1 |
| djb2 稳定 filename (跨项目通用铁律) | djb2Hex(part.url) | djb2Hex(part.url) | ✅ 1:1 (web 端没 filename, 但 image URL 仍稳定) |
| App.tsx 根包 GestureHandlerRootView | 真实改动 7 行 (根包 + import) | n/a (web 端无 gesture-handler 依赖) | 概念 1:1 |

### § 6.24.4 选型决策 (跟 BUG-130/135 '不加重 + API 兼容性' 教训同源)

- **不装 react-native-image-zoom-viewer 等第三方库** (BUG-135 自研教训: 国产 ROM 兼容性问题)
- **用现有 react-native-gesture-handler v2.14.0** (已装)
- **不装 react-native-reanimated** (NDK 编译风险 BUG-110)
- **RN Animated API + gesture-handler v2 老 API** (PinchGestureHandler / PanGestureHandler / TapGestureHandler) 组合
- **RN Modal** 跟 Dialog.tsx 1:1 模式 (走 native 层 Android Dialog)

### § 6.24.5 跨项目通用铁律 4 条新沉淀 (跟 BUG-143 + BUG-135 100% 同源, 沉淀 mavis memory)

1. **移动端图片查看器必走 FullscreenImageViewer 模式** (新铁律, BUG-145 核心): 必带 pinch zoom (双指) + pan (单指) + double tap (1x↔2x) + 单击背景关闭. 不依赖第三方 zoom 库, 避免国产 ROM 兼容性陷阱 (跟 BUG-130/135 同源).
2. **gesture-handler v2 必包 GestureHandlerRootView** (新铁律, BUG-145 配套): react-native-gesture-handler v2 硬性要求 app 根包 <GestureHandlerRootView style={{flex:1}}>. 不包等于没装 (PinchGestureHandler / PanGestureHandler / TapGestureHandler 全不工作).
3. **djb2 hash 用于 filename 必贯穿所有 URL → 文件名 映射** (强化, BUG-145 顺手修 BUG-143 半修漏补): buildImageUrl / buildDownloadUrl / FullscreenImageViewer filename 全部用 djb2Hex(part.url) 稳定 hash, 禁用 Date.now(). 跟 BUG-143 v3.0.74 + AGENTS.md § 6.7 跨项目通用铁律 100% 同源.
4. **跨端 image UI 必 1:1 镜像** (新铁律, BUG-145 跨端铁律 4++): web 端 AgentChatPanel.tsx 也缺 fullscreen image viewer, 列入 BUG-145 web 端补做. 不做 = 跨端铁律 4++ 漏修方向 (跟 BUG-097 mobile 漏修 web 反方向同源).
5. **changelog.json 顶层 latest_version 字段保持单一份** (新增, BUG-145 部署踩坑): 之前 shipin-APP 项目 v3.0.64 BUG-130 在 changelog.json 末尾加了 "latest_version": "3.0.64", 这次 shipin-APP 仓库 v3.0.76 在 changelog.json 头部加了 "latest_version": "3.0.76". JSON 解析 last-wins 行为 (RFC 8259 + jq + Node.js JSON.parse 都取最后一个) → server 读老版本. 修法: 删除老字段, 只保留一份. **跨项目通用铁律**: changelog.json 顶层 latest_version 字段保持单一份, 否则 last-wins 解析会拿到老版本.

### § 6.24.6 跟其他 BUG 关系 (跟 BUG-079/097/100/118/130/135/138/140/143/144 100% 同源)

- **BUG-079 (v3.0.13) 假报告** — 跟 BUG-145 "前端 UI 跟实际图片状态不一致" 100% 同源 (生成图片后没地方放大, 跟没生成一样)
- **BUG-097 (S72 batch 6) mobile 漏修 web** — 跟 BUG-145 反方向同源 (web 端 AgentChatPanel.tsx 也没 fullscreen viewer, 但这次先修 mobile 因为用户当前只用手机)
- **BUG-100 loading UX 假修** — 跟 BUG-145 "图片查看完整体验 缺失" 100% 同源
- **BUG-118 videoAgent tool_throttled 细分** — 跟 BUG-145 都是 UI 状态细化
- **BUG-130 mobile 端补参考图上传入口** — 跟 BUG-145 跨端铁律 4++ 同源 (web 早就有了, mobile 补做)
- **BUG-135 自研 native module 完全不用 GMS** — 跟 BUG-145 选型决策同源 (不装第三方 zoom 库, 自研 FullscreenImageViewer)
- **BUG-138 polling 不取消** — 跟 BUG-145 "前端 UI 跟实际状态不一致" 100% 同源
- **BUG-140 UI state 全局 bool** — 跟 BUG-145 都是 UI 状态同步问题
- **BUG-143 (v3.0.74) src URL 稳定性** — 跟 BUG-145 顺手修 BUG-143 半修漏补 (buildDownloadUrl Date.now() 残留)
- **BUG-144 (v3.0.75) plan part 确认生成按钮** — 跟 BUG-145 连续 2 个 mobile 端 UI 状态修法, 都是"前端 UI 跟 server 真实状态同步" 系列

### § 6.24.7 mavis memory 沉淀

`
BUG-145 (v3.0.76 mobile 端生图/视频助手生成图片后无法点击查看大图):
- 跨项目通用铁律: 移动端图片查看器必走 FullscreenImageViewer 模式 (pinch + pan + double-tap + 单击关闭), 不依赖第三方 zoom 库
- 跨项目通用铁律: gesture-handler v2 必包 GestureHandlerRootView (根包, 不包等于没装)
- 跨项目通用铁律: djb2 hash 用于 filename 必贯穿所有 URL → 文件名 映射 (buildImageUrl / buildDownloadUrl / FullscreenImageViewer)
- 跨项目通用铁律: 跨端 image UI 必 1:1 镜像 (web 端也补做, 跨端铁律 4++)
- 跨项目通用铁律 (新增, BUG-145 部署踩坑): changelog.json 顶层 latest_version 字段保持单一份 (prepend 不复制), 否则 JSON 解析 last-wins 会拿到老版本
- 修法: 新建 FullscreenImageViewer.tsx (RN Modal + gesture-handler v2.14 + RN Animated) + App.tsx 根包 GestureHandlerRootView + ImageAgentScreen/VideoAgentScreen 接入 viewer + agentDownload.ts export djb2Hex + 顺手修 BUG-143 半修漏补 (buildDownloadUrl Date.now() 残留)
- 跟 web 端反方向 1:1 镜像 (web 端也缺 fullscreen viewer, 列入下一步补做)
- E2E 验证: APK HTTP/2 200 + sha256 1:1 + /api/version latestVersion=3.0.76 (修 changelog 老 latest_version 字段冲突后)
`

### § 6.24.8 E2E 验证 (跟 BUGS.md BUG-145 1:1)

- ✅ /api/version: 3.0.76 (公网 https://ab.maque.uno/api/version 验证 version=3.0.76, latestVersion=3.0.76, mobileLatestApkVersion=3.0.76, mobileLatestApkSource='public-dir', downloadUrl=DeepScript_v3.0.76.apk, changelog+highlights+buildDate 完整返回)
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30335501 (跟本机 1:1 一致)
- ✅ 公网 APK sha256: fca407775cd334ed218d59c139e5c44fda672ff98f29938f0ebd62aa53720c70 = 本机 sha256: FCA407775CD334ED218D59C139E5C44FDA672FF98F29938F0EBD62AA53720C70 (1:1 一致)
- ✅ systemd shipin-app active, PID 23005
- ✅ 远端 /health: 200 OK
- ✅ 远端 6000 LISTEN
- ✅ mobile tsc: 53 错 baseline, 0 新错 (跟 v3.0.75 BUG-144 一致)
- ✅ ImageAgentScreen.tsx:609-616 result image 包 TouchableOpacity, onPress → setFullscreenImage
- ✅ VideoAgentScreen.tsx:637-646 reference image 同样 1:1 镜像
- ✅ App.tsx 根包 GestureHandlerRootView (4 行 import + 1 行开 tag + 1 行闭 tag)
- ✅ agentDownload.ts export djb2Hex, 跨项目通用铁律 (跟 BUG-143 100% 同源)
- ✅ changelog.json 删除老 latest_version 顶层字段 (line 640-641) 避免 JSON 解析 last-wins 冲突

### § 6.24.9 部署全链路 (跨端铁律 5, 含本版本踩坑 1 个)

| 步骤 | 结果 |
|---|---|
| 代码 commit + push | ✅ 1 commit (后续统一 push) |
| 本机 mobile tsc | ✅ 53 错 baseline, 0 新错 |
| 本机 gradle assembleRelease | ✅ app-release.apk 30335501 bytes (versionCode 78, versionName 3.0.76) |
| 本机 server build + tar.gz | ✅ dist-v3.0.76.tar.gz 329964 bytes |
| 本机 scp dist/ | ✅ /tmp/dist.tar.gz → 远端 dist/ 全覆盖 |
| 本机 scp APK | ✅ /www/wwwroot/shipin-APP/public/DeepScript_v3.0.76.apk |
| 本机 scp changelog.json | ✅ 双覆盖 shipin-APP/changelog.json + dist/changelog.json |
| 远端 sed .env APP_VERSION | ✅ 3.0.75 → 3.0.76 |
| 远端 systemctl stop + reset-failed | ✅ |
| 远端 systemctl start | ✅ active, PID 23005 |
| /api/version 3.0.76 | ✅ version=3.0.76, latestVersion=3.0.76, mobileLatestApkVersion=3.0.76, changelog+highlights+buildDate 完整 |
| APK 公网 HEAD | ✅ HTTP/2 200, ct=application/vnd.android.package-archive, cl=30335501 |
| 公网 APK sha256 | ✅ fca407775cd334ed218d59c139e5c44fda672ff98f29938f0ebd62aa53720c70 (跟本机 1:1) |

### § 6.24.10 部署踩坑笔记 (本版本新增 1 个, 跟 shipin-APP 仓库 vs shipin-APP 项目不一致相关)

4. **changelog.json 老 latest_version 字段残留导致 JSON 解析 last-wins 冲突**: 之前 shipin-APP 项目 v3.0.64 BUG-130 部署时在 changelog.json 末尾加了 "latest_version": "3.0.64" (line 640-641) + "latest_version_time": "2026-06-30". 这次 shipin-APP 仓库 v3.0.76 BUG-145 部署在 changelog.json 头部加了 "latest_version": "3.0.76" (line 6-7) + "latest_version_time": "2026-07-02". **JSON 解析 last-wins 行为** (RFC 8259 + jq + Node.js JSON.parse 都取最后一个) → server 读 line 640 = 3.0.64 → /api/version latestVersion=3.0.64 跟 changelog 内容 v3.0.76 不一致. 修法: 删除老 line 640-641 字段, 只保留 line 6-7 新字段.

### § 6.24.11 下一步: web 端补做 FullscreenImageViewer (跨端铁律 4++)

- web 端 AgentChatPanel.tsx 跟 mobile 端 1:1 镜像, 加 LightboxImage 组件
- web 端 src/components/ui/lightbox-image.tsx (新建, Tailwind + React Portal + CSS transform scale/translate)
- 触发: <img> 包 <button> (hover 显示"点击查看大图" hint)
- 手势: mouse drag + wheel zoom + double click + ESC 关闭
- 跨项目通用铁律 1:1 镜像 mobile (zoom 范围 [1x, 4x] + close 时重置 transform + djb2 稳定)

> **最后更新**: 2026-07-02 (v3.0.76 BUG-145, 加 § 6.24 mobile 端 FullscreenImageViewer 全屏图片查看器 + 顺手修 BUG-143 半修漏补 + 4 条新跨项目通用铁律 + 部署踩坑 1 个, 跟根 AGENTS.md 同步)
> **下次 review**: mobile 端有架构变更 / 新模块 / 跨端工具链时
