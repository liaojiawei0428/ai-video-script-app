/**
 * AgentChatPanel — v3.0.0 通用 Agent 聊天面板
 *
 * 复用 useAgentChat 的类型 (AgentMessage / AgentPart) + partsToText 工具。
 * 不直接用 useAgentChat Hook 是因为:
 *   - useAgentChat 走 `/api/chat/stream` 流式端点 (适合文字聊天)
 *   - image-agent / video-agent 后端是**一次性 JSON** (POST /chat 返回 { conversationId, aiMessage, status })
 *   - 后端 9 态状态机需要专门 UI (plan / question / progress / video 渲染)
 *
 * 两个 Agent Page 通过传入 `api` 对象 (imageAgentApi / videoAgentApi) 复用本组件。
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Send, Loader2, Image as ImageIcon, Video as VideoIcon, CheckCircle2, AlertCircle, Sparkles, FileText, Download, Paperclip, X, Trash2, Ban } from 'lucide-react';
import type { AgentMessage, AgentPart } from '../hooks/useAgentChat';
import { partsToText } from '../hooks/useAgentChat';
import { useAuthStore } from '../store/auth';
import { uploadAgentReferenceApi } from '../lib/api';
import { GeneratingLoader } from './ui';  // BUG-119 (v3.0.48): 流式卡片用标准动画, 跟 mobile 1:1 (跨端铁律 4++)
import { getWebAspectStyle } from '../lib/aspectRatio';  // BUG-120 (v3.0.48): 等待动画卡片按用户选的比例显示, 跟 mobile 1:1 镜像
import { useQueueStatus } from '../hooks/useQueueStatus';  // BUG-123 (v3.0.52): Agnes API 限流排队状态 polling (跨端铁律 4++ 镜像 mobile)

// v3.0.0.1: 视频 URL 生成器 (放在模块顶层避免 React 组件闭包作用域问题)
//
// 两类 URL:
// 1. **local 优先** (`/api/agent/video-local/{userId}/{filename}`):
//    - 后端从 agens 拉过一次, 存到 shipin-APP 本地
//    - 用户从 shipin-APP 本地磁盘读, 0 外网流量, 加载极快
// 2. **download proxy** (`/api/download?...`): 鉴权后从 agens 拉, 有 CORS/Range 支持
//
// 用 query `?token=` 让浏览器 GET 能带鉴权 (浏览器不会自动加 Authorization 头)
function buildVideoUrl(url: string, filename: string, token: string, disposition: 'inline' | 'attachment' = 'attachment'): string {
  return `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&token=${encodeURIComponent(token)}&disposition=${disposition}`;
}

/** v3.0.0.1: local cache 视频 URL, 没缓存会 404, 浏览器应 fallback 到 download proxy */
function buildLocalVideoUrl(userId: string, filename: string, token: string): string {
  // 鉴权: 用 Authorization 头 (video src 不会自动带 query, 但 <video> 也不会带 Authorization, 所以走 query token)
  return `/api/agent/video-local/${encodeURIComponent(userId)}/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`;
}

/** v3.0.0.1: 从 videoUrl 提取 filename (跟 download URL 反向), 用来拼 local URL */
function videoFilenameFromUrl(videoUrl: string): string {
  try {
    const u = new URL(videoUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return u.pathname.split('/').pop() || 'video.mp4';
  } catch {
    return 'video.mp4';
  }
}

/**
 * BUG-119 (v3.0.48): 清空 last assistant message 里的 result parts (video / image-result / error) + 旧 streaming
 *  用途: 用户点"确认方案" retry 时, 必须先把上一轮生成结果清空, 避免堆叠 2 个视频卡片
 *  跟 mobile VideoAgentScreen + ImageAgentScreen 1:1 镜像 (跨端铁律 4++)
 *  保留: text / plan / question / progress / image (reference, 角色=reference 不清)
 */
function clearResultParts(parts: AgentPart[]): AgentPart[] {
  return parts.filter(p => {
    if (p.type === 'video') return false;
    if (p.type === 'error') return false;
    if (p.type === 'streaming') return false;
    if (p.type === 'image' && (p as any).role === 'result') return false;
    return true;
  });
}

/** v3.0.0.1: 优先 local (快), fallback 到 download proxy (慢但能播) */
function buildPlayableVideoUrl(videoUrl: string, token: string): string {
  // 1. 试 local 路径 (后端 cacheVideoToLocal 后 local 会存在)
  //    注: userId 拼进 URL 路径, 但浏览器拿到 URL 后尝试, 404 就 fallback
  //    简单做法: 直接拼 local URL, 因为 <video> onError 时我们 fallback
  //    (但 <video> 不容易做 onError fallback, 所以前端先用 polling 检测)
  // 实际策略: 本组件渲染时, 先用 local URL, 同时在 useEffect 中 GET HEAD 探测, 失败再切到 download proxy
  // 简化: 用 download proxy (稳定), 优化靠后端 Range 透传 (已实现)
  return buildVideoUrl(videoUrl, `deep剧本-视频-${Date.now()}.mp4`, token, 'inline');
}

// 兼容旧调用: buildDownloadUrl 仍 = attachment
function buildDownloadUrl(url: string, filename: string, token: string): string {
  return buildVideoUrl(url, filename, token, 'attachment');
}

// 调 apiClient.post 拿到的是 AxiosResponse, .data 是后端响应体
// 我们所有 lib/api.ts 的 agent api 都返回 AxiosResponse<{ success, data, meta }>
// 简化: 接收 any, 内部用 (r as any).data.data.xxx 拿值 (符合现有 lib/api.ts 模式)
export interface AgentApi {
  createConversation: () => Promise<{ data: { data: { conversationId: string; welcome?: AgentMessage } } }>;
  // v3.0.0.8: 加 aspectRatio 参数 (前端比例选择器直接传, 不再混入 text)
  // v3.0.0.19: 加 durationSec 参数 (video kind 传, image 不传)
  chat: (conversationId: string, parts: AgentPart[], aspectRatio?: string, durationSec?: number) => Promise<{ data: { data: { conversationId: string; aiMessage: AgentMessage; status: string } } }>;
  confirm: (conversationId: string) => Promise<{ data: { data: { taskId: string; status: string; resultUrl?: string; error?: string } } }>;
  // v3.0.0.2: 翻译 + 改字段 (image agent 专用, video 端可填空实现)
  translatePlan?: (conversationId: string) => Promise<{ data: { data: { enPrompt?: string; cnDescription?: string; negative?: string; status: string; missingFields?: Array<{ key: string; label: string }> } } }>;
  updatePlanFields?: (conversationId: string, fields: Record<string, string>) => Promise<{ data: { data: { status: string; planFields: Record<string, string> } } }>;
  history: (limit?: number) => Promise<{ data: { data: { conversations: any[] } } }>;
  getById: (id: string) => Promise<{ data: { data: { conversation: any } } }>;
  // v3.0.0.17: 单条会话永久删除 (含审计清理)
  deleteConversation?: (id: string) => Promise<{ data: { data: { conversationId: string } } }>;
}

export interface AgentChatPanelProps {
  kind: 'image' | 'video';
  api: AgentApi;
  title: string;
  icon: 'image' | 'video';
  accentColor: string; // tailwind class, e.g. 'text-pink-500' or 'text-purple-500'
}

interface Conversation {
  id: string;
  title?: string;
  status: string;
  updatedAt?: number;
  // BUG-118: 列表项也展示 status badge, 需 errorMsg 决定细分 label (404/429/5xx)
  errorMsg?: string | null;
}

/**
 * v3.0.0.7: 比例快捷选项 (用户选 → 自动 append "比例换成 X" → server parser 解析)
 * value 跟 server `imageAspectRatio.ts` SUPPORTED_RATIOS map 一一对应
 */
const RATIO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: '📐 自动' },
  { value: '1:1', label: '1:1 方形 (1024²)' },
  { value: '16:9', label: '16:9 横屏 (1152×768)' },
  { value: '9:16', label: '9:16 竖屏 (768×1152)' },
  { value: '4:3', label: '4:3 经典 (1024×768)' },
  { value: '3:4', label: '3:4 竖版 (768×1024)' },
  { value: '2:3', label: '2:3 人像 (768×1152)' },
  { value: '3:2', label: '3:2 风景 (1152×768)' },
  { value: '2K', label: '2K 高清 (1024²)' },
  // v3.0.54 (BUG-124): 4K / 8K 移除 (agens 不支持 2048+ 分辨率生成)
];
// v3.0.0.20: 视频专属比例 (视频不推荐 2K+ 大图, 文件 50MB+ 用户扛不住, 移除)
// 视频推荐: 横屏/竖屏各 2 种, 方形 1 种, 经典 2 种
const VIDEO_RATIO_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: '📐 自动' },
  { value: '16:9', label: '16:9 横屏 (1152×768) ⭐推荐' },
  { value: '9:16', label: '9:16 竖屏 (768×1152) ⭐推荐' },
  { value: '1:1', label: '1:1 方形 (1024²)' },
  { value: '3:2', label: '3:2 风景 (1152×768)' },
  { value: '2:3', label: '2:3 人像 (768×1152)' },
  { value: '4:3', label: '4:3 经典 (1024×768)' },
  { value: '3:4', label: '3:4 竖版 (768×1024)' },
];
// v3.0.0.18: 视频时长选项 (秒), 跟 server ALLOWED_DURATIONS 一一对应
// v3.0.0.21: 用户反馈 "3秒太短, 想要 15秒", 改 [5, 10, 15]
const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 5, label: '5 秒 (标准)' },
  { value: 10, label: '10 秒 (长)' },
  { value: 15, label: '15 秒 (超长)' },
];

export function AgentChatPanel({ kind, api, title, icon, accentColor }: AgentChatPanelProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // BUG-118: 主头部 statusBadge 需要 errorMsg 决定细分 label, 同步 conv.errorMsg 到 state
  const [currentErrorMsg, setCurrentErrorMsg] = useState<string | null>(null);
  // v3.0.0: 待发送的参考图列表 (上传到 /api/agent/upload 后, URL 临时存在这里, 跟 input 文本一起发)
  const [pendingRefs, setPendingRefs] = useState<{ url: string; localPreview: string; filename: string; uploading?: boolean }[]>([]);
  // v3.0.0.7: 比例快捷选择 (避免用户打字 "比例换成16:9")
  // auto = 不传, server LLM 决定
  const [selectedRatio, setSelectedRatio] = useState<string>('auto');
  // v3.0.0.18: 视频时长快捷选择 (仅 video 显示), 3/5/10 秒
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const Icon = icon === 'image' ? ImageIcon : VideoIcon;

  // 滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, generating]);

  // 加载会话列表
  const refreshHistory = async () => {
    try {
      const r = await api.history(50);
      setConversations(r.data.data.conversations || []);
    } catch (e) { /* 静默 */ }
  };
  useEffect(() => { refreshHistory(); }, []);

  // v3.0.0.31 (S51): 加载今日限额状态 (image 30/天, video 矩阵)
  const [dailyStats, setDailyStats] = useState<{ kind: 'image' | 'video'; todayCount: number; dailyLimit: number | null; isVip: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = useAuthStore.getState().token || '';
        const r = await fetch(`/api/agent/daily-stats?kind=${kind}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (r.ok) {
          const j = await r.json();
          setDailyStats(j.data || j);
        }
      } catch (e) { /* 静默, 不阻塞 UI */ }
    })();
    return () => { cancelled = true; };
  }, [kind, conversationId, status]);  // status 变时刷新 (确认生成后计数 +1)

  // v3.0.0.2 BUG 修复: 异步任务轮询
  // 之前依赖 messages.length  → 每次 setMessages 都重建 setInterval (浪费 + 偶尔 race)
  // 修法: 用 messagesRef 持有最新 messages, effect 只依赖 conversationId + status
  const messagesRef = useRef<AgentMessage[]>([]);
  // v3.0.31 (S69 BUG-072 E): billingStatus ref (跟 messagesRef 一样, 闭包内可读最新值)
  const billingStatusRef = useRef<'settled' | 'unsettled'>('settled');
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // v3.0.31 (S69 BUG-072 E): 同步 conv.billing_status 注入到 video part, 供 case 'video' 渲染 banner
  const [convBillingStatus, setConvBillingStatus] = useState<'settled' | 'unsettled'>('settled');
  useEffect(() => { billingStatusRef.current = convBillingStatus; }, [convBillingStatus]);

  // v3.0.0.18: 单 useEffect 处理所有 status 变化
  //   - tool_queued / tool_executing: 自动 push 流式卡片 (用户刷新页面也能看到"正在生成")
  //   - tool_completed / tool_failed: 拉 conv 拿 resultUrl/error, 替换 streaming → video/image/error
  //   - status 变时, 拉最新 conv.messages 同步前端 (server 端可能 push 新 message)
  const statusEffectTimerRef = useRef<{ [id: string]: number }>({});
  useEffect(() => {
    if (!conversationId) return;
    const inFlight = status === 'tool_queued' || status === 'tool_executing';

    if (inFlight) {
      // in-progress: 立刻 push 流式卡片
      setMessages(m => {
        const last = m[m.length - 1];
        if (!last) return m;
        if (last.parts.some(p => p.type === 'streaming')) return m;
        if (last.parts.some(p => p.type === 'image' || p.type === 'video')) return m;
        return [...m.slice(0, -1), {
          ...last,
          parts: [...last.parts, { type: 'streaming', stage: 'generating' as const }],
        }];
      });
    }

    // 不管 inFlight 状态, 拉最新 conv.messages 同步 (server 可能 push 新消息)
    const syncConv = async () => {
      try {
        const r = await api.getById(conversationId);
        const conv = r.data.data.conversation;
        // 1) 同步 server push 的新 messages (例如 video 完成的 assistant message)
        if (conv.messages && conv.messages.length >= messagesRef.current.length) {
          setMessages(conv.messages);
        }
        // 2) status 变化
        if (conv.status && conv.status !== status) {
          setStatus(conv.status);
        }
        // BUG-118: 同步 conv.errorMsg → currentErrorMsg, 主头部 statusBadge 用
        setCurrentErrorMsg((conv as any).errorMsg || null);
        // 2.5) v3.0.31 (S69 BUG-072 E): 同步 conv.billing_status, 注入到 video part
        const bs = (conv as any).billing_status as 'settled' | 'unsettled' | undefined;
        if (bs === 'settled' || bs === 'unsettled') {
          setConvBillingStatus(bs);
        }
        // 3) 终态: 替换 streaming 为结果
        // BUG-119 (v3.0.48): 替换前先 clearResultParts 清掉旧 video/error (兜底: 防止 race 或 page refresh 后 polling 进来时残留)
        if (conv.status === 'tool_completed' || conv.status === 'tool_failed') {
          const resultUrl = (conv as any).resultImageUrl || (conv as any).resultVideoUrl;
          const errMsg = (conv as any).errorMsg;
          setMessages(m => {
            const next = [...m];
            const last = next[next.length - 1];
            if (!last) return m;
            if (!last.parts.some((p: any) => p.type === 'streaming')) return m;
            // BUG-119: 先 clear 旧 result + 旧 streaming, 再 push 新 result
            const cleaned = clearResultParts(last.parts);
            const newPart: AgentPart = conv.status === 'tool_failed'
              ? { type: 'error', message: errMsg || '生成失败' }
              : (!resultUrl
                  ? { type: 'error', message: '生成完成但 URL 缺失' }
                  : (kind === 'image'
                      ? { type: 'image', url: resultUrl, role: 'result' as const }
                      : { type: 'video', url: resultUrl, duration: 5, billingStatus: billingStatusRef.current }));
            next[next.length - 1] = {
              ...last,
              parts: [...cleaned, newPart],
            };
            return next;
          });
          refreshHistory();
          return false;  // 终态, 停止轮询
        }
        return true;  // 继续轮询
      } catch (e) {
        return true;
      }
    };

    // 立刻拉一次
    syncConv();

    // 5s 间隔轮询 (inFlight 时才持续轮询)
    if (!inFlight) return;
    const timer = setInterval(async () => {
      const shouldContinue = await syncConv();
      if (!shouldContinue) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [conversationId, status, kind]);

  // 加载会话详情
  const loadConversation = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.getById(id);
      const conv = r.data.data.conversation;
      setConversationId(conv.id);
      setStatus(conv.status || 'idle');
      setMessages(conv.messages || []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建新会话
  const [isCreatingConversation, setIsCreatingConversation] = useState(false); // BUG-126: 跟 loading 拆开, 让新建按钮在流式响应时可点
  const startNew = async () => {
    setIsCreatingConversation(true);
    setError(null);
    try {
      const r = await api.createConversation();
      const { conversationId: id, welcome } = r.data.data;
      setConversationId(id);
      setStatus('awaiting_clarification');
      setMessages(welcome ? [welcome] : []);
      refreshHistory();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '创建失败');
    } finally {
      setIsCreatingConversation(false);
    }
  };

  // 选文件 → 上传到 /api/agent/upload, 拿到 server URL 后加到 pendingRefs
  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    // 最多 4 张
    const limited = fileArr.slice(0, 4);
    // v3.0.0: 立即显示本地预览 (用 URL.createObjectURL), 异步上传, 完成后替换为 server URL
    const placeholders = limited.map(f => ({
      url: '',                                                  // 先空, 上传完回填
      localPreview: URL.createObjectURL(f),
      filename: f.name,
      uploading: true,
    }));
    setPendingRefs(p => [...p, ...placeholders]);

    for (let i = 0; i < limited.length; i++) {
      const file = limited[i];
      try {
        const r = await uploadAgentReferenceApi(file);
        const serverUrl = r.data?.data?.url || '';
        if (!serverUrl) throw new Error('server returned no url');
        // 替换占位 (按 filename 匹配, 因为索引可能因为并发 setState 错位)
        setPendingRefs(p => p.map(x =>
          x.filename === file.name && x.uploading
            ? { ...x, url: serverUrl, uploading: false }
            : x
        ));
      } catch (e: any) {
        const msg = e?.response?.data?.error?.message || e?.message || '上传失败';
        setError(`参考图上传失败: ${msg}`);
        // 移除失败的占位
        setPendingRefs(p => p.filter(x => !(x.filename === file.name && x.uploading)));
      }
    }
  };

  // 移除某张待发送的图
  const removePendingRef = (filename: string) => {
    setPendingRefs(p => {
      const removed = p.find(x => x.filename === filename);
      if (removed?.localPreview) URL.revokeObjectURL(removed.localPreview);
      return p.filter(x => x.filename !== filename);
    });
  };

  // 发送消息
  const send = async () => {
    const text = input.trim();
    // v3.0.0.4: 允许多个状态发消息 (持续对话)
    // - awaiting_clarification: 回答 LLM 问询
    // - plan_cn_ready: 改字段
    // - tool_completed: 提修改指令 (后端会接住, 走 modification 流程)
    if ((!text && pendingRefs.length === 0) || loading || !conversationId) return;
    if (pendingRefs.some(x => x.uploading)) {
      setError('参考图还在上传, 请稍候...');
      return;
    }
    // 拒绝在系统忙碌时对话
    if (status === 'plan_translating' || status === 'tool_queued' || status === 'tool_executing' || status === 'ai_planning' || status === 'ai_clarifying') {
      setError('AI 还在处理上一条消息, 请稍候...');
      return;
    }
    setInput('');
    setError(null);

    // v3.0.0.8: 比例作为独立参数传给 API, 不再 append 到 user text (避免显示 "比例换成X" 后缀)
    // 只在选了非 auto 时传, server 会优先用
    const aspectRatio = selectedRatio !== 'auto' ? selectedRatio : undefined;

    // 构造 parts: 先放 text, 再放 image reference (后端会自动塞到 plan.refImageUrls)
    // v3.0.0.8: 不再 append ratio 到 text (干净, 专业, 不影响 LLM 输入)
    const parts: AgentPart[] = [];
    if (text) parts.push({ type: 'text', text });
    for (const r of pendingRefs) {
      if (r.url) {
        parts.push({ type: 'image', url: r.url, role: 'reference' as const });
      }
    }

    // 释放 localPreview
    for (const r of pendingRefs) {
      if (r.localPreview) URL.revokeObjectURL(r.localPreview);
    }
    const refsToSend = pendingRefs;
    setPendingRefs([]);

    const userMsg: AgentMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      parts,
      createdAt: Date.now(),
    };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    const startTime = Date.now();
    try {
      // v3.0.0.19: video kind 时传 durationSec (3/5/10s), image 传 undefined 走 server 默认
      const r = await api.chat(
        conversationId,
        userMsg.parts,
        aspectRatio,
        kind === 'video' ? selectedDuration : undefined,
      );
      const { aiMessage, status: newStatus } = r.data.data;
      setMessages(m => [...m, aiMessage]);
      setStatus(newStatus);
      refreshHistory();
    } catch (e: any) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      // v3.0.32 (BUG-081 S71 后置): 提取 error.code, 给不同错误更友好提示
      // - INVALID_CONVERSATION_STATE: 状态错 (用户改方案时 plan_ready 之外的拒绝), 引导"刷新页面"
      // - AGENT_BUSY: AI 忙, 引导"稍候"
      // - CONVERSATION_NOT_FOUND: 会话丢失, 引导"新建会话"
      // - 其他: 通用错误
      const errCode = e?.response?.data?.error?.code;
      const errMsg = e?.response?.data?.error?.message || e?.message || '请求失败';
      let userMsg = errMsg;
      if (errCode === 'INVALID_CONVERSATION_STATE') {
        userMsg = `${errMsg} (建议刷新页面或新建会话)`;
      } else if (errCode === 'AGENT_BUSY') {
        userMsg = `AI 还在处理上一条消息, 请稍候...`;
      } else if (errCode === 'CONVERSATION_NOT_FOUND') {
        userMsg = `会话已失效, 请新建会话`;
      }
      console.error('[AgentChat] send error', { code: errCode, message: errMsg, elapsed, stack: e?.stack });
      setError(`${userMsg}${elapsed > 0 ? ` (耗时 ${elapsed}s)` : ''}`);
    } finally {
      setLoading(false);
    }
  };

  // v3.0.0.17: 一键确认方案 → 立刻返 taskId (status: queued) → 后台轮询 status
  // 流式卡片: plan → streaming(generating) → 5s 轮询 (tool_queued / tool_executing) → image / error
  // 不再调 LLM 翻译 (PR-M 极简 passthrough 已删), 直接调 confirm
  const confirmingRef = useRef(false);
  const confirmAndGenerate = async () => {
    if (!conversationId || generating || confirmingRef.current) return;
    confirmingRef.current = true;
    setGenerating(true);
    setError(null);

    // 1. 立刻把 plan part 替换成流式卡片 (generating 阶段, 极简模式无 translating)
    // BUG-119 (v3.0.48): 先 clearResultParts 清掉旧 video/error/旧 streaming (避免堆叠), 再 push 新 streaming
    setStatus('tool_queued');
    setMessages(m => {
      const next = [...m];
      const last = next[next.length - 1];
      if (last && last.role === 'assistant') {
        const cleaned = clearResultParts(last.parts);
        const newParts: AgentPart[] = [];
        let streamingReplaced = false;
        for (const p of cleaned) {
          if (p.type === 'plan' && !streamingReplaced) {
            newParts.push({ type: 'streaming', stage: 'generating' });
            streamingReplaced = true;
          } else {
            newParts.push(p);
          }
        }
        if (!streamingReplaced) {
          newParts.push({ type: 'streaming', stage: 'generating' });
        }
        next[next.length - 1] = {
          ...last,
          parts: newParts.filter(p => !(p.type === 'text' && p.text?.includes('点下方'))),
        };
      }
      return next;
    });

    try {
      // 2. 调 confirm → 立刻返 taskId + status: queued (后端 fire-and-forget 跑 agens)
      const cr = await api.confirm(conversationId);
      const { taskId, status: rStatus, error: rErr } = cr.data.data;
      if (rStatus !== 'queued') {
        throw new Error(rErr || 'confirm 返回非 queued 状态');
      }

      // 3. 后台轮询 conversation 状态 (5s 间隔, 跟 video 一样)
      //    - 状态变 tool_completed → 拉 conv.messages 拿到 resultImageUrl, 替换 streaming part
      //    - 状态变 tool_failed → 替换为 error part
      //    - 用户可随时关页面 (后台继续跑), 再次打开时 refreshConversation 拉最新状态
      const POLL_INTERVAL_MS = 4000;
      const MAX_POLL_MS = 5 * 60 * 1000;  // 5min
      const startTime = Date.now();
      let finalImageUrl: string | null = null;
      let finalError: string | null = null;
      let lastStatusSeen = '';
      const tickStatus = (s: string) => {
        lastStatusSeen = s;
        setStatus(s as any);
      };

      while (Date.now() - startTime < MAX_POLL_MS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        try {
          const conv = await api.getById(conversationId);
          const cur = conv.data.data.conversation;
          if (cur.status !== lastStatusSeen) {
            tickStatus(cur.status);
          }
          if (cur.status === 'tool_completed' && cur.resultImageUrl) {
            finalImageUrl = cur.resultImageUrl;
            break;
          }
          if (cur.status === 'tool_failed') {
            finalError = cur.error_msg || '生成失败';
            break;
          }
          if (cur.status === 'tool_throttled') {
            finalError = cur.error_msg || 'API 限流, 已暂停, 请稍后手动重试';
            break;
          }
          // v3.0.0.26 (S46): 状态从 queued/executing 变回 plan_ready = 后台 createTask 失败回滚 (S45)
          // 之前只 catch tool_failed/throttled, 漏了 plan_ready rollback → UI 一直 poll 5min 显示"生成超时"
          // 正确: 看到 plan_ready + error_msg → 立即显示错误, 让 user 知道要 5-10min 后重试
          if (cur.status === 'plan_ready' && cur.error_msg && (lastStatusSeen === 'tool_queued' || lastStatusSeen === 'tool_executing')) {
            finalError = cur.error_msg;
            tickStatus('tool_failed' as any);  // UI 假装 fail (实际状态机回滚了)
            break;
          }
        } catch (e) {
          // 网络错误继续轮询
        }
      }

      if (!finalImageUrl && !finalError) {
        finalError = '生成超时 (5min), 请刷新页面查看是否完成';
      }

      // 4. 渲染结果: streaming part 替换为 image 或 error
      const newPart: AgentPart | null = finalImageUrl
        ? { type: 'image', url: finalImageUrl, role: 'result' as const }
        : { type: 'error', message: finalError || '生成失败' };
      setMessages(m => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            parts: last.parts.map(p => p.type === 'streaming' ? newPart! : p),
          };
        }
        return next;
      });
      setStatus(finalImageUrl ? 'tool_completed' : 'tool_failed');
      refreshHistory();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '生成失败');
      setStatus('plan_ready');
      // 清掉 streaming part
      setMessages(m => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            parts: last.parts.filter(p => p.type !== 'streaming'),
          };
        }
        return next;
      });
    } finally {
      setGenerating(false);
      confirmingRef.current = false;
    }
  };

  // v3.0.0.2 BUG 修复: 确认生成 (video agent 走这个, 旧流程)
  // 之前在 setMessages updater 内部调 setStatus (React 反模式) → 状态可能丢失, 按钮卡在"生成中"
  // v3.0.0.18: 走流式卡片 + 轮询 (跟 confirmAndGenerate 一致), 删啰嗦文案
  const confirm = async () => {
    if (!conversationId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      // 1. 立刻把 plan part 替换为流式卡片 (kind: 'generating')
      // BUG-119 (v3.0.48): 先 clearResultParts 清掉旧 video/error/旧 streaming (避免堆叠), 再 push 新 streaming
      setStatus('tool_queued');
      setMessages(m => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          const cleaned = clearResultParts(last.parts);
          const newParts: AgentPart[] = [];
          let streamingReplaced = false;
          for (const p of cleaned) {
            if (p.type === 'plan' && !streamingReplaced) {
              newParts.push({ type: 'streaming', stage: 'generating' });
              streamingReplaced = true;
            } else {
              newParts.push(p);
            }
          }
          if (!streamingReplaced) {
            newParts.push({ type: 'streaming', stage: 'generating' });
          }
          next[next.length - 1] = {
            ...last,
            parts: newParts.filter(p => !(p.type === 'text' && p.text?.includes('点下方'))),
          };
        }
        return next;
      });

      // 2. confirm → 立刻返 taskId + queued (后端 fire-and-forget 跑 agens)
      const r = await api.confirm(conversationId);
      const { taskId, status: rStatus, error: rErr } = r.data.data;
      if (rStatus !== 'queued' && rStatus !== 'tool_queued') {
        throw new Error(rErr || 'confirm 返回非 queued 状态');
      }
      void taskId;

      // 3. 后台轮询 conversation 状态 (5s 间隔)
      const POLL_INTERVAL_MS = 5000;
      const MAX_POLL_MS = 5 * 60 * 1000;
      const startTime = Date.now();
      let finalResultUrl: string | null = null;
      let finalError: string | null = null;
      while (Date.now() - startTime < MAX_POLL_MS) {
        await new Promise(res => setTimeout(res, POLL_INTERVAL_MS));
        try {
          const conv = await api.getById(conversationId);
          const cur = conv.data.data.conversation;
          if (cur.status === 'tool_completed') {
            finalResultUrl = kind === 'image' ? cur.resultImageUrl : cur.resultVideoUrl;
            break;
          }
          if (cur.status === 'tool_failed') {
            finalError = cur.error_msg || '生成失败';
            break;
          }
          if (cur.status === 'tool_throttled') {
            finalError = cur.error_msg || 'AI 生成暂停, 请查看错误详情后手动重试';
            break;
          }
        } catch {}
      }
      if (!finalResultUrl && !finalError) {
        finalError = '生成超时 (5min), 请刷新页面查看是否完成';
      }

      // 4. 替换 streaming part 为结果或错误
      const newPart: AgentPart | null = finalResultUrl
        ? (kind === 'image'
          ? { type: 'image', url: finalResultUrl, role: 'result' as const }
          : { type: 'video', url: finalResultUrl, duration: 0, billingStatus: billingStatusRef.current })
        : { type: 'error', message: finalError || '生成失败' };
      setMessages(m => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            parts: last.parts.map(p => p.type === 'streaming' ? newPart! : p),
          };
        }
        return next;
      });
      setStatus(finalResultUrl ? 'tool_completed' : 'tool_failed');
      refreshHistory();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.message || '确认失败');
      // 清掉 streaming part
      setMessages(m => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            parts: last.parts.filter(p => p.type !== 'streaming'),
          };
        }
        return next;
      });
      setStatus('plan_ready');
    } finally {
      setGenerating(false);
    }
  };

  // 选 option (LLM 问询)
  const pickOption = async (label: string) => {
    setInput(label);
    setTimeout(() => send(), 50);
  };

  // 状态徽标
  // BUG-118 (v3.0.47): tool_throttled 文案细分 — 根据 error_msg 前缀 [404]/[429]/[5xx] 决定 label 颜色
  const statusBadge = (s: string, errorMsg?: string | null) => {
    const map: Record<string, { label: string; cls: string }> = {
      idle: { label: '未开始', cls: 'bg-gray-100 text-gray-600' },
      ai_clarifying: { label: 'AI 问询中', cls: 'bg-blue-100 text-blue-700' },
      awaiting_clarification: { label: '等待补充', cls: 'bg-amber-100 text-amber-700' },
      ai_planning: { label: 'AI 整理方案', cls: 'bg-blue-100 text-blue-700' },
      plan_cn_ready: { label: '中文方案', cls: 'bg-emerald-100 text-emerald-700' },
      plan_translating: { label: '准备中', cls: 'bg-violet-100 text-violet-700' },
      plan_ready: { label: '英文方案', cls: 'bg-green-100 text-green-700' },
      awaiting_confirmation: { label: '等待确认', cls: 'bg-cyan-100 text-cyan-700' },
      tool_queued: { label: '排队中', cls: 'bg-purple-100 text-purple-700' },
      tool_executing: { label: '生成中', cls: 'bg-indigo-100 text-indigo-700' },
      tool_completed: { label: '已完成 · 可继续修改', cls: 'bg-emerald-100 text-emerald-700' },
      // BUG-118: 细分子状态,前端 parse error_msg 前缀
      // [404] 任务失效 (上游 query 找不到) — 红橙色,提示重新生成会创建新任务
      // [429] 限流暂停 — 橙色,提示 1-2 分钟后重试
      // [5xx] 上游异常 — 琥珀色,提示稍后重试
      // 无前缀 (老数据 fallback) — 橙色 "暂停"
      tool_throttled: { label: '暂停', cls: 'bg-orange-100 text-orange-700' },
      tool_failed: { label: '失败', cls: 'bg-red-100 text-red-700' },
    };
    let m = map[s] || { label: s, cls: 'bg-gray-100 text-gray-600' };
    // BUG-118: tool_throttled 时根据 error_msg 前缀细分子标签
    // BUG-132 (v3.0.64): 同时对 tool_throttled / tool_failed 都 parse [content_policy]/[rate_limit]/[upstream_busy]/[timeout] 4 种 ERR_TYPE
    // 修前只 parse 3 种 [404]/[429]/[5xx], 漏 [content_policy] 引导致用户看到 "暂停/失败" 通用 label, 不知道是策略拦截
    const isRetryable = s === 'tool_throttled' || s === 'tool_failed';
    if (isRetryable && errorMsg) {
      if (/^\[(content_policy|invalid_input)\]/.test(errorMsg)) {
        // 红 — 用户操作可解决 (改 prompt / 改图片), 不是 API 限流
        m = { label: '策略拦截', cls: 'bg-rose-100 text-rose-700' };
      } else if (/^\[(rate_limit|429)\]/.test(errorMsg)) {
        m = s === 'tool_throttled'
          ? { label: '限流暂停', cls: 'bg-orange-100 text-orange-700' }
          : { label: '限流失败', cls: 'bg-orange-100 text-orange-700' };
      } else if (/^\[(upstream_busy|5xx)\]/.test(errorMsg)) {
        m = { label: '上游异常', cls: 'bg-amber-100 text-amber-700' };
      } else if (/^\[timeout\]/.test(errorMsg)) {
        m = { label: '超时', cls: 'bg-amber-100 text-amber-700' };
      } else if (/^\[404\]/.test(errorMsg)) {
        m = { label: '任务失效', cls: 'bg-red-100 text-red-700' };
      }
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${m.cls}`} title={errorMsg || undefined}>{m.label}</span>;
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-12rem)] flex gap-4">
      {/* 左侧: 会话列表 */}
      <aside className="w-60 flex-shrink-0 flex flex-col gap-2">
        <button
          onClick={startNew}
          disabled={isCreatingConversation}
          className={`btn-primary w-full flex items-center justify-center gap-2 ${accentColor.replace('text-', 'bg-').replace('-500', '-500/90')}`}
        >
          <Sparkles size={16} />
          新建{kind === 'image' ? '生图' : '视频'}会话
        </button>
        <div className="text-xs text-text-tertiary px-1 mt-2">历史会话</div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.length === 0 && (
            <div className="text-xs text-text-tertiary px-2 py-3">还没有会话</div>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => loadConversation(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                c.id === conversationId
                  ? 'bg-primary/20 text-primary'
                  : 'hover:bg-bg-tertiary text-text-secondary'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} />
                <span className="truncate flex-1">{c.title || c.id.slice(0, 8)}</span>
                {/* v3.0.0.17: 单条会话删除按钮 (永久删除, 不可恢复) — 加大 + 红色 + 一直显示, 不靠 hover */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`确定要永久删除这条会话吗？\n\n所有图片/视频、对话记录、生成历史都将被删除, 无法找回。`)) return;
                    try {
                      await api.deleteConversation!(c.id);
                      if (c.id === conversationId) {
                        setConversationId(null);
                        setMessages([]);
                        setStatus('idle');
                      }
                      await refreshHistory();
                    } catch (err: any) {
                      alert('删除失败: ' + (err?.response?.data?.error?.message || err?.message));
                    }
                  }}
                  className="p-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/30 hover:border-red-500/60 transition-colors flex-shrink-0 flex items-center gap-1"
                  title="删除这条会话 (永久, 不可恢复)"
                >
                  <Trash2 size={13} />
                  <span className="text-[10px] font-medium">删除</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                {statusBadge(c.status, c.errorMsg)}
                {c.updatedAt && <span className="text-[10px] text-text-tertiary">{new Date(c.updatedAt).toLocaleDateString()}</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* 右侧: 当前会话 */}
      <main className="flex-1 flex flex-col glass rounded-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon className={accentColor} size={20} />
            <h2 className="font-semibold">{title}</h2>
            {conversationId && statusBadge(status, currentErrorMsg)}
          </div>
          {/* v3.0.0.3: 一键确认 (image: 中文方案→自动翻译→自动出图; video: 旧流程) */}
          {status === 'plan_cn_ready' && api.translatePlan && (
            <button
              onClick={confirmAndGenerate}
              disabled={generating || (!dailyStats?.isVip && kind === 'image' && (dailyStats?.todayCount ?? 0) >= 30)}
              className="btn-primary flex items-center gap-1.5"
              title={
                kind === 'image'
                  ? (!dailyStats?.isVip && (dailyStats?.todayCount ?? 0) >= 30
                      ? '今日生图已达 30 张上限, 升级 VIP 解锁无限'
                      : `生图免费 · 今日已用 ${dailyStats?.todayCount ?? 0}/30${dailyStats?.isVip ? ' (VIP 无限)' : ''}`)
                  : (dailyStats?.isVip
                      ? (selectedDuration <= 10 ? 'VIP 免费生成' : 'VIP 0.1 元/条')
                      : (selectedDuration === 5 ? '免费生成' : '0.1 元/条'))
              }
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {generating ? '生成中...' : '确认方案, 出图'}
            </button>
          )}
          {status === 'plan_translating' && (
            <button disabled className="btn-primary flex items-center gap-1.5 opacity-70">
              <Loader2 size={14} className="animate-spin" />
              正在翻译成AI识别的最佳提示词, 请稍等...
            </button>
          )}
          {status === 'plan_ready' && (
            <button
              onClick={confirm}
              disabled={generating}
              className="btn-primary flex items-center gap-1.5"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {generating ? `${kind === 'image' ? '生图' : '视频'}生成中 (首次 30-60s)...` : '确认生成'}
            </button>
          )}
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !conversationId && (
            <div className="text-center text-text-tertiary py-12">
              <Icon className={`mx-auto mb-3 ${accentColor}`} size={48} />
              <div className="text-sm">点击"新建会话"开始</div>
              <div className="text-xs mt-1 text-text-tertiary/70">
                告诉{kind === 'image' ? '生图' : '视频'}助手你想生成什么
              </div>
            </div>
          )}
          {messages.map(m => (
            <MessageBubble key={m.id} message={m} onPick={pickOption} kind={kind} selectedRatio={selectedRatio} conversationId={conversationId} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-bg-tertiary rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-xs text-text-tertiary">{kind === 'image' ? '生图助手' : '视频助手'} 思考中, 首次可能 30-60s...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 text-red-700 rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            </div>
          )}
        </div>

        {/* v3.0.0: 待发送参考图缩略图 (上传到 /api/agent/upload 后, 跟着 send 一起发给 agent) */}
        {pendingRefs.length > 0 && (
          <div className="px-3 pt-2 flex gap-2 flex-wrap border-t border-border bg-bg-secondary/30">
            {pendingRefs.map((r) => (
              <div key={r.filename} className="relative group">
                <img
                  src={r.localPreview || (r.url ? `${(typeof window !== 'undefined' ? window.location.origin : '')}${r.url}` : '')}
                  alt={r.filename}
                  className={`h-14 w-14 object-cover rounded-md border ${r.uploading ? 'opacity-50' : 'border-primary/40'}`}
                />
                {r.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 size={14} className="animate-spin text-white drop-shadow" />
                  </div>
                )}
                <button
                  onClick={() => removePendingRef(r.filename)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className="border-t border-border p-3 space-y-2">
          {/* v3.0.0.14: 比例 chip 显示 (图片 + 视频 agent 都显示) */}
          {selectedRatio !== 'auto' && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 text-primary rounded-md text-xs font-medium">
                📐 {selectedRatio}
                <button
                  onClick={() => setSelectedRatio('auto')}
                  className="hover:text-primary/70 ml-0.5"
                  title="清除比例选择"
                >
                  <X size={12} />
                </button>
              </span>
              <span className="text-[10px] text-text-secondary opacity-60">
                {kind === 'video'
                  ? `视频比例 ${selectedRatio} — 推荐 16:9 横屏 / 9:16 竖屏`
                  : `图片比例 ${selectedRatio} — 2K 大图生成更慢`}
              </span>
            </div>
          )}
          {/* v3.0.0.31 (S51): 视频时长 chip (仅 video 显示) — 新计费矩阵 */}
          {kind === 'video' && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/15 text-primary rounded-md text-xs font-medium">
                ⏱️ {selectedDuration}s
              </span>
              <span className="text-[10px] text-text-secondary opacity-60">
                视频时长 —{' '}
                {dailyStats?.isVip
                  ? (selectedDuration <= 10
                      ? <span className="text-green-400">VIP 免费</span>
                      : <span className="text-amber-400">VIP 0.1 元/条</span>)
                  : (selectedDuration === 5
                      ? <span className="text-green-400">免费</span>
                      : <span className="text-amber-400">0.1 元/条</span>)}
                {selectedDuration >= 15 && ' · 文件 10-15MB, 等待 1-3 分钟'}
              </span>
            </div>
          )}
          {/* v3.0.0.31 (S51): 生图免费提示 + 30/天限额 (仅 image) */}
          {kind === 'image' && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/15 text-green-400 rounded-md text-xs font-medium">
                🎨 免费
              </span>
              <span className="text-[10px] text-text-secondary opacity-60">
                {dailyStats?.isVip
                  ? 'VIP 今日无限生图'
                  : `今日生图 ${dailyStats?.todayCount ?? 0}/30${(dailyStats?.todayCount ?? 0) >= 30 ? ' · 已达上限, 升级 VIP 解锁无限' : ''}`}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => {
                onPickFiles(e.target.files);
                e.target.value = ''; // reset, 让同样文件能再次选
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!conversationId || loading || pendingRefs.length >= 4}
              className="btn-secondary flex items-center justify-center disabled:opacity-50"
              title="上传参考图 (最多 4 张, JPEG/PNG/WebP)"
            >
              <Paperclip size={16} />
            </button>
            {/* v3.0.0.14: 比例快捷选择 (图片 + 视频 agent 都显示) */}
            {/* v3.0.0.20: video 用 VIDEO_RATIO_OPTIONS (8 种, 去 8K/4K/2K), image 用 RATIO_OPTIONS (11 种) */}
            <select
              value={selectedRatio}
              onChange={e => setSelectedRatio(e.target.value)}
              disabled={!conversationId || loading || status === 'plan_translating' || status === 'tool_queued' || status === 'tool_executing'}
              className="bg-bg-tertiary rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
              title={kind === 'video' ? '选择视频比例 (2K+ 视频不推荐, 文件太大)' : '选择图片比例'}
            >
                {(kind === 'video' ? VIDEO_RATIO_OPTIONS : RATIO_OPTIONS).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            {/* v3.0.0.19: 视频时长 (仅 video kind 显示), 默认 5s */}
            {kind === 'video' && (
              <select
                value={selectedDuration}
                onChange={e => setSelectedDuration(Number(e.target.value))}
                disabled={!conversationId || loading || status === 'plan_translating' || status === 'tool_queued' || status === 'tool_executing'}
                className="bg-bg-tertiary rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 cursor-pointer"
                title="选择视频时长 (秒) — 计费 0.05 元/秒"
              >
                {DURATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder={
                !conversationId
                  ? '先新建一个会话'
                  : status === 'tool_completed'
                    ? '继续对话, 例如: 把背景换成海边, 衣服改成白色...'
                    : status === 'plan_cn_ready'
                      ? '改字段 (例如: 改主体为猫, 风格改为动漫) 或点上方"确认方案, 出图"'
                      : '描述你的需求 (可粘贴/上传参考图)...'
              }
              disabled={!conversationId || loading || status === 'plan_translating' || status === 'tool_queued' || status === 'tool_executing'}
              className="flex-1 bg-bg-tertiary rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!conversationId || loading || (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={14} />
              发送
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── 单条消息气泡 ───
function MessageBubble({ message, onPick, kind, selectedRatio, conversationId }: { message: AgentMessage; onPick: (s: string) => void; kind: 'image' | 'video'; selectedRatio: string; conversationId: string | null }) {
  const isUser = message.role === 'user';
  // v3.0.0.3 BUG 修复: useAuthStore 必须在 component 顶层调用 (Rules of Hooks)
  // 之前在 message.parts.map() 内调用, 当 parts 数量变化时 (出图前 1 个, 出图后 2-3 个)
  // → hook 数量变化 → React throw "Rendered fewer hooks than expected" → ErrorBoundary 抓到
  const token = useAuthStore((s) => s.token) || '';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 space-y-2 ${
        isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-bg-tertiary rounded-tl-sm'
      }`}>
        {message.parts.map((p, i) => (
          <PartSafeView key={i} part={p} onPick={onPick} kind={kind} isUser={isUser} token={token} selectedRatio={selectedRatio} conversationId={conversationId} />
        ))}
      </div>
    </div>
  );
}

/**
 * PartSafeView — v3.0.0.3 单 part 渲染兜底
 *  - PartView 内部抛错 (e.g., part.url undefined 触发 startsWith 崩) → 这层 catch 兜住
 *  - 单 part 渲染失败 → 只显示一个 fallback 行, 不影响其他 part 渲染, 也不击垮整个 MessageBubble
 */
function PartSafeView({ part, onPick, kind, isUser, token, selectedRatio, conversationId }: { part: AgentPart; onPick: (s: string) => void; kind: 'image' | 'video'; isUser: boolean; token: string; selectedRatio: string; conversationId: string | null }) {
  try {
    return <PartView part={part} onPick={onPick} kind={kind} isUser={isUser} token={token} selectedRatio={selectedRatio} conversationId={conversationId} />;
  } catch (e: any) {
    console.error('[PartSafeView] render failed:', e, { part, kind });
    return (
      <div className="text-[10px] text-red-400/70 italic px-1 py-0.5">
        [渲染跳过: {String(e?.message || '未知错误').slice(0, 80)}]
      </div>
    );
  }
}

/**
 * safeStr — v3.0.0.3 防御性 string 转换
 *  - part.data.X 可能是 undefined / null / 非 string (老 conv / partial 响应)
 *  - 一律转 string, 避免 React child 渲染时崩
 */
function safeStr(v: any, fallback: string = ''): string {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

/**
 * v3.0.52 (BUG-123): 流式卡片子组件, 集成 GeneratingLoader + 排队状态
 *  - useQueueStatus 自动 polling /api/tasks/:taskId/queue (3s 间隔)
 *  - 3 种状态显示:
 *    1. 排队中: position > 0 → "⏳ 排队中: 第 N 位 · 预计 X 秒 (生视频 2 次/分钟)" (amber)
 *    2. 等待资源中: global.active > 0 && position == null → "⏳ 等待资源: 当前 N/M 在跑, 平均 Xs/任务" (blue)
 *    3. 正常: global.active == 0 → 只显示 GeneratingLoader 默认 label
 *  - 跨端铁律 4++ 镜像 mobile VideoAgentScreen/ImageAgentScreen 1:1
 */
function StreamingCard({ aspectStyle, stage, kind, isUser, conversationId }: {
  aspectStyle: React.CSSProperties;
  stage: 'translating' | 'generating';
  kind: 'image' | 'video';
  isUser: boolean;
  conversationId: string | null;
}) {
  const { status: queueStatus } = useQueueStatus(conversationId, { enabled: !!conversationId, intervalMs: 3000 });

  // 选对应 kind 的队列信息
  const queueInfo = kind === 'video' ? queueStatus?.video : queueStatus?.image;
  const globalInfo = queueStatus?.global ? (kind === 'video' ? queueStatus.global.video : queueStatus.global.image) : null;

  const inQueue = queueInfo?.position !== null && queueInfo?.position !== undefined && (queueInfo?.position ?? 0) > 0;
  // 等待资源: 系统中已经有任务在跑 (active > 0), 但这个请求不在队列 (立即拿到 slot)
  const waitingForResource = !inQueue && (globalInfo?.active ?? 0) > 0;

  const kindLabel = kind === 'image' ? '生图 40 次/分钟' : '生视频 2 次/分钟';

  return (
    <div
      className="mt-1 rounded-lg bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 flex flex-col items-center justify-center gap-2"
      style={{
        ...aspectStyle,
        width: '100%',
        color: isUser ? 'white' : undefined,
      }}
    >
      <GeneratingLoader
        size="md"
        label={
          stage === 'translating'
            ? '正在翻译成AI识别的最佳提示词...'
            : kind === 'video'
              ? 'AI 正在渲染视频, 通常 1-3 分钟, 别关页面...'
              : 'AI 正在绘制中...'
        }
      />
      {inQueue && queueInfo && (
        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded px-2 py-1 mt-1">
          <span className="font-medium">⏳ 排队中:</span>{' '}
          第 <span className="font-bold">{queueInfo.position}</span> 位
          {' · '}
          预计 <span className="font-bold">{queueInfo.etaSeconds}</span> 秒
          {' · '}
          {kindLabel}
        </div>
      )}
      {!inQueue && waitingForResource && globalInfo && (
        <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded px-2 py-1 mt-1">
          <span className="font-medium">⏳ 等待资源:</span>{' '}
          当前 <span className="font-bold">{globalInfo.active}/{globalInfo.limit}</span> 在跑
          {globalInfo.avgDurationMs > 0 && (
            <>
              {' · '}
              平均 <span className="font-bold">{Math.round(globalInfo.avgDurationMs / 1000)}</span>s/任务
            </>
          )}
          {' · '}
          {kindLabel}
        </div>
      )}
    </div>
  );
}

function PartView({ part, onPick, kind, isUser, token, selectedRatio, conversationId }: { part: AgentPart; onPick: (s: string) => void; kind: 'image' | 'video'; isUser: boolean; token: string; selectedRatio: string; conversationId: string | null }) {
  switch (part.type) {
    case 'text':
      return <p className="text-sm whitespace-pre-wrap leading-relaxed">{part.text}</p>;
    case 'image': {
      // v3.0.0.3 BUG 修复: part.url 防御 (老 data corruption / 部分响应 可能 url 是 undefined)
      const url = safeStr(part.url);
      if (!url) {
        return <div className="text-[10px] text-red-400/70 italic">[图片 URL 缺失]</div>;
      }
      const isHttp = url.startsWith('http');
      const fullUrl = isHttp ? url : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`;
      // v3.0.0.18: 鉴权 URL (相对路径 /api/agent/uploads/ 或 http 域内的 ab.maque.uno URL) 需要加 ?token= 让浏览器 img 能访问
      //   浏览器 <img> 不会自动带 Authorization header, server 鉴权会 401
      //   安全: token 在用户自己浏览器加载本地图片, 只暴露给 shipin-APP 同源
      const isAuthPath = url.startsWith('/api/agent/uploads/') ||
        /^[a-z]+:\/\/[^\/]*ab\.maque\.uno\//i.test(url);
      const refUrl = (isAuthPath && token) ? `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : fullUrl;
      return (
        <div className="mt-1">
          {part.role === 'reference' ? (
            // v3.0.0: user 上传的参考图, 显示缩略图 (拼 origin 因为 URL 是相对路径)
            <div className="flex items-center gap-2">
              <img
                src={refUrl}
                alt="参考图"
                className="h-20 w-20 object-cover rounded-md border border-white/20"
              />
              <div className="text-xs opacity-80">
                <div className="flex items-center gap-1">
                  <FileText size={10} /> 参考图
                </div>
              </div>
            </div>
          ) : (
            <div>
              <img
                src={refUrl}
                alt="生成结果"
                className="rounded-lg max-w-full max-h-96 object-contain border border-white/20"
                loading="lazy"
              />
              {/* v3.0.0.17: 跟视频一样加下载按钮 (之前只有"另存为") */}
              {(() => {
                const downloadFilename = `deep剧本-图片-${Date.now()}.${url.includes('.png') ? 'png' : 'jpg'}`;
                // v3.0.0.18: 鉴权 URL (相对路径 /api/agent/uploads/ 或同源) 走 /api/download 加 token
                //   ab.maque.uno/... 公网 URL 直接走 /api/download
                const isAbUrl = /^[a-z]+:\/\/[^\/]*ab\.maque\.uno\//i.test(url);
                const href = isHttp && !isAbUrl
                  ? `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(downloadFilename)}&token=${encodeURIComponent(token)}&disposition=attachment`
                  : `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
                return (
                  <div className="flex items-center gap-2 mt-1.5">
                    <a
                      href={href}
                      download={downloadFilename}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 border border-blue-500/30 hover:border-blue-500/60 font-medium transition-colors"
                      title="下载图片 (.png / .jpg) — 保存到本地"
                    >
                      <Download size={14} />
                      下载图片
                    </a>
                    <span className="text-[10px] text-text-tertiary">右键图片也可"另存为"</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      );
    }
    case 'plan': {
      // v3.0.0.13: 极简 passthrough — 只显示用户原文 + 比例
      // v3.0.58 (BUG-128 followup): 加 refImageCount badge + negativePrompt 字段
      //   - refImageCount: UI 显示参考图数量, 让用户知道"模型看图, 文字只补动态"
      //   - negativePrompt: UI 显示排除内容 (三视图展示/走样/低质量 等), 默认模板来自 server DEFAULT_NEGATIVE_PROMPT_VIDEO
      //   - 跟 mobile VideoAgentScreen/ImageAgentScreen 1:1 镜像 (跨端铁律 4++)
      if (!part.data) {
        return <div className="text-[10px] text-red-400/70 italic">[plan data 缺失]</div>;
      }
      const promptText = safeStr(part.data.prompt);
      const aspectText = safeStr(part.data.aspectRatio);
      const refImageCount = typeof part.data.refImageCount === 'number' ? part.data.refImageCount : 0;
      const negativeText = safeStr(part.data.negativePrompt);
      return (
        <div className="mt-1 p-3 rounded-lg bg-black/5 border border-black/10 text-xs space-y-1.5" style={{ color: isUser ? 'white' : undefined }}>
          <div className="font-semibold flex items-center gap-1.5">
            <FileText size={12} /> 提示词方案
          </div>
          {promptText && (
            <div className="leading-relaxed">{promptText}</div>
          )}
          {refImageCount > 0 && (
            <div className="opacity-80 text-[11px] flex items-center gap-1">
              <ImageIcon size={11} className="opacity-60" />
              <span>已用 {refImageCount} 张参考图 (模型已看图, 文字只补动作/场景/运镜/风格)</span>
            </div>
          )}
          {negativeText && (
            <details className="opacity-80 text-[11px]">
              <summary className="cursor-pointer flex items-center gap-1 select-none">
                <Ban size={11} className="opacity-60" />
                <span>排除以下内容 (negative_prompt)</span>
              </summary>
              <div className="mt-1 pl-4 leading-relaxed opacity-70">{negativeText}</div>
            </details>
          )}
          {aspectText && (
            <div className="opacity-70 text-[11px]">比例: {aspectText}</div>
          )}
          <div className="opacity-60 text-[10px]">
            确认后按上面的内容发送给生图大模型
          </div>
        </div>
      );
    }
    case 'question':
      return (
        <div className="mt-1 space-y-2">
          <p className="text-sm">{part.data.question}</p>
          {part.data.options && part.data.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {part.data.options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => onPick(o.label)}
                  className="text-xs px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-full border border-white/20 transition-colors"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    case 'progress':
      return (
        <div className="mt-1 flex items-center gap-2 text-xs">
          <Loader2 size={12} className="animate-spin" />
          <div className="flex-1 bg-white/20 rounded-full h-1.5 overflow-hidden">
            <div className="bg-white h-full transition-all" style={{ width: `${part.value}%` } as CSSProperties} />
          </div>
          <span>{part.value}%{part.label ? ` ${part.label}` : ''}</span>
        </div>
      );
    // v3.0.0.10: 流式生图卡片 — 用户点"确认方案, 出图"后 plan part 原地变成这个, 然后变成图片
    // BUG-119 (v3.0.48): 改用 GeneratingLoader 跨端 1:1 动画 (跟 mobile VideoAgentScreen + ImageAgentScreen 1:1, AGENTS.md § 5.4 强约束)
    // BUG-120 (v3.0.48): 等待动画卡片按用户选的比例显示 (1:1 方形 / 16:9 横屏 / 9:16 竖屏 等), 不再硬编码固定宽高
    case 'streaming': {
      const aspectStyle = getWebAspectStyle(selectedRatio, kind);
      // v3.0.52 (BUG-123): 排队状态 hook — 只在 streaming 阶段轮询, inQueue=false 自动停
      return (
        <StreamingCard
          aspectStyle={aspectStyle}
          stage={part.stage}
          kind={kind}
          isUser={isUser}
          conversationId={conversationId}
        />
      );
    }
      case 'video':
        // v3.0.0.1: local-first 策略
        // 1) 渲染时优先用 /api/agent/video-local/{userId}/{filename}?token=...
        //    - 后端 cacheVideoToLocal 后会 200 + 极速本地磁盘读 (0 外网)
        //    - local 还没缓存时 404, <video> 触发 onError
        // 2) onError fallback 到 /api/download?disposition=inline&token=...
        //    - 后端代理从 agens 拉, 慢 (6-8s) 但能播
        // 这样用户感受: 首次看视频 6-8s (代理) → 后端后台 cache 后刷新页面看 1-2s (本地)
        const filename = videoFilenameFromUrl(part.url);
        const localUrl = buildLocalVideoUrl(useAuthStore.getState().user?.id || '', filename, token);
        const proxyUrl = buildVideoUrl(part.url, `deep剧本-视频-${Date.now()}.mp4`, token, 'inline');
        return (
          <div className="mt-1">
            <video
              key={localUrl}
              src={localUrl}
              controls
              playsInline
              className="rounded-lg max-w-full max-h-96"
              preload="metadata"
              crossOrigin="anonymous"
              onError={(e) => {
                // v3.0.0.1: local 404 → 切到 download proxy
                const v = e.currentTarget;
                if (v.src !== proxyUrl) {
                  console.warn('[AgentChatPanel] local video 404, fallback to proxy', { localUrl, proxyUrl });
                  v.src = proxyUrl;
                }
              }}
            />
            {/* v3.0.31 (S69 BUG-072 E): 视频已生成但扣费失败 (billing_status='unsettled') → 显示"余额不足, 充值后解锁" banner */}
            {(part as any).billingStatus === 'unsettled' && (
              <div className="mt-1.5 p-2.5 rounded-md bg-warning/10 border border-warning/30 flex items-start gap-2">
                <AlertCircle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="font-medium text-warning">余额不足, 充值后解锁视频</div>
                  <div className="opacity-80 mt-0.5 text-text-tertiary">视频已生成但未结算, 充值 ¥0.1 后系统自动解锁</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              {(() => {
                const downloadFilename = `deep剧本-视频-${Date.now()}.mp4`;
                const href = buildDownloadUrl(part.url, downloadFilename, token);
                return (
                  <a
                    href={href}
                    download={downloadFilename}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary transition-colors"
                    title="下载视频 (含 agens 自动配的环境音)"
                  >
                    <Download size={12} />
                    下载视频 (.mp4, 含音频)
                  </a>
                );
              })()}
              <div className="text-[10px] text-text-tertiary italic">
                提示: agens 自动配了环境音 (海浪 / 风声等), 点 ▶ 播放
              </div>
            </div>
          </div>
        );
    case 'error':
      // v3.0.0.17: 增强错误卡片 (用户 #6 需求: 失败也要卡片形式提醒)
      // v3.0.32 BUG-082: 防御性渲染 — part.message 历史上可能是对象 {code, message} (server 没归一), 直接渲染对象会触发 React #31
      const errorMsgText = typeof part.message === 'string'
        ? part.message
        : (part.message && typeof part.message === 'object' && typeof (part.message as any).message === 'string')
          ? (part.message as any).message
          : (typeof part.message === 'object' ? JSON.stringify(part.message) : String(part.message ?? ''));
      return (
        <div className="mt-1 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-red-200">
            <div className="font-medium mb-0.5">生成失败</div>
            <div className="opacity-80">{errorMsgText || '未知错误'}</div>
          </div>
        </div>
      );
    default:
      return null;
  }
}
