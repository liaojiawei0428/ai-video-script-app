# V3.0.0 Agent 矩阵扩展 方案文档 V2.0

> **基线**: v2.5.36 已部署生产 (159.75.16.110)
>
> **目标**: 扩展出 "AI 助手 / 生图 Agent / 视频 Agent" 三个独立 Agent 板块
>
> **V2.0 调整** (2026-06-09, 参照 V3_RESEARCH_BENCHMARK.md 调研结论):
> 1. 消息格式升级 → UIMessage.parts 数组 (Vercel + LobeChat)
> 2. 状态机 7 态 → 9 态 (Vercel tool state machine)
> 3. 引导方式 → LLM 自适应澄清 (LobeChat Agent Builder)
> 4. AI 助手加 SSE 流式输出 (Vercel streamText)
> 5. 视频 WS 协议 typed 化 (ComfyUI + Vercel)
> 6. 错误重试 + 心跳机制
> 7. 后端三层分层: agent / service / provider (MoneyPrinterTurbo)
> 8. config.toml 集中配置 (MoneyPrinterTurbo)

---

## 0. 核心决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| AI 助手文本模型 | **Agnes-2.0-Flash** | 端点 `https://apihub.agnes-ai.com/v1/chat/completions`, 支持 SSE + Thinking |
| 生图模型 | **Agnes Image 2.1 Flash** | 已实接, 修复字段 + `extra_body.response_format` |
| 生视频模型 | **Agnes Video V2.0** | 异步任务模式 (新) |
| 三个 Agent 的边界 | **互相隔离** | module 隔离 + system prompt 强约束 |
| Agent 多轮对话 | **持久化到 DB** | 状态机驱动, 刷新可恢复 |
| 消息格式 | **UIMessage.parts 数组** | Vercel + LobeChat 标准, 单气泡混合多模态 |
| 状态机 | **9 态 (含 tool 三态 + awaiting 二态)** | Vercel tool state machine |
| 引导方式 | **LLM 自适应澄清 (1-2 关键问题)** | LobeChat Agent Builder |
| AI 助手输出 | **SSE 流式 + Thinking 模式** | Vercel streamText |
| 视频进度 | **typed WS 协议 + 30s 心跳 + 自动重连** | ComfyUI + Vercel |
| 计费 | **占位 ¥0.01-1.00** (上游 Agnes 当前免费) | 代码保留计费逻辑 |
| 多 Agent 协同 | **⏸ v3.1+ 再设计** (Dify DAG 模式) | 当前 v3.0 不引外部框架 |

---

## 0.5 V2.0 关键升级 (对比 V1.0)

### 升级 1: 消息格式 (UIMessage.parts)

**V1.0** (旧):
```ts
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrls?: string[];
  timestamp: number;
}
```

**V2.0** (新, 借鉴 Vercel + LobeChat):
```ts
// apps/server/src/shared/types.ts
type AgentPart =
  | { type: 'text', text: string }
  | { type: 'image', url: string, role: 'reference' | 'result' }
  | { type: 'plan', data: PlanData }                           // 方案卡片
  | { type: 'question', data: QuestionData }                    // AI 询问
  | { type: 'progress', value: number, label?: string }         // 视频进度
  | { type: 'video', url: string, duration: number }            // 视频结果
  | { type: 'error', message: string };

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentPart[];                                          // ← 关键
  metadata?: { taskId?: string, stage?: string };
  createdAt: number;
}
```

**好处**:
- 单气泡可混合 text + plan + image + progress + video, 前端 `parts.map()` 一把梭
- AI 文字助手启用 Thinking 模式时, parts 加 `{type:'reasoning', text:...}` 展示思考过程
- 多模态兼容 (未来加 image_url 也能复用)

### 升级 2: 状态机 (9 态)

**V1.0** (旧, 7 态):
```
idle → needs_clarification → plan_ready → confirmed → generating → completed/failed
```

**V2.0** (新, 9 态, 借鉴 Vercel):
```ts
// apps/server/src/shared/types.ts
type ConversationStatus =
  | 'idle'                    // 初始
  | 'ai_clarifying'           // AI 在问澄清问题 (LLM 思考中)
  | 'awaiting_clarification'  // 等用户回答
  | 'ai_planning'             // AI 在生成方案 (LLM 思考中)
  | 'plan_ready'              // 方案就绪, 等用户确认
  | 'awaiting_confirmation'   // 等用户点"确认生成"
  | 'tool_queued'             // 已调 Agnes, 拿 taskId, 等待执行
  | 'tool_executing'          // 任务执行中 (WS 推送 progress)
  | 'tool_completed'          // 完成
  | 'tool_failed';            // 失败 (可重试, 最多 3 次)
```

**对应 UI 渲染**:
| 状态 | 前端显示 |
|---|---|
| `ai_clarifying` | "AI 思考中..." + spinner |
| `awaiting_clarification` | AI 气泡 (含 question part) + 输入框激活 |
| `ai_planning` | "AI 正在规划方案..." + spinner |
| `plan_ready` | AI 气泡 (含 plan part 卡片) + [确认] [调整] 按钮 |
| `awaiting_confirmation` | 同上 (用户点确认后转 tool_queued) |
| `tool_queued` | "任务已提交, 排队中..." |
| `tool_executing` | 进度条 (progress part) + "生成中 60%" |
| `tool_completed` | AI 气泡 (含 image/video part) + [下载] [微调] 按钮 |
| `tool_failed` | 错误气泡 + [重试] 按钮 |

### 升级 3: 引导方式 (LLM 自适应)

**V1.0** (旧): 固定 8 步状态机 (问性别 → 问年龄 → 问风格 → ...)

**V2.0** (新, 借鉴 LobeChat Agent Builder):
```
System Prompt 加引导:
你是"生图助手", 引导用户描述需求, **只问最关键的 1-2 个问题**。
不要按固定 8 步流程走。
如果用户已经说了 (性别, 年龄, 风格, 服装, 场景), 直接进入 plan_ready。
如果用户只说 "美女", 问 1 个关键问题 (风格: 写实/动漫/3D?), 然后进 plan_ready。
```

**实现**: 在 `imageAgentService.processTurn()` 里:
1. LLM 看完整 messages 上下文
2. 输出 JSON: `{status: 'clarify' | 'plan_ready' | 'confirmed', question?, plan?}`
3. **强制保险**: 如果 `clarify` 累计超过 3 次, 强制 `plan_ready` (避免无限澄清)

**预期效果**: 3-4 轮完成, 用户体验流畅。

### 升级 4: AI 助手 SSE 流式输出

**V1.0** (旧): 一次性返回

**V2.0** (新, 借鉴 Vercel streamText):
- 后端加 `/api/chat/stream` SSE endpoint
- 前端 typewriter 效果
- Agnes 支持 `stream: true` (OpenAI 兼容)

**SSE 协议** (借鉴 Vercel UIMessage chunks):
```
event: start
data: {"messageId": "msg_xxx"}

event: text-delta
data: {"text": "AI "}

event: text-delta
data: {"text": "的回复"}

event: reasoning-delta          (启用 Thinking 时)
data: {"text": "先想想..."}

event: finish
data: {"usage": {"promptTokens": 35, "completionTokens": 58}}
```

### 升级 5: 视频 WS 协议 (typed)

**V1.0** (旧): `task_update` 单一消息

**V2.0** (新, 借鉴 ComfyUI + Vercel):
```ts
// 后端 → 前端
type WSServerMessage =
  | { type: 'task_update', task: { id, status, progress, message? } }
  | { type: 'task_completed', task: { id, resultUrl, metadata } }
  | { type: 'task_failed', task: { id, error, retryable: boolean } }
  | { type: 'pong' };

// 前端 → 后端
type WSClientMessage =
  | { type: 'subscribe', taskId: string }
  | { type: 'unsubscribe', taskId: string }
  | { type: 'ping' };
```

**配套**:
- 30s 心跳 (ping/pong), 防死连接
- 客户端断线自动重连 + 重订阅
- 失败用 `task_failed` 单独通道, 不污染 update 流
- 失败可重试 3 次 (前端按钮 + 后端限制)

### 升级 6: 错误重试 + 心跳

**V2.0 新增**:
- WS 心跳: 30s ping/pong
- 自动重连: 客户端断线 1s 后重连, 重连成功后重订阅所有 taskId
- 视频任务失败可重试 3 次 (同一 conversation 下)
- 失败原因分类: 网络错误 (retryable) / 余额不足 (not retryable) / 输入非法 (not retryable)

### 升级 7: 后端三层分层

**V1.0** (旧): 一对一 service

**V2.0** (新, 借鉴 MoneyPrinterTurbo MVC):
```
agent 层: 状态机驱动 + 业务规则 (imageAgent.ts, videoAgent.ts, textAgent.ts)
  ↓ 调用
service 层: 通用能力封装 (billingService, fileService, conversationService)
  ↓ 调用
provider 层: 上游 API 适配 (agnesTextProvider, agnesImageProvider, agnesVideoProvider)
```

**好处**:
- agent 不知道 provider 细节 (换上游不改 agent)
- provider 不知道业务 (通用, 可复用)
- service 跨 agent 共享 (计费, 文件, 会话)

### 升级 8: config.toml 集中配置

**V1.0** (旧): hardcoded 散落各处

**V2.0** (新, 借鉴 MoneyPrinterTurbo):
```toml
# apps/server/config.toml
[chat]
model = "agnes-2.0-flash"
max_tokens = 2048
temperature = 0.7
stream = true
enable_thinking = true

[image_agent]
default_aspect_ratio = "1024x1024"
max_clarify_rounds = 3
default_charging = 0.01

[video_agent]
default_duration = 5
default_width = 1152
default_height = 768
default_fps = 24
max_retry = 3

[websocket]
heartbeat_interval_ms = 30000
client_reconnect_delay_ms = 1000
```

---

## 1. 三个 API 的标准调用方式 (校准后)

### 1.1 Agnes-2.0-Flash (文本)

**端点**: `POST https://apihub.agnes-ai.com/v1/chat/completions`

**请求** (V2.0 启用流式 + Thinking):
```ts
{
  model: 'agnes-2.0-flash',
  messages: [
    { role: 'system', content: '...' },
    { role: 'user', content: '...' },
  ],
  temperature: 0.7,
  max_tokens: 2048,
  stream: true,                                     // ← V2.0 启用
  chat_template_kwargs: { enable_thinking: true },  // ← V2.0 启用
}
```

**支持能力 (本次用到的)**:
- ✅ Chat Completion + 多轮对话 + System Prompt
- ✅ 流式输出 (stream: true) — **V2.0 给 chat 用**
- ✅ Thinking 模式 (chat_template_kwargs) — **V2.0 提升意图识别**
- ✅ JSON 风格输出 — Zod schema 强约束
- ⏸️ 图片 URL 输入 (image_url) — 后续版本
- ⏸️ 工具调用 (tools) — 后续版本

### 1.2 Agnes Image 2.1 Flash (图片)

(同 V1.0, 不变)

### 1.3 Agnes Video V2.0 (视频)

(同 V1.0, 不变)

---

## 2. 现有代码修复清单 (必修)

### 2.1 agnesImageProvider.ts (V1.0 必修)

**字段修复**:
- `body.image_url` → `body.extra_body.image` (string[])
- 加 `body.extra_body.response_format: 'url'`
- 删 hack 前缀
- 多图支持: 整个数组传入

### 2.2 mobile AIAssistantScreen.tsx (V1.0 必修)

- 端点 `/chat/assistant` → `/chat`
- payload `{message, novelId, episodeId}` → `{messages: [...]}`

### 2.3 chatController.ts (V1.0 必修 + V2.0 增强)

**V1.0 切换**: deepseekPool → agnesTextProvider

**V2.0 新增**:
- 加 `/api/chat/stream` SSE endpoint
- 加 Thinking 模式开关
- 集成 Zod schema 校验 LLM 输出
- 加 prompt caching (相同 system prompt 缓存, 节省成本)

---

## 3. 顶部导航栏 (同 V1.0)

(V1.0 顺序不变: 书架-进度-生图-视频-AI助手-充值)

---

## 4. AI 文字助手 (V2.0 升级)

### 4.1 位置
- 后端: `apps/server/src/services/agnesTextProvider.ts` (新)
- 后端: `apps/server/src/controllers/chatController.ts` (改造)
- 集成: 替换 deepseek 调用

### 4.2 System Prompt (强边界)
```
你是 Deep剧本 的 AI 文字助手, 只能回答文字问题。
能力: 润色剧本对白、剧情结构建议、角色塑造指导、镜头分镜优化、文案生成。
边界: 不能调生图/视频 API, 不能生成图片/视频内容。
如果用户要求生图: 回复"请去'生图'板块, 我无法直接生成图片"。
如果用户要求视频: 回复"请去'视频'板块, 我无法直接生成视频"。
```

### 4.3 V2.0 启用流式

**后端** (Express + Agnes stream):
```ts
// apps/server/src/controllers/chatController.ts
export const chatStreamHandler = async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { messages } = req.body;
  const agnesStream = await agnesTextProvider.streamChatCompletion({
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    stream: true,
    chat_template_kwargs: { enable_thinking: true },
  });

  res.write(`event: start\ndata: ${JSON.stringify({ messageId: genId() })}\n\n`);

  for await (const chunk of agnesStream) {
    if (chunk.type === 'reasoning') {
      res.write(`event: reasoning-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
    } else if (chunk.type === 'text') {
      res.write(`event: text-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
  }

  res.write(`event: finish\ndata: ${JSON.stringify({ usage: ... })}\n\n`);
  res.end();
};
```

**前端 (web)** — 封装 `useAgentChat` Hook:
```ts
// apps/web/src/hooks/useAgentChat.ts
import { useState, useCallback } from 'react';

export function useAgentChat(conversationId: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<'ready' | 'streaming' | 'error'>('ready');

  const sendMessage = useCallback(async (userInput: string) => {
    setStatus('streaming');
    const res = await fetch('/api/chat/stream', { method: 'POST', body: JSON.stringify({ messages: [..., userInput] }) });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aiMessage: AgentMessage = { id: genId(), role: 'assistant', parts: [], createdAt: Date.now() };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event: text-delta')) {
          const data = JSON.parse(line.split('data: ')[1]);
          // append to last part of type 'text' OR create new
          const lastPart = aiMessage.parts[aiMessage.parts.length - 1];
          if (lastPart?.type === 'text') lastPart.text += data.text;
          else aiMessage.parts.push({ type: 'text', text: data.text });
          setMessages([...prev, aiMessage]);
        }
      }
    }
    setStatus('ready');
  }, [conversationId]);

  return { messages, status, sendMessage };
}
```

**前端 (RN mobile)** — 同 useAgentChat, 用 fetch + ReadableStream polyfill

### 4.4 计费

V2.0 同 V1.0: 文字聊天免费 (只计 agent 调用的图片/视频)

---

## 5. 生图 Agent (V2.0 升级)

### 5.1 状态机 (9 态, 已在 §0.5 定义)

### 5.2 LLM 自适应澄清 (V2.0 升级)

**System Prompt** (V2.0):
```
你是"生图助手", 引导用户描述生成图片的需求。

**核心规则**:
1. 每次只问 1 个最关键的问题, 不要罗列
2. 如果用户已经说了足够信息 (性别/年龄/风格/服装/场景/构图), 直接进 plan_ready
3. 累计 clarifications 超过 3 次, 强制进 plan_ready
4. 输出必须 JSON: 
   { "status": "clarify"|"plan_ready", "question": "...", "plan": {...} }

plan 包含: 
- prompt (英文, 用于调 agnes image API)
- aspectRatio (1:1 / 16:9 / 9:16)
- style (写实/动漫/3D/油画)
- refImageUrls (用户上传的参考图)
- estimatedQuality
```

**Service 实现** (V2.0):
```ts
// apps/server/src/services/imageAgentService.ts
export class ImageAgentService {
  async processTurn(conversationId: string, userInput: string): Promise<AgentMessage> {
    const conv = await this.conversationRepo.get(conversationId);
    const userMessage: AgentMessage = { 
      id: genId(), 
      role: 'user', 
      parts: [{ type: 'text', text: userInput }], 
      createdAt: Date.now() 
    };
    conv.messages.push(userMessage);

    // LLM 自适应引导
    const llmResponse = await agnesTextProvider.chatCompletion({
      system: IMAGE_AGENT_SYSTEM_PROMPT,
      messages: conv.messages.map(m => ({ role: m.role, content: m.partsToText() })),
      responseFormat: 'json',
    });
    const decision = z.object({
      status: z.enum(['clarify', 'plan_ready']),
      question: z.string().optional(),
      plan: z.object({
        prompt: z.string(),
        aspectRatio: z.string(),
        style: z.string(),
        refImageUrls: z.array(z.string()).default([]),
      }).optional(),
    }).parse(JSON.parse(llmResponse.content));

    // 强制保险: 超过 3 次 clarify 强制 plan_ready
    const clarifyCount = conv.messages.filter(m => 
      m.parts.some(p => p.type === 'question')
    ).length;
    if (clarifyCount >= 3 && decision.status === 'clarify') {
      decision.status = 'plan_ready';
      decision.question = undefined;
    }

    // 构造 AI message (with parts)
    const aiMessage: AgentMessage = {
      id: genId(),
      role: 'assistant',
      parts: decision.status === 'clarify' 
        ? [{ type: 'question', data: { question: decision.question } }]
        : [
            { type: 'plan', data: decision.plan! },
            { type: 'text', text: '方案已就绪, 请确认或调整:' },
          ],
      createdAt: Date.now(),
    };
    conv.messages.push(aiMessage);
    conv.status = decision.status === 'clarify' ? 'awaiting_clarification' : 'plan_ready';
    await this.conversationRepo.update(conv);

    return aiMessage;
  }

  async confirm(conversationId: string): Promise<{ taskId: string }> {
    const conv = await this.conversationRepo.get(conversationId);
    if (conv.status !== 'plan_ready') throw new Error('Invalid status');
    const plan = conv.messages.lastPlanPart();
    
    // 余额守门
    await billingService.guard(conv.userId, config.image_agent.default_charging);
    
    // 调 agnes image
    conv.status = 'tool_queued';
    await this.conversationRepo.update(conv);
    
    const result = await agnesImageProvider.generate({
      prompt: plan.prompt,
      refImages: plan.refImageUrls,
      aspectRatio: plan.aspectRatio,
    });
    
    if (result.status === 'completed') {
      conv.status = 'tool_completed';
      conv.resultImageUrl = result.url;
      await billingService.charge(conv.userId, config.image_agent.default_charging, 'image_agent');
    } else {
      conv.status = 'tool_failed';
    }
    await this.conversationRepo.update(conv);
    return { taskId: result.taskId };
  }
}
```

### 5.3 API 设计
```
POST /api/image-agent/chat             // 引导对话 (LLM 思考 + 1-2 轮澄清)
POST /api/image-agent/upload           // 上传参考图 (multipart, 压缩到 ≤ 2MB)
POST /api/image-agent/confirm          // 用户确认 → 调 agnes image
GET  /api/image-agent/history          // 历史会话
GET  /api/image-agent/:id              // 会话详情 (含 status + messages.parts)
```

### 5.4 DB Schema (V2.0, parts 数组)
```sql
CREATE TABLE image_conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  status VARCHAR(30) DEFAULT 'idle',  -- 9 态之一
  mode VARCHAR(20) DEFAULT 'text2img',
  messages JSON,                       -- AgentMessage[] with parts
  plan JSON,
  result_image_url TEXT,
  aspect_ratio VARCHAR(20),
  style_id VARCHAR(36),
  charged_amount DECIMAL(10,2) DEFAULT 0,
  error_msg TEXT,
  retry_count INT DEFAULT 0,           -- V2.0 新增
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_img_conv_user (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 5.5 计费 (同 V1.0)
| 模式 | 价格 (占位) |
|---|---|
| 文生图 (t2i) | ¥0.01/张 |
| 图生图 (i2i) | ¥0.02/张 |
| 多图参考 (multi_ref) | ¥0.02/张 |
| 方案对话 | 免费 |

### 5.6 前端 (V2.0: parts.map 渲染)

布局 (复用 AIAssistantPage 模板, V2.0 改用 useAgentChat):
```
+----------------------------------------+
| [顶部: 返回] 生图助手   [历史]        |
+----------------------------------------+
| 聊天区 (parts.map 渲染)              |
| AI: parts = [                         |
|   { type: 'question', data: {         |
|     question: "风格: 写实/动漫/3D?"   |
|   } }                                 |
| ]                                     |
| User: parts = [                       |
|   { type: 'text', text: "..." },      |
|   { type: 'image', url: "ref1.png",   |
|     role: 'reference' }               |
| ]                                     |
| AI: parts = [                         |
|   { type: 'plan', data: {             |
|     prompt: "A beautiful...",        |
|     aspectRatio: "1:1",               |
|     style: "写实"                     |
|   } },                                |
|   { type: 'text', text: "方案已就绪" }|
| ]                                     |
+----------------------------------------+
| [输入框: 描述你的需求...]   [发送]   |
+----------------------------------------+
| [方案卡片 (plan part) when plan_ready]|
| [确认生成] [调整]                     |
+----------------------------------------+
| [结果卡片 (image part) when completed]|
| [下载] [重新生成] [微调]              |
+----------------------------------------+
```

---

## 6. 视频 Agent (V2.0 升级)

### 6.1 状态机 (9 态, 同 §0.5)

### 6.2 typed WS 协议 (V2.0)

```ts
// apps/server/src/services/websocket.ts 扩展
type WSServerMessage =
  | { type: 'task_update', task: { id: string, status: 'queued'|'in_progress', progress: number, message?: string } }
  | { type: 'task_completed', task: { id: string, resultUrl: string, metadata?: any } }
  | { type: 'task_failed', task: { id: string, error: string, retryable: boolean } }
  | { type: 'pong' };

type WSClientMessage =
  | { type: 'subscribe', taskId: string }
  | { type: 'unsubscribe', taskId: string }
  | { type: 'ping' };
```

### 6.3 后端 polling 逻辑 (V2.0: setInterval + 心跳 + 重试)

```ts
// apps/server/src/services/videoAgentService.ts
export class VideoAgentService {
  async confirm(conversationId: string): Promise<{ taskId: string, videoId: string }> {
    const conv = await this.conversationRepo.get(conversationId);
    if (conv.status !== 'plan_ready') throw new Error('Invalid status');
    const plan = conv.messages.lastPlanPart();

    await billingService.guard(conv.userId, this.calcPrice(plan));

    // 创建任务
    const { taskId, videoId } = await agnesVideoProvider.createTask({
      prompt: plan.prompt,
      refImages: plan.refImageUrls,
      duration: plan.durationSec,
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
    });

    conv.status = 'tool_queued';
    conv.taskId = taskId;
    conv.videoId = videoId;
    await this.conversationRepo.update(conv);

    // 启动轮询 (5s 一次, 最多 10 分钟)
    this.startPolling(conversationId, videoId);

    return { taskId, videoId };
  }

  private startPolling(conversationId: string, videoId: string) {
    const MAX_ATTEMPTS = 120; // 10 分钟
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const result = await agnesVideoProvider.queryStatus(videoId);
        const conv = await this.conversationRepo.get(conversationId);

        if (result.status === 'completed') {
          clearInterval(interval);
          conv.status = 'tool_completed';
          conv.resultVideoUrl = result.videoUrl;  // remixed_from_video_id
          await this.conversationRepo.update(conv);
          await billingService.charge(conv.userId, ..., 'video_agent');
          websocketService.broadcast({ type: 'task_completed', task: { id: videoId, resultUrl: result.videoUrl } });
        } else if (result.status === 'failed') {
          clearInterval(interval);
          conv.retryCount = (conv.retryCount || 0) + 1;
          conv.status = conv.retryCount < 3 ? 'plan_ready' : 'tool_failed';
          await this.conversationRepo.update(conv);
          websocketService.broadcast({ 
            type: 'task_failed', 
            task: { id: videoId, error: result.error, retryable: conv.retryCount < 3 } 
          });
        } else {
          // in_progress
          conv.status = 'tool_executing';
          await this.conversationRepo.update(conv);
          websocketService.broadcast({ 
            type: 'task_update', 
            task: { id: videoId, status: 'in_progress', progress: result.progress } 
          });
        }
      } catch (err) {
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(interval);
          // 标失败
        }
      }
    }, 5000);
  }
}
```

### 6.4 心跳机制 (V2.0 新增)
- 服务端: 每 30s 推一次 `pong`
- 客户端: 收到 `pong` 重置心跳计时器
- 超时 (60s 无响应): 客户端主动重连 + 重订阅

### 6.5 重试机制 (V2.0 新增)
- 失败时 `retryCount` 自增
- < 3 次: 状态回到 `plan_ready`, 显示"重试" 按钮
- ≥ 3 次: 状态 `tool_failed`, 显示"已达最大重试次数"

### 6.6 API 设计
```
POST /api/video-agent/chat
POST /api/video-agent/upload
POST /api/video-agent/confirm
GET  /api/video-agent/:id/status        (轮询备选)
GET  /api/video-agent/history
GET  /api/video-agent/:id
```

### 6.7 DB Schema (V2.0, 同生图结构)
```sql
CREATE TABLE video_conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  status VARCHAR(30) DEFAULT 'idle',
  mode VARCHAR(20) DEFAULT 'text2vid',
  messages JSON,                            -- AgentMessage[] with parts
  plan JSON,
  result_video_url TEXT,
  duration_sec INT DEFAULT 5,
  resolution VARCHAR(20) DEFAULT '1152x768',
  fps INT DEFAULT 24,
  task_id VARCHAR(100),
  video_id VARCHAR(100),
  retry_count INT DEFAULT 0,                -- V2.0 新增
  charged_amount DECIMAL(10,2) DEFAULT 0,
  error_msg TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_vid_conv_user (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 6.8 计费 (同 V1.0)
| 模式 | 时长 | 价格 (占位) |
|---|---|---|
| 文生视频 | 5s/10s/15s | ¥0.25/0.50/0.75 |
| 图生视频 | 5s/10s | ¥0.40/0.80 |
| 多图参考 | 5s/10s | ¥0.50/1.00 |

### 6.9 前端 (V2.0: progress part 渲染)

布局 (类似生图 + 进度条 + 视频):
```
+----------------------------------------+
| [顶部: 返回] 视频助手   [历史]        |
+----------------------------------------+
| 聊天区 (parts.map)                     |
| AI: parts = [                          |
|   { type: 'plan', data: {...} },       |
|   { type: 'progress', value: 60 }      |
| ]                                      |
| AI: parts = [                          |
|   { type: 'video', url: '...',         |
|     duration: 5 }                      |
| ]                                      |
+----------------------------------------+
| [输入框] [发送]                        |
+----------------------------------------+
| [方案卡片 plan_ready]                  |
| 时长: [5s] [10s] [15s]                |
| [确认生成]                             |
+----------------------------------------+
| [进度条 tool_executing]                |
| ████████░░░░░░░ 60% (3/5 帧)         |
+----------------------------------------+
| [视频播放器 tool_completed]            |
| [下载] [重新生成] [微调]              |
+----------------------------------------+
```

---

## 7. 严格边界 (同 V1.0, 不变)

| 板块 | 允许调用的 API | module 隔离 |
|---|---|---|
| AI 文字助手 | `agnesTextProvider` | 只能 import text provider |
| 生图 Agent | `agnesImageProvider` | 只能 import image provider |
| 视频 Agent | `agnesVideoProvider` | 只能 import video provider |

---

## 8. 数据库 Schema 增量 (V2.0, parts JSON + retry_count)

(见 §5.4 / §6.7)

**迁移文件**: `apps/server/migrations/v3.0.0-add-agent-tables.sql`
- 4 张新表: image_conversations / image_generations / video_conversations / video_generations
- 关键字段: `messages JSON` (用 parts 数组) + `status VARCHAR(30)` (9 态) + `retry_count INT`

---

## 9. 实施计划 (V2.0, 估 8-10 工作日)

| 阶段 | 任务 | 估时 | 依赖 |
|---|---|---|---|
| **A** | **修 agnesImageProvider** (字段 + response_format) + 加 **agnesTextProvider** (含流式) + 切 chat (含 SSE) + 修 mobile endpoint + 加 **useAgentChat Hook** (web + RN) | 1.5d | - |
| **B** | 加 **config.toml** 集中配置 + 加 **prompt 模板 (3 个 agent)** + 加 **parts 数组类型定义** (shared/types.ts) | 0.5d | A |
| **C** | 生图 Agent 后端 (DB 迁移 + 9 态状态机 + LLM 自适应澄清 + Zod 校验) | 2d | A, B |
| **D** | 生图 Agent 前端 (web ImageAgentPage + mobile ImageAgentScreen + parts.map 渲染) | 1d | C |
| **E** | agnesVideoProvider + 视频 Agent 后端 (typed WS 协议 + 轮询 + 心跳 + 重试) | 2d | A, B |
| **F** | 视频 Agent 前端 (web VideoAgentPage + mobile VideoAgentScreen + 自动重连) | 1d | E |
| **G** | 顶部 nav 更新 (web Layout + mobile tab bar + 路由) | 0.5d | D, F |
| **H** | 联调 + 文档 (V3_AGENT_MATRIX.md V2.0) + 部署 v3.0.0 | 1d | G |

---

## 10. 风险 + 缓解 (V2.0)

| 风险 | V2.0 缓解 |
|---|---|
| **agness 文本 API 端点路径** 跟 OpenAI 兼容, 但实际 Agnes 是否真的支持 SSE 需 curl 测 | 实施 Phase A 时让用户 curl 测一下 sample 验证 |
| **现有 agnesImageProvider 字段名错** | 必修, 同步改 comicService |
| **Agnes 当前免费期** | 代码保留计费逻辑 |
| **视频生成 2-10 分钟** | 进度条 + WS 实时推送 + 心跳 |
| **多轮状态机持久化** | 充分测试 + 状态机单测 |
| **多参考图上传** | 前端压缩到 ≤ 2MB/张, 后端存 `uploads/agent-refs/{userId}/` |
| **视频 URL 在 `remixed_from_video_id` 字段** | agnesVideoProvider 内部取, 不让上层感知 |
| **Mobile 底部 6 tab** | icon-only + 短文字标签 |
| **V2.0 借鉴模式增加复杂度** | UIMessage.parts 是单一改动, 影响 1 个 type 文件; 9 态枚举清晰 |
| **WS 自动重连 + 心跳** | 前端封装 useWebSocket Hook, 30 行内 |
| **LLM 自适应可能死循环** | 强制保险: clarify 累计 3 次强制 plan_ready |
| **RN SSE 兼容性差** | fetch + ReadableStream polyfill (RN 0.72+ 支持) |

---

## 11. 确认项 (V1.0 + V2.0 全部 9 个)

V1.0 8 个全部不变, V2.0 新增第 9 个:
1-8. (同 V1.0)
9. ✅ **采用 V2.0 借鉴模式** (5 个核心借鉴 + 1 个反例, 见 §0.5)

**额外技术确认 (V2.0)**:
10. ✅ **RN 0.72+ 是否支持 fetch + ReadableStream SSE** — 实施 Phase A 时验证
11. ✅ **Agnes 文本 API 是否真的支持 stream + thinking** — 实施 Phase A 时 curl 测

---

## 附录: 借鉴模式来源

- Vercel AI SDK (24.7k⭐): github.com/vercel/ai
- LobeChat (10k+⭐): github.com/lobehub/lobe-chat
- MoneyPrinterTurbo (23k⭐): github.com/harry0703/MoneyPrinterTurbo
- ComfyUI (30k+⭐): github.com/comfyanonymous/ComfyUI
- Dify (10k+⭐): github.com/langgenius/dify (v3.1+ 再考虑)

完整调研报告见 `docs/V3_RESEARCH_BENCHMARK.md`。

---

> 本文档是 V3.0.0 Agent 矩阵扩展 V2.0 的唯一规范, 所有 AI 助手在实施前必须完整阅读。
> 实际实施时的代码细节由实施者按本方案 + 现有代码风格落地。
