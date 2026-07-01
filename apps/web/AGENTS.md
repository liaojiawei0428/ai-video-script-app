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

> **最后更新**: 2026-06-29 (S72 batch 21 v3.0.49 BUG-120, 加 § 5.8 等待动画卡片按用户选的比例显示, 跟 mobile AGENTS.md § 6.11 镜像同步)
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

---

## § 5.7 v3.0.48 新增: AgentChatPanel retry 边界清空旧 result part + GeneratingLoader 全屏集成补齐 (S72 batch 20 BUG-119)

> **新增 2026-06-29 (S72 batch 20 v3.0.48 BUG-119)**: 修视频助手 retry 视频堆叠 + 补标准生成中动画 — 跨端 web + mobile 1:1 加 `clearResultParts(parts)` helper (retry 前先清空 last assistant 的 video/image-result/error/旧 streaming, 避免堆叠 2 张卡片), streaming 渲染改用 GeneratingLoader (Stage 3 v3.0.43 组件, 之前只集成 ScriptDetailPage 一处, AgentChatPanel + VideoAgentScreen + ImageAgentScreen 漏集成).

### § 5.7.1 背景 (跟 mobile § 6.10.1 1:1)

用户在 https://ab.maque.uno/video-agent BUG-118 修后 (ad9aad5b / 6bec5aae SQL 救活成 plan_ready) 点"确认方案" retry → 等待 → 完成后页面同时显示 2 个 0:00/0:15 视频卡片 (堆叠 2 张, 内容相同). 同时流式卡片是 "AI 渲染视频, 别关页面..." + Loader2 文字 (不是 BUG-110 Stage 3 设计的标准 spinner 动画).

**双 BUG 100% 同源 (跟 BUG-079/082/096/097/103/104/115/116/117/118 同源)**:
- **BUG-A (retry 边界没清空旧 result part)**: web `confirmAndGenerate` / `confirm` 找 last assistant message 的 `plan` part 替换为 `streaming`, 但**该 message 之前的 video / error / image result part 不清空**. 第二次完成时 push 新 video, 跟旧 video 一起渲染 → 2 个堆叠
- **BUG-B (stage 3 BUG-110 GeneratingLoader 组件漏集成)**: v3.0.43 stage 3 加了 `components/ui/generating-loader.tsx` (web) + AGENTS.md § 5.4 强约束, **实际只集成在 `ScriptDetailPage.tsx` 一处**, `AgentChatPanel.tsx case 'streaming'` 用 `Loader2 size={28}` (lucide-react) inline

### § 5.7.2 修法架构 (web 端)

```
apps/web/src/components/AgentChatPanel.tsx (image+video 共用, 改一处两边都修)
├─ import GeneratingLoader from './ui' (跨端 1:1 镜像 mobile)
├─ module scope: clearResultParts(parts)
│   └─ filter 掉 video / error / streaming / image(role=result), 保留 text/plan/question/progress/image(reference)
├─ confirmAndGenerate + confirm + status effect 3 处都先 strip 旧 result + 旧 streaming
└─ case 'streaming' 改用 <GeneratingLoader size="md" label="..." /> 替代 Loader2+Sparkles inline
```

### § 5.7.3 跨端铁律 4++ 镜像 (跟 mobile § 6.10.3 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Helper API | `clearResultParts(parts): AgentPart[]` (module scope) | 同左 | ✅ 1:1 |
| Filter 逻辑 | `video` / `error` / `streaming` / `image(role=result)` 4 类 | 同左 | ✅ 1:1 |
| 集成点 | confirmAndGenerate + confirm + status effect 3 处 | confirmGenerate + polling 终态 2 处 (imageAgentScreen 同 2 处) | ✅ 1:1 |
| GeneratingLoader 渲染 | `<GeneratingLoader size="md" label="..." />` 替代 Loader2+Sparkles | `<GeneratingLoader size="md" label="..." />` 替代 ActivityIndicator | ✅ 1:1 |
| 1s 周期 + 蓝色 | CSS spinner 1s | Animated 1000ms | ✅ 1:1 |

### § 5.7.4 使用规范 (跟 mobile § 6.10.4 1:1)

1. **retry 边界必清空旧 result part (前端不能 append, 要 replace)**: 找 `plan` 替成 `streaming` 之前, 先 `cleaned = clearResultParts(last.parts)` 再 push 新 streaming
2. **AI 生成中/loading 场景必用 GeneratingLoader 跨端 1:1, 不准裸用 Loader2/ActivityIndicator**: AGENTS.md § 5.4 (web) + § 6.6.4 (mobile) 强约束
3. **加了 component 必集成到所有相关 screen, 不留半成品**: 写完 GeneratingLoader 必 grep 找 "Loader2" / "ActivityIndicator" / "加载中" 字符串, 全部替换
4. **跨端改一处必同步 web+mobile 1:1 镜像 (跨端铁律 4++)**: web AgentChatPanel 是 image+video 共用, 改一处两边都修
5. **status effect 终态替换也要 strip 旧 result (兜底)**: race / page refresh 后 polling 进来时残留
6. **in-flight (tool_queued / tool_executing) 不动 messages**: 终态 push 新 result, in-flight 直接 return prev

### § 5.7.5 跨项目通用 (跟 BUG-079/082/096/097/103/104/115/116/117/118 100% 同源, 跟 mobile § 6.10.5 1:1)

- **retry 边界必清空旧 result part**: 跨项目通用铁律, 不 strip 就是堆叠
- **AI 生成中/loading 场景必用 GeneratingLoader 跨端 1:1**: AGENTS.md § 5.4/§ 6.6.4 强约束
- **加了 component 必集成到所有相关 screen, 不留半成品**: 跨项目通用铁律
- **跨端改一处必同步 web+mobile 1:1 镜像**: 跨端铁律 4++
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
- **strip UTF-8 BOM from build.gradle + package.json**: 跨项目通用铁律, PowerShell Edit 工具会写 BOM
- **APK 必传 shipin-APP/public/**: nginx `location ^~ /app/` alias 路径

### § 5.7.6 跟其他 BUG 关系 (跟 mobile § 6.10.6 1:1)

- **BUG-079** 假报告 — 跟 BUG-119 retry 边界没清理 100% 同源
- **BUG-082/096** 假渲染陷阱 — 跟 BUG-119 retry 堆叠 100% 同源
- **BUG-097** mobile 漏修 web — BUG-119 跨端铁律 4++ 修法
- **BUG-103** 自动退款漏刷 APK — BUG-119 此次已重打 mobile APK
- **BUG-110** Stage 3 GeneratingLoader — BUG-119 把 component 补集成到所有 streaming 场景
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-119 跨项目通用铁律同源
- **BUG-117** 公网 APK 404 — BUG-119 跨项目通用铁律新一条 "APK 必传对路径"
- **BUG-118** 细分了 status 字段但漏加 status label UI — BUG-119 教训同源 "加了 component 漏集成"

---

## § 5.8 v3.0.49 新增: 等待动画卡片按用户选的比例显示 (S72 batch 21 BUG-120)

> **新增 2026-06-29 (S72 batch 21 v3.0.49 BUG-120)**: 修视频/生图助手等待动画卡片按用户选的比例显示 — 跨端 web + mobile 1:1 加 `aspectRatio.ts` util (跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 镜像), streaming 卡片容器按 1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 2:3 / 3:2 / 2K / 4K / 8K 比例显示, auto 默认 image 1:1 / video 16:9.

### § 5.8.1 背景 (跟 mobile § 6.11.1 1:1)

用户选了 16:9 横屏比例, 点"确认方案" → 等待动画卡片是 mobile 默认 360x202 横向 (不是 16:9 实际比例 1152×768) → 等 1-3 分钟完成 → 视频变成 16:9 实际比例 → 跳变感强, 用户感觉"等待跟完成不一致".

**根因**: 修前 `case 'streaming'` 渲染用固定样式 (mobile `styles.streamingBox` 固定 flex row 容器, web `p-4 rounded-lg` 自适配) — 不读用户选的 selectedRatio. 跟 BUG-118/119 教训 100% 同源 (加了 state 但漏消费到所有相关 render).

### § 5.8.2 修法架构 (web 端)

```
apps/web/src/lib/aspectRatio.ts (新建, 跟 server 1:1 镜像)
├─ ASPECT_RATIO_DIMS: 10 ratio → 实际 w/h (跟 server SUPPORTED_RATIOS 1:1)
├─ parseAspectDims(ratio, kind): 支持 '16:9' / '2K' / 'WxH' 3 格式
├─ defaultRatioForKind(kind): auto fallback (image 1:1 / video 16:9)
└─ getWebAspectStyle: 返 { aspectRatio: 'W / H', maxWidth, maxHeight } (CSS, 缩到 480px max)

apps/web/src/components/AgentChatPanel.tsx
├─ import getWebAspectStyle from '../lib/aspectRatio'
├─ selectedRatio prop drilling: 顶层 → MessageBubble → PartSafeView → PartView (跟 kind 同样路径)
└─ case 'streaming' 用 getWebAspectStyle(selectedRatio, kind) 限定容器宽高, flex-col items-center justify-center
```

### § 5.8.3 跨端铁律 4++ 镜像 (跟 mobile § 6.11.3 + server `imageAspectRatio.ts` 1:1)

| 维度 | web 端 | mobile 端 | server 端 (真源) | 一致性 |
|---|---|---|---|---|
| Util 文件 | `apps/web/src/lib/aspectRatio.ts` | `apps/mobile/src/utils/aspectRatio.ts` | `apps/server/src/prompts/imageAspectRatio.ts` (SUPPORTED_RATIOS) | ✅ 1:1 |
| ASPECT_RATIO_DIMS 10 项 | 1:1=1024², 16:9=1152×768, 9:16=768×1152, 4:3=1024×768, 3:4=768×1024, 2:3=768×1152, 3:2=1152×768, 2K=1280², 4K=2048², 8K=2048² | 同左 | 同左 (SUPPORTED_RATIOS map) | ✅ 1:1 |
| parseAspectDims 3 格式 | '16:9' / '2K' / 'WxH' | 同左 | 同左 (parseAspectToDims) | ✅ 1:1 |
| defaultRatioForKind | image 1:1, video 16:9 | 同左 | 同左 (DEFAULT_ASPECT) | ✅ 1:1 |
| getStyle 返值 | `{ aspectRatio: 'W / H', maxWidth, maxHeight }` CSS | `{ aspectRatio: number, width, height }` RN 0.72+ | n/a (server 不渲染) | ✅ 1:1 跨端 (web/mobile 风格略不同) |
| 缩放 | max 480px (max edge) | 1/3 显示 | n/a | ✅ 1:1 |

### § 5.8.4 使用规范 (跟 mobile § 6.11.4 1:1)

1. **等待动画卡片尺寸必跟用户选的比例 1:1, 完成后的 result 不能跟等待时比例跳变**: 用户在 confirm 前选了什么比例, streaming 卡片就用什么比例
2. **ratio 字典必 web + mobile + server 三端 1:1 同步**: 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS 1:1 镜像, 改必双端+server 三端同步
3. **跨端铁律 4++ 1:1 镜像**: helper API (parseAspectDims) / getStyle 入口 (getWebAspectStyle + getMobileAspectStyle) / 10 ratio 字典 跨端一致
4. **auto fallback 默认值 web + mobile + server 1:1**: image 走 1:1, video 走 16:9
5. **加了 state 必消费到所有相关 render**: 跟 BUG-118/119 教训同源, selectedRatio 之前是 state 但 streaming 卡片没消费
6. **CSS aspectRatio (web) 用 'W / H' 字符串, RN aspectRatio (mobile) 用 number**: 跨端 1:1 但实现细节不同 (web Tailwind 3 支持 / RN 0.72+ 支持 number)
7. **prop drilling vs 闭包访问**: web AgentChatPanel 走 prop drilling (顶层 → MessageBubble → PartSafeView → PartView), mobile 走闭包访问 (selectedRatio 是 state, renderPart 直接用). 效果一致

### § 5.8.5 跨项目通用 (跟 BUG-079/082/096/097/103/115/116/117/118/119 100% 同源)

- **等待动画卡片尺寸必跟用户选的比例 1:1**: 不 1:1 就有跳变感
- **ratio 字典必 web + mobile + server 三端 1:1 同步**: 跨项目通用铁律
- **跨端铁律 4++ 1:1 镜像**: 跨端铁律 4++
- **auto fallback 默认值跨端 1:1**: image 1:1 / video 16:9
- **加了 state 必消费到所有相关 render**: 跨项目通用铁律, 跟 BUG-118/119 同源
- **CSS aspectRatio 用字符串, RN aspectRatio 用 number**: 实现细节不同, 跨端 1:1 但用对工具
- **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3)
- **strip UTF-8 BOM from build.gradle + package.json**: 跨项目通用铁律

### § 5.8.6 跟其他 BUG 关系 (跟 mobile § 6.11.6 1:1)

- **BUG-079** 假报告 — 跟 BUG-120 selectedRatio 没消费到 streaming 100% 同源
- **BUG-097** mobile 漏修 web — BUG-120 web + mobile 同步 (跨端铁律 4++)
- **BUG-110** GeneratingLoader Stage 3 — BUG-120 在 Stage 3 基础上按比例显示
- **BUG-115/116** 缓存方案 A+B — 跟 BUG-120 跨项目通用铁律同源
- **BUG-118** 细分 status 字段但漏加 status label UI — BUG-120 教训同源 "加了 state 漏消费"
- **BUG-119** retry 清理 + GeneratingLoader 全屏集成 — BUG-120 补上 ratio 维度

---

## § 5.9 v3.0.59 新增: AgentChatPanel 上传参考图功能 mobile 端 1:1 镜像, 跨端铁律 4++ web→mobile 同步 (S72 batch 30 BUG-130)

> **新增 2026-06-30 (S72 batch 30 v3.0.59 BUG-130)**: web 端 AgentChatPanel v3.0.0 早就有完整参考图功能, mobile 端一直 0 个上传入口. S72 batch 7 规范反转"web 主导 mobile 跟随" 漏修 1+ 年, 这次 BUG-130 修. 跨端铁律 4++ web→mobile 同步, 跟 mobile § 6.15 1:1.

### § 5.9.1 背景 (跟 mobile § 6.15.1 1:1)

web 端 AgentChatPanel.tsx 完整功能 v3.0.0 起就有, 但 BUG-130 之前 mobile 端 0 个上传入口. 1+ 年用户手机端不能传图, 跟 web 端 UI 不一致 (跨端铁律 4++ 漏修).

**双 BUG 100% 同源**:
- **BUG-A (mobile 端 0 个上传入口)**: mobile ImageAgentScreen + VideoAgentScreen send() 只发 1 个 text part
- **BUG-B (S72 batch 7 web→mobile 同步漏修)**: 跟 BUG-097 mobile 漏修 web 100% 同源 (漏修方向反转)

### § 5.9.2 修法架构 (web 端 0 改, mobile 端补齐 1:1)

web 端 AgentChatPanel.tsx v3.0.0 就有完整功能:
- `pendingRefs` state (4 张上限)
- `onPickFiles` → `uploadAgentReferenceApi` → 替换占位为 server URL
- thumbnail bar (inputBar 上方)
- send() 构造 parts (text 在前, image role='reference' 在后)

mobile 端 1:1 镜像见 mobile § 6.15.2.

### § 5.9.3 跨端铁律 4++ 镜像 (跟 mobile § 6.15.3 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Upload API | `uploadAgentReferenceApi(file: File)` (axios FormData) | `uploadAgentReferenceApi(file: { uri, name, type? })` (XHR FormData) | ✅ API 1:1 |
| State type | `pendingRefs: { url, localPreview, filename, uploading? }[]` | `PendingRef` interface (mobile 单独 export) | ✅ 类型 1:1 |
| State 上限 | 4 张 | 4 张 | ✅ 1:1 |
| Image picker | `<input type="file" accept="image/*" multiple>` | `DocumentPicker.pick({ type: [DocumentPicker.types.images] })` | ✅ 行为 1:1 |
| Send 拼接 parts | text + image role='reference' | 同左 | ✅ 1:1 |
| sendBtn disabled | `!input.trim() && pendingRefs.length === 0` | 同左 | ✅ 1:1 |
| UI 位置 | inputBar 上方 (📎 + thumbnail bar) | 同左 | ✅ 1:1 |
| 服务端调用 | `chatApi(conversationId, parts, ...)` | `imageAgentChatApi` / `videoAgentChatApi` | ✅ 1:1 |

### § 5.9.4 使用规范 (跟 mobile § 6.15.4 1:1)

1. **web + mobile 镜像功能必双端同步实现 (S72 batch 7 规范反转铁律)**: web 做了 mobile 没做 = 漏修, check_list 必查
2. **server 端 0 改动原则**: web 端 API 早就接住, mobile 端补 UI 入口后 server 端代码不动
3. **Response shape 模拟 axios 1:1**: mobile XHR upload 必返 axios response shape 让调用方跟 web 1:1
4. **inputBar 上方加 📎 + thumbnail bar**: 跟 web AgentChatPanel 1:1 镜像
5. **8 处版本号同步必走**: 改 1 处必同步 8 处 (跨端铁律 3, 3.0.58 → 3.0.59)

### § 5.9.5 跨项目通用 (跟 BUG-079/082/097/124/128 100% 同源, 跟 mobile § 6.15.5 1:1)

- **web + mobile 镜像功能必双端同步实现**: 跨项目通用铁律, 漏修方向 = S72 batch 7 后 web 做了 mobile 漏修
- **server 端 0 改动原则**: 跨项目通用铁律
- **8 处版本号同步必走**: 跨端铁律 3

### § 5.9.6 跟其他 BUG 关系 (跟 mobile § 6.15.6 1:1)

- **BUG-079** 假报告 — 跟 BUG-130 同源
- **BUG-097** mobile 漏修 web — BUG-130 100% 同源 (漏修方向反转)
- **BUG-103** 自动退款漏刷 APK — BUG-130 此次重打 mobile APK
- **BUG-118/119/120/121/122/123/124/125/126/127/128/129** — BUG-130 是这一系列延伸
- **BUG-128** VIDEO_PROMPT_REF_IMAGE_SYSTEM — BUG-130 直接受益, mobile 现在能传 ref image 给 video## § 5.10 v3.0.70 新增: 跨端 AgentChatPanel 后台 polling 不取消, 切换会话旧 polling 污染新会话 UI (BUG-138, 跟 mobile § 6.18 1:1 镜像)

> **新增 2026-07-01 (v3.0.70 BUG-138)**: 修 web + mobile 跨端 AgentChatPanel 后台 polling 切换会话时不取消 → 旧 polling tickStatus 把全局 status 改回 tool_queued → 触发 statusEffectTimerRef useEffect 给新会话 push streaming part → 新会话一直显示"提示词方案正在生成".

### § 5.10.1 背景 (跟 mobile § 6.18.1 1:1)

用户反馈: 提示词正在生成方案时, 无论新建多少个会话框, 都一直显示"提示词方案正在生成". 跟 BUG-079/100/118/119/120/123/130/134/135/136/137 100% 同源.

### § 5.10.2 修前根因 (跟 mobile § 6.18.2 1:1)

**BUG-A (web AgentChatPanel.tsx)**: `confirmAndGenerate` / `confirm` 函数的后台 polling 是 **fire-and-forget** 的 (while + await setTimeout, line 541-572 / 668-685), 切换会话时不会被自动取消. 4-5s 后旧 polling poll 拿到 ConvA.status → `tickStatus(cur.status)` → 全局 status 被改回去 → 触发 statusEffectTimerRef useEffect → 给 ConvB 的 messages 最后一个 push streaming part → ConvB 显示"正在生成方案".

**BUG-B (mobile ImageAgentScreen + VideoAgentScreen)**: `loadConversation` 函数没重置 `pollingConvId`. 跟 web 1:1 同源, 详见 mobile § 6.18.2.

### § 5.10.3 修法架构 (跨端铁律 4++ 1:1 镜像 mobile § 6.18.3)

```
apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 主修):
├─ 加 activeConvIdRef = useRef<string | null>(null) (追踪当前活跃会话)
├─ 加 pollingOwnerRef = useRef<string | null>(null) (追踪 polling owner)
├─ startNew / loadConversation 入口:
│   ├─ activeConvIdRef.current = newId (更新活跃会话)
│   └─ pollingOwnerRef.current = null (cancel 旧 polling)
├─ confirmAndGenerate / confirm 进入:
│   ├─ capturedConvId = conversationId (闭包捕获)
│   └─ pollingOwnerRef.current = capturedConvId (声明 owner)
├─ confirmAndGenerate / confirm while 循环:
│   ├─ 每次 poll 前 check: if (pollingOwnerRef.current !== capturedConvId) break
│   ├─ tickStatus / setStatus / setMessages 前 check pollingOwnerRef === capturedConvId
│   └─ finally: pollingOwnerRef.current === capturedConvId 时清 null
└─ statusEffectTimerRef useEffect (line 227-309) push streaming 前 check:
    if (pollingOwnerRef.current !== conversationId) {
      // 旧 polling 改的 status 不该 push streaming 到新会话
    } else {
      // in-progress: push 流式卡片
    }

apps/mobile/src/screens/ImageAgentScreen.tsx + VideoAgentScreen.tsx (跨端铁律 4++ 镜像 web 1:1):
└─ loadConversation 入口加 setPollingConvId(null)
```

### § 5.10.4 跨端铁律 4++ 镜像 (跟 mobile § 6.18.4 1:1)

| 维度 | web 端 | mobile 端 | 一致性 |
|---|---|---|---|
| Polling owner 追踪 | `pollingOwnerRef = useRef<string \| null>(null)` | `pollingConvId` state | 概念 1:1 |
| Cancel 旧 polling 入口 | `startNew` / `loadConversation` 设 `pollingOwnerRef.current = null` | `loadConversation` 入口 `setPollingConvId(null)` | ✅ 行为 1:1 |
| Polling while / setInterval poll 前 check | `if (pollingOwnerRef.current !== capturedConvId) break` | useEffect 依赖 `pollingConvId` 变 → cleanup | ✅ 1:1 |
| statusEffectTimerRef / useEffect push streaming 前 check | `if (pollingOwnerRef.current !== conversationId)` | mobile 没有 (useEffect 自动 cleanup) | web 端独有 |

### § 5.10.5 使用规范 (跟 mobile § 6.18.5 1:1)

1. **后台 polling 必须有 cancel 机制 (useEffect-based 优于 fire-and-forget)**: React useEffect cleanup 必清 setInterval, 切会话 / unmount / 重新挂载 都会自动取消. fire-and-forget while 循环是"野指针", 没法响应 React state 变化
2. **fire-and-forget async 任务必捕获 owner context**: 任何后台 async 任务必须捕获 start 时的 conversationId / userId / requestId, 跟当前 React state / 当前用户比较. 不匹配就立即退出
3. **跨端轮询逻辑必 1:1 镜像, 修一处必同步双端**: web 修了 polling cancel, mobile 端必然有同样问题 (跟 BUG-097 mobile 漏修 web 反向)
4. **加了 useEffect 必查 cleanup 路径**: 没 cleanup = polling 跨会话泄漏
5. **新代码必走 useEffect 不用 fire-and-forget**: shipin-APP 老代码 (v3.0.0) 用了 fire-and-forget 是历史包袱, 新代码必走 useEffect 路径

### § 5.10.6 跨项目通用铁律 4 条新沉淀 (跟 mobile § 6.18.6 1:1)

1. **useEffect-based polling 优于 fire-and-forget polling**: React 组件内的 polling 必走 useEffect + setInterval + cleanup return
2. **fire-and-forget async 任务必捕获 owner context**: 任何后台 async 任务必须捕获 start 时的 conversationId + owner ref
3. **跨端代码改一处必同步双端 + E2E 验证**: web 修了 polling cancel, mobile 端必然有同样问题
4. **加 useEffect 必查 cleanup 路径**: 没 cleanup = polling 跨会话泄漏

### § 5.10.7 跟其他 BUG 关系 (跟 mobile § 6.18.7 1:1)

- **BUG-079** 假报告 — 跟 BUG-138 同源
- **BUG-097** mobile 漏修 web — BUG-138 反方向漏修
- **BUG-100** loading UX 假修 — 同源
- **BUG-119** retry 边界清理 — BUG-138 跟 BUG-119 配套
- **BUG-120** 等待动画卡片按比例显示 — statusEffectTimerRef push streaming 前 check 跟 BUG-120 1:1
- **BUG-123** Agnes API 限流排队 — BUG-138 是更上层的"轮询生命周期管理"
- **BUG-130** mobile 端补参考图上传入口 — 跨端铁律 4++ 同源
- **BUG-131** server-only hotfix 必 rebuild APK — BUG-138 此次已重打 mobile APK
- **BUG-132** video/image retry 策略细化 — retry 终止条件跟 BUG-132 同源
- **BUG-135** 自研 native module — 跟 BUG-138 都是 mobile 端基础设施层修法
- **BUG-136** 生成中动画卡片重设计 — statusEffectTimerRef push streaming 前 check 跟 BUG-136 配套
- **BUG-137** Agnes API 调用规范 — 跨项目通用铁律 "useEffect-based > fire-and-forget" 跟 BUG-137 "API 协议规范" 同源

### § 5.10.8 mavis memory 沉淀 (跟 mobile § 6.18.8 1:1)

```
BUG-138 (v3.0.70 跨端 AgentChatPanel 后台 polling 不取消):
- 跨项目通用铁律: 后台 polling 必须有 cancel 机制 (useEffect-based > fire-and-forget)
- 跨项目通用铁律: fire-and-forget async 任务必捕获 conversationId + owner ref
- 跨项目通用铁律: 跨端轮询逻辑必 1:1 镜像, 修一处必同步双端
- 跨项目通用铁律: 加 useEffect 必查 cleanup 路径, 没 cleanup = polling 跨会话泄漏
- 修法 web: 加 activeConvIdRef + pollingOwnerRef, startNew/loadConversation 清 pollingOwnerRef, while 循环 poll 前 check
- 修法 mobile: loadConversation 入口加 setPollingConvId(null)
- E2E 验证: ConvB 立即 + 15s 后都是 awaiting_clarification 无 streaming part, ConvA 正常 tool_completed
```

### § 5.10.9 E2E 验证 (跟 mobile § 6.18.9 1:1)

- ✅ /api/version: 3.0.70, mobileLatestApkVersion: 3.0.70
- ✅ 公网 APK HTTP/2 200, Content-Length: 30256080
- ✅ systemd shipin-app active
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错, web build 成功
- ✅ E2E (image agent, testuser_bug138): ConvB 立即 + 15s 后都是 awaiting_clarification 无 streaming part, ConvA 正常 tool_completed
- **PASS**: BUG-138 已修, 跨端轮询生命周期管理规范化

### § 5.10.10 部署全链路 (跨端铁律 5)

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
## § 5.11 v3.0.71 新增: server 修 UPSTREAM_BUSY 文案 + 加 10 秒自动重试, 客户端 statusBadge 1:1 镜像 (S72 batch 36 BUG-139, 2026-07-01)

> **新增 2026-07-01 (v3.0.71 BUG-139)**: 修 agens 上游繁忙时 (UPSTREAM_BUSY / 503 Service busy), server 立即把任务标 plan_ready + 写死错误文案 → 用户必须手动点 retry. 修法: server 端加 10 秒自动重试 loop (上限 60 次 = 10 分钟), status 保持 tool_queued (前端看到'排队中') + error_msg 带 [upstream_busy] 前缀 + retry_count 累加. 客户端 statusBadge 根据 error_msg 包含 [upstream_busy] 决定 label 文案 + 颜色.

### § 5.11.1 背景 (跟 mobile § 6.19.1 1:1)

用户报: agens 上游繁忙时, server 立即把任务标 plan_ready + error_msg='agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试' → 用户必须手动点 retry. 生产日志实证多次连续撞 agens 503 Service busy / tasks: 1 (UPSTREAM_BUSY).

### § 5.11.2 修前根因 (跟 BUG-100/118/132 100% 同源)

1. **错误文案不区分'上游繁忙' vs '真失败'**: 任何非 200/201 都标 plan_ready + 写死 'agns 视频服务暂时不可用 (上游繁忙或维护), 请 5-10 分钟后重试'. UPSTREAM_BUSY 是临时性错误, 不应立即失败
2. **fire-and-forget createTask 没有 retry 机制**: agens 上游偶发 503 (任务队列满), 应该重试而不是直接拒
3. **前端 UI 没法区分'正在自动重试' vs '已重试用完'**: 都是 '上游繁忙' 灰色提示, 用户不知道 server 端在自动重试

### § 5.11.3 修法架构 (跨端铁律 4++ 1:1 镜像 mobile)

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

apps/web/src/components/AgentChatPanel.tsx (跨端铁律 4++ 主修, web 端):
└─ statusBadge(s, errorMsg?): tool_queued/tool_executing + error_msg 含 [upstream_busy] → '排队中(自动重试)' (琥珀色 amber-100 bg + amber-700 text + ring-1 ring-amber-200)
   tool_failed + [upstream_busy] → '上游持续繁忙' (amber-200 bg + amber-800 text, 区别于普通'上游异常' gray)
`

### § 5.11.4 跨端铁律 4++ 镜像 (跟 server 端 1:1, 跟 mobile § 6.19.4 1:1)

| 维度 | server 端 (源) | web 端 | mobile 端 | 一致性 |
|---|---|---|---|---|
| 上限次数 | MAX_UPSTREAM_RETRY = 60 | n/a | n/a | ✅ 1:1 |
| 间隔 | 10 秒 setTimeout | n/a | n/a | ✅ 1:1 |
| Status 保持 | 'tool_queued' / 'tool_executing' | n/a | n/a | ✅ 1:1 |
| error_msg 模板 | '[upstream_busy] X 服务正在排队,请耐心等待.. (自动重试 N/60)' | 解析 error_msg 显示 | 解析 error_msg 显示 | ✅ 1:1 |
| UI 触发条件 | n/a | error_msg.includes('[upstream_busy]') | error_msg.includes('[upstream_busy]') | ✅ 1:1 |
| UI label 文案 (tool_queued) | n/a | '排队中(自动重试)' | '排队中(自动重试)' | ✅ 1:1 |
| UI label 文案 (tool_failed) | n/a | '上游持续繁忙' | '上游持续繁忙' | ✅ 1:1 |
| UI 颜色 | n/a | amber-100 bg / amber-700 text | #fef3c7 bg / #92400e text | ✅ 1:1 (web Tailwind / mobile hex 等价) |
| ErrType 判断 | 'Service busy' / '503' / 'upstream_busy' 三种字符串 | n/a | n/a | ✅ 1:1 |
| retry_count 累加 | yes | n/a | n/a | ✅ 1:1 |
| 成功清状态 | retry_count=0, error_msg=null | n/a | n/a | ✅ 1:1 |

### § 5.11.5 使用规范 (跨项目通用铁律)

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

### § 5.11.6 跨项目通用铁律 4 条新沉淀 (跟 BUG-079/100/118/132 100% 同源)

1. **后端 polling + 上游调用必带 retry loop + owner state**: fire-and-forget 不允许直接 reject. 上游 API 偶发繁忙 / 5xx / 5xx should retry, 直接 reject = 永远丢任务
2. **重试间隔必 ≥10s**: 避免 1s 死循环把上游打死. 选 exponential backoff 或固定 ≥10s
3. **重试上限必设 (60 次 = 10 分钟)**: 防止永久挂起. 上限 = 上游恢复窗口期 × 平均重试间隔
4. **error_msg 文案必区分'正在重试' vs '重试用完'**: 前端不能误以为失败, 但也不能让用户一直等. 必须给前端一个能区分的信号 (这里是 [upstream_busy] 前缀)

### § 5.11.7 跟其他 BUG 关系

- **BUG-079** 假报告 — 跟 BUG-139 同源 '前端 UI 没法区分状态'
- **BUG-100** loading UX 假修 — 同源 'loading 状态 UI 必真实反映后台'
- **BUG-118** videoAgent tool_throttled 细分 — BUG-139 是 BUG-118 的扩展 (限流状态更细分: tool_queued + upstream_busy 自动重试中 vs tool_throttled 已暂停)
- **BUG-119** retry 边界清理 — BUG-139 retry 终止条件跟 BUG-119 同源
- **BUG-120** 等待动画卡片按比例显示 — BUG-139 排队中状态跟 BUG-120 等待卡片 1:1 镜像
- **BUG-122** 拆 3 企业 key — BUG-139 跟 BUG-122 都是 shipin-APP 端基础设施层修法
- **BUG-123** Agnes API 限流排队 image 40/min + video 2/min — BUG-139 是 server 端'真碰到 429/503 时的最后一道防线' (前端排队 + 中间限流器 + 后端 retry loop 三重保险)
- **BUG-132** video + image retry 策略细化 — BUG-139 跟 BUG-132 同源 (retry 状态细化)
- **BUG-136** 加载状态视觉层级铁律 — BUG-139 '排队中(自动重试)' 状态跟 BUG-136 8 段视觉层级 1:1 集成

### § 5.11.8 mavis memory 沉淀 (跟 mobile § 6.19.8 1:1)

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

### § 5.11.9 E2E 验证 (跟 mobile § 6.19.9 1:1)

- ✅ /api/version: 3.0.71, mobileLatestApkVersion: 3.0.71, downloadUrl: https://ab.maque.uno/app/DeepScript_v3.0.71.apk
- ✅ 公网 APK HTTP/2 200, Content-Type: application/vnd.android.package-archive, Content-Length: 30256334
- ✅ systemd shipin-app active (running), PID 6849 (restart 后)
- ✅ 12 维验证全过 (systemd + 6000 + /health + /api/version + APK HTTP/2 200 + 宝塔 shipin_APP run=True)
- ✅ mobile tsc: 53 错 (全 pre-existing, baseline 一致, 0 新错)
- ✅ web typecheck: 0 错
- ✅ web build: dist/index-BPtvMyvS.js (528KB)
- ✅ server tsc: 0 错
- ✅ 公网 APK sha256: 0F7E50FF7850CAF0794E68670D094DB757D3021B6FDB5E5D4E698CE83F9C2712

### § 5.11.10 部署全链路 (跨端铁律 5)

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

## § 5.12 v3.0.72 新增: 跨端 AgentChatPanel generating/confirmingId UI state 跟会话 ID 绑定 (BUG-140, 跟 mobile § 6.20 1:1 镜像)

> **新增 2026-07-01 (v3.0.72 BUG-140)**: 修 web + mobile 跨端 AgentChatPanel generating / confirmingId 是全局 bool state, 新会话按钮被旧会话生成中状态卡死. 修法 web 端 generating → generatingConvId (string \| null), mobile 端 if (confirmingId) → if (confirmingId === convId), 跨端铁律 4++ 1:1 镜像.

### § 5.12.1 背景 (跟 mobile § 6.20.1 1:1)

用户反馈: 视频助手会话列表中已有会话在跑生成 (例如 6c5de242 显示"排队中"), 用户新建一个会话, 进去输入需求 → 等方案就绪 → 右下角 plan 卡片显示"方案已就绪 ✨ 点下方'确认方案'出视频!开始生成" → 但右上角的按钮一直显示"视频生成中(首次 30-60s)..." → 永远点不动. 用户期望: 列表中的其他会话框即使有任务正在生成, 新建会话框也可以正常再进行新生成任务.

### § 5.12.2 修前根因 (跟 mobile § 6.20.2 1:1)

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

### § 5.12.3 修法 (跨端铁律 4++ 1:1 镜像 mobile)

跟 mobile § 6.20.3 完全镜像 (跨端铁律 4++ 1:1), 详见 § 6.20.3.

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

### § 5.12.4 跨端铁律 4++ 镜像 (跟 server 端 1:1, 跟 mobile § 6.20.4 1:1)

跟 mobile § 6.20.4 完全镜像, 详见 § 6.20.4.

### § 5.12.5 使用规范 (跟 mobile § 6.20.5 1:1, 跨项目通用铁律)

跟 mobile § 6.20.5 完全镜像, 详见 § 6.20.5.

### § 5.12.6 跨项目通用铁律 4 条新沉淀 (跟 mobile § 6.20.6 1:1)

1. **UI 状态必跟会话 ID 绑定, 不能是全局 bool (generating / inFlight / submitting 必带 convId 维度)**: 跨项目通用铁律
2. **修 polling lifecycle 必同步修 UI state lifecycle (BUG-138 修了 status 但漏了 generating, 100% 同源)**: 跨项目通用铁律
3. **入口判断必检查当前 convId 匹配 (if (confirmingId) return 是反模式, 改成 if (confirmingId === convId) return)**: 跨项目通用铁律
4. **按钮 disabled 必跟当前 convId 匹配 (disabled={!!someGlobalBool} 是反模式, 改成 disabled={someGlobalBool === currentConvId})**: 跨项目通用铁律

### § 5.12.7 跟其他 BUG 关系 (跟 mobile § 6.20.7 1:1)

跟 mobile § 6.20.7 完全镜像, 详见 § 6.20.7.

### § 5.12.8 mavis memory 沉淀 (跟 mobile § 6.20.8 1:1)

跟 mobile § 6.20.8 完全镜像, 详见 § 6.20.8.

### § 5.12.9 E2E 验证 (跟 mobile § 6.20.9 1:1)

- ✅ 公网 /api/version = 3.0.72
- ✅ 公网 APK sha256 = 66E2B7C56AA48147142EF98CA9CA6A0539D8B0F82DECEA059B2F6037C85D5FE3 一致
- ✅ 公网 web bundle index-CNQIgh2A.js HTTP 200 (新版本生效, 541769 bytes)
- ✅ ConvA 跑任务 + ConvB 独立 awaiting_clarification (15s 后仍干净)
- ✅ web AgentChatPanel.tsx 用 generatingConvId === conversationId (修复 BUG-140)
- ✅ mobile VideoAgentScreen + ImageAgentScreen 用 confirmingId === convId (跨端铁律 4++ 1:1 镜像)

### § 5.12.10 部署全链路 (跨端铁律 5, 跟 mobile § 6.20.10 1:1)

跟 mobile § 6.20.10 完全镜像, 详见 § 6.20.10.
