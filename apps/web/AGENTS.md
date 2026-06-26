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

### § 2.2 [GAP] M-5: 独立组件缺失
- **现状**: 没找到独立 `Sidebar / AssetCard / CharacterImage / EpisodeCard / StatusBadge / UploadDialog / OutlineEditor / CharacterDescriptionEditor / ResponsiveGuard` 组件
- **影响**: 功能直接写在 page 里, 复用性差
- **修法**: 等用户提需求"想要更可复用"时再做

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

1. **不引入 shadcn/ui** — 当前 17 个 page 全 Tailwind 手写, 一致性好. 引入 shadcn 会破坏一致性 + 增 bundle size
2. **状态管理只用 Zustand** — 跟 mobile 端同款, 一致性. ❌ 不用 Redux / Recoil / Context
3. **路由守卫在 App.tsx 集中** — `Protected` 检查 token + `AdminProtected` 检查 token (TODO: 加 role 检查, 当前只检查 token 存在)
4. **bundle hash 必带** — `vite.config.ts` 默认带 query hash, 部署后浏览器自动拉新版本, 不用手动删旧 bundle

---

**web 端部署 SOP** → [`./DEPLOY.md`](./DEPLOY.md)
**跨端版本管理** → [`../../docs/VERSION_MANAGEMENT.md`](../../docs/VERSION_MANAGEMENT.md)
**mobile 端独有 (web 镜像参考)** → [`../../apps/mobile/AGENTS.md`](../../apps/mobile/AGENTS.md)
**server 端独有 (web 共享 API)** → [`../../apps/server/AGENTS.md`](../../apps/server/AGENTS.md)
**跨端统一规范 (S68 收口核心)** → [`../../AGENTS.md`](../../AGENTS.md)

> **最后更新**: 2026-06-26 (S72 batch 7 v1.1, 加铁律 4++ (Web 主导, APP 跟随) — 改 web 端必同步 app 端 5 步 SOP, 跟根 AGENTS.md v2.11 + mobile AGENTS.md v1.3 同步)
> **下次 review**: web 端有架构变更 / 新 GAP / 独立部署时
