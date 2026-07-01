// apps/mobile/src/screens/ImageAgentScreen.tsx
// v3.0.24 (S60 P2 BUG-041/042): 移动端生图助手 - 跟 web AgentChatPanel PartView 1:1 对齐
//   修: image agent 调错 /video-agent/confirm → /image-agent/confirm
//   修: image part 只显示 URL 60 字符 → RN <Image> + ?token= 鉴权 + 下载按钮
//   加: 历史列表 / 新建会话 / 删除 / 切换
//   加: streaming 卡片 / plan 卡片美化
//   加: translate-plan + update plan fields (image 端, 跟 web 一致)
// v3.0.24.4 (S60 P3 BUG-050 重设计): toolbar 改版 + StatusBadge + 空状态大引导按钮 + race condition fix + 历史侧栏新建大按钮 + 单条删除

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Image, Modal, FlatList, RefreshControl,
  Animated, Easing,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// v3.0.67 (BUG-135): 改用自研 pickImages (Intent.ACTION_OPEN_DOCUMENT) 替代 react-native-image-picker
//   原因: image-picker v7.x Android 13+ 走 androidx PickVisualMedia contract, fallback 到 GMS photopicker UI,
//         蓝叠/部分国产 ROM 没 GMS 必崩 "An unexpected error occurred"
//   自研模块 100% 走 Android 系统 Intent.ACTION_OPEN_DOCUMENT + createChooser, 国产 ROM 全支持
//   跨项目通用铁律: 用户体验优先 (跨端铁律 4++), 自研 native module 比依赖第三方 picker 更可控
import { pickImages } from '../utils/pickImage';
import { colors, spacing, radii, typography } from '../theme';
import { getAuthToken } from '../api/client';
import { ImageWithLoading, GeneratingLoader } from '../components/ui';
import { getMobileAspectStyle } from '../utils/aspectRatio';
import { useQueueStatus } from '../hooks/useQueueStatus';  // v3.0.52 (BUG-123): Agnes API 限流排队状态 polling (跨端铁律 4++ 镜像 web)
import {
  imageAgentCreateConversationApi, imageAgentChatApi, imageAgentConfirmApi,
  imageAgentHistoryApi, imageAgentGetApi, imageAgentDeleteApi,
  imageAgentTranslatePlanApi, imageAgentUpdatePlanFieldsApi,
  uploadAgentReferenceApi, type PendingRef,  // v3.0.5X (BUG-130): Agent 参考图上传 (跟 web 1:1)
} from '../api/client';
import { useDialog, alert } from '../hooks/useDialog';
import { buildImageUrl, buildDownloadUrl, downloadImage } from '../utils/agentDownload';
import type { AgentMessage, AgentPart, PlanData } from '../types/agent';

const SUGGESTIONS = [
  '做一个精美女战士, 短发, 持剑',
  '古风山水插画, 飘逸',
  '赛博朋克夜城, 霓虹',
];

// v3.0.25: 跟 web RATIO_OPTIONS 1:1 对齐 (9 选项, v3.0.54 BUG-124 移除 4K/8K)
// 历史: mobile 只有 6 个 (auto/1:1/16:9/9:16/4:3/3:4), 漏 2:3/3:2/2K, 后补
// v3.0.54 (BUG-124): 4K / 8K 移除 (agens 不支持 2048+ 分辨率生成)
const ASPECT_RATIOS = [
  { value: '',        label: '自动', icon: 'help-circle-outline' },
  { value: '1:1',     label: '1:1',  icon: 'square-outline' },
  { value: '16:9',    label: '16:9', icon: 'tablet-landscape-outline' },
  { value: '9:16',    label: '9:16', icon: 'phone-portrait-outline' },
  { value: '4:3',     label: '4:3',  icon: 'crop-landscape' },
  { value: '3:4',     label: '3:4',  icon: 'crop-portrait' },
  { value: '2:3',     label: '2:3',  icon: 'phone-portrait-outline' },
  { value: '3:2',     label: '3:2',  icon: 'tablet-landscape-outline' },
  { value: '2K',      label: '2K',   icon: 'square-outline' },
];

/**
 * BUG-119 (v3.0.48): 清空 last assistant message 里的 result parts (image-result / video / error) + 旧 streaming
 *  用途: 用户点"确认方案" retry 时, 必须先把上一轮生成结果清空, 避免堆叠 2 个图片卡片
 *  跟 web AgentChatPanel.clearResultParts + mobile VideoAgentScreen.clearResultParts 1:1 镜像 (跨端铁律 4++)
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

interface ConvListItem {
  id: string;
  title?: string;
  status: string;
  createdAt: number;
  resultImageUrl?: string;
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

// v3.0.64 (BUG-132 配套): image 跟 video 1:1 镜像, tool_throttled + tool_failed 都 parse ERR_TYPE
// 修前 ImageAgentScreen 完全没 parse, 只 label='限流暂停' / '失败' (更粗), 用户看不到 content_policy 等细分
const SUBTYPE_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  content_policy: { label: '策略拦截', bg: '#fecdd3', fg: '#be123c' },  // BUG-132 新加: 红
  invalid_input: { label: '请求无效', bg: '#fecdd3', fg: '#be123c' },
  rate_limit: { label: '限流', bg: '#ffedd5', fg: '#c2410c' },          // 橙
  '429': { label: '限流', bg: '#ffedd5', fg: '#c2410c' },               // 老兼容
  upstream_busy: { label: '上游异常', bg: '#fef3c7', fg: '#b45309' },    // 琥珀
  '5xx': { label: '上游异常', bg: '#fef3c7', fg: '#b45309' },            // 老兼容
  timeout: { label: '超时', bg: '#fef3c7', fg: '#b45309' },
  '404': { label: '任务失效', bg: '#fee2e2', fg: '#b91c1c' },            // 红
};

function StatusBadge({ status, error_msg }: { status: string; error_msg?: string | null }) {
  // BUG-118 + BUG-132: tool_throttled / tool_failed 都按 error_msg 前缀细分子标签 (跟 video 1:1, 跨端铁律 4++)
  // v3.0.71 (BUG-139): UPSTREAM_BUSY 重试用完后 label "上游异常" → "上游持续繁忙" (区别自动重试中的状态)
  let m = STATUS_MAP[status] || { label: status, bg: '#f3f4f6', fg: '#4b5563' };
  const isRetryable = status === 'tool_throttled' || status === 'tool_failed';
  if (isRetryable && error_msg) {
    const m1 = error_msg.match(/^\[(\w+)\]/);
    const errType = m1 ? m1[1] : null;
    if (errType && SUBTYPE_MAP[errType]) {
      m = SUBTYPE_MAP[errType];
    }
  }
  // v3.0.71 (BUG-139): tool_queued/tool_executing + error_msg 含 [upstream_busy] → "排队中(自动重试)" 琥珀色
  //   image 跟 video 不同: image agent 没有单独的 tool_queued 阶段, 直接 tool_executing (跟 video agent 区别)
  //   用户看到 server 端在自动重试 (10s 一次, 上限 60 次 = 10 分钟), 而不是失败
  if ((status === 'tool_queued' || status === 'tool_executing') && error_msg && /^\[upstream_busy\]/.test(error_msg)) {
    m = { label: '排队中(自动重试)', bg: '#fef3c7', fg: '#b45309' };
  }
  return (
    <View style={{ backgroundColor: m.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 2 }}>
      <Text style={{ color: m.fg, fontSize: 10, fontWeight: '700' }}>{m.label}</Text>
    </View>
  );
}

export function ImageAgentScreen(): React.JSX.Element {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRatio, setSelectedRatio] = useState<string>('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pollingConvId, setPollingConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ConvListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [convStatus, setConvStatus] = useState<string>(''); // v3.0.24.4 BUG-050: 顶部 status badge
  // BUG-134 (v3.0.66): 顶部 StatusBadge 需要 error_msg 渲染细分 label (跟 VideoAgentScreen 1:1 镜像)
  // 修前 line 612 误用 useEffect 局部变量 `conv`, 不在 render scope, 进生图 tab 立即 ReferenceError 白屏
  const [convErrorMsg, setConvErrorMsg] = useState<string | null>(null);
  const [userInitiated, setUserInitiated] = useState(false); // v3.0.24.4 BUG-050: race condition
  const [pendingRefs, setPendingRefs] = useState<PendingRef[]>([]); // v3.0.5X (BUG-130): 待发送参考图 (跟 web 1:1)
  const scrollRef = useRef<ScrollView>(null);
  const { showAlert, showConfirm } = useDialog();

  // v3.0.24: 进入屏先拉历史, 如果有最近 result 图就显示; 否则 createConversation
  useEffect(() => { loadHistory(); }, []);

  // v3.0.36 (S72 batch 6 BUG-089): 拆成 2 个函数 — 区分"首次进入 auto-load"和"轮询完成只刷新列表"
  //   之前 polling 完成调 loadHistory() 会触发 loadConversation(lastResult.id) → 整体覆盖 messages
  //   如果 userInitiated 已被其他路径设 true, 或者 loadConversation 拉回的 messages 是旧版本
  //   (server 写入 race), 就会出现"图片生成成功不显示, 必须切走再切回才显示"的诡异现象
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await imageAgentHistoryApi(50);
      // v3.0.24 (S60 P2 BUG-042 修): server 返 {data:{conversations:[...], meta}}, 不是 {data:[...]}
      // v3.0.24 (S60 P2 BUG-045 修): server 字段是 snake_case (result_image_url), 不是 camelCase
      const list = (res.data?.data?.conversations || res.data?.data || []).map((c: any) => ({
        id: c.id,
        title: c.title || c.messages?.[0]?.parts?.find((p: any) => p.type === 'text')?.text?.slice(0, 30) || '新会话',
        status: c.status,
        createdAt: c.createdAt || c.updated_at,
        resultImageUrl: c.resultImageUrl || c.result_image_url,
      }));
      setHistory(list);
      // v3.0.24.4 (S60 P3 BUG-050 修): race condition — 用户主动新建/删除后, 不要 auto-load 旧 conv
      if (userInitiated) {
        setUserInitiated(false);
        return;
      }
      // 自动加载最近一条有 result 的会话
      const lastResult = list.find((c: ConvListItem) => c.resultImageUrl);
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
  //   polling 完成时调用 — 当前 messages 已包含 image part (setMessages(prev) 已更新)
  //   不需要再拉 server 整体覆盖
  const refreshHistory = async () => {
    try {
      const res = await imageAgentHistoryApi(50);
      const list = (res.data?.data?.conversations || res.data?.data || []).map((c: any) => ({
        id: c.id,
        title: c.title || c.messages?.[0]?.parts?.find((p: any) => p.type === 'text')?.text?.slice(0, 30) || '新会话',
        status: c.status,
        createdAt: c.createdAt || c.updated_at,
        resultImageUrl: c.resultImageUrl || c.result_image_url,
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
      const res = await imageAgentGetApi(id);
      // v3.0.24 (S60 P2 BUG-041 修): server 返 {data:{conversation: {...}}}, 不是 {data:{...}}
      const conv = res.data?.data?.conversation || res.data?.data;
      if (!conv) return;
      setConversationId(conv.id);
      setMessages(conv.messages || []);
      setConvStatus(conv.status || ''); // v3.0.24.4 BUG-050
      setConvErrorMsg(conv.error_msg || null); // BUG-134 (v3.0.66): 同步 error_msg 给头部 StatusBadge
      setShowHistory(false);
    } catch (e: any) {
      showAlert({ title: '加载失败', message: e?.response?.data?.error?.message || e?.message });
    }
  };

  const createConversation = async (fromUser = false) => {
    try {
      if (fromUser) setUserInitiated(true); // v3.0.24.4 BUG-050
      const res = await imageAgentCreateConversationApi();
      const convId = res.data?.data?.conversationId;
      const welcome = res.data?.data?.welcome;
      if (convId) {
        setConversationId(convId);
        setConvStatus('awaiting_clarification'); // v3.0.24.4 BUG-050
        setConvErrorMsg(null); // BUG-134 (v3.0.66): 新会话清空 error_msg
        if (welcome) setMessages([welcome]);
        else setMessages([]);
      }
    } catch (e: any) {
      showAlert({ title: '错误', message: e?.response?.data?.error?.message || e?.message || '创建会话失败' });
    }
  };

  // v3.0.24: 轮询, 跟 web 一致
  useEffect(() => {
    if (!pollingConvId) return;
    const timer = setInterval(async () => {
      try {
        const res = await imageAgentGetApi(pollingConvId);
        // v3.0.24 (S60 P2 BUG-041 修): server 返 {data:{conversation: {...}}}
        const conv = res.data?.data?.conversation || res.data?.data;
        if (!conv) return;
        const status = conv.status;
        setConvStatus(status); // v3.0.24.4 BUG-050: 顶部 status badge 实时更新
        setConvErrorMsg(conv.error_msg || null); // BUG-134 (v3.0.66): 同步 error_msg 给头部 StatusBadge
        // v3.0.24 (S60 P2 BUG-045 修): server 字段是 snake_case (result_image_url), 不是 camelCase
        const convResultUrl = conv.resultImageUrl || conv.result_image_url;
        // 替换最后一条 assistant 消息中 streaming part 为 image part
        // BUG-119 (v3.0.48): 终态替换前先 clear 旧 result + 旧 streaming (兜底: race / page refresh 后 polling 进来时残留)
        setMessages(prev => {
          const next = [...prev];
          // 找包含 plan part 的最后一条 assistant 消息
          let targetIdx = -1;
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'assistant' && next[i].parts.some(p => p.type === 'streaming' || p.type === 'plan')) {
              targetIdx = i;
              break;
            }
          }
          if (targetIdx < 0) return prev;
          const target = next[targetIdx];
          const cleaned = clearResultParts(target.parts);
          const newParts: AgentPart[] = [...cleaned];
          if (status === 'tool_completed' && convResultUrl) {
            newParts.push({ type: 'image', url: convResultUrl, role: 'result' as const, width: 1024, height: 1024 });
          } else if (status === 'tool_failed') {
            newParts.push({ type: 'error' as const, message: conv.error_msg || '生成失败' });
          } else {
            // 还在 in-flight (tool_queued / tool_executing 等), 不动 messages
            return prev;
          }
          next[targetIdx] = { ...target, parts: newParts };
          return next;
        });
        if (status === 'tool_completed' || status === 'tool_failed') {
          setPollingConvId(null);
          if (status === 'tool_completed') {
            showAlert({ title: '✅ 图片生成完成', message: '已生成图片, 请查看对话' });
            // v3.0.36 (S72 batch 6 BUG-089): 改 refreshHistory 只刷列表, 不 auto-load
            //   避免 loadConversation 整体覆盖当前 messages (race condition: 切走再切回才显示)
            refreshHistory();
            // v3.0.36 (S72 batch 6 BUG-089): 强制滚到底部, 确保生成的图片可见
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
          } else {
            showAlert({ title: '❌ 生成失败', message: conv.error_msg || '请重试' });
          }
        }
      } catch (e) {
        console.warn('polling failed', e);
      }
    }, 3000);  // v3.0.24: 3s 轮询 (web 实际是 polling, 我们用 3s 更密)
    return () => clearInterval(timer);
  }, [pollingConvId]);

  // v3.0.59 (BUG-130): 选图片 + 上传 (跟 web AgentChatPanel.onPickFiles 1:1 镜像, 跨端铁律 4++)
  // v3.0.59 hotfix: 改用 react-native-image-picker 替代 document-picker (Android 9 模拟器兼容性, 详见 import 注释)
  const pickAndUploadImages = async () => {
    if (pendingRefs.length >= 4) {
      showAlert({ title: '已达上限', message: '最多 4 张参考图' });
      return;
    }
    const remainingSlots = 4 - pendingRefs.length;
    try {
      // v3.0.67 (BUG-135): 用自研 pickImages (Intent.ACTION_OPEN_DOCUMENT) 替代 image-picker
      // 国产 ROM 全支持 (华为/小米/OPPO/vivo/魅族), 不需要 GMS photopicker
      const assets = await pickImages({
        maxCount: remainingSlots,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (assets.length === 0) return;

      // 1. 立刻显示本地预览 (跟 web URL.createObjectURL 等价)
      const placeholders: PendingRef[] = assets.map((a) => ({
        url: '',
        localPreview: a.uri || '',
        filename: a.name || `img_${Date.now()}.jpg`,
        uploading: true,
      }));
      setPendingRefs(p => [...p, ...placeholders]);

      // 2. 异步上传, 完成后替换为 server URL
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

  // v3.0.5X (BUG-130): 移除某张待发送图 (跟 web removePendingRef 1:1)
  const removePendingRef = (filename: string) => {
    setPendingRefs(p => p.filter(x => x.filename !== filename));
  };

  const send = async (text: string) => {
    const content = (text || input).trim();
    // v3.0.5X (BUG-130): 允许只发参考图不发文本 (跟 web 1:1), 校验空内容改为"既无 text 又无 refs"
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
      const res = await imageAgentChatApi(conversationId, parts, selectedRatio || undefined);
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

  // v3.0.24 (BUG-041 修): 调 /image-agent/confirm (不是 /video-agent/confirm)
  const confirmGenerate = async (convId: string) => {
    // BUG-140 (v3.0.72): 改成 confirmingId === convId, 允许其他会话 in-flight 时新会话也能 confirm
    //   (跟 web 端 generatingConvId === conversationId + VideoAgentScreen 1:1 镜像, 跨端铁律 4++)
    if (!convId || confirmingId === convId) return;
    setConfirmingId(convId);
    try {
      // v3.0.24: 先翻译 plan (image 端, 跟 web 一致)
      try {
        setTranslating(true);
        await imageAgentTranslatePlanApi(convId);
      } catch (e) {
        console.warn('translatePlan failed, continue confirm', e);
      } finally {
        setTranslating(false);
      }
      const res = await imageAgentConfirmApi(convId);
      const { taskId, status, error: rErr } = res.data?.data || {};
      if (status !== 'queued') {
        showAlert({ title: '确认失败', message: rErr || '后端返回非 queued 状态' });
        return;
      }
      showAlert({ title: '已加入队列', message: `图片生成中, 等待 5-30 秒\n\ntaskId: ${taskId}` });
      // BUG-119 (v3.0.48): 先 clearResultParts 清掉旧 image/error/旧 streaming (避免堆叠), 再 map plan→streaming
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

  // v3.0.24: 删除当前会话
  const deleteCurrent = () => {
    if (!conversationId) return;
    showConfirm({
      title: '删除会话?',
      message: '删除后无法恢复, 包含所有聊天记录和生成的图片',
      confirmText: '删除',
      variant: 'error',
      onConfirm: async () => {
        try {
          setUserInitiated(true); // v3.0.24.4 BUG-050 修 race condition
          await imageAgentDeleteApi(conversationId);
          setConversationId(null);
          setMessages([]);
          setPollingConvId(null);
          setConvStatus('');
          // BUG-141 (v3.0.73): 改成 refreshHistory() (不是 loadHistory())
          //   修前 deleteCurrent 内 createConversation(true) + loadHistory() 触发 race condition:
          //     setUserInitiated(true) 异步, loadHistory 立即调用 closure 里 userInitiated=false
          //     → 走到 else createConversation() 兜底分支 → "删除"按钮变成"新建"按钮
          //     → 用户感觉"越删越多"
          //   修后: 删完就停 (不创建新会话, 跟 web 端 1:1 镜像)
          //     refreshHistory() 只刷新列表不 auto-load, 避免 race condition 触发兜底创建
          refreshHistory();
        } catch (e: any) {
          showAlert({ title: '删除失败', message: e?.response?.data?.error?.message || e?.message });
        }
      },
    });
  };

  const renderPart = (part: AgentPart, idx: number, msgId: string) => {
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
      //   - 跟 web AgentChatPanel + VideoAgentScreen 1:1 镜像 (跨端铁律 4++)
      //   - refImageCount: UI 显示参考图数量
      //   - negativePrompt: UI 显示排除内容 (走样/低质量 等)
      const refImageCount = typeof part.data.refImageCount === 'number' ? part.data.refImageCount : 0;
      const negativeText = part.data.negativePrompt || '';
      return (
        <View key={idx} style={styles.planBox}>
          <View style={styles.planHeader}>
            <Ionicons name="document-text" size={14} color={colors.accent} />
            <Text style={styles.planLabel}>提示词方案</Text>
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
            {part.data.style ? `风格: ${part.data.style}` : ''}
          </Text>
          <Text style={styles.planHint}>确认后按上面的内容发送给生图大模型</Text>
          {conversationId && (
            <TouchableOpacity
              style={[styles.confirmBtn, (confirmingId === conversationId || translating) && styles.confirmBtnDisabled]}
              onPress={() => confirmGenerate(conversationId)}
              // BUG-140 (v3.0.72): 改成 confirmingId === conversationId, 跟 web + VideoAgentScreen 1:1 镜像
              disabled={(confirmingId === conversationId) || translating}
            >
              {confirmingId === conversationId || translating ? (
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
    if (part.type === 'streaming') {
      // BUG-119 (v3.0.48): 改用 GeneratingLoader 跨端 1:1 动画 (跟 web AgentChatPanel + VideoAgentScreen 1:1, AGENTS.md § 6.6.4 强约束)
      // BUG-120 (v3.0.48): 等待动画卡片按用户选的比例显示 (1:1 方形 / 16:9 横屏 / 9:16 竖屏 等), 跟 web AgentChatPanel 1:1
      // v3.0.52 (BUG-123): 集成 useQueueStatus hook, 显示排队位置 + ETA (生图 40/min 限流)
      const aspectStyle = getMobileAspectStyle(selectedRatio, 'image');
      return <StreamingCardImage part={part} aspectStyle={aspectStyle} conversationId={conversationId} />;
    }
    if (part.type === 'image') {
      const token = getAuthToken();
      const imgUrl = buildImageUrl(part.url, token);
      const isAuthPath = part.url.startsWith('/api/') || /^[a-z]+:\/\/[^\/]*ab\.maque\.uno\//i.test(part.url);
      const downloadHref = isAuthPath
        ? buildDownloadUrl(part.url, `deep剧本-图片-${Date.now()}.${part.url.includes('.png') ? 'png' : 'jpg'}`, token)
        : part.url;
      return (
        <View key={idx} style={styles.imageBox}>
          {part.role === 'reference' ? (
            <View style={styles.refImageRow}>
              <ImageWithLoading
                src={imgUrl}
                alt="参考图"
                width={80}
                height={80}
                containerStyle={{ width: 80, height: 80 }}
                style={{ width: 80, height: 80 }}
              />
              <View style={styles.refImageMeta}>
                <Ionicons name="document" size={12} color={colors.text.tertiary} />
                <Text style={styles.refImageLabel}>参考图</Text>
              </View>
            </View>
          ) : (
            <View>
              <ImageWithLoading
                src={imgUrl}
                alt="生成结果图"
                width={320}
                height={320}
                containerStyle={{ width: 320, height: 320, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.primary }}
                style={{ width: 320, height: 320 }}
              />
              <View style={styles.imageActions}>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => downloadImage(part.url, token).catch(() => {})}
                >
                  <Ionicons name="download" size={14} color={colors.accent} />
                  <Text style={styles.downloadBtnText}>下载图片</Text>
                </TouchableOpacity>
                <Text style={styles.imageHint}>长按图片也可保存</Text>
              </View>
            </View>
          )}
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
      {/* 顶部工具栏: 历史/新建/标题/删除 */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => setShowHistory(true)}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.toolbarCenter}>
          <View style={styles.toolbarTitleRow}>
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text style={styles.toolbarTitleText} numberOfLines={1}>
              {conversationId ? '生图会话' : '生图助手'}
            </Text>
          </View>
          {convStatus ? <StatusBadge status={convStatus} error_msg={convErrorMsg} /> : null}
        </View>
        <TouchableOpacity style={styles.toolbarPrimaryBtn} onPress={() => { createConversation(true); refreshHistory(); }}>
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
              <Ionicons name="sparkles" size={56} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>开始你的第一张图</Text>
            <Text style={styles.emptyHint}>描述画面内容、风格、比例, AI 会整理方案后生成高清图片</Text>
            <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => { createConversation(true); refreshHistory(); }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.emptyPrimaryBtnText}>新建生图会话</Text>
            </TouchableOpacity>
            <View style={styles.emptySuggestionRow}>
              {['古风少女写实人像', '赛博朋克夜景', '水墨山水画'].map((s, i) => (
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
                  <Ionicons name="sparkles" size={14} color={colors.accent} />
                  <Text style={styles.aiLabel}>生图助手</Text>
                </View>
              )}
              {m.parts.map((p, idx) => renderPart(p, idx, m.id))}
            </View>
          </View>
        ))}
        {loading && (
          <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
            <View style={[styles.bubble, styles.bubbleAI]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.thinkingText}>生图助手 思考中...</Text>
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

      {/* 比例选择器 */}
      <View style={styles.ratioBar}>
        <Text style={styles.ratioLabel}>比例:</Text>
        {ASPECT_RATIOS.map(r => (
          <TouchableOpacity
            key={r.value || 'auto'}
            style={[styles.ratioChip, selectedRatio === r.value && styles.ratioChipActive]}
            onPress={() => setSelectedRatio(r.value)}
            disabled={loading}
          >
            <Ionicons name={r.icon as any} size={12} color={selectedRatio === r.value ? '#fff' : colors.accent} />
            <Text style={[styles.ratioChipText, selectedRatio === r.value && styles.ratioChipTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.freeTag}>🎨 免费 30/天</Text>
      </View>

      <View style={styles.inputBar}>
        {/* v3.0.5X (BUG-130): 待发送参考图缩略图条 (跟 web AgentChatPanel line 917-940 1:1 镜像) */}
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
        {/* v3.0.5X (BUG-130): 📎 上传按钮 (跟 web 1:1) */}
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
          placeholder="描述你想生成的图 (可上传参考图)..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)} disabled={loading || (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)}>
          <Ionicons name="send" size={20} color={(loading || (!input.trim() && pendingRefs.length === 0) || pendingRefs.some(x => x.uploading)) ? colors.text.tertiary : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* 历史侧栏 */}
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
                onPress={() => { createConversation(true); setShowHistory(false); refreshHistory(); }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>新建生图会话</Text>
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
                  {item.resultImageUrl ? (
                    <Image source={{ uri: buildImageUrl(item.resultImageUrl, getAuthToken()) }} style={styles.historyThumb} />
                  ) : (
                    <View style={[styles.historyThumb, styles.historyThumbPlaceholder]}>
                      <Ionicons name="image-outline" size={20} color={colors.text.tertiary} />
                    </View>
                  )}
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
                              await imageAgentDeleteApi(item.id);
                              if (item.id === conversationId) {
                                setConversationId(null);
                                setMessages([]);
                                setConvStatus('');
                                setConvErrorMsg(null); // BUG-134 (v3.0.66): 删除后清空 error_msg
                              }
                              await refreshHistory();
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
  // v3.0.52 (BUG-123): 排队信息样式 (跨端铁律 4++ 镜像 web + VideoAgentScreen 1:1)
  queueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  queueText: { fontSize: 12, color: '#92400e' },
  queueTextBold: { fontSize: 12, color: '#92400e', fontWeight: '700' },
  // v3.0.52.1 (BUG-123): 等待资源样式 (蓝色)
  waitingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    alignSelf: 'center',
  },
  waitingText: { fontSize: 12, color: '#1e40af' },
  waitingTextBold: { fontSize: 12, color: '#1e40af', fontWeight: '700' },
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
  bubble: { maxWidth: '85%', borderRadius: radii.lg, padding: spacing.md },
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
  // v3.0.58 (BUG-128 followup): plan refImageCount badge + negative_prompt 字段 (跨端铁律 4++ 跟 web + VideoAgentScreen 1:1 镜像)
  planRefBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 4 },
  planRefText: { ...typography.caption, color: colors.text.secondary, fontSize: 11, flex: 1 },
  planNegativeBox: { backgroundColor: colors.bg.secondary, borderRadius: radii.sm, padding: 8, marginTop: 4, marginBottom: 4 },
  planNegativeHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  planNegativeLabel: { ...typography.caption, color: colors.text.secondary, fontSize: 11, fontWeight: '700' },
  planNegativeText: { ...typography.caption, color: colors.text.tertiary, fontSize: 10, lineHeight: 14 },
  planMeta: { ...typography.caption, color: colors.text.tertiary, fontSize: 11, marginBottom: 4 },
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
  // v3.0.68 (BUG-136): 重设计生成动画卡片 (跟 VideoAgentScreen 1:1 镜像, 跨端铁律 4++)
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
  streamingText: { ...typography.caption, color: colors.accent, fontSize: 12 },
  imageBox: { marginTop: 4, alignItems: 'center' },
  refImageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refImage: { width: 80, height: 80, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  refImageMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refImageLabel: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  resultImage: { width: 320, height: 320, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg.primary },
  imageActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'center' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.md,
    backgroundColor: colors.accent + '20', borderWidth: 1, borderColor: colors.accent + '60',
  },
  downloadBtnText: { ...typography.caption, color: colors.accent, fontSize: 12, fontWeight: '600' },
  imageHint: { ...typography.caption, color: colors.text.tertiary, fontSize: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: '#fee', borderRadius: radii.md },
  errorMsg: { ...typography.body, color: '#f44', fontSize: 13, flex: 1 },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  suggestionChip: { paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.bg.secondary, borderRadius: radii.full, borderWidth: 1, borderColor: colors.accent },
  suggestionText: { ...typography.caption, color: colors.accent, fontSize: 12 },
  ratioBar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg.primary },
  ratioLabel: { ...typography.caption, color: colors.text.tertiary, fontSize: 11 },
  ratioChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.bg.secondary, borderRadius: radii.full, borderWidth: 1, borderColor: colors.accent },
  ratioChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  ratioChipText: { ...typography.caption, color: colors.accent, fontSize: 11, fontWeight: '600' },
  ratioChipTextActive: { color: '#fff' },
  freeTag: { marginLeft: 'auto', ...typography.caption, color: '#4ade80', fontSize: 11, fontWeight: '600' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg.primary },
  input: { flex: 1, ...typography.body, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: 10, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  // v3.0.5X (BUG-130): 参考图上传 UI (跟 web AgentChatPanel 1:1 镜像, 跨端铁律 4++)
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
  historyItemDeleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee', alignItems: 'center', justifyContent: 'center' },
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
});

// v3.0.68 (BUG-136): 重设计流式卡片 - 跟 VideoAgentScreen 1:1 镜像 (跨端铁律 4++)
//   阶段徽章 + 比例 spinner + 进度条 + ETA + 排队信息整合 (不浮窗) + 取消按钮
//   修前 BUG-119 v3.0.48 卡片布局散乱, 配套修法
function StreamingCardImage({ part, aspectStyle, conversationId }: {
  part: AgentPart;
  aspectStyle: { aspectRatio: number; width: number; height: number };
  conversationId: string | null;
}) {
  const { status: queueStatus } = useQueueStatus(conversationId, { enabled: !!conversationId, intervalMs: 3000 });
  const queueInfo = queueStatus?.image;
  const globalInfo = queueStatus?.global?.image;

  const inQueue = queueInfo?.position != null && (queueInfo?.position ?? 0) > 0;
  const waitingForResource = !inQueue && (globalInfo?.active ?? 0) > 0;

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
    generating: 'AI 正在绘制中',
  };
  const mainLabel = mainLabelMap[stage];

  const subLabelMap = {
    translating: '首次可能需要 5-10 秒',
    queueing: `预计等待 ${queueInfo?.etaSeconds ?? 0} 秒 · 生图 40 次/分钟`,
    generating: '通常 5-20 秒, 请稍候...',
  };
  const subLabel = subLabelMap[stage];

  const spinValue = React.useRef(new Animated.Value(0)).current;
  const glowValue = React.useRef(new Animated.Value(0)).current;
  const progressValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const spinLoop = Animated.loop(Animated.timing(spinValue, {
      toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true,
    }));
    spinLoop.start();
    return () => spinLoop.stop();
  }, [spinValue]);

  React.useEffect(() => {
    const glowLoop = Animated.loop(Animated.sequence([
      Animated.timing(glowValue, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(glowValue, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ]));
    glowLoop.start();
    return () => glowLoop.stop();
  }, [glowValue]);

  const progressRatio = (() => {
    if (stage === 'queueing' && queueInfo) {
      const pos = queueInfo.position ?? 1;
      return Math.max(0.05, Math.min(0.8, 1 - pos / 10));
    }
    if (stage === 'generating') {
      return Math.min(0.95, 0.1 + Math.random() * 0.05);
    }
    return 0.05;
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

  const stageColorMap = {
    translating: '#a78bfa',
    queueing: '#fbbf24',
    generating: '#60a5fa',
  };
  const stageColor = stageColorMap[stage];

  return (
    <View style={[styles.genCardOuter, { width: aspectStyle.width }]}>
      <View style={[styles.genCard, { aspectRatio: aspectStyle.aspectRatio, borderColor: stageColor + '40' }]}>
        <Animated.View style={[styles.genCardGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }], backgroundColor: stageColor }]} />

        <View style={styles.genCardHeader}>
          <View style={[styles.genStageBadge, { backgroundColor: stageColor + '20', borderColor: stageColor + '60' }]}>
            <Animated.View style={[styles.genStageDot, { backgroundColor: stageColor, transform: [{ scale: glowValue.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }] }]} />
            <Text style={[styles.genStageText, { color: stageColor }]}>{stageLabel}</Text>
          </View>
        </View>

        <View style={styles.genSpinnerArea}>
          <Animated.View style={[styles.genSpinnerRing, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.genSpinnerArc, { borderColor: stageColor }]} />
            <View style={[styles.genSpinnerArcGap, { borderColor: stageColor + '20' }]} />
          </Animated.View>

          <View style={styles.genSpinnerCore}>
            <Ionicons
              name={stage === 'translating' ? 'language' : stage === 'queueing' ? 'hourglass-outline' : 'image-outline'}
              size={28}
              color={stageColor}
            />
          </View>
        </View>

        <Text style={styles.genMainLabel}>{mainLabel}</Text>
        <Text style={styles.genSubLabel}>{subLabel}</Text>

        <View style={styles.genProgressTrack}>
          <Animated.View style={[styles.genProgressFill, { width: progressWidth, backgroundColor: stageColor }]} />
        </View>

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
