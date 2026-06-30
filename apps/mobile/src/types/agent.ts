// apps/mobile/src/types/agent.ts
// v3.0.0: 本地 mirror agent types (跟 server shared/types.ts:444-462 同步)
// 原因: monorepo 没有 shared package, web/mobile 各自定义 mirror 类型
// 真源: apps/server/src/shared/types.ts (请保持字段 1:1 对齐)

// v3.0.24 (S60 P2 BUG-041/042): 跟 web AgentChatPanel PartView 1:1 对齐
// - 加 streaming (UI: 生成中 loading 卡片)
// - plan fields 加 cnDescription (image 端中文字段用)
export type AgentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; role: 'reference' | 'result'; width?: number; height?: number }
  | { type: 'plan'; data: PlanData }
  | { type: 'question'; data: QuestionData }
  | { type: 'progress'; value: number; label?: string }
  | { type: 'video'; url: string; duration: number; width?: number; height?: number; coverUrl?: string }
  | { type: 'streaming'; stage: 'translating' | 'generating' }
  | { type: 'error'; message: string };

export interface PlanData {
  prompt: string;
  aspectRatio?: string;
  style?: string;
  refImageUrls?: string[];
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  estimatedCost?: number;
  // v3.0.58 (BUG-128 followup): 跨端 1:1 镜像 (server + web + mobile PlanData 同步)
  negativePrompt?: string;
  refImageCount?: number;
}

export interface QuestionData {
  question: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentPart[];
  metadata?: { taskId?: string; stage?: string };
  createdAt: number;
}

export type AgentConversationStatus =
  | 'idle' | 'ai_clarifying' | 'awaiting_clarification' | 'ai_planning'
  | 'plan_ready' | 'awaiting_confirmation' | 'tool_queued' | 'tool_executing'
  | 'tool_completed' | 'tool_failed';
