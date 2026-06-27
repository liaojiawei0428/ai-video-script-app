# apps/web/AGENTS.md — Web 端 AI Agent 必读 (S72 v1.1 加部署主入口)

> **本文件**: web 端 (React + Vite) AI Agent 独有规范. 跟根 AGENTS.md + mobile AGENTS.md + server AGENTS.md 对称.
> **必读顺序** (S72 batch 7 加 🆕 部署主入口):
> 0. **[`../../AGENTS.md`](../../AGENTS.md)** — 跨端统一总入口 (中文/Persistence/铁律/工作流, **必先读**)
> 0.5. **[`../../docs/DEPLOY_RELEASE_FLOW.md`](../../docs/DEPLOY_RELEASE_FLOW.md)** — 🆕 **S72 batch 7 部署 + 发布主入口 SOP (跨端统一, 含 web 部署 § 3 + BUG-099 web dist 破坏 应急处理 § 12.1)**
> 1. 本文件 — web 端独有 (React 栈 + 3 个已知 GAP + 部署)
> 2. **[`./DEPLOY.md`](./DEPLOY.md)** — web 端部署 (本地 build + scp + nginx)
> 3. **[`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)** — 跨端版本管理 (含 § 5 发版 SOP)
> 4. **[`../../apps/mobile/AGENTS.md`](../../apps/mobile/AGENTS.md)** — mobile 端独有 (web 镜像 mobile UI, 参考)

> **跨端规范 (中文/Persistence/铁律/工作流/代码 4 原则/禁新旧版) → 看根 [`../../AGENTS.md`](../../AGENTS.md), 本文件不重复**.

---

## § 1. web 项目速览 (React 18 + Vite 5 + Tailwind 3)

- **栈**: React 18 + Vite 5 + TypeScript 5.5 + Tailwind 3 + Zustand 4 + lucide-react + clsx (零 shadcn/ui)
- **路由**: react-router-dom 6 (`App.tsx` 集中注册 17 个 page, 路由守卫 `Protected` + `AdminProtected`)
- **API client**: `apps/web/src/lib/api.ts` (axios + 401 拦截 + token 注入), 跟 mobile 端 `apps/mobile/src/api/client.ts` 是各自实现 (M-2 GAP, 暂未抽 packages/shared-utils)
- **WebSocket**: `apps/web/src/lib/websocket.ts` (重连 + 心跳), 同上 GAP
- **状态管理**: 仅 Zustand (`apps/web/src/store/auth.ts` / `notifications.ts` / `taskProgress.ts`), 跟 mobile 端 `useNovelStore` 镜像
- **构建**: `npm run build` = `tsc -b && vite build`, 产物 `dist/assets/index-<hash>.js` (~412 KB)
- **部署**: `apps/web/scripts/deploy.sh` (GAP-8 P1 已修复, 2026-06-09), 本地 build → 打包 dist + package.json → scp → 服务器解压到 `/www/wwwroot/web-app/` → nginx reload
- **公网**: `https://ab.maque.uno` (跟 mobile APK 共用同一域名, nginx 反代 `/` 到 web dist, `/app/DeepScript_v*.apk` 到 shipin-APP/dist)
- **依赖 server**: `apps/server/` (公网同源 API, 端口 6000, 走 systemd unit 部署 S70 起不再 PM2)

## § 2. web 端独有 3 个 GAP (2026-06-09 摸底)

> **3 个 GAP 暂未修复**, 等用户提需求时再做. 修法见下.

### § 2.1 [GAP] M-2: shared-utils 包抽取
- **现状**: `apps/web/src/lib/api.ts` + `apps/web/src/lib/characterUtils.ts` 跟 `apps/mobile/src/api/client.ts` + `apps/mobile/src/utils/*` 是各自实现
- **影响**: 重复代码 ~300 行, 改一处要同步两处
- **修法**: 抽 `packages/shared-utils/src/apiClient.ts` (axios + 401 拦截 + token 注入) + `websocketClient.ts` (重连 + 心跳) + `characterUtils.ts`, web + mobile 都引用

### § 2.2 ✅ 已修 (S72 batch 10 v3.0.43): 独立组件缺失 — Skeleton / ImageWithLoading 等
- **修法**: 新建 `apps/web/src/components/ui/` (跟 mobile 端 components/ui/ 1:1 镜像):
  - `skeleton.tsx` — 通用骨架屏组件 (shadcn 风格)
  - `skeleton-presets.tsx` — SkeletonCard / SkeletonImage / SkeletonText 预制
  - `image-with-loading.tsx` — 3 态图片组件 (loading→ready→error + LQIP 占位 + shimmer)
  - `index.ts` — barrel export
- **配套**: `apps/web/src/lib/utils.ts` (cn 工具) + `tailwind-merge` 依赖 + `tailwind.config.js` shimmer keyframes + `.skeleton-shimmer` 工具类
- **剩余 GAP**: `Sidebar / AssetCard / CharacterImage / EpisodeCard / StatusBadge / UploadDialog / OutlineEditor / CharacterDescriptionEditor / ResponsiveGuard` 仍待抽, 等用户提需求再做

### § 2.3 [GAP] M-7.2: 响应式引导缺失
- **现状**: <1024px 应该显示"请使用 App 扫码下载" + 二维码, 但没找到 ResponsiveGuard 组件
- **影响**: 小屏用户体验差, 可能误以为 web 端坏了
- **修法**: 加 `<ResponsiveGuard><NoMobileNotice qrCodeUrl=... /></ResponsiveGuard>` 包裹非 App 路由

## § 3. 改 web 代码前后 3 步必做

### 改前 3 步
1. `Read ../../AGENTS.md` 跨端统一规范 (S68 收口后必先读)
2. `Read ./DEPLOY.md` web 端部署 SOP
3. `Read ../../docs/VERSION_MANAGEMENT.md` 跨端版本管理 (web 端只有 1 处版本号, `apps/web/src/config/version.ts`)

### 改后 3 步
1. `npm run typecheck` (tsc -b --noEmit) 0 错
2. `npm run build` (vite build) 产物 hash 跟 git diff 一致
3. `bash apps/web/scripts/deploy.sh` (走 deploy.sh, 不手动 scp)

## § 4. web 端铁律 (独有)

> **跨端铁律 4 / 5 / 8 跨端通用, web 端独有 4 条强化**:

1. **✅ 已修 (S72 batch 10 v3.0.43) 允许 tailwind-merge + cn() 工具 + components/ui/ 独立目录**:
   - 17 个 page 全 Tailwind 手写 维持不变 (历史包袱, 不强求统一)
   - 新建 `apps/web/src/components/ui/` 装 Skeleton / ImageWithLoading 等独立组件 (shadcn 风格, 跟 mobile 端 components/ui/ 1:1 镜像, 跨端铁律 4++)
   - 用 `cn()` 工具 (来自 `apps/web/src/lib/utils.ts`, 整合 clsx + tailwind-merge) 替代裸 clsx, 自动去重 Tailwind 类冲突
   - [GAP] M-5 独立组件缺失 已填平 (S72 batch 10 v3.0.43)
2. **状态管理只用 Zustand** — 跟 mobile 端同款, 一致性. ❌ 不用 Redux / Recoil / Context
3. **路由守卫在 App.tsx 集中** — `Protected` 检查 token + `AdminProtected` 检查 token (TODO: 加 role 检查, 当前只检查 token 存在)
4. **bundle hash 必带** — `vite.config.ts` 默认带 query hash, 部署后浏览器自动拉新版本, 不用手动删旧 bundle

---

**web 端部署 SOP** → [`./DEPLOY.md`](./DEPLOY.md)
**跨端版本管理** → [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)
**mobile 端独有 (web 镜像参考)** → [`../../apps/mobile/AGENTS.md`](../../apps/mobile/AGENTS.md)
**server 端独有 (web 共享 API)** → [`../../apps/server/AGENTS.md`](../../apps/server/AGENTS.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

> **最后更新**: 2026-06-27 (S72 batch 11 v3.0.43 Stage 3, 加 § 5 GeneratingLoader + useMediaLoader 跨端 1:1 规范, 跟 mobile AGENTS.md § 6.6 同步)
> **下次 review**: web 端有架构变更 / 新 GAP / 独立部署时


---

## § 5. v3.0.43 Stage 3 新增: GeneratingLoader + useMediaLoader 跨端 1:1 (S72 batch 11 Stage 3)

> **新增 2026-06-27 (S72 batch 11 v3.0.43 Stage 3)**: AI 生成中动画 + 跨端 1:1 媒体加载抽象.

### § 5.1 跨端 1:1 镜像 (跟 mobile 端 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| 组件 | components/ui/generating-loader.tsx | components/ui/GeneratingLoader.tsx | ✅ 1:1 |
| Hook | hooks/useMediaLoader.ts | hooks/useMediaLoader.ts | ✅ 1:1 |
| 4 态 type | idle/loading/ready/error | 同左 | ✅ 1:1 |
| Hook 返回 | {source, state, error, retry, refresh, onLoaded, retryCount} | 同左 | ✅ 1:1 |
| Spinner 风格 | CSS order-t-blue-500 + nimationDuration: 1s | Animated orderTopColor: #3b82f6 + duration: 1000 | ✅ 1:1 |
| MAX_RETRIES | 3 | 3 | ✅ 1:1 |

### § 5.2 useMediaLoader 跟 useCachedMedia 的关系

`
useMediaLoader (Stage 3)  ← 高阶封装, 4 态 + retry
   └─ useCachedMedia (Stage 2)  ← 单一职责, 缓存 + URL state
       └─ IndexedDB (web) / SQLite (mobile)
`

### § 5.3 集成示范 (跨端 1:1)

- web: ScriptDetailPage.tsx line 177 用 <GeneratingLoader size="lg" label="正在加载剧集..." /> 替代原 "加载中..." 文本
- mobile: ScriptDetailScreen.tsx line 154 用 <GeneratingLoader size="lg" label="正在加载剧集..." /> 替代原 ActivityIndicator

### § 5.4 使用规范

1. **AI 生成中/loading 场景必用 GeneratingLoader**, 替代原 ActivityIndicator / "加载中..." 文本
2. **跨端 1:1 风格** — 不要 web 用一种, mobile 用另一种, 都要走 GeneratingLoader
3. **MAX_RETRIES / 1s 周期 / 蓝色 跨端一致** — 改阈值必双端同步
4. **Lottie 暂时走 fallback spinner** — lottie-react 需要 animationData (Stage 3.5 接入)

### § 5.5 跨项目通用 (跟 BUG-079/097 100% 同源)

- **跨端铁律 4++ 必 web + mobile 同步** — Stage 3 跨端 1:1 8 维一致
- **改 hook 必 100% 移植 4 态 + retry + 集成点** — 缺一就是漏修

### § 5.6 验证脚本 (跟 shipin-APP 历史 verify 一致)

	ools/verify-bug110-media-loader.js (8 维验证, 跟 mobile AGENTS.md § 6.6.6 同源):
1. GeneratingLoader 跨端文件存在 (web + mobile 1:1)
2. useMediaLoader 跨端 hook 文件存在 (封装 useCachedMedia + 4 态 + retry)
3. useMediaLoader 跨端 API 1:1 (返回 {source, state, error, retry, refresh, onLoaded, retryCount})
4. 4 态 type 一致 (idle/loading/ready/error 跨端 1:1)
5. MAX_RETRIES 阈值一致 (web + mobile 都 3)
6. 集成 ScriptDetailScreen (mobile) + ScriptDetailPage (web) 用 GeneratingLoader
7. CSS spinner + Animated spinner 1:1 风格 (1s 周期 + 蓝色 + 轨道)
8. components/ui/index.ts 跨端 barrel export GeneratingLoader (跨端铁律 4++)

跑法: 
ode tools/verify-bug110-media-loader.js (期望 PASS: 8 / FAIL: 0)