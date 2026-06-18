# 项目问题追踪

> 本文档记录项目设计和实现中发现的所有问题
> 最后更新: 2026-05-13
>
> **状态说明**: 已修复 = 代码已实现 | 待处理 = 尚未实现 | 已关闭 = 无需修复

---

## Issue-001: 大文本存储策略缺失

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 后端数据库、内存管理
**状态**: 已修复

**问题描述**:
设计文档中将50万字小说的完整内容存储在SQLite的TEXT字段中。这会导致：
1. 内存占用过高（加载时整个文本进入内存）
2. 数据库性能下降（大字段影响查询速度）
3. 备份和迁移困难

**解决方案**:
- `novels` 表使用 `file_path` 字段替代 `content_text`
- `novelService.createNovel` 将原文保存到 `uploads/novels/{uuid}.txt`
- 数据库只存储文件路径和元数据

**相关文件**:
- `docs/specs/2026-05-13-ai-video-script-design.md` 第3.2节
- `apps/server/src/models/db.ts`
- `apps/server/src/services/novelService.ts`

---

## Issue-002: 依赖不一致（sqlite vs sqlite3）

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P0
**影响范围**: 后端数据库层
**状态**: 已修复

**问题描述**:
`apps/server/package.json` 依赖的是 `sqlite3`，但 `apps/server/src/models/db.ts` 中导入的是 `sqlite`（即 `sqlite` 包，它是 better-sqlite3 的 Promise 封装）。

**解决方案**:
- `package.json` 同时依赖 `sqlite` 和 `sqlite3`
- `db.ts` 使用 `sqlite` 的 Promise API（`open` + `sqlite3.Database` driver）

**相关文件**:
- `apps/server/package.json`
- `apps/server/src/models/db.ts`

---

## Issue-003: EpisodePlan 类型与Prompt输出不匹配

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 剧本生成核心逻辑
**状态**: 已修复

**问题描述**:
`EpisodePlan` 接口定义 `startPosition`/`endPosition` 为 `number` 类型，但 Prompt 中要求AI输出 `"起始章节/段落位置"`（字符串描述），且 `ScriptService.generateEpisodes` 中将其当作百分比使用。

**解决方案**:
- `EpisodePlan` 接口改为使用 `startCharIndex`/`endCharIndex`（字符位置索引）
- Prompt 明确要求AI输出字符位置
- `scriptService` 使用 `sliceTextAtBoundary` 按段落边界切片

**相关文件**:
- `packages/shared-types/src/index.ts`
- `apps/server/src/prompts/episodeGeneration.ts`
- `apps/server/src/services/scriptService.ts`

---

## Issue-004: 状态流转逻辑错误

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 任务状态管理
**状态**: 待处理

**问题描述**:
`novelService.analyzeNovel` 分析完成后直接将 novel 状态设为 `'completed'`：
```typescript
await novelModel.updateStatus(novelId, 'completed');
```

但按照正常流程，分析完成后应该进入 `'analyzed'` 状态，等待生成剧集。直接设为 `completed` 会跳过生成阶段。

**建议方案**:
1. 分析完成 → 状态设为 `'analyzed'`
2. 剧集生成完成 → 状态设为 `'completed'`

修改 `novelService.analyzeNovel`：
```typescript
await novelModel.updateStatus(novelId, 'analyzed');
```

**相关文件**:
- `apps/server/src/services/novelService.ts`

---

## Issue-005: 缺少文件解析器（EPUB/DOCX）

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 文件上传模块
**状态**: 已修复

**问题描述**:
设计文档声称支持 TXT/EPUB/DOCX 格式，但缺少对应的解析逻辑。

**解决方案**:
- 创建 `FileParserService` 统一处理文件解析
- 支持 TXT（直接读取）、EPUB（`epub` 包）、DOCX（`mammoth` 包）
- 移动端 `DocumentPicker` 配置多种 MIME 类型
- 上传路由使用 multer 处理文件上传

**相关文件**:
- `apps/server/src/services/fileParser.ts`
- `apps/server/src/routes/novels.ts`
- `apps/mobile/src/screens/UploadScreen.tsx`
- `apps/mobile/src/screens/UploadScreen.tsx`

---

## Issue-006: WebSocket 实现缺失

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 实时进度推送
**状态**: 已修复

**问题描述**:
设计文档提到 "WebSocket优先，HTTP轮询兜底"，但后端缺少 WebSocket 服务实现。

**解决方案**:
- 使用原生 `ws` 库创建 WebSocket 服务
- `WebSocketService` 支持按 novelId 订阅和广播
- `novelService` 和 `scriptService` 在进度更新时调用 `broadcastProgress`
- 移动端保留 HTTP 轮询作为兜底，可后续升级为 WebSocket

**相关文件**:
- `apps/server/src/services/websocket.ts`
- `apps/server/src/index.ts`
- `apps/server/src/services/novelService.ts`
- `apps/server/src/services/scriptService.ts`

---

## Issue-007: 缺少限流与并发控制

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: Deepseek API调用、成本控制
**状态**: 已修复

**问题描述**:
没有 API 限流机制、Deepseek 并发调用限制、Token 用量预估。

**解决方案**:
- Express 使用 `express-rate-limit` 限制请求频率
- `DeepseekService` 实现请求队列（最大并发3）+ 指数退避重试
- 添加 `estimateTokens` 和 `estimateCost` 工具函数
- `DeepseekService` 记录每次调用的 Token 用量和费用

**相关文件**:
- `apps/server/src/index.ts`
- `apps/server/src/services/deepseek.ts`
- `packages/shared-utils/src/index.ts`

---

## Issue-008: 移动端 API 地址硬编码

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: 移动端配置
**状态**: 已修复

**问题描述**:
API 地址硬编码在代码中，无法支持多环境切换。

**解决方案**:
- 使用 `react-native-config` 读取环境变量
- `config.ts` 从 `Config.API_BASE_URL` 读取，提供默认值
- 不同环境通过 `.env` 文件配置

**相关文件**:
- `apps/mobile/src/config.ts`
- `apps/mobile/src/api/client.ts`

---

## Issue-009: 缺少日志系统

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: 运维调试
**状态**: 已修复

**问题描述**:
当前代码使用 `console.log`/`console.error` 输出日志，缺少结构化日志和请求链路追踪。

**解决方案**:
- 使用 `winston` 日志库
- 开发环境输出到控制台（带颜色）
- 生产环境输出到文件（error.log + combined.log）
- `requestIdMiddleware` 为每个请求生成唯一 requestId
- 错误日志包含堆栈和上下文

**相关文件**:
- `apps/server/src/utils/logger.ts`
- `apps/server/src/middleware/requestId.ts`

---

## Issue-010: Docker 构建问题

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 部署
**状态**: 已修复

**问题描述**:
Dockerfile 使用 `npm ci --only=production` 但 monorepo 需要 workspace 支持，没有多阶段构建。

**解决方案**:
- 多阶段构建：builder 阶段编译，production 阶段运行
- builder 阶段安装 python3/make/g++ 编译原生模块
- production 阶段只复制构建产物和 package.json
- 添加 HEALTHCHECK 和 curl

**相关文件**:
- `apps/server/Dockerfile`
- `docker-compose.yml`
- `apps/server/Dockerfile`

---

## Issue-011: 缺少 Nginx 配置

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: 腾讯云部署
**状态**: 已修复

**问题描述**:
腾讯云部署需要反向代理、SSL、WebSocket 支持，但缺少 Nginx 配置。

**解决方案**:
- 创建 `apps/server/nginx.conf`
- HTTP → HTTPS 重定向
- SSL 配置（TLSv1.2+）
- `/api/` 和 `/ws/` 反向代理到后端
- 安全头部（X-Frame-Options, X-Content-Type-Options 等）
- 文件上传大小限制 100M
        proxy_set_header Connection "upgrade";
    }
}
```

**相关文件**:
- 新增 `apps/server/nginx.conf`
- `docs/plans/2026-05-13-implementation-plan.md`

---

## Issue-012: 剧本生成切片逻辑缺陷

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P1
**影响范围**: 剧本质量
**状态**: 已修复

**问题描述**:
`ScriptService.generateEpisodes` 中按字符位置切片，可能在句子中间切断，导致上下文丢失。

**解决方案**:
- `shared-utils` 中添加 `sliceTextAtBoundary` 函数
- 切片时寻找最近的段落边界（`\n`）
- 每集增加 500 字符的上下文重叠
- `scriptService` 使用新函数替代直接 `slice`

---

## Issue-013: 移动端 SQLite 与后端不同步

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: 数据一致性
**状态**: 已修复

**问题描述**:
移动端 SQLite 表结构缺少后端有的字段，如 `updated_at`、`script_format` 等。

**解决方案**:
- 移动端 SQLite 表结构已对齐后端核心字段
- `novels`、`episodes`、`characters` 三张表已创建
- 使用 `INSERT OR REPLACE` 支持数据同步更新

**相关文件**:
- `apps/mobile/src/db/sqlite.ts`

---

## Issue-014: 缺少 Token 预估和成本控制

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: API费用
**状态**: 已修复

**问题描述**:
缺少 Token 用量追踪和费用预估功能。

**解决方案**:
- `shared-utils` 添加 `estimateTokens` 和 `estimateCost` 函数
- `DeepseekService` 每次调用后记录 Token 用量和费用到 `callHistory`
- 提供 `getTotalCost()`、`getTotalTokens()`、`getCallHistory()` 查询接口
- 费用预估可在上传后通过 `estimateTokens(totalChars)` 计算

**相关文件**:
- `packages/shared-utils/src/index.ts`
- `apps/server/src/services/deepseek.ts`
- 新增费用追踪模块

---

## Issue-015: 任务断点续传机制缺失

**发现时间**: 2026-05-13
**发现AI**: 方案审查
**问题级别**: P2
**影响范围**: 可靠性
**状态**: 已修复

**问题描述**:
生成40集剧本时在第20集失败，没有机制从第20集继续，必须重新从头开始。

**解决方案**:
- `scriptService.generateEpisodes` 在生成每集前检查数据库
- 如果该集已存在且 `status === 'completed'`，则跳过
- 使用 `episodeModel.findByNovelId` 查询已有剧集
- 只生成未完成的集，避免重复 API 调用

**相关文件**:
- `apps/server/src/services/scriptService.ts`
- `apps/server/src/models/episode.ts`

---

## Issue-027: 视频 Agent prompt 100% passthrough, 中文质量差

**发现时间**: 2026-06-19
**发现AI**: Mavis (S61 视频功能改造调研)
**问题级别**: P2
**影响范围**: 视频生成质量 (中文用户感知最强)

**问题描述**:
shipin-APP 视频 Agent 自 v3.0.0.28 (S48) 起将用户原文 100% 原样转发给 agnes-video-v2.0 模型。S49 实测过：
- EN trigger 词匹配率 ~85%
- ZH trigger 词匹配率 ~55% (降 30%+)

中文用户提交"古风绿衣仙子站在桃花树下微风拂面"这种 prompt，模型理解不到位导致视频质量低（人物比例错 / 风格跑偏 / 动作不达意）。

**解决方案 (S61 已修复)**:
- 新增 LLM 优化层：中文 / 英文 / 混合输入 → LLM 改写成结构化英文 prompt + quality tags
- LLM 失败 / 超时 (30s) / 返空 → 100% fallback passthrough（视频生成永远不中断）
- i2v (modification) 模式跳过 LLM（保留用户修改指令原意）
- 计费 ¥0.01/次（复用 `billingService.chargeImage`，description='video prompt LLM 优化'）

**E2E 验证**:
- 中文 "古风绿衣仙子站在桃花树下微风拂面" (16 chars) → 英文结构化 (494 chars) + quality tags
- LLM 调用 ~2s, ~950 tokens
- billing_logs 正常写入 ¥0.01
- 详细报告: `docs/notes/REPORT_S61_LLM_PROMPT.md`

**相关文件**:
- `apps/server/src/prompts/videoAgentSystem.ts` (新建)
- `apps/server/src/services/videoAgentService.ts` (改 processTurn)

---


*新发现问题请按此格式追加到文档末尾。*
