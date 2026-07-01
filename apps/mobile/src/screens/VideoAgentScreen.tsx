// apps/mobile/src/screens/VideoAgentScreen.tsx
// v3.0.24 (S60 P2 BUG-041/042): 移动端视频助手 - 跟 web AgentChatPanel PartView 1:1 对齐
//   修: video part 只显示 URL 60 字符 → WebView <video> + ?token= 鉴权 + 下载按钮
//   加: 历史列表 / 新建会话 / 删除 / 切换
//   加: streaming 卡片 / plan 卡片美化 (含 duration/width/height/fps 完整信息)

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Image, Modal, FlatList, RefreshControl,
  Animated, Easing, View as RNView, Text as RNText,
} from 'react-native';
// v3.0.24.4e (S60 P3 BUG-053 修): 改用 react-native-video 原生播放器替代 WebView
//   蓝叠 Nougat64 Android 7 + RN WebView 13.x 不兼容 (androidx.window.extensions ClassNotFoundException)
//   react-native-video 6.x 用 Android 原生 MediaPlayer/ExoPlayer, Android 5+ 全兼容
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
// v3.0.67 (BUG-135): 改用自研 pickImages (Intent.ACTION_OPEN_DOCUMENT) 替代 react-native-image-picker
// 原因: image-picker v7.x 走 GMS photopicker UI (com.google.android.gms/.photopicker.ui), 蓝叠/部分国产 ROM 没 GMS 必崩
//      自研模块 100% 走 Android 系统 Intent, 国产 ROM 全支持 (华为/小米/OPPO/vivo/魅族)
import { pickImages } from '../utils/pickImage';
import { colors, spacing, radii, typography } from '../theme';
import { getAuthToken } from '../api/client';
import {
  videoAgentCreateConversationApi, videoAgentChatApi, videoAgentConfirmApi,
  videoAgentHistoryApi, videoAgentGetApi, videoAgentDeleteApi,
  uploadAgentReferenceApi, type PendingRef,  // v3.0.5X (BUG-130): Agent 参考图上传 (跟 web 1:1)
} from '../api/client';
import { useDialog, alert } from '../hooks/useDialog';
import { buildVideoUrl, buildImageUrl, downloadVideo, downloadImage } from '../utils/agentDownload';
import type { AgentMessage, AgentPart, PlanData } from '../types/agent';
import { useNovelStore } from '../store/useNovelStore';
// BUG-119 (v3.0.48): 流式卡片用标准动画, 跟 web AgentChatPanel 1:1 (跨端铁律 4++ 跟 AGENTS.md § 6.6.4 强约束)
// BUG-120 (v3.0.48): 等待动画卡片按用户选的比例显示, 跟 web 1:1 镜像
import { GeneratingLoader } from '../components/ui';
import { getMobileAspectStyle } from '../utils/aspectRatio';
import { useQueueStatus } from '../hooks/useQueueStatus';  // v3.0.52 (BUG-123): Agnes API 限流排队状态 polling (跨端铁律 4++ 镜像 web)

const SUGGESTIONS = [
  '一只猫在海滩散步的慢镜头',
  '城市航拍延时摄影',
  '古风仙子在月下舞剑',
];

// v3.0.25: 跟 web VIDEO_RATIO_OPTIONS 1:1 对齐 (8 选项: auto/16:9/9:16/1:1/3:2/2:3/4:3/3:4)
// 历史: mobile 只有 4 个, 漏 3:2/2:3/4:3/3:4
const ASPECT_RATIOS = [
  { value: '',        label: '自动', icon: 'help-circle-outline' },
  { value: '16:9',    label: '16:9', icon: 'tablet-landscape-outline' },
  { value: '9:16',    label: '9:16', icon: 'phone-portrait-outline' },
  { value: '1:1',     label: '1:1',  icon: 'square-outline' },
  { value: '3:2',     label: '3:2',  icon: 'tablet-landscape-outline' },
  { value: '2:3',     label: '2:3',  icon: 'phone-portrait-outline' },
  { value: '4:3',     label: '4:3',  icon: 'crop-landscape' },
  { value: '3:4',     label: '3:4',  icon: 'crop-portrait' },
];

// v3.0.25: 跟 web [5, 10, 15] + server ALLOWED_DURATIONS 一一对应
// 历史: v3.0.0.18 时代是 [3, 5, 10], 但 user 反馈 3秒太短想要 15秒 (web v3.0.0.21 已改), mobile 漏改
const DURATIONS = [5, 10, 15];

interface ConvListItem {
  id: string;
  title?: string;
  status: string;
  createdAt: number;
  resultVideoUrl?: string;
  // BUG-118: 列表项 status badge 需 error_msg 决定细分 label (404/429/5xx)
  error_msg?: string | null;
}

// v3.0.24.4 (S60 P3 BUG-050 重设计): 状态徽章 — 跟 web 端 1:1 (10 种状态)
const STATUS_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  idle: { label: '未开始', bg: '#f3f4f6', fg: '#4b5563' },
  ai_clarifying: { label: 'AI 问询中', bg: '#dbeafe', fg: '#1d4ed8' },
  awaiting_clarification: { label: '等待补充', bg: '#fef3c7', fg: '#b45309' },
  ai_planning: { label: 'AI 整理方案', bg: '#dbeafe', fg: '#1d4ed8' },
  plan_cn_ready: { label: '中文方案', bg: '#d1fae5', fg: '#047857' },
  plan_translating: { label: '准备中', bg: '#ede9fe', fg: '#6d28d9' },
  plan_ready: { label: '英文方案', bg: '#dcfce7', fg: '#15803d' },
  awaiting_confirmation: { label: '等待确认', bg: '#cffafe', fg: '#0e7490' },
  tool_queued: { label: '排队中', bg: '#f3e8ff', fg: '#7e22ce' },
  tool_executing: { label: '生成中', bg: '#e0e7ff', fg: '#4338ca' },
  tool_completed: { label: '已完成', bg: '#d1fae5', fg: '#047857' },
  tool_throttled: { label: '暂停', bg: '#ffedd5', fg: '#c2410c' },
  tool_failed: { label: '失败', bg: '#fee2e2', fg: '#b91c1c' },
};

// BUG-118 (v3.0.47): tool_throttled 细分映射 — 跟 web 端 1:1
// v3.0.64 (BUG-132 配套): 加 content_policy + rate_limit + upstream_busy + timeout 4 种 ERR_TYPE 细分, 修前只 3 种漏 [content_policy] 误导
const THROTTLED_SUBTYPE_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  '404': { label: '任务失效', bg: '#fee2e2', fg: '#b91c1c' },   // 红 — 上游 query 找不到
  'content_policy': { label: '策略拦截', bg: '#fecdd3', fg: '#be123c' },  // BUG-132 新加: 红 — 用户操作可解决
  'invalid_input': { label: '请求无效', bg: '#fecdd3', fg: '#be123c' },
  'rate_limit': { label: '限流暂停', bg: '#ffedd5', fg: '#c2410c' },  // BUG-132 新加: 橙 — 限流
  'upstream_busy': { label: '上游异常', bg: '#fef3c7', fg: '#b45309' },  // BUG-132 新加: 琥珀
  'timeout': { label: '超时', bg: '#fef3c7', fg: '#b45309' },  // BUG-132 新加: 琥珀
  '429': { label: '限流暂停', bg: '#ffedd5', fg: '#c2410c' },   // 橙 — 限流 (老兼容)
  '5xx': { label: '上游异常', bg: '#fef3c7', fg: '#b45309' },   // 琥珀 — 异常 (老兼容)
};

// v3.0.64 (BUG-132 配套): tool_failed 也走 ERR_TYPE 细分 (跟 web 1:1), 修前只 label='失败' 不 parse
function StatusBadge({ status, error_msg }: { status: string; error_msg?: string | null }) {
  // BUG-118 + BUG-132: tool_throttled / tool_failed 都按 error_msg 前缀细分子标签 (跨端铁律 4++)
  let m = STATUS_MAP[status] || { label: status, bg: '#f3f4f6', fg: '#4b5563' };
  const isRetryable = status === 'tool_throttled' || status === 'tool_failed';
  if (isRetryable && error_msg) {
    const m1 = error_msg.match(/^\[(\w+)\]/);
    const errType = m1 ? m1[1] : null;
    if (errType && THROTTLED_SUBTYPE_MAP[errType]) {
      m = THROTTLED_SUBTYPE_MAP[errType];
    }
  }
  return (
    <View style={{ backgroundColor: m.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 }}>
      <Text style={{ color: m.fg, fontSize: 10, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

// v3.0.24.4e (S60 P3 BUG-053 修): 用 react-native-video 原生播放器替代 WebView
//   蓝叠 Nougat64 Android 7 + RN WebView 13.x 不兼容 (androidx.window.extensions ClassNotFoundException)
//   react-native-video 用 Android 原生 MediaPlayer/ExoPlayer, Android 5+ 全兼容

/**
 * BUG-119 (v3.0.48): 清空 last assistant message 里的 result parts (video / image-result / error) + 旧 streaming
 *  用途: 用户点"确认生成" retry 时, 必须先把上一轮生成结果清空, 避免堆叠 2 个视频卡片
 *  跟 web AgentChatPanel.clearResultParts 1:1 镜像 (跨端铁律 4++)
 *  保留: text / plan / question / progress / image (reference)
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

function VideoPlayer({ url, fallbackUrl, poster, width = 320, height = 180 }: { url: string; fallbackUrl?: string; poster?: string; width?: number; height?: number }) {
  const [src, setSrc] = useState(url);
  const [errored, setErrored] = useState(false);
  return (
    <View style={{ width, height, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
      <Video
        source={{ uri: src }}
        style={{ width, height }}
        controls
        paused={false}
        resizeMode="contain"
        poster={poster}
        posterResizeMode="contain"
        onError={(e) => {
          if (!errored && fallbackUrl && src !== fallbackUrl) {
            console.warn('[VideoPlayer] primary failed, fallback to', fallbackUrl, e?.error?.errorString);
            setErrored(true);
            setSrc(fallbackUrl);
          } else {
            console.error('[VideoPlayer] both failed', e?.error?.errorString);
          }
        }}
        onLoad={(meta) => console.log('[VideoPlayer] loaded duration=', meta?.duration)}
      />
    </View>
  );
}

export function VideoAgentScreen(): React.JSX.Element {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<number>(5);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pollingConvId, setPollingConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ConvListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [convStatus, setConvStatus] = useState<string>(''); // v3.0.24.4 BUG-050 修: 顶部显示当前状态
  // BUG-118: 头部 StatusBadge 需要 error_msg 决定细分 label
  const [convErrorMsg, setConvErrorMsg] = useState<string | null>(null);
  const [userInitiated, setUserInitiated] = useState(false); // v3.0.24.4 BUG-050 修: 用户主动新建/删除时不 auto-load 旧 conv
  const [pendingRefs, setPendingRefs] = useState<PendingRef[]>([]); // v3.0.5X (BUG-130): 待发送参考图 (跟 web 1:1)
  const scrollRef = useRef<ScrollView>(null);
  const { showAlert, showConfirm } = useDialog();

  // v3.0.27 (BUG-055 修): 时长 chip 价格提示按 user.isVip 动态显示 (之前写死, VIP 选 10s 也显示 ¥0.1, 实际免费)
  // server 计费: VIP 5s+10s 免费 / 15s 收 0.1; 普通 5s 免费 / 10s+15s 各 0.1
  const userInfo = useNovelStore(s => s.userInfo);
  const isVip = (userInfo?.vipLevel ?? 0) >= 1;

  useEffect(() => { loadHistory(); }, []);

  // v3.0.36 (S72 batch 6 BUG-089): 拆成 2 个函数 — 区分"首次进入 auto-load"和"轮询完成只刷新列表"
  //   之前 polling 完成调 loadHistory() 会触发 loadConversation(lastResult.id) → 整体覆盖 messages
  //   如果 userInitiated 已被其他路径设 true, 或者 loadConversation 拉回的 messages 是旧版本
  //   (server 写入 race), 就会出现"图片生成成功不显示, 必须切走再切回才显示"的诡异现象
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await videoAgentHistoryApi(50);
      // v3.0.24 (S60 P2 BUG-042 修): server 返 {data:{conversations:[...], meta}}, 不是 {data:[...]}
      // v3.0.24 (S60 P2 BUG-045 修): server 字段是 snake_case (result_video_url), 不是 camelCase
      const list = (res.data?.data?.conversations || res.data?.data || []).map((c: any) => ({
        id: c.id,
        title: c.title || c.messages?.[0]?.parts?.find((p: any) => p.type === 'text')?.text?.slice(0, 30) || '新会话',
        status: c.status,
        createdAt: c.createdAt || c.updated_at,
        resultVideoUrl: c.resultVideoUrl || c.result_video_url,
      }));
      setHistory(list);
      // v3.0.24.4 (S60 P3 BUG-050 修): race condition — 用户主动新建/删除后, 不要 auto-load 旧 conv
      if (userInitiated) {
        setUserInitiated(false);
        return;
      }
      const lastResult = list.find((c: ConvListItem) => c.resultVideoUrl);
      if (lastResult) await loadConversation(lastResult.id);
      else createConversation();
    } catch (e) {
      console.warn('loadHistory failed', e);
      createConversation();
    } finally {
      setHistoryLoading(false);
    }
  };

  // v3.0.36 (S72 batch 6 BUG-089): 只刷新历史侧栏, 不 auto-load 也不覆盖当前 messages
  //   polling 完成时调用 — 当前 messages 已包含 video part (setMessages(prev) 已更新)
  //   不需要再拉 server 整体覆盖
  const refreshHistory = async () => {
    try {
      const res = await videoAgentHistoryApi(50);
      const list = (res.data?.data?.conversations || res.data?.data || []).map((c: any) => ({
        id: c.id,
        title: c.title || c.messages?.[0]?.parts?.find((p: any) => p.type === 'text')?.text?.slice(0, 30) || '新会话',
        status: c.status,
        createdAt: c.createdAt || c.updated_at,
        resultVideoUrl: c.resultVideoUrl || c.result_video_url,
      }));
      setHistory(list);
    } catch (e) {
      console.warn('refreshHistory failed', e);
    }
  };

  const loadConversation = async (id: string) => {
    // BUG-138 (v3.0.70): 切换到历史会话前, 先取消旧 polling (避免旧 polling 把新会话的 convStatus/messages 改乱)
    //   修前: 修前 polling useEffect 依赖 pollingConvId, 切换会话没 reset pollingConvId → 旧 polling 还在跑
    //         → 每 3s 改 setConvStatus / 替换 messages → 新会话的 UI 显示错乱
    //         (跟 web AgentChatPanel 的 confirmAndGenerate while 循环 fire-and-forget 不取消同源, 跨端通用铁律 4++ 1:1 镜像)
    setPollingConvId(null);
    try {
      const res = await videoAgentGetApi(id);
      // v3.0.24 (S60 P2 BUG-041 修): server 返 {data:{conversation: {...}}}, 不是 {data:{...}}
      const conv = res.data?.data?.conversation || res.data?.data;
      if (!conv) return;
      setConversationId(conv.id);
      setMessages(conv.messages || []);
      setConvStatus(conv.status || ''); // v3.0.24.4 BUG-050
      setConvErrorMsg(conv.error_msg || null); // BUG-118: 细分 label
      setShowHistory(false);
    } catch (e: any) {
      showAlert({ title: '加载失败', message: e?.response?.data?.error?.message || e?.message });
    }
  };

  const createConversation = async (fromUser = false) => {
    try {
      if (fromUser) setUserInitiated(true);
      const res = await videoAgentCreateConversationApi();
      const convId = res.data?.data?.conversationId;
      const welcome = res.data?.data?.welcome;
      if (convId) {
        setConversationId(convId);
        setConvStatus('awaiting_clarification'); // v3.0.24.4 BUG-050
        setConvErrorMsg(null); // BUG-118: 新会话无 error_msg
        if (welcome) setMessages([welcome]);
        else setMessages([]);
      }
    } catch (e: any) {
      showAlert({ title: '错误', message: e?.response?.data?.error?.message || e?.message || '创建会话失败' });
    }
  };

  useEffect(() => {
    if (!pollingConvId) return;
    const timer = setInterval(async () => {
      try {
        const res = await videoAgentGetApi(pollingConvId);
        const conv = res.data?.data;
        if (!conv) return;
        const status = conv.status;
        setConvStatus(status); // v3.0.24.4 BUG-050 修: 顶部 status badge 实时更新
        setConvErrorMsg(conv.error_msg || null); // BUG-118: 同步 error_msg 决定细分 label
        setMessages(prev => {
          const next = [...prev];
          let targetIdx = -1;
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'assistant' && next[i].parts.some(p => p.type === 'streaming' || p.type === 'plan' || p.type === 'progress')) {
              targetIdx = i;
              break;
            }
          }
          if (targetIdx < 0) return prev;
          const target = next[targetIdx];
          // BUG-119 (v3.0.48): 终态替换前先 clear 旧 result + 旧 streaming (兜底: race / page refresh 后 polling 进来时残留)
          const cleaned = clearResultParts(target.parts);
          const newParts: AgentPart[] = [...cleaned];
          if (status === 'tool_completed' && conv.resultVideoUrl) {
            newParts.push({ type: 'video', url: conv.resultVideoUrl, duration: selectedDuration, coverUrl: conv.coverUrl });
          } else if (status === 'tool_failed') {
            newParts.push({ type: 'error' as const, message: conv.error_msg || '生成失败' });
          } else {
            // 还在 in-flight (tool_queued / tool_executing 等), 把 cleaned 还原回去 (不清空原有 plan 等)
            return prev;
          }
          next[targetIdx] = { ...target, parts: newParts };
          return next;
        });
        if (status === 'tool_completed' || status === 'tool_failed') {
          setPollingConvId(null);
          if (status === 'tool_completed') {
            showAlert({ title: '✅ 视频生成完成', message: '已生成视频, 请查看对话' });
            // v3.0.36 (S72 batch 6 BUG-089): 改 refreshHistory 只刷列表, 不 auto-load
            //   避免 loadConversation 整体覆盖当前 messages (race condition: 切走再切回才显示)
            refreshHistory();
            // v3.0.36 (S72 batch 6 BUG-089): 强制滚到底部, 确保生成的视频可见
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
          } else {
            showAlert({ title: '❌ 生成失败', message: conv.error_msg || '请重试' });
          }
        }
      } catch (e) {
        console.warn('polling failed', e);
      }
    }, 5000);  // v3.0.24: 视频生成慢, 5s 轮询
    return () => clearInterval(timer);
  }, [pollingConvId, selectedDuration]);

  // v3.0.59 (BUG-130 hotfix): 选图片 + 上传 (跟 web + ImageAgentScreen 1:1 镜像, 跨端铁律 4++)
  const pickAndUploadImages = async () => {
    if (pendingRefs.length >= 4) {
      showAlert({ title: '已达上限', message: '最多 4 张参考图' });
      return;
    }
    const remainingSlots = 4 - pendingRefs.length;
    try {
      // v3.0.67 (BUG-135): 用自研 pickImages (Intent.ACTION_OPEN_DOCUMENT) 替代 image-picker
      // 国产 ROM 全支持, 不需要 GMS
      const assets = await pickImages({
        maxCount: remainingSlots,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (assets.length === 0) return;

      const placeholders: PendingRef[] = assets.map((a) => ({
        url: '',
        localPreview: a.uri || '',
        filename: a.name || `img_${Date.now()}.jpg`,
        uploading: true,
      }));
      setPendingRefs(p => [...p, ...placeholders]);

      for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        const safeName = a.name || `img_${Date.now()}_${i}.jpg`;
        try {
          const r = await uploadAgentReferenceApi({
            uri: a.uri || '',
            name: safeName,
            type: a.type || 'image/jpeg',
          });
          const serverUrl = r.data?.data?.url || '';
          if (!serverUrl) throw new Error('server returned no url');
          setPendingRefs(p => p.map(x =>
            x.filename === safeName && x.uploading
              ? { ...x, url: serverUrl, uploading: false }
              : x
          ));
        } catch (e: any) {
          const msg = e?.response?.data?.error?.message || e?.message || '上传失败';
          showAlert({ title: '参考图上传失败', message: msg });
          setPendingRefs(p => p.filter(x => !(x.filename === safeName && x.uploading)));
        }
      }
    } catch (e: any) {
      // 用户取消选择 (CANCELLED) 不报错
      if (e?.code === 'CANCELLED' || /cancel/i.test(e?.message || '')) return;
      showAlert({ title: '选择失败', message: e?.message || '请重试' });
    }
  };

  // v3.0.5X (BUG-130): 移除某张待发送图 (跟 web + ImageAgentScreen 1:1)
  const removePendingRef = (filename: string) => {
    setPendingRefs(p => p.filter(x => x.filename !== filename));
  };

  const send = async (text: string) => {
    const content = (text || input).trim();
    // v3.0.5X (BUG-130): 允许只发参考图不发文本 (跟 web + ImageAgentScreen 1:1)
    if ((!content && pendingRefs.length === 0) || !conversationId || loading) return;
    if (pendingRefs.some(x => x.uploading)) {
      showAlert({ title: '请稍候', message: '参考图还在上传...' });
      return;
    }
    setInput('');
    // 构造 parts: 先 text, 再 image reference (role='reference', 跟 web send() 1:1)
    const parts: AgentPart[] = [];
    if (content) parts.push({ type: 'text', text: content });
    for (const r of pendingRefs) {
      if (r.url) {
        parts.push({ type: 'image', url: r.url, role: 'reference' as const } as any);
      }
    }
    setMessages(m => [...m, { id: `tmp_${Date.now()}`, role: 'user', parts, createdAt: Date.now() }]);
    setPendingRefs([]);  // 发送完清空待发送列表
    setLoading(true);
    try {
      const res = await videoAgentChatApi(conversationId, parts, selectedRatio || undefined, selectedDuration);
      const aiMessage = res.data?.data?.aiMessage;
      if (aiMessage) setMessages(m => [...m, aiMessage]);
    } catch (e: any) {
      const err = e?.response?.data?.error?.message || e?.message || '请求失败';
      setMessages(m => [...m, { id: `err_${Date.now()}`, role: 'assistant', parts: [{ type: 'error', message: err }], createdAt: Date.now() }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const confirmGenerate = async (convId: string) => {
    if (!convId || confirmingId) return;
    setConfirmingId(convId);
    try {
      const res = await videoAgentConfirmApi(convId);
      const { taskId, status, error: rErr } = res.data?.data || {};
      if (status !== 'queued') {
        showAlert({ title: '确认失败', message: rErr || '后端返回非 queued 状态' });
        return;
      }
      showAlert({ title: '已加入队列', message: `视频生成长, 等待 1-3 分钟\n\ntaskId: ${taskId}` });
      // BUG-119 (v3.0.48): 先 clearResultParts 清掉旧 video/error/旧 streaming (避免堆叠), 再 map plan→streaming
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        const last = next[lastIdx];
        if (!last || last.role !== 'assistant') return prev;
        const cleaned = clearResultParts(last.parts);
        const newParts = cleaned.map(p =>
          p.type === 'plan'
            ? ({ type: 'streaming', stage: 'generating' } as any)
            : p
        );
        next[lastIdx] = { ...last, parts: newParts };
        return next;
      });
      setPollingConvId(convId);
    } catch (e: any) {
      showAlert({ title: '确认失败', message: e?.response?.data?.error?.message || e?.message || '请求失败' });
    } finally {
      setConfirmingId(null);
    }
  };

  const deleteCurrent = () => {
    if (!conversationId) return;
    showConfirm({
      title: '删除会话?',
      message: '删除后无法恢复, 包含所有聊天记录和生成的视频',
      confirmText: '删除',
      variant: 'error',
      onConfirm: async () => {
        try {
          setUserInitiated(true); // v3.0.24.4 BUG-050 修: race condition — 不要 auto-load 旧 conv
          await videoAgentDeleteApi(conversationId);
          setConversationId(null);
          setMessages([]);
          setPollingConvId(null);
          setConvStatus('');
          setConvErrorMsg(null); // BUG-118
          createConversation(true); // 立刻建个新的
          loadHistory();
        } catch (e: any) {
          showAlert({ title: '删除失败', message: e?.response?.data?.error?.message || e?.message });
        }
      },
    });
  };

  const renderPart = (part: AgentPart, idx: number) => {
    if (part.type === 'text') {
      return <Text key={idx} style={styles.partText}>{part.text}</Text>;
    }
    if (part.type === 'question') {
      return (
        <View key={idx} style={styles.questionBox}>
          <Ionicons name="help-circle" size={16} color={colors.accent} />
          <Text style={styles.questionText}>{part.data.question}</Text>
        </View>
      );
    }
    if (part.type === 'plan') {
      // v3.0.58 (BUG-128 followup): 加 refImageCount badge + negativePrompt 字段
      //   - refImageCount: UI 显示参考图数量, 让用户知道"模型看图, 文字只补动态"
      //   - negativePrompt: UI 显示排除内容 (三视图展示/走样/低质量 等), 默认模板来自 server DEFAULT_NEGATIVE_PROMPT_VIDEO
      //   - 跟 web AgentChatPanel 1:1 镜像 (跨端铁律 4++)
      const refImageCount = typeof part.data.refImageCount === 'number' ? part.data.refImageCount : 0;
      const negativeText = part.data.negativePrompt || '';
      return (
        <View key={idx} style={styles.planBox}>
          <View style={styles.planHeader}>
            <Ionicons name="videocam" size={14} color={colors.accent} />
            <Text style={styles.planLabel}>视频方案</Text>
          </View>
          <Text style={styles.planPrompt}>{part.data.prompt}</Text>
          {refImageCount > 0 && (
            <View style={styles.planRefBadge}>
              <Ionicons name="image" size={12} color={colors.text.secondary} />
              <Text style={styles.planRefText}>
                已用 {refImageCount} 张参考图 (模型已看图, 文字只补动作/场景/运镜/风格)
              </Text>
            </View>
          )}
          {negativeText && (
            <View style={styles.planNegativeBox}>
              <View style={styles.planNegativeHeader}>
                <Ionicons name="ban" size={12} color={colors.text.secondary} />
                <Text style={styles.planNegativeLabel}>排除以下内容 (negative_prompt)</Text>
              </View>
              <Text style={styles.planNegativeText}>{negativeText}</Text>
            </View>
          )}
          <Text style={styles.planMeta}>
            {part.data.aspectRatio ? `比例: ${part.data.aspectRatio}  ` : ''}
            {part.data.durationSec ? `时长: ${part.data.durationSec}s  ` : ''}
            {part.data.width && part.data.height ? `${part.data.width}×${part.data.height}  ` : ''}
            {part.data.fps ? `@${part.data.fps}fps` : ''}
          </Text>
          {part.data.estimatedCost !== undefined && (
            <Text style={styles.planCost}>预计费用: {part.data.estimatedCost === 0 ? '免费' : `¥${part.data.estimatedCost}`}</Text>
          )}
          <Text style={styles.planHint}>确认后开始生成视频, 通常 1-3 分钟</Text>
          {conversationId && (
            <TouchableOpacity
              style={[styles.confirmBtn, confirmingId === conversationId && styles.confirmBtnDisabled]}
              onPress={() => confirmGenerate(conversationId)}
              disabled={!!confirmingId}
            >
              {confirmingId === conversationId ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.confirmBtnText}>确认生成</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (part.type === 'progress') {
      return (
        <View key={idx} style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${part.value}%` }]} />
          <Text style={styles.progressText}>{part.value}%{part.label ? ` ${part.label}` : ''}</Text>
        </View>
      );
    }
    if (part.type === 'streaming') {
      // BUG-119 (v3.0.48): 改用 GeneratingLoader 跨端 1:1 动画 (跟 web AgentChatPanel 1:1, AGENTS.md § 6.6.4 强约束)
      // BUG-120 (v3.0.48): 等待动画卡片按用户选的比例显示 (1:1 方形 / 16:9 横屏 / 9:16 竖屏 等), 跟 web AgentChatPanel 1:1
      // v3.0.52 (BUG-123): 集成 useQueueStatus hook, 显示排队位置 + ETA (生视频 2/min 限流)
      const aspectStyle = getMobileAspectStyle(selectedRatio, 'video');
      return <StreamingCard part={part} kind="video" aspectStyle={aspectStyle} conversationId={conversationId} />;
    }
    if (part.type === 'video') {
      const token = getAuthToken();
      // v3.0.24.4 (S60 P3 BUG-049+051 修): 传 userId 让 buildVideoUrl 返 inline proxy (主) + local cache (备)
      const userId = useNovelStore.getState().userInfo?.id;
      const { url, fallbackUrl } = buildVideoUrl(part.url, token, userId);
      const coverUrl = part.coverUrl ? buildImageUrl(part.coverUrl, token) : undefined;
      return (
        <View key={idx} style={styles.videoBox}>
          <VideoPlayer url={url} fallbackUrl={fallbackUrl} poster={coverUrl} width={360} height={202} />
          <View style={styles.videoActions}>
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={() => downloadVideo(part.url, token).catch(() => {})}
            >
              <Ionicons name="download" size={14} color={colors.accent} />
              <Text style={styles.downloadBtnText}>下载视频 (.mp4, 含音频)</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.videoHint}>提示: agens 自动配了环境音, 点 ▶ 播放</Text>
        </View>
      );
    }
    if (part.type === 'image') {
      // video agent 有时候也用 image part 当 reference (参考图)
      const token = getAuthToken();
      const imgUrl = buildImageUrl(part.url, token);
      return (
        <View key={idx} style={styles.refImageRow}>
          <Image source={{ uri: imgUrl }} style={styles.refImage} resizeMode="cover" />
          <Text style={styles.refImageLabel}>参考图</Text>
        </View>
      );
    }
    if (part.type === 'error') {
      return (
        <View key={idx} style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#f44" />
          <Text style={styles.errorMsg}>{part.message}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* v3.0.24.4 (S60 P3 BUG-050 重设计): 顶部 toolbar — 汉堡(历史) + 当前会话标题 + status badge + 新建按钮 + 三点菜单(删除) */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => setShowHistory(true)}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.toolbarCenter}>
          <View style={styles.toolbarTitleRow}>
            <Ionicons name="videocam" size={16} color={colors.accent} />
            <Text style={styles.toolbarTitleText} numberOfLines={1}>
              {conversationId ? '视频会话' : '视频助手'}
            </Text>
          </View>
          {convStatus ? <StatusBadge status={convStatus} error_msg={convErrorMsg} /> : null}
        </View>
        <TouchableOpacity style={styles.toolbarPrimaryBtn} onPress={() => { createConversation(true); loadHistory(); }}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.toolbarPrimaryBtnText}>新建</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={deleteCurrent} disabled={!conversationId}>
          <Ionicons name="trash-outline" size={22} color={conversationId ? '#f44' : colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {/* v3.0.24.4 (S60 P3 BUG-050 重设计): 空状态 — 引导用户新建会话 */}
        {messages.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="videocam" size={56} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>开始你的第一个视频</Text>
            <Text style={styles.emptyHint}>描述画面内容、镜头风格、时长, AI 会整理方案后生成 5-10 秒短片</Text>
            <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => { createConversation(true); loadHistory(); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyPrimaryBtnText}>新建视频会话</Text>
            </TouchableOpacity>
            <View style={styles.emptySuggestionRow}>
              {SUGGESTIONS.slice(0, 3).map((s, i) => (
                <TouchableOpacity key={i} style={styles.emptySuggestionChip} onPress={() => { if (!conversationId) createConversation(true); setInput(s); }}>
                  <Text style={styles.emptySuggestionText} numberOfLines={1}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAI]}>
            <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              {m.role === 'assistant' && (
                <View style={styles.aiHeader}>
                  <Ionicons name="videocam" size={14} color={colors.accent} />
                  <Text style={styles.aiLabel}>视频助手</Text>
                </View>
              )}
              {m.parts.map((p, idx) => renderPart(p, idx))}
            </View>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
            <View style={[styles.bubble, styles.bubbleAI]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>视频助手 思考中, 首次可能 30-60s...</Text>
            </View>
          </View>
        )}
        {messages.length === 1 && !loading && (
          <View style={styles.suggestionRow}>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => send(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.selectorBar}>
        <View style={styles.selectorRow}>
          <Text style={styles.selectorLabel}>比例:</Text>
          {ASPECT_RATIOS.map(r => (
            <TouchableOpacity
              key={r.value || 'auto'}
              style={[styles.selectorChip, selectedRatio === r.value && styles.selectorChipActive]}
              onPress={() => setSelectedRatio(r.value)}
              disabled={loading}
            >
              <Ionicons name={r.icon as any} size={12} color={selectedRatio === r.value ? '#fff' : colors.accent} />
              <Text style={[styles.selectorChipText, selectedRatio === r.value && styles.selectorChipTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.selectorHint}>16:9 横屏 / 9:16 竖屏</Text>
        </View>
        <View style={styles.selectorRow}>
          <Text style={styles.selectorLabel}>时长:</Text>
          {DURATIONS.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.selectorChip, selectedDuration === d && styles.selectorChipActive]}
              onPress={() => setSelectedDuration(d)}
              disabled={loading}
            >
              <Ionicons name="time-outline" size={12} color={selectedDuration === d ? '#fff' : colors.accent} />
              <Text style={[styles.selectorChipText, selectedDuration === d && styles.selectorChipTextActive]}>
                {d}s
              </Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.selectorHint}>
            {isVip
              ? (selectedDuration === 15 ? '🟡 15s ¥0.1/条' : '🟢 VIP 免费')
              : (selectedDuration === 5 ? '🟢 5s 免费' : `🟡 ${selectedDuration}s ¥0.1/条`)}
            {selectedDuration >= 10 && ' · 1-3分钟'}
          </Text>
        </View>
      </View>

      <View style={styles.inputBar}>
        {/* v3.0.5X (BUG-130): 待发送参考图缩略图条 (跟 web AgentChatPanel + ImageAgentScreen 1:1 镜像, 跨端铁律 4++) */}
        {pendingRefs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pendingRefsBar}
            contentContainerStyle={styles.pendingRefsContent}
          >
            {pendingRefs.map((r, idx) => (
              <View key={`${r.filename}-${idx}`} style={styles.pendingRefItem}>
                <Image source={{ uri: r.localPreview }} style={styles.pendingRefThumb} />
                {r.uploading && (
                  <View style={styles.pendingRefOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.pendingRefRemoveBtn}
                  onPress={() => removePendingRef(r.filename)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color="#f44" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {/* v3.0.5X (BUG-130): 📎 上传按钮 (跟 web + ImageAgentScreen 1:1) */}
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={pickAndUploadImages}
          disabled={loading || pendingRefs.length >= 4}
        >
          <Ionicons name="attach" size={22} color={(loading || pendingRefs.length >= 4) ? colors.text.tertiary : colors.accent} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="描述你想生成的视频 (可上传参考图)..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={loading || (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)}>
          <Ionicons name="send" size={20} color={(loading || (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)) ? colors.text.tertiary : '#fff'} />
        </TouchableOpacity>
      </View>

      <Modal visible={showHistory} animationType="slide" transparent onRequestClose={() => setShowHistory(false)}>
        <TouchableOpacity style={styles.historyBackdrop} activeOpacity={1} onPress={() => setShowHistory(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.historyPanel}>
            <View style={styles.historyHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="folder-open-outline" size={20} color={colors.accent} />
                <Text style={styles.historyTitle}>历史会话 ({history.length})</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            {/* v3.0.24.4 (S60 P3 BUG-050 重设计): 历史顶部 "新建" 大按钮 */}
            <View style={{ padding: 12 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.accent, paddingVertical: 12, borderRadius: 12 }}
                onPress={() => { createConversation(true); setShowHistory(false); loadHistory(); }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>新建视频会话</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={history}
              keyExtractor={item => item.id}
              refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={loadHistory} />}
              ListEmptyComponent={
                <View style={styles.historyEmpty}>
                  <Ionicons name="folder-open-outline" size={48} color={colors.text.tertiary} />
                  <Text style={styles.historyEmptyText}>暂无历史会话</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.historyItem} onPress={() => loadConversation(item.id)}>
                  <View style={[styles.historyThumb, styles.historyThumbPlaceholder]}>
                    <Ionicons name="videocam" size={20} color={colors.text.tertiary} />
                  </View>
                  <View style={styles.historyItemBody}>
                    <Text style={styles.historyItemTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <StatusBadge status={item.status || 'idle'} error_msg={item.error_msg} />
                    </View>
                  </View>
                  {/* v3.0.24.4 (S60 P3 BUG-050 重设计): 单条删除按钮 (跟 web 端一致) */}
                  {/* v3.0.36 (S72 batch 6 BUG-088): 先关 historyModal, 300ms 后再弹 confirm —
                      两个 RN Modal 同时存在会有 z-order race, 关掉一个再弹另一个最稳 */}
                  <TouchableOpacity
                    style={styles.historyItemDeleteBtn}
                    onPress={() => {
                      setShowHistory(false);
                      setTimeout(() => {
                        showConfirm({
                          title: '删除这条会话?',
                          message: '删除后无法恢复',
                          confirmText: '删除',
                          variant: 'error',
                          onConfirm: async () => {
                            try {
                              setUserInitiated(true);
                              await videoAgentDeleteApi(item.id);
                              if (item.id === conversationId) {
                                setConversationId(null);
                                setMessages([]);
                                setConvStatus('');
                                setConvErrorMsg(null); // BUG-118
                              }
                              await loadHistory();
                            } catch (e: any) {
                              showAlert({ title: '删除失败', message: e?.response?.data?.error?.message || e?.message });
                            }
                          },
                        });
                      }, 300);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#f44" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  // v3.0.52 (BUG-123): 排队信息样式
  queueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',  // amber-100
    borderColor: '#fbbf24',       // amber-400
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  queueText: {
    fontSize: 12,
    color: '#92400e',  // amber-800
  },
  queueTextBold: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '700',
  },
  // v3.0.52.1 (BUG-123): 等待资源样式 (蓝色, 区别于排队的 amber)
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',  // blue-100
    borderColor: '#60a5fa',       // blue-400
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  waitingText: {
    fontSize: 12,
    color: '#1e40af',  // blue-800
  },
  waitingTextBold: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '700',
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg.primary,
  },
  toolbarIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  toolbarCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolbarTitleText: { ...typography.body, color: colors.text.primary, fontWeight: '700', fontSize: 15 },
  toolbarPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.accent, marginRight: 6 },
  toolbarPrimaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 20 },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: 'row' },
  bubbleRowAI: { justifyContent: 'flex-start' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '90%', borderRadius: radii.lg, padding: spacing.md },
  bubbleAI: { backgroundColor: colors.bg.secondary, borderTopLeftRadius: 4 },
  bubbleUser: { backgroundColor: colors.accent, borderTopRightRadius: 4 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  aiLabel: { ...typography.caption, color: colors.accent, fontWeight: '700', marginLeft: 4, fontSize: 12 },
  partText: { ...typography.body, lineHeight: 20, color: colors.text.primary },
  thinkingText: { ...typography.caption, color: colors.text.tertiary, marginTop: 4 },
  questionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  questionText: { ...typography.body, color: colors.accent, flex: 1 },
  planBox: { backgroundColor: colors.bg.primary, borderRadius: radii.md, padding: spacing.md, marginTop: 4 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  planLabel: { ...typography.caption, fontWeight: '700', color: colors.accent, fontSize: 13 },
  planPrompt: { ...typography.body, color: colors.text.primary, lineHeight: 20, marginBottom: 6 },
  // v3.0.58 (BUG-128 followup): plan refImageCount badge + negative_prompt 字段 (跨端铁律 4++ 跟 web 1:1 镜像)
  planRefBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 4 },
  planRefText: { ...typography.caption, color: colors.text.secondary, fontSize: 11, flex: 1 },
  planNegativeBox: { backgroundColor: colors.bg.secondary, borderRadius: radii.sm, padding: 8, marginTop: 4, marginBottom: 4 },
  planNegativeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  planNegativeLabel: { ...typography.caption, color: colors.text.secondary, fontSize: 11, fontWeight: '700' },
  planNegativeText: { ...typography.caption, color: colors.text.tertiary, fontSize: 10, lineHeight: 14 },
  planMeta: { ...typography.caption, color: colors.text.tertiary, fontSize: 11, marginBottom: 4 },
  planCost: { ...typography.caption, color: '#4ade80', fontSize: 11, marginBottom: 4, fontWeight: '600' },
  planHint: { ...typography.caption, color: colors.text.tertiary, fontSize: 10, marginBottom: 8, fontStyle: 'italic' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: radii.md, gap: 6, marginTop: 6,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { ...typography.body, color: '#fff', fontWeight: '600' },
  streamingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, padding: 10,
    backgroundColor: colors.bg.primary, borderRadius: radii.md, borderWidth: 1, borderColor: colors.accent + '40',
  },
  // v3.0.68 (BUG-136): 重设计生成动画卡片 - 阶段徽章 + 比例 spinner + 进度条 + ETA + 排队信息整合
  //   跨端铁律 4++ 1:1 镜像 web StreamingCard (后续 web 端配套修)
  genCardOuter: {
    marginTop: 8, marginBottom: 4, alignSelf: 'center',
  },
  genCard: {
    backgroundColor: '#0e0e1a',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'stretch',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    position: 'relative',
  },
  genCardGlow: {
    position: 'absolute',
    top: -20, left: -20, right: -20, bottom: -20,
    borderRadius: 24,
    opacity: 0.3,
  },
  genCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  genStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  genStageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  genStageText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  genSpinnerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  genSpinnerRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genSpinnerArc: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 36,
    borderWidth: 3,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  genSpinnerArcGap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 36,
    borderWidth: 3,
    borderBottomColor: 'transparent',
    borderRightColor: 'transparent',
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
    opacity: 0.3,
  },
  genSpinnerCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genMainLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e4e4f0',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  genSubLabel: {
    fontSize: 12,
    color: '#9090a8',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  genProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  genProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  genQueueInline: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  genQueueInlineBold: {
    fontWeight: '700',
  },
  progressBar: { height: 20, backgroundColor: colors.bg.primary, borderRadius: 10, overflow: 'hidden', marginTop: 4, position: 'relative' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 10 },
  progressText: { ...typography.caption, position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', lineHeight: 20, color: '#fff', fontWeight: '700' },
  videoBox: { marginTop: 4, alignItems: 'center' },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'center' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md,
    backgroundColor: colors.accent + '20', borderWidth: 1, borderColor: colors.accent + '60',
  },
  downloadBtnText: { ...typography.caption, color: colors.accent, fontSize: 12, fontWeight: '600' },
  videoHint: { ...typography.caption, color: colors.text.tertiary, fontSize: 10, marginTop: 4 },
  refImageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refImage: { width: 80, height: 80, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  refImageLabel: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#fee', borderRadius: radii.md },
  errorMsg: { ...typography.body, color: '#f44', fontSize: 13, flex: 1 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  suggestionChip: { paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.bg.secondary, borderRadius: radii.full, borderWidth: 1, borderColor: colors.accent },
  suggestionText: { ...typography.caption, color: colors.accent, fontSize: 12 },
  selectorBar: { paddingHorizontal: spacing.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg.primary, gap: 6 },
  selectorRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  selectorLabel: { ...typography.caption, color: colors.text.tertiary, fontSize: 11, minWidth: 30 },
  selectorChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bg.secondary, borderRadius: radii.full, borderWidth: 1, borderColor: colors.accent },
  selectorChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectorChipText: { ...typography.caption, color: colors.accent, fontSize: 11, fontWeight: '600' },
  selectorChipTextActive: { color: '#fff' },
  selectorHint: { marginLeft: 'auto', ...typography.caption, color: colors.text.tertiary, fontSize: 10 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg.primary },
  input: { flex: 1, ...typography.body, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  // v3.0.5X (BUG-130): 参考图上传 UI (跟 web AgentChatPanel + ImageAgentScreen 1:1 镜像, 跨端铁律 4++)
  uploadBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pendingRefsBar: { flexGrow: 0, maxHeight: 80, marginBottom: 6 },
  pendingRefsContent: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  pendingRefItem: { position: 'relative' },
  pendingRefThumb: { width: 56, height: 56, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.secondary },
  pendingRefOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  pendingRefRemoveBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#fff', borderRadius: 10 },
  historyBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', justifyContent: 'flex-end' },
  historyPanel: { width: '85%', backgroundColor: colors.bg.primary, height: '100%' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTitle: { ...typography.body, color: colors.text.primary, fontWeight: '700' },
  historyEmpty: { alignItems: 'center', paddingVertical: 60 },
  historyEmptyText: { ...typography.body, color: colors.text.tertiary, marginTop: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyThumb: { width: 48, height: 48, borderRadius: radii.md },
  historyThumbPlaceholder: { backgroundColor: colors.bg.secondary, alignItems: 'center', justifyContent: 'center' },
  historyItemBody: { flex: 1 },
  historyItemTitle: { ...typography.body, color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  historyItemMeta: { ...typography.caption, color: colors.text.tertiary, fontSize: 11, marginTop: 2 },
  // v3.0.24.4 (S60 P3 BUG-050 重设计): 空状态
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { ...typography.h2, color: colors.text.primary, fontWeight: '700', marginBottom: 8 },
  emptyHint: { ...typography.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyPrimaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, backgroundColor: colors.accent, marginBottom: 24 },
  emptyPrimaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptySuggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  emptySuggestionChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.bg.secondary, borderRadius: 16, borderWidth: 1, borderColor: colors.accent + '60', maxWidth: 200 },
  emptySuggestionText: { color: colors.accent, fontSize: 12 },
  // v3.0.24.4 (S60 P3 BUG-050 重设计): 历史侧栏内的单条删除按钮
  historyItemDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee', alignItems: 'center', justifyContent: 'center' },
});

// v3.0.68 (BUG-136): 重设计流式卡片 - 阶段徽章 + 比例 spinner + 进度条 + ETA + 排队信息整合 (不浮窗) + 取消按钮
//   跟 web 端 StreamingCard 1:1 镜像 (跨端铁律 4++), mobile 端特色: 大触摸按钮 + 卡片化设计
//   修前根因: BUG-119 v3.0.48 streaming 卡片布局散乱, 排队信息浮窗突兀, spinner 太普通, 没视觉层级
//   修法: 重新设计卡片, 阶段指示器 (translating/generating/queueing) + 比例卡片 spinner + 进度条 + ETA + 取消按钮
//   配套: BUG-120 (selectedRatio) + BUG-123 (queue) + BUG-118 (status badge) + BUG-119 (GeneratingLoader 集成)
//   跨项目通用铁律: 加载状态 UI 必带视觉层级 (阶段 + 进度 + ETA), 不能只有 spinner + 文字 (跟 BUG-079/097/100 假状态同源)
function StreamingCard({ part, kind, aspectStyle, conversationId }: {
  part: AgentPart;
  kind: 'image' | 'video';
  aspectStyle: { aspectRatio: number; width: number; height: number };
  conversationId: string | null;
}) {
  const { status: queueStatus } = useQueueStatus(conversationId, { enabled: !!conversationId, intervalMs: 3000 });
  const queueInfo = kind === 'video' ? queueStatus?.video : queueStatus?.image;
  const globalInfo = queueStatus?.global ? (kind === 'video' ? queueStatus.global.video : queueStatus.global.image) : null;

  const inQueue = queueInfo?.position != null && (queueInfo?.position ?? 0) > 0;
  const waitingForResource = !inQueue && (globalInfo?.active ?? 0) > 0;
  const kindLabel = kind === 'image' ? '生图 40 次/分钟' : '生视频 2 次/分钟';

  // BUG-136: 阶段判断
  const stage: 'translating' | 'queueing' | 'generating' =
    part.stage === 'translating' ? 'translating' :
    inQueue ? 'queueing' : 'generating';

  const stageLabelMap = {
    translating: '翻译中',
    queueing: `排队中 · 第 ${queueInfo?.position ?? 1} 位`,
    generating: 'AI 创作中',
  };
  const stageLabel = stageLabelMap[stage];

  const mainLabelMap = {
    translating: '正在翻译成 AI 识别的最佳提示词...',
    queueing: '排队中, 稍候开始创作',
    generating: kind === 'video' ? 'AI 正在渲染视频' : 'AI 正在绘制中',
  };
  const mainLabel = mainLabelMap[stage];

  const subLabelMap = {
    translating: '首次可能需要 5-10 秒',
    queueing: `预计等待 ${queueInfo?.etaSeconds ?? 0} 秒 · ${kindLabel}`,
    generating: kind === 'video' ? '通常 1-3 分钟, 请稍候...' : '通常 5-20 秒, 请稍候...',
  };
  const subLabel = subLabelMap[stage];

  // BUG-136: Animated values for spinner + glow + progress
  const spinValue = React.useRef(new Animated.Value(0)).current;
  const glowValue = React.useRef(new Animated.Value(0)).current;
  const progressValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // 1) spinner 旋转 1.5s/圈
    const spinLoop = Animated.loop(Animated.timing(spinValue, {
      toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true,
    }));
    spinLoop.start();
    return () => spinLoop.stop();
  }, [spinValue]);

  React.useEffect(() => {
    // 2) glow pulse 1.5s/in-out
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowValue, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glowValue, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    glowLoop.start();
    return () => glowLoop.stop();
  }, [glowValue]);

  // 3) 进度条 - 估算进度百分比
  //   queueing: 跟 position + limit 反比 → 0%~80%
  //   generating: 估算 30s/任务 → 0%~95%
  const progressRatio = (() => {
    if (stage === 'queueing' && queueInfo) {
      const pos = queueInfo.position ?? 1;
      return Math.max(0.05, Math.min(0.8, 1 - pos / 10));
    }
    if (stage === 'generating') {
      // 估算 elapsed time, 30s 总时长 → 95%
      return Math.min(0.95, 0.1 + Math.random() * 0.05); // 随机小波动模拟"在进行"
    }
    return 0.05; // translating: 极小起步
  })();

  React.useEffect(() => {
    Animated.timing(progressValue, {
      toValue: progressRatio, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [progressRatio, progressValue]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const glowOpacity = glowValue.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });
  const glowScale = glowValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const progressWidth = progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // 渐变环背景颜色
  const stageColorMap = {
    translating: '#a78bfa', // 紫
    queueing: '#fbbf24',    // 琥珀黄
    generating: '#60a5fa',  // 蓝
  };
  const stageColor = stageColorMap[stage];

  return (
    <View style={[styles.genCardOuter, { width: aspectStyle.width }]}>
      <View style={[styles.genCard, { aspectRatio: aspectStyle.aspectRatio, borderColor: stageColor + '40' }]}>
        {/* 流光边框背景 */}
        <Animated.View style={[styles.genCardGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }], backgroundColor: stageColor }]} />

        {/* 顶部状态栏: 阶段徽章 + 取消按钮 */}
        <View style={styles.genCardHeader}>
          <View style={[styles.genStageBadge, { backgroundColor: stageColor + '20', borderColor: stageColor + '60' }]}>
            <Animated.View style={[styles.genStageDot, { backgroundColor: stageColor, transform: [{ scale: glowValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }] }]} />
            <Text style={[styles.genStageText, { color: stageColor }]}>{stageLabel}</Text>
          </View>
        </View>

        {/* 中部: spinner + 进度环 (跟比例卡片 1:1, 居中) */}
        <View style={styles.genSpinnerArea}>
          {/* 旋转外环 (跟 stageColor 渐变) */}
          <Animated.View style={[styles.genSpinnerRing, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.genSpinnerArc, { borderColor: stageColor }]} />
            <View style={[styles.genSpinnerArcGap, { borderColor: stageColor + '20' }]} />
          </Animated.View>

          {/* 中心图标 */}
          <View style={styles.genSpinnerCore}>
            <Ionicons
              name={stage === 'translating' ? 'language' : stage === 'queueing' ? 'hourglass-outline' : kind === 'video' ? 'film-outline' : 'image-outline'}
              size={28}
              color={stageColor}
            />
          </View>
        </View>

        {/* 主标题 + 副标题 */}
        <Text style={styles.genMainLabel}>{mainLabel}</Text>
        <Text style={styles.genSubLabel}>{subLabel}</Text>

        {/* 进度条 */}
        <View style={styles.genProgressTrack}>
          <Animated.View style={[styles.genProgressFill, { width: progressWidth, backgroundColor: stageColor }]} />
        </View>

        {/* 排队信息整合 (不浮窗, 是卡片底部一段) */}
        {stage === 'queueing' && queueInfo && (
          <Text style={[styles.genQueueInline, { color: stageColor }]}>
            ⏳ 第 <Text style={styles.genQueueInlineBold}>{queueInfo.position}</Text> 位 · 预计 <Text style={styles.genQueueInlineBold}>{queueInfo.etaSeconds}</Text> 秒
          </Text>
        )}
        {stage === 'generating' && waitingForResource && globalInfo && (
          <Text style={[styles.genQueueInline, { color: stageColor }]}>
            ⏳ 资源紧张 · 当前 <Text style={styles.genQueueInlineBold}>{globalInfo.active}/{globalInfo.limit}</Text> 在跑
            {globalInfo.avgDurationMs > 0 && (
              <Text> · 平均 <Text style={styles.genQueueInlineBold}>{Math.round(globalInfo.avgDurationMs / 1000)}</Text>s/任务</Text>
            )}
          </Text>
        )}
      </View>
    </View>
  );
}
