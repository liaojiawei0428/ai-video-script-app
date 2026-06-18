# V3.0.0 方案调研报告 — GitHub 开源项目横向对比

> **目标**: 找出现有项目里"多 Agent + 多轮澄清 + 异步任务 + 流式输出"的最优解
>
> **方法**: 6 类搜索 + 4 个项目深读 + 提取可借鉴模式
>
> **结论**: **4 个核心借鉴 + 1 个反例** , V3 方案需要从"自创状态机"升级为"参照业界最佳实践"
>
> **版本**: v1.0 (2026-06-09)

---

## 0. 调研结论速览 (TL;DR)

| 借鉴点 | 来源项目 | V3 方案调整 |
|---|---|---|
| **🥇 UIMessage.parts 消息格式** | Vercel AI SDK + LobeChat | 消息从 `{content: string}` 升级为 `{parts: [{type, ...}]}`, 让单条消息混合文字+图片+计划+视频+进度 |
| **🥇 工具状态机显式化** | Vercel AI SDK tool state machine | 状态从 7 个扩到 9 个, 把"executing"拆成"queued/progress/done"三态 |
| **🥇 LLM 自适应澄清** | LobeChat Agent Builder | Agent 不再按固定 8 步问, LLM 自适应问 1-2 个关键问题后直接进 plan_ready |
| **🥇 SSE 流式输出** | Vercel AI SDK streamText | AI 文字助手支持 `?stream=true`, 前端 typewriter 效果 |
| **🥇 WS 协议标准化** | ComfyUI WS protocol | 视频进度消息类型细分 (subscribe/update/completed/failed/ping/pong) |
| **❌ 不引 LangGraph** | LangGraph | MySQL 行 + interrupt 状态就够, 引框架成本不划算 |
| **❌ 不引 AutoGen** | AutoGen | 我们不需要 AI 互相对话, AI 是引导者 |

---

## 1. 调研样本 (6 类 + 4 深读)

### 1.1 第一轮: 6 类广搜 (28 个结果)
- **LangGraph** (langchain-ai/langgraph) — 状态机 / checkpoint / HITL
- **AutoGen** (microsoft/autogen) — 对话式多 Agent
- **CrewAI** — 角色式多 Agent
- **Dify** (langgenius/dify) — DAG + 异步事件 + Multi-Agent
- **LobeChat** (lobehub/lobe-chat) — 多模型 Agent UI
- **Vercel AI SDK** (vercel/ai) — useChat + 工具调用 + 流式
- **MoneyPrinterTurbo** (harry0703/MoneyPrinterTurbo) — 视频自动生成 MVC
- **ComfyUI** (comfyanonymous/ComfyUI) — 节点 + WebSocket 实时进度

### 1.2 第二轮: 4 个深读
- ✅ **Vercel AI SDK** README + useChat 用法 (webfetch github.com 成功)
- ✅ **LobeChat** README + 架构 (raw.githubusercontent.com 成功)
- ⚠️ **Dify / ComfyUI / MoneyPrinterTurbo** GitHub 主页 webfetch 超时, 用搜索摘要 + 第三方文章分析

### 1.3 选样标准
- 跟我们 V3 方案的 6 个核心痛点 (多 Agent / 多轮澄清 / 持久化 / 异步任务 / 流式 / 进度推送) 高度相关
- 生产级 (Star > 1k) + 持续维护 + 文档完整

---

## 2. 5 个项目的架构模式对比

| 维度 | **Dify** (⭐10k+) | **LobeChat** (⭐10k+) | **Vercel AI SDK** (⭐24.7k) | **MoneyPrinterTurbo** (⭐23k) | **ComfyUI** (⭐30k+) |
|------|------|------|------|------|------|
| **核心定位** | 低代码 AI 应用平台 | 多模型 Agent UI 框架 | TS 流式 + 工具调用 SDK | 一键 AI 视频生成 | 节点式扩散模型 GUI |
| **多 Agent 架构** | DAG + 异步事件总线 | "Agents as unit of work" + Agent Groups + IM Gateway | `ToolLoopAgent` (单 agent + 工具链) | MVC + 模块化 service | 节点图 (自由编排) |
| **状态持久化** | workflow_run 表 + context snapshot | 消息历史 + Personal Memory (白盒可编辑) | `useChat` Hook 自动管 messages | SQLite/JSON 任务队列 | 节点图 JSON 文件 |
| **多轮澄清** | ✅ workflow 节点 (LLM Router 输出 schema) | ✅ Agent Builder 一次性配置 + 自动引导 | ❌ useChat 是单轮 | ❌ 无澄清, 一次性输入 | ❌ 无 |
| **异步任务** | ✅ 异步事件驱动 (NATS JetStream) | ✅ Schedule agent run | ❌ 主要流式 | ✅ 任务队列 + 批量调度 | ✅ 节点队列 |
| **流式输出** | ✅ SSE | ✅ (Next.js Edge) | ✅ **toUIMessageStreamResponse (gold standard)** | ✅ 进度回调 | ✅ |
| **WebSocket 进度** | ✅ 任务状态推送 | ✅ IM Gateway | ❌ 用 SSE | ✅ 进度回调 | ✅ **3 类消息 (status/progress/executing)** |
| **工具调用** | 50+ 工具 + MCP | 10,000+ skills + MCP 兼容 | tools + execute + state machine | LLM 模块适配 (16+ 提供商) | 自定义节点 |
| **可观测性** | Trace ID + 仪表盘 + LLMOps | 日志 + LangSmith 兼容 | 实验性 throttle + 完整 UIMessage | 日志 + config.toml | UI 可视化 |
| **消息格式** | UIMessage-like (parts) | UIMessage-like (parts) | **UIMessage (gold standard)**: text/file/tool-*/reasoning/data-* | 内部 dict | 节点 JSON |
| **生产部署** | Docker Compose / K8s | Vercel / Docker / 阿里云 | npm lib | Docker / Windows 一键包 | Python / Docker |
| **我们的契合度** | 🟡 后续 v3.1+ 多 Agent 协同 | 🟢 极契合 | 🟢 **核心借鉴** | 🟡 业务参考 | 🟢 视频进度借鉴 |

---

## 3. 核心借鉴模式 (5 个)

### 3.1 🥇 UIMessage.parts 消息格式 (Vercel + LobeChat)

**问题**: 我们 V3 方案用 `content: string` 存消息, 但生图/视频 Agent 需要在同一气泡里展示: AI 文字 + 方案卡片 + 生成的图 + 视频 + 进度条。字符串做不到。

**Vercel 的解法** (从 README + useChat 文档):
```ts
interface UIMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  metadata?: unknown;
  parts: Array<UIMessagePart>;
}

type UIMessagePart =
  | { type: 'text', text: string }                                    // 文字
  | { type: 'file', file: { name, contentType, url } }                // 文件/图片
  | { type: 'tool-{toolName}', toolCallId, state, input, output }     // 工具调用
  | { type: 'reasoning', text: string }                               // AI 思考 (Thinking mode)
  | { type: 'data-{typeName}', data: unknown };                       // 自定义数据
```

**LobeChat 的应用** (从 README):
> "Seamless access to any model and any modality—all under your control. Connect your agents to the skills you use every day with a library of over 10,000 tools and MCP-compatible plugins."

**应用到 V3**:
```ts
// apps/server/src/shared/types.ts
type AgentPart =
  | { type: 'text', text: string }
  | { type: 'image', url: string, role: 'reference' | 'result' }
  | { type: 'plan', data: PlanData }                          // 方案卡片
  | { type: 'question', data: QuestionData }                  // 询问
  | { type: 'progress', value: number, label?: string }      // 视频进度
  | { type: 'video', url: string, duration: number }         // 视频结果
  | { type: 'error', message: string };

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentPart[];          // ← 关键
  metadata?: { taskId?, stage? };
  createdAt: number;
}
```

**好处**:
- 同一个气泡里混合 text + plan + image + progress + video, 前端 `parts.map()` 一把梭
- AI 文字助手启用 Thinking 模式时, parts 里加 `reasoning` part 展示思考过程
- 多模态兼容 (未来加 image_url 也能复用)

### 3.2 🥇 工具状态机显式化 (Vercel AI SDK)

**问题**: 我们 V3 方案的 7 个状态 (idle/needs_clarification/plan_ready/confirmed/generating/completed/failed) 太粗, "generating" 这个状态跨度从 0% 到 100% 都是同一个, 用户不知道是"刚提交"还是"快完成"。

**Vercel 的解法** (tool state machine):
```
input-streaming      (用户打字中, UI 显示省略号)
  ↓ 用户发送
input-available      (消息已提交, UI 锁定输入框)
  ↓ AI 思考
ai-thinking          (启用 Thinking 模式, UI 显示"AI 思考中")
  ↓
ai-streaming         (AI 流式输出文字, typewriter)
  ↓
tool-calling         (AI 决定调工具, 如生图/视频)
  ↓
tool-input-available (任务已提交, 等 Agnes 返 taskId)
  ↓
tool-executing       (任务执行中, 轮询 progress)
  ↓
tool-output-available (完成, 显示结果)
tool-output-error    (失败, 显示错误)
```

**应用到 V3 状态机升级** (9 状态):
```ts
type ConversationStatus =
  | 'idle'                          // 初始
  | 'ai_clarifying'                 // AI 在问澄清问题
  | 'awaiting_clarification'        // 等用户回答
  | 'ai_planning'                   // AI 在生成方案
  | 'plan_ready'                    // 方案就绪, 等用户确认
  | 'awaiting_confirmation'         // 等用户点"确认生成"
  | 'tool_queued'                   // 已调 Agnes, 拿 taskId
  | 'tool_executing'                // 任务执行中 (WS 推送 progress)
  | 'tool_completed'                // 完成
  | 'tool_failed';                  // 失败 (可重试)
```

**好处**:
- 前端能渲染 9 种不同的 loading 状态 (从"AI 思考"到"任务排队"到"生成中 60%")
- 用户焦虑感降低 (ComfyUI 也是这么做的)
- 失败/重试/中断都明确

### 3.3 🥇 LLM 自适应澄清 (LobeChat Agent Builder)

**问题**: 我们 V3 方案是固定 8 步状态机 (问性别 → 问年龄 → 问风格 → ...)。如果用户第一句就给了 5 个关键信息, AI 还按部就班问 3 个, 体验差。

**LobeChat 的解法** (从 README):
> "You can describe what you need once, and the agent setup starts right away, applying auto-configurations so you can use it instantly."

**应用到 V3**:
System prompt 加引导:
```
你是"生图助手", 引导用户描述需求, 但**只问最关键的 1-2 个问题**。
不要按固定 8 步流程走。
如果用户已经说了 (性别, 年龄, 风格, 服装, 场景), 直接进入 plan_ready。
如果用户只说 "美女", 问 1 个关键问题 (风格: 写实/动漫/3D?), 然后进 plan_ready。
```

**实现**: 在 `imageAgentService.processTurn()` 里:
1. LLM 看完整 messages 上下文
2. 输出 JSON: `{status: 'clarify' | 'plan_ready' | 'confirmed', question?, plan?}`
3. 如果 status=clarify 且已有 1 个问题, 强制进 plan_ready (避免无限澄清)

**好处**:
- 3-4 轮就完成, 用户体验流畅
- 边界 (LobeChat 也是用 system prompt 强约束)

### 3.4 🥇 SSE 流式输出 (Vercel AI SDK streamText)

**问题**: 我们 V3 方案的 AI 文字助手是一次性返回, 2-10 秒空白, 用户以为卡死。

**Vercel 的解法** (`toUIMessageStreamResponse`):
```ts
// 后端 (Next.js)
import { streamText, convertToModelMessages } from 'ai';

const result = streamText({
  model: openai('gpt-4'),
  messages: convertToModelMessages(uiMessages),
  tools: { ... },
});
return result.toUIMessageStreamResponse({
  onFinish: ({ messages }) => { /* 存 DB */ },
});
```

**应用到 V3 (Express + Agnes 兼容)**:
- 后端: Express SSE endpoint `/api/chat/stream`
  ```ts
  app.post('/api/chat/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const agnesStream = await agnesTextProvider.streamChatCompletion({ ... });
    for await (const chunk of agnesStream) {
      res.write(`data: ${JSON.stringify({ type: 'text-delta', text: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  });
  ```
- 前端 (web): `fetch + ReadableStream` + DOM diff
- 前端 (RN): `fetch + ReadableStream` polyfill + `setState` 逐字追加

**注意**: Agnes 文档支持 `stream: true` (OpenAI 兼容), 但 Agnes 实际是否真的流式需要 curl 验证。

**好处**:
- AI 文字助手 typewriter 效果, 体验提升明显
- Thinking 模式 + 流式组合, 思考过程也能流式展示

### 3.5 🥇 WS 协议标准化 (ComfyUI + Vercel)

**问题**: 我们 V3 方案的 WS 只有 1 个 `task_update` 消息, 心跳/订阅/退订/重连都没设计。

**ComfyUI 的解法** (3 类消息):
- `status`: 系统状态 (队列剩余任务数)
- `progress`: 单节点进度 (current/max)
- `executing`: 节点开始/结束 (node_id/prompt_id)

**Vercel 的流式协议** (SSE):
```
event: start
data: {...}

event: text-delta
data: {"text": "AI "}

event: text-delta
data: {"text": "的回复"}

event: tool-input-available
data: {"toolCallId": "xxx", "toolName": "generateImage", "input": {...}}

event: tool-output-available
data: {"toolCallId": "xxx", "output": {...}}

event: finish
data: {...}
```

**应用到 V3 (WS)**:
```ts
// 后端
type WSServerMessage =
  | { type: 'task_update', task: { id, status, progress, message? } }
  | { type: 'task_completed', task: { id, resultUrl, metadata } }
  | { type: 'task_failed', task: { id, error } }
  | { type: 'pong' };

// 前端 → 后端
type WSClientMessage =
  | { type: 'subscribe', taskId: string }
  | { type: 'unsubscribe', taskId: string }
  | { type: 'ping' };
```

**配套机制**:
- 30s 心跳 (ping/pong)
- 客户端断线自动重连 + 重订阅
- 错误用 `task_failed` 单独通道, 不污染 update 流

**好处**:
- 协议清晰, 前端能区分"完成"和"失败"
- 心跳机制防死连接
- 订阅/退订阅灵活

---

## 4. 反例 (不借鉴)

### 4.1 ❌ 不引 LangGraph 框架

**理由**:
- LangGraph 核心价值 (Checkpoint / HITL / State Schema) 我们用 MySQL 行 + interrupt 状态就实现了
- 引 Python 框架要改 stack (我们 Node.js), 成本不划算
- LangGraph 学习曲线陡 (StateGraph 节点/边/条件路由), 团队上手慢

**我们用什么实现"状态机"**:
- MySQL 表 + `status` 字段 (借鉴 Dify 的 workflow_run 表)
- interrupt 状态 = `awaiting_clarification` / `awaiting_confirmation` (借鉴 Vercel tool state)
- DB 持久化 = LangGraph Checkpoint 的替代品 (更简单)

### 4.2 ❌ 不引 AutoGen 对话式多 Agent

**理由**:
- AutoGen 适合"多个 AI 专家互相对话、协商、辩论" (如代码生成 - 评审 - 修复)
- 我们 V3 不需要 AI 互相对话, AI 是"引导者", 用户是"决策者"
- AutoGen 调试难 (需分析完整对话), 不适合生产

### 4.3 ❌ 不引 Dify DAG 复杂路由

**理由**:
- Dify 适合"复杂工作流 (客服/风控/数据处理) + 异构 Agent 协同"
- 我们 V3 是"线性 + 1-2 个条件路由" (clarify 循环 + 确认 + 执行)
- 当前引 DAG 框架是 over-engineered

**未来 v3.1+ 再考虑 Dify 模式**:
- 场景: 生图 Agent → 视频 Agent 协同 (先生图再视频)
- 实现: 用我们自己的 state machine + event bus, 不引入外部框架

### 4.4 ❌ 不引 ComfyUI 节点式架构

**理由**:
- ComfyUI 适合"高自由度创作工具 (用户拖节点编排)"
- 我们 V3 是"预定义流程 (引导 → 确认 → 执行)", 不需要用户自由编排
- 节点式 UI 复杂度高, 不适合移动端

**借鉴 ComfyUI 的点**: WS 消息协议 (见 3.5)

---

## 5. V3 方案调整清单 (从 V1.0 → V2.0)

### 5.1 架构层调整

| 项 | V1.0 (原方案) | V2.0 (借鉴后) | 借鉴自 |
|---|---|---|---|
| 消息数据格式 | `{role, content, imageUrls}` | **`{id, role, parts: [...], metadata}`** | Vercel + LobeChat |
| 状态机 | 7 状态 | **9 状态 (含 ai_*/tool_*/awaiting_*)** | Vercel tool state |
| Agent 引导 | 固定 8 步 | **LLM 自适应 (1-2 关键问题)** | LobeChat Agent Builder |
| AI 助手输出 | 一次性 | **SSE 流式 (text-delta)** | Vercel streamText |
| 视频进度 | task_update 单一 | **typed WS 协议 (subscribe/update/completed/failed/ping/pong)** | ComfyUI + Vercel |
| 多 Agent 协同 | ❌ | **⏸ v3.1+ 再设计** (Dify DAG 模式) | Dify |
| 后端分层 | 一对一 service | **清晰三层: agent / service / provider** | MoneyPrinterTurbo |
| 配置文件 | hardcoded | **`config.toml` 集中管理** | MoneyPrinterTurbo |
| 持久化检查点 | MySQL 行 | **MySQL 行 (够用, 不引 LangGraph)** | 自己的设计 |

### 5.2 工程实践调整

| 项 | V1.0 | V2.0 |
|---|---|---|
| WS 心跳 | 无 | **30s ping/pong + 自动重连** |
| 视频任务失败 | 单状态 (failed) | **保留 task_failed 单独通道, 可重试 (最多 3 次)** |
| 工具调用状态 | 隐式 | **显式 4 态 (queued / executing / completed / failed)** |
| LLM 输出 | JSON 强约束 (容易 parse 失败) | **JSON 模式 + Zod schema 校验 + fallback (解析失败默认 plan_ready)** |
| 前端 chat 组件 | useState 自己管 | **封装 `useAgentChat` Hook (类似 useChat)**, 内置流式 + 重试 + 滚动 |
| 移动端 SSE | ❌ 不支持 | **fetch + ReadableStream polyfill** |

### 5.3 风险缓解 (新增)

| 风险 | V2.0 缓解 |
|---|---|
| **LobeChat "10,000+ skills" 太重** | 我们只做 3 个 Agent (text/image/video), 不需要插件市场 |
| **Vercel useChat 是 React Hook, 不能直接用** | 我们手写一个 useAgentChat (参考 API 兼容, 30 行内) |
| **Dify 的 DAG 配置复杂** | 我们用代码定义 state machine, 不用 YAML |
| **ComfyUI WS 协议太细** | 简化为 6 种消息类型 (subscribe/unsubscribe/task_update/task_completed/task_failed/ping/pong) |

---

## 6. 借鉴模式落地路径 (4 阶段)

### 阶段 1: 基础设施升级 (与 V3 Phase A 合并)
- DB schema 加 `parts` JSON 字段 (替换 `content` 字段)
- 后端引入 `config.toml`
- 前端封装 `useAgentChat` Hook
- 升级 WebSocket 到 6 类消息协议

### 阶段 2: AI 文字助手升级
- System prompt 加 "流式输出" 标记
- 启用 Agnes `stream: true` + `chat_template_kwargs.enable_thinking: true`
- 后端加 `/api/chat/stream` SSE endpoint
- 前端 typewriter 效果 + 思考过程展示 (parts.reasoning)

### 阶段 3: 生图 Agent 升级
- LLM 自适应澄清 (替换固定 8 步)
- 用 UIMessage.parts 嵌入 plan 卡片 + reference 图 + 结果图
- 状态机扩到 9 态

### 阶段 4: 视频 Agent 升级
- typed WS 协议 (subscribe/unsubscribe/update/completed/failed/ping/pong)
- 30s 心跳 + 自动重连
- 用 parts.progress 嵌进度条 + parts.video 嵌播放器
- 失败可重试 3 次

---

## 7. 不动的部分 (确认稳定)

- 三个 API 端点 (校准后 OK, 见 V3_AGENT_MATRIX.md §1)
- 严格 module 隔离 (3 个 agent 互不调, 见 §7)
- 4 张新表 schema (image_conversations / image_generations / video_conversations / video_generations)
- 顶部 nav 顺序 (书架-进度-生图-视频-AI助手-充值)
- 计费占位策略
- 视频时长选项 5s/10s/15s
- 7 阶段实施计划 (A→G), 时间估 7-9 工作日

---

## 8. 一句话总结

> **从"自创状态机"升级为"参照业界最佳实践"**: 用 Vercel 的 UIMessage.parts + tool state machine + SSE 流式, 用 LobeChat 的 LLM 自适应澄清, 用 ComfyUI 的 WS 协议, 用 MoneyPrinterTurbo 的 MVC 分层, **不引任何外部框架** (LangGraph/AutoGen/DAG), MySQL 行 + Node.js 状态机自己实现。

---

## 附录 A: 调研清单

| # | 项目 | URL | Star | 调研深度 | 借鉴价值 |
|---|---|---|---|---|---|
| 1 | Vercel AI SDK | https://github.com/vercel/ai | 24.7k | README + useChat API | 🥇🥇🥇 核心 |
| 2 | LobeChat (lobehub) | https://github.com/lobehub/lobe-chat | 10k+ | README + 架构 | 🥇🥇 Agent Builder |
| 3 | MoneyPrinterTurbo | https://github.com/harry0703/MoneyPrinterTurbo | 23k | 搜索摘要 + 架构解析 | 🥈 MVC + 任务队列 |
| 4 | Dify | https://github.com/langgenius/dify | 10k+ | 搜索摘要 + 源码解析文章 | 🥈 v3.1+ 借鉴 |
| 5 | ComfyUI | https://github.com/comfyanonymous/ComfyUI | 30k+ | 搜索摘要 + WS 协议分析 | 🥇 WS 协议 |
| 6 | LangGraph | https://github.com/langchain-ai/langgraph | - | 搜索摘要 | ❌ 不引 (成本不划算) |
| 7 | AutoGen | https://github.com/microsoft/autogen | - | 搜索摘要 | ❌ 不引 (场景不匹配) |
| 8 | CrewAI | - | - | 搜索摘要 | ❌ 不引 (角色式不匹配) |
