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

> **最后更新**: 2026-06-27 (S72 batch 11 v3.0.43 Stage 3, 加 § 6.6 GeneratingLoader + useMediaLoader 跨端 1:1 规范, 跟根 AGENTS.md v2.12 同步)
> **下次 review**: mobile 端有架构变更 (新模块 / 跨端工具链) 时
