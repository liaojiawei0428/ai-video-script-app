# 开发进度追踪

> 项目：AI 视频剧本生成系统（小说上传→分段分析→剧本生成→分镜）
> 当前阶段：v2.0.0 实施准备 → 模块 H（角色一致性）

---

## 状态标记说明

```
[待开始]   尚未开始
[进展中]   正在实施
[待验证]   已实施，待测试验证
[已验收]   已实施并通过验证
[已跳过]   评估后不需要
[阻塞]     被外部因素阻断
```

---

## S11 (当前)：v2.0.0 — 角色一致性 + 章节大纲 + 资产库 + Web 端

### 总体目标
在 v1.2.0（已完成）基础上，引入：
1. **角色一致性三阶段流程**（描述生成 → 用户确认 → 变体图生成）
2. **分集大纲确认步骤**（AI 先出每集摘要, 用户调整后再生成剧本）
3. **章节事件图谱**（plotGraph, 注入剧本生成 prompt）
4. **多角度变体图**（每角色 3 张：正面半身/侧面半身/全身）
5. **画风预设系统**（5 种风格, 锁定不可改）
6. **PDF/Word 导出**（剧集一键导出）
7. **书架搜索/筛选**（标题 + 状态）
8. **积分订单系统**（充值 + 消费流水 + 退款）
9. **Web 端（全新）**（Vite + React 18 + TS, 无限画布 + AI 助手侧栏）

### 服务器现状（2026-06-04 摸底）
- **后端**：`/www/wwwroot/shipin-APP`，PM2 `ai-script-server` (PID 57159, 端口 6000)
- **代码形态**：单层 server（非 monorepo），无 git
- **GitHub 仓库**：`https://github.com/liaojiawei0428/ai-video-script-app`（monorepo 形态）
- **MySQL** `ai_script` 库 @ 10.1.0.11:3306，11 张表，约 2.7MB
- **关键数据**：78 characters / 12 novels / 20 users / 346 episodes / 98 shots / 17 notifications / 710 billing_logs
- **v1.2.0 字段已就位**：users.role/vip_level/last_ip/ip_location, novels.full_summary/analysisReport, notifications, billing_logs, feedbacks
- **备份**：`/www/backup/ai-script-migration/ai_script-20260604-133818.sql` + `/www/backup/shipin-APP-v1.2.0/.env`
- **资源**：4 CPU / 3.6GB 内存（用 1.1GB）/ 59GB 磁盘（用 24GB）/ 负载 1.17
- **邻居服务**：sparrow-logic/banmu-server (:3000), gg.maque.uno/Node_JS (:3001)
- **nginx** 宝塔管理，sites-enabled 空但 maque.uno/gg.maque.uno 正常（宝塔 vhost 在 `/www/server/panel/vhost/nginx/`）
- **SSL**：宝塔内部管理（无 certbot），ab.maque.uno 未配置
- **Redis**：未安装，6379 未监听（代码不用 redis，V4 Flash 多 Key 池替代）

### 部署策略
- **保留路径** `/www/wwwroot/shipin-APP`（用户决定）
- **代码同步**：本地 build apps/server → scp 到 shipin-APP（保留单层结构, 不切 monorepo 形态）
- **包管理**：`apps/server/package.json` 同步到 `shipin-APP/package.json`
- **dist 路径**：`shipin-APP/dist/index.js`（保持 PM2 启动命令不变）
- **数据库迁移**：**增量迁移**（不删表, 只 ALTER TABLE 加字段 + CREATE 新表，保留 78 characters 数据）
- **Web 端**：新建 `/www/wwwroot/web-app/` 目录，跑 Vite build 输出 + nginx 反代
- **域名**：`ab.maque.uno`（用户去宝塔加站点 + 申请证书）
- **首次部署流程**：本地 build → `scp dist.tgz` → 服务器解压替换 → 删 ai_script 库（用户接受清空）或 ALTER 增量 → PM2 reload

### 关键设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 角色一致性流程 | **三阶段**（描述→确认→生图） | 比 v1 直接生图质量高 5x, 用户可调整 |
| 角色描述维度 | **15 维度**（11 基础 + 4 新增）| 11 基础=姓名/年龄/身高/体型/脸型/五官/发型/标志/服装/性格/别名；4 新增=关系网络/情绪范围/动作习惯/标志性台词 |
| 资产库 | **统一 `assets` 表** | v2.0 只用 character 类型, 但为 v2.5 scene/prop/costume 预埋 |
| 分集大纲 | **先确认再生成剧本** | 减少重做, AI 出 1-2 句/集摘要让用户改 |
| 章节事件图谱 | **plotGraph**（结构化事件链）| 注入剧本 prompt 提升连贯性 |
| 默认画风 | **写实电影风**（realistic cinematic） | 5 选 1（写实/古风水墨/动漫/赛博/3D）|
| 画风锁定 | **上传时定, 不可改** | 避免变体图风格不一致 |
| 多角度变体 | **正面半身 + 侧面半身 + 全身** | 3 张/角色, 各扣费 0.3 元 |
| 单图角色数 | **最多 2 个** | AI 模型限制, 超出文字描述 |
| 选角规则 | **按出场顺序前 2** | 自动化选角, 不让用户选 |
| 扣费粒度 | **按张**（变体图） | PRICING.character_image=0.3/张 ×3=0.9/角色 |
| 描述生成 AI | **DeepSeek V4 Flash** | 复用 `deepseekPool`, 文字便宜 |
| 生图 AI | **暂不选型**（占位符）| 优先稳定后端, 后期接入 |
| Web 端栈 | **Vite + React 18 + TS + Tailwind + shadcn/ui + Zustand** | 不引入 TanStack Query |
| 状态管理 | **仅 Zustand** | 移动端同款, 一致性 |
| 账户 | **共享 users 表** | Web + 移动端一个用户 |
| 管理员后台 | **Web 完整版 + 移动端 4 Tab 简版** | 双端保留 |
| 移动端 | **Android only** | iOS 不做 |
| 响应式 | **≥1024 桌面完整, <1024 引导用 App** | Web 端主用户是 PC 编剧 |
| 无限画布 | **react-flow** | 章节事件图谱 + 后续协作画布 |
| AI 助手侧栏 | **Web 独有** | 移动端 ChatScreen 已在用 |
| Web 部署 | **同服务器 ab.maque.uno** | 用户决定 |
| 证书 | **宝塔 Let's Encrypt** | 用户去宝塔点 |
| SSH 部署 | **scp + PM2 reload** | shipin-APP 单层结构不变, 不切 monorepo |
| 测试 G 模块 | **跳过** | 用户决定 1.2 已有测试不管 |
| 验证 V-2~V-8 | **延后** | 等实施完 |

### 状态流转（新小说 v2.0 流程）

```
[上传] → pending
  ↓
[分块分析+合并] → analyzing → analyzed  (full_summary 写入)
  ↓
[角色描述生成（仅文字）] → character_extracting  (deepseek 文字)
  ↓
[等待用户确认角色描述] → character_pending  ← 用户编辑/确认
  ↓
[变体图生成（3张/角色, deepseek 文字+占位图）] → image_generating
  ↓
[角色图完成] → characters_ready
  ↓
[分集大纲生成] → outline_generating
  ↓
[等待用户确认分集大纲] → outline_pending  ← 用户编辑/确认
  ↓
[剧本生成（每集独立, 注入 plotGraph + 角色描述）] → generating
  ↓
[分镜生成] → shot_generating
  ↓
[完成] → completed
```

---

### 模块 H：角色一致性三阶段流程（核心）

#### H-1：基础设施与类型

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| H-1.1 | 扩 `shared/types.ts`：新增 CharacterDescription（15 维度）, ImageVariant, StylePreset, ImageGenStatus | [待开始] | |
| H-1.2 | 新建 `shared/stylePresets.ts`：5 画风预设常量 + 默认值 + 文案 | [待开始] | realistic/ancient/cyber/anime/3d |
| H-1.3 | `models/db.ts` 加字段：characters.description JSON, extra_description JSON, style_id VARCHAR(36), confirmed TINYINT, image_variants JSON | [待开始] | 兼容迁移 try/catch |
| H-1.4 | 新建 `prompts/characterDescription.ts`：15 维度描述生成 prompt | [待开始] | 基于全文摘要, 输出严格 JSON |

#### H-2：CharacterService 核心

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| H-2.1 | 新建 `services/characterService.ts`：`extractDescriptions(novelId, fullSummary)` — 调 deepseek 文字, 落库 | [待开始] | |
| H-2.2 | 同上：`confirmDescription(characterId, userEdits)` — 接受用户编辑, 标记 confirmed=1 | [待开始] | |
| H-2.3 | 同上：`generateImageVariants(characterId, styleId)` — 调 imageProvider 生成 3 张 | [待开始] | 并行, 按张扣费 |
| H-2.4 | 同上：`getCharacter(characterId)` / `listByNovel(novelId)` | [待开始] | |
| H-2.5 | 新建 `services/imageProvider.ts`：抽象接口 (generate / supportsNegativePrompt) + 占位实现 | [待开始] | v2.0 用 SVG 占位, v2.5 接入实际 provider |

#### H-3：集成到 chunkService / novelService

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| H-3.1 | `services/chunkService.ts`：mergeSummaries 后, 调 characterService.extractDescriptions (仅文字) | [待开始] | 不生图, 等用户确认 |
| H-3.2 | `services/novelService.ts`：状态流转加入 character_extracting/character_pending/image_generating | [待开始] | WS 推送新状态 |
| H-3.3 | `services/taskQueue.ts`：任务类型加 'character_extract' / 'image_generate' | [待开始] | |

#### H-4：API 路由 + Controller

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| H-4.1 | 新建 `controllers/characterController.ts` | [待开始] | |
| H-4.2 | 新建 `routes/characters.ts`：`POST /api/novels/:id/characters/extract`, `GET /api/novels/:id/characters`, `POST /api/characters/:id/confirm`, `POST /api/characters/:id/generate-images`, `GET /api/characters/:id` | [待开始] | |
| H-4.3 | `index.ts` 注册路由 + 鉴权中间件 | [待开始] | |

#### H-5：移动端 UI

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| H-5.1 | 新建 `screens/CharacterDescriptionReviewScreen.tsx`：列表 + 编辑器 + 确认按钮 | [待开始] | 风格预设选择器（仅在 novels.style_id 未设置时显示）|
| H-5.2 | 新建 `screens/CharacterDetailScreen.tsx`：3 张变体图展示 + 重新生成按钮（按张扣费）| [待开始] | |
| H-5.3 | `useNovelStore.ts`：加 characters 状态 + confirmCharacter() / generateImages() action | [待开始] | |
| H-5.4 | `ChatScreen.tsx`：角色状态显示 + "查看角色" 入口 | [待开始] | |
| H-5.5 | `UploadScreen.tsx`：加画风选择（5 选 1, 默认写实）| [待开始] | |

---

### 模块 I：分集大纲确认 + 章节事件图谱

#### I-1：基础设施

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| I-1.1 | 扩 `shared/types.ts`：EpisodeOutline / EpisodeOutlineItem / PlotGraph / PlotGraphEvent | [待开始] | |
| I-1.2 | `models/db.ts` 加字段：novels.style_id, novels.plot_graph JSON, novels.outline_confirmed TINYINT, episodes.outline_text TEXT, episodes.confirmed TINYINT, episodes.character_descriptions JSON | [待开始] | |
| I-1.3 | 新建 `prompts/episodeOutline.ts`：分集大纲 prompt | [待开始] | 基于全文摘要 + 角色 + plotGraph |

#### I-2：ScriptService 扩展

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| I-2.1 | 扩 `services/scriptService.ts`：`generateOutline(novelId)` — 调 deepseek 出每集 1-2 句摘要, 落库 | [待开始] | |
| I-2.2 | 同上：`confirmOutline(novelId, userEdits)` | [待开始] | |
| I-2.3 | 同上：`generateEpisodes()` 改造：注入 confirmedDescription + plotGraph 到 prompt | [待开始] | 检查 outline_confirmed=1 才执行 |
| I-2.4 | `services/novelService.ts`：状态流转加 outline_generating/outline_pending | [待开始] | |

#### I-3：章节事件图谱生成

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| I-3.1 | 新建 `prompts/plotGraph.ts`：基于全文摘要生成 plotGraph | [待开始] | 输出 [{chapter, events: [{type, summary, characters}]}] |
| I-3.2 | `services/chunkService.ts`：mergeSummaries 后调 plotGraph 生成 | [待开始] | 跟角色描述生成并发 |
| I-3.3 | plotGraph 注入所有后续 prompt（分集大纲、剧本、分镜）| [待开始] | 提升连贯性 |

#### I-4：API + 移动端 UI

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| I-4.1 | 新增 `POST /api/novels/:id/outline/generate`, `POST /api/novels/:id/outline/confirm` | [待开始] | |
| I-4.2 | 新建 `screens/EpisodeOutlineReviewScreen.tsx`：列表 + 编辑每集摘要 + 确认 | [待开始] | |
| I-4.3 | `ChatScreen.tsx`：大纲状态显示 + "查看大纲" 入口 | [待开始] | |
| I-4.4 | `useNovelStore.ts`：加 outline 状态 + confirmOutline() action | [待开始] | |

---

### 模块 J：PDF/Word 导出

#### J-1：基础设施

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| J-1.1 | 安装依赖：`pdfkit`（PDF）/ `docx`（Word）/ 已有 `multer` | [待开始] | |
| J-1.2 | 扩 `shared/types.ts`：ExportOptions / ExportFormat | [待开始] | |

#### J-2：ExportService

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| J-2.1 | 新建 `services/exportService.ts`：`generatePdf(episodeId)` / `generateDocx(episodeId)` / `generateMarkdown(episodeId)` | [待开始] | 标题/角色/分镜/对白/动作 |
| J-2.2 | PDF 样式：标题、剧集元数据、角色介绍、分镜列表、页脚页码 | [待开始] | |
| J-2.3 | Word 样式：相同结构, 标题分级 H1/H2 | [待开始] | |

#### J-3：API + UI

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| J-3.1 | 新增 `GET /api/episodes/:id/export?format=pdf|docx|md` | [待开始] | 流式返回, Content-Disposition attachment |
| J-3.2 | `EpisodeDetailScreen.tsx` 加"导出"按钮 + 选格式弹窗 | [待开始] | |
| J-3.3 | Web 端 `EpisodeDetail.tsx` 复用 API + 加下载按钮 | [待开始] | |

---

### 模块 K：书架搜索/筛选

#### K-1：后端

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| K-1.1 | 扩 `controllers/novelController.ts`：`GET /api/novels?q=...&status=...&page=...` | [待开始] | 标题模糊 + 状态精确 + 分页 |
| K-1.2 | `models/novel.ts` 扩 `searchByUserId(userId, query, status, offset, limit)` | [待开始] | |

#### K-2：移动端

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| K-2.1 | `useNovelStore.ts` 加 `searchNovels()` / `filterByStatus()` | [待开始] | |
| K-2.2 | `BookshelfScreen.tsx` 加搜索框 + 状态筛选 chip | [待开始] | |
| K-2.3 | 下拉刷新 + 空状态文案 | [待开始] | |

#### K-3：Web 端

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| K-3.1 | Web `pages/Bookshelf.tsx` 同功能（移动端组件抽出来）| [待开始] | |

---

### 模块 L：资产库 + 镜头生图 + AI 助手侧栏

#### L-1：资产库

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| L-1.1 | `models/db.ts` 新表 `assets`（id, novel_id, type, name, description JSON, style_id, reference_image, created_at）| [待开始] | v2.0 只用 character 类型 |
| L-1.2 | `models/db.ts` 新表 `style_presets`（id, name, label, description, sample_image_url, is_default）| [待开始] | 5 画风 seed 数据 |
| L-1.3 | 写入 5 个画风 preset seed | [待开始] | 在 initTables 末尾 |
| L-1.4 | `services/characterService.ts` 加 `getAssetsByNovel()` | [待开始] | |

#### L-2：镜头生图

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| L-2.1 | `models/db.ts` 加字段：shots.image_url, shots.character_ids JSON, shots.style_id, shots.image_prompt TEXT | [待开始] | |
| L-2.2 | `services/characterService.ts` 加 `generateImageForShot(shotId)` | [待开始] | 自动选前 2 角色 + 镜头描述合成 prompt |
| L-2.3 | `routes/shots.ts` 加 `POST /api/shots/:id/generate-image` | [待开始] | 按张扣费 |
| L-2.4 | `ShotDetailScreen.tsx` 加"生成参考图"按钮 | [待开始] | |

#### L-3：积分订单系统

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| L-3.1 | `models/db.ts` 新表 `points_orders`（id, user_id, type, amount, status, payment_method, transaction_id, created_at, completed_at）| [待开始] | |
| L-3.2 | `services/billingService.ts` 加 `createOrder()` / `completeOrder()` | [待开始] | 复用现有支付回调 |
| L-3.3 | `routes/orders.ts` 新增订单查询/创建/取消 API | [待开始] | |

#### L-4：AI 助手侧栏

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| L-4.1 | `components/AIAssistant.tsx` (Web 端)：聊天界面 + 上下文感知 | [待开始] | 在剧集详情页右侧 |
| L-4.2 | 复用后端 ChatScreen 的 deepseek 流式接口 | [待开始] | |

---

### 模块 M：Web 端（v2.0 全新）

#### M-1：项目搭建

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-1.1 | 创建 `apps/web/`：`npm create vite@latest -- --template react-ts` | [待开始] | |
| M-1.2 | 配 Tailwind：`npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p` | [待开始] | |
| M-1.3 | 配 shadcn/ui：`npx shadcn-ui@latest init` | [待开始] | |
| M-1.4 | 安装：`zustand react-router-dom@6 axios lucide-react reactflow clsx` | [待开始] | 不引入 TanStack Query |
| M-1.5 | `tsconfig.json` 配路径别名 `@/*` | [待开始] | |

#### M-2：抽公共代码

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-2.1 | 抽 `packages/shared-utils/src/apiClient.ts`：axios 实例 + 401 拦截 + token 注入 | [待开始] | 移动端 + Web 共用 |
| M-2.2 | 抽 `packages/shared-utils/src/websocketClient.ts`：重连 + 心跳 | [待开始] | |
| M-2.3 | 抽 `packages/shared-utils/src/types.ts`：枚举/常量（status/config）| [待开始] | |

#### M-3：状态管理（Zustand）

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-3.1 | `store/useAuthStore.ts`：user/token/login/logout | [待开始] | |
| M-3.2 | `store/useNovelStore.ts`：novels/fetchNovels/搜索/筛选 | [待开始] | |
| M-3.3 | `store/useCharacterStore.ts`：characters/confirm/generateImages | [待开始] | |

#### M-4：页面（核心 6 页）

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-4.1 | `pages/Login.tsx` + `pages/Register.tsx` | [待开始] | 复用后端 /api/auth |
| M-4.2 | `pages/Bookshelf.tsx`：小说列表 + 搜索 + 筛选 | [待开始] | K-3 复用 |
| M-4.3 | `pages/NovelDetail.tsx`：小说详情 + 剧集列表 + 大纲确认 + 状态 | [待开始] | |
| M-4.4 | `pages/EpisodeDetail.tsx`：剧集详情 + 分镜 + 导出 + AI 助手侧栏 | [待开始] | |
| M-4.5 | `pages/Characters.tsx`：角色库 + 描述确认 + 变体图 | [待开始] | H-5 复用 |
| M-4.6 | `pages/Canvas.tsx`：无限画布（react-flow）+ 章节事件图谱 | [待开始] | |
| M-4.7 | `pages/Admin.tsx`：管理员后台（用户管理/反馈/通知/订单）| [待开始] | Web 完整版 |

#### M-5：组件

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-5.1 | `components/Sidebar.tsx`：主导航（侧边栏）| [待开始] | |
| M-5.2 | `components/AIAssistant.tsx`：AI 助手侧栏 | [待开始] | L-4 复用 |
| M-5.3 | `components/AssetCard.tsx`：角色/资产卡片 | [待开始] | |
| M-5.4 | `components/CharacterImage.tsx`：变体图组件（3 图轮播）| [待开始] | |
| M-5.5 | `components/EpisodeCard.tsx`：剧集卡片 | [待开始] | |
| M-5.6 | `components/StatusBadge.tsx`：状态徽章 | [待开始] | |
| M-5.7 | `components/UploadDialog.tsx`：上传小说对话框 | [待开始] | |
| M-5.8 | `components/OutlineEditor.tsx`：分集大纲编辑器 | [待开始] | |
| M-5.9 | `components/CharacterDescriptionEditor.tsx`：角色描述编辑器 | [待开始] | |
| M-5.10 | `components/ResponsiveGuard.tsx`：<1024px 引导用 App | [待开始] | |

#### M-6：路由 + 布局

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-6.1 | `App.tsx`：React Router v6 + 全局 Layout | [待开始] | |
| M-6.2 | 路由守卫：未登录跳 /login | [待开始] | |
| M-6.3 | 管理员路由守卫：role !== 'admin' 跳 /403 | [待开始] | |

#### M-7：响应式 + 移动适配

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-7.1 | ≥1024px：完整布局（Sidebar + 主区 + AI 助手侧栏）| [待开始] | |
| M-7.2 | <1024px：`ResponsiveGuard` 显示"请使用 App 扫码下载" + 二维码 | [待开始] | |

#### M-8：构建 + 部署

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| M-8.1 | `vite.config.ts`：base='/web/', build.outDir='dist' | [待开始] | |
| M-8.2 | `nginx.conf` (web 端)：gzip + SPA fallback + 静态缓存 | [待开始] | |
| M-8.3 | `scripts/deploy.sh`：build → scp → 服务器解压 → reload nginx | [待开始] | |
| M-8.4 | 服务器 nginx 站点 `ab.maque.uno.conf`（宝塔添加后我配反代）| [待开始] | |
| M-8.5 | 宝塔申请 Let's Encrypt 证书（用户操作）| [待开始] | |
| M-8.6 | `apps/web/README.md`：部署说明 | [待开始] | |

---

### 模块 N：服务器部署（最后一步）

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| N-1 | 本地 build `apps/server`：`pnpm build` | [待开始] | 产出 dist/ |
| N-2 | 打包 `dist/` + `package.json` + `package-lock.json` 为 `dist.tgz` | [待开始] | |
| N-3 | scp 到 `/www/backup/release/v2.0.0/` | [待开始] | |
| N-4 | 服务器 `tar -xzf` 替换 `dist/` + `npm ci --production` | [待开始] | |
| N-5 | **数据库迁移**：`psql/mysql < migrate-v1.2-to-v2.0.sql` | [待开始] | 增量 ALTER + CREATE |
| N-6 | 启动新 server：`pm2 restart ai-script-server` | [待开始] | 检查 initTables 跑通 |
| N-7 | 验证 API：`/api/version` 返回 2.0.0 | [待开始] | |
| N-8 | 部署 Web 端：build + scp + nginx reload | [待开始] | |
| N-9 | 申请 ab.maque.uno 证书（用户去宝塔）| [待开始] | |
| N-10 | 切移动端 API URL → ab.maque.uno 或 159.75.16.110:6000 | [待开始] | 下次 APP 发版 |

---

## 验证阶段（V-2 ~ V-8, 实施完再做）

| 步骤 | 描述 | 状态 | 备注 |
|------|------|------|------|
| V-2 | T-1 短小说走完整 v2.0.0 流程（上传→分析→角色描述→确认→分集大纲→确认→剧本→分镜）| [待开始] | |
| V-3 | T-2 中篇小说（10万字）+ 角色描述+大纲双确认 | [待开始] | |
| V-4 | T-3 长篇小说（1MB+）完整 | [待开始] | |
| V-5 | 多角度变体图（3张/角色）生成 + 显示 + 按张扣费 | [待开始] | |
| V-6 | PDF/Word 导出验证（剧集导出, 文件可打开）| [待开始] | |
| V-7 | Web 端 6 页 + 无限画布 + AI 助手侧栏 + 响应式 | [待开始] | |
| V-8 | ab.maque.uno 部署 + 移动端切 API URL | [待开始] | |

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 生产 DB characters 78 行不能丢 | 高 | 增量迁移, 字段加完数据自动兼容 |
| 服务器 git fetch GitHub 失败 | 中 | 不依赖 git, 直接 scp 部署 |
| Web 端移动端 API 跨域 | 中 | 后端 CORS_ORIGIN=* + Web 用同源 |
| 变体图 AI provider 未选型 | 中 | v2.0 用 SVG 占位, v2.5 接入 |
| ab.maque.uno 证书申请拖延 | 中 | 先用 IP 测, 证书好了切 |
| SSH 密钥已暴露 | 高 | 任务结束立即轮换 |
| .env DEEPSEEK_KEY/PAY_KEY/JWT_SECRET 暴露 | 高 | 任务结束立即轮换 |
| 服务器无 git 版本管理 | 中 | 加 .git 跟踪 shipin-APP 改动 |

---

## 安全轮换清单（任务结束前必做）

- [ ] SSH 私钥轮换（已 3 次出现在对话）
- [ ] DEEPSEEK_API_KEYS 轮换（2 个 key）
- [ ] MYSQL_PASSWORD 轮换
- [ ] PAY_KEY 轮换
- [ ] JWT_SECRET 轮换（当前是默认值 `ai-script-jwt-secret-dev`）
- [ ] 检查 .env 是否被 commit 到 git
- [ ] 检查宝塔面板 888 端口是否限制 IP

---

## 当前进度（AI 会话追踪）

| 会话 | 日期 | 完成的工作 | 下一个任务 |
|------|------|-----------|-----------|
| S5 | 2026-05-21 | **部署**：SCP 上传服务端新文件 + 安装 bcryptjs/jsonwebtoken 依赖 + 重启服务。**验证**：注册/登录/获取资料 API 全通过。**APK 构建安装**：Gradle 重新打包 + 安装到设备 + App 自动启动 | 性能调优 |
| S6 | 2026-05-21 | **三规格小说全流程服务端测试**：<br>1️⃣ **88KB 暴君的笼中雀**（45K字）：上传→分析→13集剧本生成→✅ 全部通过<br>2️⃣ **1MB 重生真千金是大佬**（545K字）：上传→72块分析→36集剧本已生成→✅ 管道正常<br>3️⃣ **9.3MB 雪中悍刀行**（4.7M字）：上传→72块分析→500集全部生成（4.5h）→✅ 全通过 | UI 商业化改造 |
| S9 | 2026-05-27 | **闪退修复 + VIP开通修复 + 数据库迁移**：闪退/VIP/数据库迁移 | - |
| S10 | 2026-05-30 | **API切换 + 数据库迁移 + 功能优化 + 版本发布 v1.0.0** | - |
| S11 (当前) | 2026-06-04 | **v2.0.0 启动 + 服务器摸底 + 文档落档**：<br>1. SSH 连接到 159.75.16.110, 摸清部署现状（PM2 ai-script-server v1.2.0, MySQL ai_script 11 表, 78 characters / 12 novels / 20 users）<br>2. mysqldump 完整备份到 /www/backup/<br>3. shipin-APP 拉成 git 仓库（但 GitHub 端 fetch 失败, 改用 scp 部署）<br>4. **本地落档**：DEV_PROGRESS.md / VERSION_POLICY.md / version.ts<br>5. **安全警示**：6 个生产密钥已在对话中暴露（SSH 私钥/DEEPSEEK KEY/MYSQL PASS/PAY_KEY/JWT_SECRET 默认值）<br>**决策**（用户拍板）：<br>• 保留 shipin-APP 路径, scp 部署<br>• ab.maque.uno 宝塔手工加站点<br>• **建议改增量迁移**（保护 78 characters）<br>• 写完文档先, 然后开 H-1 | H-1.1 扩 types.ts（CharacterDescription/ImageVariant/StylePreset/ImageGenStatus）|
