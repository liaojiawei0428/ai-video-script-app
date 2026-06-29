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