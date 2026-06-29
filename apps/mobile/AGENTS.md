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

> **最后更新**: 2026-06-29 (S72 batch 20 v3.0.48 BUG-119, 加 § 6.10 videoAgent retry 清理 + GeneratingLoader 1:1 集成补齐规范, 跟根 AGENTS.md v2.15 同步)
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时
