/**
 * useAgentChat — v3.0.0 首次实现
 *
 * 借鉴 Vercel AI SDK `useChat` Hook API（messages / status / sendMessage / stop /
 * onFinish / onError），但适配我们自己的后端协议（Vercel AI SDK data stream
 * protocol 简化版 + 自定义 parts 数组）。
 *
 * 支持两种模式：
 *   1. 流式（默认，stream=true）：POST `/api/chat/stream`，解析 SSE 事件
 *      - `event: start`           → 锁定 assistant messageId
 *      - `event: text-delta`      → 追加到末尾 text part
 *      - `event: reasoning-delta` → 追加到独立 text part（暂用 text part 装
 *                                 reasoning 文本，未来可加 'reasoning' part type）
 *      - `event: finish`          → 收尾，触发 onFinish
 *   2. 一次性（stream=false）：POST `/api/chat`，拿单次 reply
 *
 * 消息格式：借鉴 Vercel UIMessage.parts —— 单气泡可混合多 part
 * （text / image / plan / question / progress / video / error）。
 *
 * 已知限制 / 后续要补：
 *   - plan / question / video / progress part 的"服务端推送"目前只解析 text /
 *     reasoning，剩余 part 类型待后端 SSE 协议完善后补全（见 V3_AGENT_MATRIX §4）
 *   - 错误重试：当前暴露 clearError() + sendMessage() 让用户手动重试，
 *     v3.0.0+ 可加自动重试（指数退避 + 最多 3 次）
 *   - tool_* 状态展示：依赖 AgentMessage.metadata.taskId + WS 订阅，
 *     本 Hook 暂不集成 WS，留给上层组件按 taskId 订阅
 *   - 图片 part 预览：纯展示型，无缩略图优化
 *   - 鉴权头：默认不带，由 caller 注入（useAuthStore 已在 apiClient 拦截器中处理）
 *
 * 后续：等 `packages/shared-types` 包 build v3.0.0 类型后，
 *       把本地镜像的 AgentMessage/AgentPart/PlanData/QuestionData 改为
 *       `import { ... } from '@ai-script/shared-types'`
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { apiClient } from '../lib/api';

// ─── 消息类型 (mirror of apps/server/src/shared/types.ts v3.0.0 段) ───

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
  /** v3.0.0.2: 10 字段标准模板 (subject/action/appearance/expression/environment/lighting/composition/style/quality/negative) */
  planFields?: Record<string, string>;
  /** v3.0.0.2: 翻译后中文段落 (调试用) */
  cnDescription?: string;
  /** v3.0.0.2: 负向 prompt (SDXL 标准) */
  negative?: string;
}

export interface QuestionData {
  question: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string;
}

export type AgentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; role: 'reference' | 'result' }
  | { type: 'plan'; data: PlanData }
  | { type: 'question'; data: QuestionData }
  | { type: 'progress'; value: number; label?: string }
  | { type: 'video'; url: string; duration: number; billingStatus?: 'settled' | 'unsettled' }  // v3.0.31 (S69 BUG-072 E): unsettled 时显示"余额不足, 充值后解锁" banner
  | { type: 'error'; message: string }
  // v3.0.0.10: 流式生图卡片 (用户点确认后, plan part 原地变成这个, 然后变成图片)
  | { type: 'streaming'; stage: 'translating' | 'generating'; cnDescription?: string };

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentPart[];
  metadata?: { taskId?: string; stage?: string };
  createdAt: number;
}

// ─── Hook 配置 / 返回类型 ───

export type ChatStatus = 'ready' | 'streaming' | 'error';

export interface UseAgentChatOptions {
  api?: string;
  stream?: boolean;
  initialMessages?: AgentMessage[];
  onFinish?: (message: AgentMessage) => void;
  onError?: (error: Error) => void;
  headers?: Record<string, string>;
}

export interface UseAgentChatReturn {
  messages: AgentMessage[];
  status: ChatStatus;
  error: Error | null;
  sendMessage: (parts: AgentPart[]) => void;
  stop: () => void;
  clearError: () => void;
  setMessages: Dispatch<SetStateAction<AgentMessage[]>>;
}

// ─── 内部工具 ───

/** crypto.randomUUID() 优先，旧浏览器/Node fallback */
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** parts 数组 → 单字符串（发给后端的 OpenAI 格式 content 用） */
export function partsToText(parts: AgentPart[]): string {
  const chunks: string[] = [];
  for (const p of parts) {
    switch (p.type) {
      case 'text':
        if (p.text) chunks.push(p.text);
        break;
      case 'image':
        chunks.push(`[图片: ${p.url}]`);
        break;
      case 'plan':
        chunks.push(`[方案: ${p.data.prompt.slice(0, 80)}...]`);
        break;
      case 'question':
        chunks.push(`[询问: ${p.data.question}]`);
        break;
      case 'progress':
        chunks.push(`[进度: ${p.value}%${p.label ? ' ' + p.label : ''}]`);
        break;
      case 'video':
        chunks.push(`[视频: ${p.url} 时长${p.duration}s]`);
        break;
      case 'error':
        chunks.push(`[错误: ${p.message}]`);
        break;
    }
  }
  return chunks.join('\n');
}

/** AgentMessage[] → OpenAI messages 格式 (后端兼容) */
export function messagesToOpenAIFormat(
  messages: AgentMessage[],
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: partsToText(m.parts),
  }));
}

/** 找到最后一条 assistant message 并对其做不可变更新（否则追加新 part） */
function upsertAssistantMessage(
  prev: AgentMessage[],
  assistantId: string,
  mutator: (msg: AgentMessage) => AgentMessage,
): AgentMessage[] {
  const idx = prev.findIndex((m) => m.id === assistantId);
  if (idx === -1) {
    return [
      ...prev,
      mutator({
        id: assistantId,
        role: 'assistant',
        parts: [],
        createdAt: Date.now(),
      }),
    ];
  }
  const next = prev.slice();
  next[idx] = mutator(next[idx]);
  return next;
}

/** 把 text delta 追加到末尾 text part；没有就 push 新 text part */
function appendTextDelta(parts: AgentPart[], delta: string): AgentPart[] {
  if (parts.length > 0 && parts[parts.length - 1].type === 'text') {
    const last = parts[parts.length - 1] as Extract<AgentPart, { type: 'text' }>;
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...parts, { type: 'text', text: delta }];
}

// ─── Hook 主体 ───

export function useAgentChat(options?: UseAgentChatOptions): UseAgentChatReturn {
  const {
    api,
    stream = true,
    initialMessages,
    onFinish,
    onError,
    headers,
  } = options ?? {};

  const [messages, setMessages] = useState<AgentMessage[]>(
    initialMessages ?? [],
  );
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<Error | null>(null);

  // 用 ref 保存最新的 onFinish/onError, 避免 useCallback 反复重建
  const onFinishRef = useRef(onFinish);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onFinishRef.current = onFinish;
    onErrorRef.current = onError;
  }, [onFinish, onError]);

  // 当前 fetch 的 AbortController, 供 stop() 调用
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === 'streaming' ? 'ready' : s));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus((s) => (s === 'error' ? 'ready' : s));
  }, []);

  // 卸载时取消未完成请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendMessage = useCallback(
    (parts: AgentPart[]) => {
      if (parts.length === 0) return;
      if (status === 'streaming') {
        // 防止重入: 已经在流式时拒绝
        return;
      }

      // 1) 构造 user message 并立即 push（乐观更新）
      const userMsg: AgentMessage = {
        id: genId(),
        role: 'user',
        parts,
        createdAt: Date.now(),
      };

      // 2) 预创建 assistant message（流式模式需要占位 id）
      //    客户端流式解析用, 不发给后端（后端 OpenAI 格式不需要空 assistant 轮次）
      const assistantId = genId();
      const clientMessages: AgentMessage[] = [
        ...messages,
        userMsg,
        ...(stream
          ? [
              {
                id: assistantId,
                role: 'assistant' as const,
                parts: [],
                createdAt: Date.now(),
              },
            ]
          : []),
      ];
      setMessages(clientMessages);
      setStatus('streaming');
      setError(null);

      // 发给后端的 payload: 只含 user 之前的全部对话, 不含空 assistant 占位
      const payload = {
        messages: messagesToOpenAIFormat([...messages, userMsg]),
      };
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      };

      const endpoint =
        api ?? (stream ? '/api/chat/stream' : '/api/chat');

      // 失败统一处理
      const handleError = (err: unknown) => {
        const e =
          err instanceof Error
            ? err
            : new Error(typeof err === 'string' ? err : 'Chat request failed');
        if (e.name === 'AbortError') {
          // 用户主动 stop, 不当错误处理
          setStatus('ready');
          return;
        }
        setError(e);
        setStatus('error');
        onErrorRef.current?.(e);
      };

      // ─── 流式模式 ───
      if (stream) {
        const controller = new AbortController();
        abortRef.current = controller;

        fetch(endpoint, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok || !res.body) {
              throw new Error(
                `Chat stream failed: ${res.status} ${res.statusText}`,
              );
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // SSE 解析循环
            // 每条事件格式: `event: <name>\ndata: <json>\n\n`
            // eslint-disable-next-line no-constant-condition -- 显式循环, done 时 break
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              // 按 \n\n 切分完整事件
              let sepIdx: number;
              while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
                const rawEvent = buffer.slice(0, sepIdx);
                buffer = buffer.slice(sepIdx + 2);

                const parsed = parseSSEEvent(rawEvent);
                if (!parsed) continue;

                setMessages((prev) =>
                  upsertAssistantMessage(prev, assistantId, (msg) => {
                    if (parsed.event === 'text-delta' && parsed.data?.text) {
                      return {
                        ...msg,
                        parts: appendTextDelta(msg.parts, parsed.data.text),
                      };
                    }
                    if (
                      parsed.event === 'reasoning-delta' &&
                      parsed.data?.text
                    ) {
                      // 暂用 text part 装 reasoning, 未来可加 { type: 'reasoning' }
                      return {
                        ...msg,
                        parts: appendTextDelta(msg.parts, parsed.data.text),
                      };
                    }
                    // 其他事件 (start / image / plan / video / finish / ...) 在此扩展
                    return msg;
                  }),
                );
              }
            }

            // 流自然结束
            setStatus('ready');
            abortRef.current = null;
            // 触发 onFinish (传最终的 assistant message)
            setMessages((prev) => {
              const final = prev.find((m) => m.id === assistantId);
              if (final) onFinishRef.current?.(final);
              return prev;
            });
          })
          .catch(handleError)
          .finally(() => {
            abortRef.current = null;
          });
        return;
      }

      // ─── 一次性模式 ───
      const controller = new AbortController();
      abortRef.current = controller;

      apiClient
        .post(endpoint, payload, {
          headers: reqHeaders,
          signal: controller.signal,
        })
        .then((res) => {
          const reply: string =
            res?.data?.data?.reply ??
            res?.data?.reply ??
            '';

          const assistantMsg: AgentMessage = {
            id: genId(),
            role: 'assistant',
            parts: [{ type: 'text', text: reply }],
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setStatus('ready');
          onFinishRef.current?.(assistantMsg);
        })
        .catch((err) => {
          if (err?.name === 'CanceledError' || err?.name === 'AbortError') {
            setStatus('ready');
            return;
          }
          handleError(err);
        })
        .finally(() => {
          abortRef.current = null;
        });
    },
    [api, headers, messages, status, stream],
  );

  return {
    messages,
    status,
    error,
    sendMessage,
    stop,
    clearError,
    setMessages,
  };
}

// ─── SSE 解析辅助 ───

interface ParsedSSE {
  event: string;
  data: { text?: string; [k: string]: unknown } | null;
}

/** 解析单条 SSE 事件 (event + data 字段) */
function parseSSEEvent(raw: string): ParsedSSE | null {
  if (!raw) return null;
  let event = 'message';
  let dataStr = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const v = line.slice(5).trim();
      dataStr = dataStr ? dataStr + '\n' + v : v;
    }
  }
  if (!dataStr) return null;
  let data: ParsedSSE['data'] = null;
  try {
    data = JSON.parse(dataStr);
  } catch {
    // data 不是 JSON, 当作裸字符串
    data = { text: dataStr };
  }
  return { event, data };
}
