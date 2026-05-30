import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNovelStore, createLlmMessage, LlmMessage } from '../store/useNovelStore';
import { getTaskProgress, getNovelAnalysis, getEpisodes as apiGetEpisodes, generateEpisodes, getNovels as apiGetNovels } from '../api/client';
import { saveNovel, saveEpisodes as saveEpisodesDb, updateNovelStatus, initDatabase, getNovels } from '../db/sqlite';
import { WS_BASE_URL } from '../config';
import { colors, spacing, radii, typography } from '../theme';
import type { ChatTabRouteProp } from '../types/navigation';

const STEPS = [
  { key: 'uploaded', label: '上传文件', icon: 'document-text-outline' },
  { key: 'analyzing', label: 'AI 分析小说', icon: 'analytics-outline' },
  { key: 'script_gen', label: 'AI 生成剧本', icon: 'film-outline' },
  { key: 'saving', label: '保存到书架', icon: 'save-outline' },
  { key: 'done', label: '全部完成', icon: 'checkmark-circle' },
];

// ===== FlatList item types =====
type FlatItem =
  | { type: 'phase_header'; key: string; label: string }
  | { type: 'collapsible'; key: string; title: string; text: string; color: string }
  | { type: 'msg'; key: string; m: LlmMessage }
  | { type: 'hint'; key: string; content: string }
  | { type: 'summary'; key: string }
  | { type: 'chunk_progress'; key: string }
  | { type: 'awaiting'; key: string }
  | { type: 'ep_header'; key: string; label: string }
  | { type: 'ep_collapsible'; key: string; epNum: string; text: string };

// ===== Memoized sub-components =====
const CollapsibleBlock = memo(function CollapsibleBlock({ title, text, color }: { title: string; text: string; color: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const lines = text.split('\n');
  const preview = lines.length > 4 ? lines.slice(0, 4).join('\n') + '\n...' : text;
  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
      <View style={[styles.collapsible, { borderLeftColor: color }]}>
        <Text style={[styles.collapsibleTitle, { color }]}>{title}</Text>
        <Text style={styles.collapsibleText} numberOfLines={expanded ? undefined : 4}>
          {expanded ? text : preview}
        </Text>
        {lines.length > 4 && (
          <Text style={styles.collapsibleToggle}>{expanded ? '▲ 收起' : '▼ 展开全部'}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const MsgItem = memo(function MsgItem({ m }: { m: LlmMessage }) {
  const isUser = m.type === 'reasoning' && m.content.length < 200 && !m.content.startsWith('[\n');
  if (isUser) {
    return (
      <View style={styles.chatBubbleRow}>
        <View style={styles.chatBubbleSystem}>
          <View style={styles.chatBubbleLabelRow}>
            <Ionicons name="person" size={14} color={colors.text.secondary} />
            <Text style={styles.chatBubbleLabel}> 系统</Text>
          </View>
          <Text style={styles.chatBubbleText}>{m.content}</Text>
        </View>
      </View>
    );
  }
  if (m.type === 'output' || m.type === 'reasoning') {
    const isLong = m.content.length > 200 || m.content.includes('\n');
    if (m.type === 'output') {
      return (
        <CollapsibleBlock title="剧本内容" text={m.content} color="#2563EB" icon="film-outline" />
      );
    }
    if (isLong) {
      return (
        <CollapsibleBlock
          title={m.type === 'reasoning' ? '思考过程' : 'AI 输出结果'}
          text={m.content}
          color={m.type === 'reasoning' ? '#F97316' : '#22C55E'}
          icon={m.type === 'reasoning' ? 'bulb-outline' : 'checkmark-circle-outline'}
        />
      );
    }
    return (
      <View style={styles.chatBubbleRow}>
        <View style={styles.chatBubbleAI}>
          <Text style={styles.chatBubbleLabel}>🤖 AI</Text>
          <Text style={styles.chatBubbleText}>{m.content}</Text>
        </View>
      </View>
    );
  }
  return <Text style={styles.phaseHint}>{m.content}</Text>;
});

const ChunkProgressBlock = memo(function ChunkProgressBlock() {
  const chunkProgress = useNovelStore(s => s.chunkProgress);
  const chunkStreams = useNovelStore(s => s.chunkStreams);
  if (!chunkProgress) return null;

  const total = chunkProgress.total;
  const states = chunkProgress.chunkStates || [];
  const completed = states.filter(s => s.status === 'completed').length;
  const failed = states.filter(s => s.status === 'failed').length;
  const running = states.filter(s => s.status === 'running').length;

  if (chunkProgress.phase === 'chunking') {
    return (
      <View style={styles.phaseBlock}>
        <View style={styles.phaseTitleRow}>
          <Ionicons name="analytics" size={18} color={colors.primary} />
          <Text style={styles.phaseTitle}> 小说分析</Text>
        </View>
        <View style={styles.chunkProgressBox}>
          <Ionicons name="cut" size={16} color={colors.text.secondary} />
          <Text style={styles.chunkProgressSummary}> 正在分割小说...</Text>
        </View>
      </View>
    );
  }
  if (chunkProgress.phase === 'merging') {
    return (
      <View style={styles.phaseBlock}>
        <View style={styles.phaseTitleRow}>
          <Ionicons name="analytics" size={18} color={colors.primary} />
          <Text style={styles.phaseTitle}> 小说分析</Text>
        </View>
        <View style={styles.chunkProgressBox}>
          <Ionicons name="git-merge" size={16} color={colors.text.secondary} />
          <Text style={styles.chunkProgressSummary}> 正在合并各段分析结果...</Text>
        </View>
      </View>
    );
  }
  if (chunkProgress.phase === 'final_analysis') {
    return (
      <View style={styles.phaseBlock}>
        <View style={styles.phaseTitleRow}>
          <Ionicons name="analytics" size={18} color={colors.primary} />
          <Text style={styles.phaseTitle}> 小说分析</Text>
        </View>
        <View style={styles.chunkProgressBox}>
          <Ionicons name="document-text" size={16} color={colors.text.secondary} />
          <Text style={styles.chunkProgressSummary}> 正在生成最终分析...</Text>
        </View>
      </View>
    );
  }

  const etaText = chunkProgress.eta != null
    ? `预计剩余 ${chunkProgress.eta >= 60 ? Math.floor(chunkProgress.eta / 60) + '分' : ''}${chunkProgress.eta % 60}秒`
    : '';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'running': return 'flash';
      default: return 'ellipse-outline';
    }
  };

  return (
    <View style={styles.phaseBlock}>
      <View style={styles.phaseTitleRow}>
        <Ionicons name="analytics" size={18} color={colors.primary} />
        <Text style={styles.phaseTitle}> 小说分析</Text>
      </View>
      <View style={styles.chunkProgressBox}>
        <Text style={styles.chunkProgressSummary}>
          <Ionicons name="document-text" size={14} color={colors.text.secondary} />
          {' '}逐段分析：{completed}/{total} 段完成{failed > 0 ? ` ${failed}段失败` : ''}
        </Text>
        {etaText ? <Text style={styles.chunkEtaText}>{etaText}</Text> : null}
        {states.map((s, idx) => {
          const streamContent = chunkStreams[s.index] || '';
          const isRunning = s.status === 'running';
          const isDone = s.status === 'completed' || s.status === 'failed';
          const isPending = s.status === 'pending';
          return (
            <View key={s.index} style={[
              styles.chunkItem,
              isRunning && styles.chunkItemRunning,
              isDone && styles.chunkItemDone,
            ]}>
              <View style={styles.chunkItemHeaderRow}>
                <Ionicons name={getStatusIcon(s.status)} size={14} color={isDone ? (s.status === 'completed' ? colors.success : colors.error) : isRunning ? colors.warning : colors.text.tertiary} />
                <Text style={styles.chunkItemHeader}>
                  {' '}第 {s.index}/{total} 段
                  {isDone ? ' 分析完成' : isRunning ? ' 分析中...' : ' 等待中'}
                </Text>
              </View>
              {isRunning && streamContent ? (
                <Text style={styles.chunkStreamText} numberOfLines={6}>{streamContent}</Text>
              ) : null}
              {isRunning && !streamContent ? (
                <Text style={styles.chunkStreamPlaceholder}>等待 AI 输出...</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const SummaryBlock = memo(function SummaryBlock() {
  return (
    <View style={styles.summaryBlock}>
      <View style={styles.summaryTitleRow}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <Text style={styles.summaryTitle}> 全部完成</Text>
      </View>
      {STEPS.filter(s => s.key !== 'done').map(s => (
        <View key={s.key} style={styles.summaryItemRow}>
          <Ionicons name="checkmark" size={14} color={colors.success} />
          <Text style={styles.summaryItem}> {s.label}</Text>
        </View>
      ))}
      <Text style={styles.summaryHint}>前往「书架」查看剧本</Text>
    </View>
  );
});

function waitForTask(taskId: string, onUpdate: (t: any) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const MAX_RETRIES = 3;
    const interval = setInterval(async () => {
      try {
        const res = await getTaskProgress(taskId);
        const t = res.data.data;
        retries = 0; // 成功后重置重试计数
        onUpdate(t);
        if (t.status === 'completed') { clearInterval(interval); resolve(); }
        else if (t.status === 'failed') { clearInterval(interval); reject(new Error(t.errorMsg || '任务执行失败')); }
      } catch {
        retries++;
        if (retries >= MAX_RETRIES) {
          clearInterval(interval);
          reject(new Error('轮询失败，请检查网络连接'));
        }
        // 未达到上限则静默重试
      }
    }, 2000);
  });
}

export function ChatScreen(): React.JSX.Element {
  const route = useRoute<ChatTabRouteProp>();
  // 用 selector 替代全量订阅，避免不相关字段变化触发重渲染
  const llmMessages = useNovelStore(s => s.llmMessages);
  const activeTasks = useNovelStore(s => s.activeTasks);
  const chunkProgress = useNovelStore(s => s.chunkProgress);
  const novels = useNovelStore(s => s.novels);
  const storeGet = useNovelStore.getState;
  const paramsNovelId = route.params?.novelId;
  const firstActive = activeTasks[0];
  const [discoveredNovelId, setDiscoveredNovelId] = useState<string | null>(null);
  const novelId = paramsNovelId || firstActive?.novelId || discoveredNovelId;
  const novelTitle = route.params?.novelTitle || firstActive?.novelTitle || '';
  const messages = novelId ? llmMessages.filter(m => m.novelId === novelId) : [];
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<any>(null);
  const pipelineRef = useRef(false);
  const novelIdRef = useRef(novelId);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECONNECTS = 5;

  const [status, setStatus] = useState<'idle' | 'analyzing' | 'generating' | 'saving' | 'done' | 'error'>(
    novelId ? 'analyzing' : 'idle'
  );
  const [progress, setProgress] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [episodeTitle, setEpisodeTitle] = useState(''); // 当前集标题
  const [streamExpanded, setStreamExpanded] = useState(true); // 流式内容是否展开
  const [detail, setDetail] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentStepIdx = STEPS.findIndex(s => {
    if (status === 'idle' || status === 'analyzing') return s.key === 'analyzing';
    if (status === 'generating') return s.key === 'script_gen';
    if (status === 'saving') return s.key === 'saving';
    if (status === 'done') return s.key === 'done';
    if (status === 'error') return s.key === 'analyzing';
    return 0;
  });

  // 流式内容本地管理（对标 EpisodeDetailScreen 的增量追加模式）
  const [liveText, setLiveText] = useState('');
  const accumulatedRef = useRef(''); // 仅用于 stream:false 时保存到 store

  // 仅在用户在底部时才自动滚动
  const [isAtBottom, setIsAtBottom] = useState(true);
  const autoScrollRef = useRef(true); // 默认启用自动滚动
  const userScrolledRef = useRef(false); // 用户是否手动滚动过

  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 60;
    setIsAtBottom(atBottom);
    
    // 用户手动滚动到底部时，重新启用自动滚动
    if (atBottom && userScrolledRef.current) {
      autoScrollRef.current = true;
      userScrolledRef.current = false;
    }
    // 用户手动滚动离开底部时，禁用自动滚动
    if (!atBottom) {
      userScrolledRef.current = true;
      autoScrollRef.current = false;
    }
  };

  // 流式内容或消息变化时自动滚动到底部
  const messagesLen = messages.length;
  useEffect(() => {
    // 流式输出时：展开状态下自动滚动，收起时不滚动
    if (liveText) {
      if (streamExpanded) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
      return;
    }
    // 非流式内容：按用户滚动状态决定
    if (autoScrollRef.current && (messagesLen > 0 || status !== 'idle')) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messagesLen, liveText, status, streamExpanded]);

  // 当 novelId 变化时重置所有状态，确保重新进入分析流程
  useEffect(() => {
    if (novelIdRef.current !== novelId) {
      novelIdRef.current = novelId;
      pipelineRef.current = false;
      storeGet().clearLlmMessages();
      storeGet().clearChunkStreams();
      setLiveText('');
      accumulatedRef.current = '';
      setStatus(novelId ? 'analyzing' : 'idle');
      setProgress(0);
      setErrorMsg('');
    }
  }, [novelId]);

  // 重置到初始状态
  const resetToIdle = useCallback(() => {
    pipelineRef.current = false;
    storeGet().clearLlmMessages();
    storeGet().clearChunkStreams();
    setLiveText('');
    accumulatedRef.current = '';
    setStatus('idle');
    setProgress(0);
    setTotalEpisodes(0);
    setCurrentEpisode(0);
    setEpisodeTitle('');
    setDetail('');
    setErrorMsg('');
    setStreamExpanded(true);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    navigation.goBack();
  }, [navigation]);

  // 定时轮询余额（WebSocket 更新失败时兜底）
  useEffect(() => {
    if (!novelId) return;
    const timer = setInterval(async () => {
      try {
        const { getProfile } = require('../api/client');
        const res = await getProfile();
        const user = res?.data?.data?.user;
        if (user) storeGet().setUserInfo(user);
      } catch {}
    }, 10000);
    return () => clearInterval(timer);
  }, [novelId]);

  // 自动恢复：无 novelId 时查询服务端是否有进行中的小说
  useEffect(() => {
    if (novelId || discoveredNovelId) return;
    let cancelled = false;
    let retries = 0;

    const tryRecover = async () => {
      if (cancelled) return;
      try {
        const res = await apiGetNovels();
        const list = res?.data?.data?.novels || [];
        const active = list.find((n: any) => n.status === 'analyzing' || n.status === 'generating');
        if (active && !cancelled) {
          setDiscoveredNovelId(active.id);
        }
      } catch {
        // Token 可能还没恢复完，1 秒后重试（最多 10 次）
        if (!cancelled && retries < 10) {
          retries++;
          setTimeout(tryRecover, 1000);
        }
      }
    };

    tryRecover();
    return () => { cancelled = true; };
  }, [novelId, discoveredNovelId]);

  // 自动恢复时加载已完成的剧集内容到对话列表
  useEffect(() => {
    if (!discoveredNovelId || llmMessages.filter(m => m.novelId === discoveredNovelId).length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const epsRes = await apiGetEpisodes(discoveredNovelId, false);
        const eps = epsRes.data.data.episodes || [];
        if (cancelled) return;
        const s = storeGet();
        for (const ep of eps) {
          if (ep.status === 'completed' && ep.scriptContent) {
            s.addLlmMessage(createLlmMessage(discoveredNovelId, 'output', `ep_${ep.episodeNumber}`, ep.scriptContent));
            // 添加剧集标题作为通知
            s.addLlmMessage(createLlmMessage(discoveredNovelId, 'reasoning', `ep_${ep.episodeNumber}`, `第 ${ep.episodeNumber} 集 ${ep.title || ''}（已生成）`));
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [discoveredNovelId]);

  // WebSocket（含自动重连和心跳）— 流式内容用本地 state，不经过 store
  useEffect(() => {
    if (!novelId) return;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    // chunk_stream 节流：300ms 批量写入，避免高频触发 store 更新
    const chunkStreamBuf: Record<number, string> = {};
    let chunkStreamTimer: ReturnType<typeof setTimeout> | null = null;
    const flushChunkStreams = () => {
      const keys = Object.keys(chunkStreamBuf);
      if (keys.length > 0) {
        const s = storeGet();
        for (const k of keys) {
          s.appendChunkStream(parseInt(k), chunkStreamBuf[parseInt(k)]);
        }
        for (const k of keys) delete chunkStreamBuf[parseInt(k)];
      }
      chunkStreamTimer = null;
    };

    const cleanupWs = () => {
      if (chunkStreamTimer) { clearTimeout(chunkStreamTimer); chunkStreamTimer = null; }
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      wsRef.current = null;
    };

    const doConnect = () => {
      if (wsRef.current) return;
      try {
        const ws = new WebSocket(WS_BASE_URL.replace('http', 'ws') + '/ws');
        wsRef.current = ws;

        // 每个连接的独立缓冲区（对标 EpisodeDetailScreen 的 shotBuffer 模式）
        let streamBuffer = '';
        let currentStreamPhase = ''; // 跟踪当前流式输出对应的phase
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushStream = () => {
          if (streamBuffer) {
            const batch = streamBuffer;
            streamBuffer = '';
            setLiveText(prev => prev + batch);
          }
          flushTimer = null;
        };

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe', novelId }));
          reconnectAttemptsRef.current = 0;
          heartbeatTimer = setInterval(() => {
            try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
          }, 15000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const s = storeGet();
            if (data.type === 'llm_update') {
              if (data.stream) {
                accumulatedRef.current += (data.content || '');
                streamBuffer += (data.content || '');
                currentStreamPhase = data.phase; // 记录当前流式输出的phase
                if (!flushTimer) {
                  flushTimer = setTimeout(flushStream, 100);
                } else if (streamBuffer.length > 300) {
                  clearTimeout(flushTimer);
                  flushStream();
                }
              } else {
                if (flushTimer) { clearTimeout(flushTimer); flushStream(); }
                // 将累积的流式内容写入 store 作为完整消息（使用正确的phase）
                if (accumulatedRef.current) {
                  s.addLlmMessage(createLlmMessage(novelId, 'output', currentStreamPhase || data.phase, accumulatedRef.current));
                  accumulatedRef.current = '';
                  currentStreamPhase = '';
                  setLiveText('');
                }
                // 添加通知消息（ep_阶段的reasoning不存入store，避免显示在剧本框）
                if (data.content) {
                  if (data.step === 'reasoning' && data.phase?.startsWith('ep_')) {
                    // 更新当前集标题显示
                    setEpisodeTitle(data.content);
                  } else {
                    s.addLlmMessage(createLlmMessage(novelId,
                      data.step === 'reasoning' ? 'reasoning' : 'output',
                      data.phase, data.content, data.tokens));
                  }
                }
              }
            } else if (data.type === 'progress') {
              // 检测错误状态
              if (data.status === 'error') {
                setStatus('error');
                setErrorMsg(data.detail || '任务已终止');
                if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
                if (accumulatedRef.current) {
                  s.addLlmMessage(createLlmMessage(novelId, 'output', currentStreamPhase || 'script_gen', accumulatedRef.current));
                  accumulatedRef.current = '';
                  currentStreamPhase = '';
                }
                setLiveText('');
                return;
              }
              // 完成时，先flush最后一集的流式内容到store
              if (data.status === 'completed' && accumulatedRef.current) {
                if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
                s.addLlmMessage(createLlmMessage(novelId, 'output', currentStreamPhase || 'script_gen', accumulatedRef.current));
                accumulatedRef.current = '';
                currentStreamPhase = '';
                setLiveText('');
              }
              s.updateTaskProgress(novelId, data.progress, data.status, data.phase || 'unknown');
              if (data.totalEpisodes) setTotalEpisodes(data.totalEpisodes);
              if (data.currentEpisode) setCurrentEpisode(data.currentEpisode);
            } else if (data.type === 'chunk_progress') {
              s.setChunkProgress({
                phase: data.phase, current: data.current, total: data.total,
                unitLabel: data.unitLabel, detail: data.detail,
                chunkStates: data.chunkStates || [], error: data.error, eta: data.eta,
              });
            } else if (data.type === 'chunk_stream') {
              const idx = data.chunkIndex;
              chunkStreamBuf[idx] = (chunkStreamBuf[idx] || '') + data.content;
              if (!chunkStreamTimer) {
                chunkStreamTimer = setTimeout(flushChunkStreams, 300);
              }
            } else if (data.type === 'queue_status') {
              s.setQueueStatus(novelId, data.position || 0, data.runningCount || 0, data.waitingCount || 0);
            } else if (data.type === 'balance_update') {
              const bal = data.balance;
              const info = s.userInfo;
              if (info && typeof bal === 'number') {
                s.setUserInfo({ ...info, balance: bal });
              }
            }
          } catch { /* ignore */ }
        };

        ws.onclose = () => {
          cleanupWs();
          if (reconnectAttemptsRef.current < MAX_RECONNECTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;
            reconnectTimerRef.current = setTimeout(doConnect, delay);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {}
    };

    doConnect();

    return () => {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      reconnectAttemptsRef.current = MAX_RECONNECTS;
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        cleanupWs();
      }
    };
  }, [novelId]);

  // Pipeline: single async flow
  useEffect(() => {
    if (!novelId || pipelineRef.current) return;
    pipelineRef.current = true;

    const runPipeline = async () => {
      try {
        // ---- Phase 1: Wait for analysis ----
        const analysisTask = activeTasks.find(t => t.novelId === novelId);
        if (!analysisTask) {
          // 自动恢复模式：无需执行 pipeline，WebSocket 已连接并接收进度
          return;
        }

        setDetail('等待 AI 响应...');
        await waitForTask(analysisTask.taskId, (t) => {
          setProgress(t.progress || 0);
          storeGet().updateTaskProgress(novelId, t.progress, t.status, 'analyzing');
          if (t.progress >= 100) setDetail('分析完成');
        });
        await updateNovelStatus(novelId, 'analyzed');

        storeGet().addLlmMessage(createLlmMessage(novelId, 'completed', 'analyzing', '小说分析完成'));
        setProgress(0);

        // ---- Phase 2: Generate episodes ----
        setStatus('generating');
        storeGet().addLlmMessage(createLlmMessage(novelId, 'phase_start', 'script_gen', '开始生成剧集...'));

        const genRes = await generateEpisodes(novelId);
        const genTaskId = genRes.data.data.taskId;

        setDetail('等待 AI 划分剧集...');
        await waitForTask(genTaskId, (t) => {
          setProgress(t.progress || 0);
          setDetail(`生成剧集中 ${t.progress}%`);
        });

        // 等 2 秒让最后一条流式内容有时间显示到 UI 并 flush 到 store
        await new Promise<void>(r => setTimeout(r, 2000));

        storeGet().addLlmMessage(createLlmMessage(novelId, 'completed', 'completed', '剧集生成完成！'));

        // ---- Phase 3: Save to local ----
        setStatus('saving');
        setDetail('保存到本地书架...');

        const analysisRes = await getNovelAnalysis(novelId).catch(() => null);
        const analysis = analysisRes?.data?.data || {};
        const episodeRes = await apiGetEpisodes(novelId, false).catch(() => null);
        const episodes = episodeRes?.data?.data?.episodes || [];
        const existing = novels.find(n => n.id === novelId);

        await saveNovel({
          id: novelId, title: novelTitle, author: 'User',
          totalChars: existing?.totalChars || 0,
          totalWords: existing?.totalWords || 0,
          genre: analysis.genre || existing?.genre || '',
          theme: analysis.theme || existing?.theme || '',
          style: analysis.style || existing?.style || '',
          tone: analysis.tone || existing?.tone || '',
          summary: analysis.summary || '',
          scenes: analysis.scenes || [],
          plotPoints: analysis.plotPoints || [],
          status: 'completed',
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        if (episodes.length > 0) {
          await saveEpisodesDb(episodes);
          storeGet().setEpisodes(episodes);
        }
        storeGet().setNovels(await getNovels());

        storeGet().addLlmMessage(createLlmMessage(novelId, 'completed', 'completed', '已保存到书架！共 ' + episodes.length + ' 集'));
        setStatus('done');
        setDetail('全部完成，共 ' + episodes.length + ' 集');
      } catch (err: any) {
        storeGet().addLlmMessage(createLlmMessage(novelId, 'completed', 'completed', `${err?.message || '处理失败'}`));
        setStatus('done');
        setDetail('处理出错');
      } finally {
        // 完成后关闭 WebSocket，停止一切请求
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    };

    runPipeline();
  }, [novelId]);

  // Group messages by phase（含动态 ep_X 阶段）
  const phases = ['analyzing', 'script_gen', 'shot_gen', 'completed'];
  const grouped: Record<string, LlmMessage[]> = {};
  messages.forEach(m => {
    if (!grouped[m.phase]) grouped[m.phase] = [];
    grouped[m.phase].push(m);
  });
  // 收集所有 ep_X 阶段，按集数排序
  const epPhases = Object.keys(grouped).filter(k => k.startsWith('ep_')).sort((a, b) => {
    return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
  });
  const allPhases = [...phases, ...epPhases];

  // 构建 FlatList 扁平数据
  const flatData = useMemo(() => {
    const items: FlatItem[] = [];
    let awaitingAdded = false;
    let epHeaderAdded = false;
    const deferredHints: FlatItem[] = []; // 延迟到剧集后面显示的提示

    for (const phase of allPhases) {
      const msgs = (grouped[phase] || []).sort((a, b) => a.timestamp - b.timestamp);

      if (phase.startsWith('ep_')) {
        const epNum = phase.split('_')[1];
        const outputs = msgs.filter(m => m.type === 'output');
        const content = outputs.map(m => m.content).join('');
        // 在第一个剧集前添加剧集标题（只显示episodeTitle）
        if (!epHeaderAdded && totalEpisodes > 0 && episodeTitle) {
          items.push({ type: 'ep_header', key: 'ep_header', label: episodeTitle });
          epHeaderAdded = true;
        }
        if (content) {
          items.push({ type: 'ep_collapsible', key: phase, epNum, text: content });
        }
        continue;
      }

      if (phase === 'analyzing' && chunkProgress && ['chunking', 'analyzing_chunks', 'merging', 'final_analysis'].includes(chunkProgress.phase)) {
        items.push({ type: 'chunk_progress', key: phase });
        continue;
      }

      if (msgs.length === 0) {
        if (!awaitingAdded && status === 'analyzing') {
          items.push({ type: 'awaiting', key: 'awaiting' });
          awaitingAdded = true;
        }
        continue;
      }

      // Phase header
      if (phase === 'analyzing') items.push({ type: 'phase_header', key: phase + '_h', label: '小说分析', icon: 'analytics' });
      else if (phase === 'script_gen') items.push({ type: 'phase_header', key: phase + '_h', label: '剧本生成', icon: 'film' });
      else if (phase === 'shot_gen') items.push({ type: 'phase_header', key: phase + '_h', label: '分镜头', icon: 'videocam' });

      for (const m of msgs) {
        const isStreaming = phase === 'script_gen' && m.type === 'reasoning';
        if (isStreaming) continue;
        // 分析完成提示放在分析框后面（同阶段内）
        if (m.type === 'completed' && phase === 'analyzing') {
          items.push({ type: 'hint', key: m.id, content: m.content });
        } else if (m.type === 'phase_start' && phase === 'script_gen') {
          // 开始生成剧集 → 延迟到所有剧集后面
          deferredHints.push({ type: 'hint', key: m.id, content: m.content });
        } else if (m.type === 'completed' && phase === 'completed') {
          // 剧集完成、保存完成 → 延迟到所有剧集后面
          deferredHints.push({ type: 'hint', key: m.id, content: m.content });
        } else {
          items.push({ type: 'msg', key: m.id, m });
        }
      }
    }
    // 延迟的提示放在剧集后面
    items.push(...deferredHints);
    if (status === 'done') items.push({ type: 'summary', key: 'summary' });
    return items;
  }, [allPhases, messages, status, chunkProgress, totalEpisodes, currentEpisode, episodeTitle]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await apiGetNovels();
      const serverNovels = res?.data?.data?.novels || [];
      if (novelId) {
        const n = serverNovels.find((x: any) => x.id === novelId);
        if (n?.status) {
          setStatus(n.status === 'analyzing' || n.status === 'pending' ? 'analyzing' :
                    n.status === 'generating' ? 'generating' :
                    n.status === 'completed' ? 'done' : status);
        }
      }
    } catch {}
    setRefreshing(false);
  }, [novelId, status]);

  if (!novelId) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles" size={56} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>等待任务...</Text>
          <Text style={styles.emptySub}>前往「上传」页上传小说，自动在此处理</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{novelTitle || '小说分析'}</Text>
        <Text style={styles.headerStatus}>{detail || '等待开始'}</Text>
        {status !== 'done' && status !== 'idle' && status !== 'saving' && (
          <View style={styles.progressBarBg}>
            {totalEpisodes > 0 ? (
              <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
            ) : (
              <View style={styles.progressBarPulse} />
            )}
          </View>
        )}
        {status === 'generating' && totalEpisodes > 0 && (
          <View style={styles.episodeCounter}>
            <Text style={styles.episodeCounterText}>
              {currentEpisode > 0 && currentEpisode < totalEpisodes
                ? `正在生成第 ${currentEpisode + 1} 集（已完成 ${currentEpisode}/${totalEpisodes}）`
                : currentEpisode >= totalEpisodes
                  ? `全部 ${totalEpisodes} 集生成完毕`
                  : `准备生成（共 ${totalEpisodes} 集）`}
            </Text>
          </View>
        )}
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        <FlatList horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepsRow}
          data={STEPS} keyExtractor={s => s.key}
          renderItem={({ item: step, index: i }) => {
            const isCompleted = i < currentStepIdx;
            const isCurrent = i === currentStepIdx;
            const isPending = i > currentStepIdx;
            return (
              <View key={step.key} style={styles.stepItem}>
                <View style={[
                  styles.stepDot,
                  isCompleted && styles.stepDotDone,
                  isCurrent && styles.stepDotCurrent,
                  isPending && styles.stepDotPending,
                ]}>
                  {isCompleted ? <Ionicons name="checkmark" size={14} color="#fff" /> :
                   isCurrent && status !== 'done' ? <ActivityIndicator size="small" color="#fff" /> :
                   <Ionicons name={step.icon} size={14} color="#fff" />}
                </View>
                <Text style={[
                  styles.stepLabel,
                  (isCompleted || isCurrent) && styles.stepLabelActive,
                  isPending && styles.stepLabelPending,
                ]} numberOfLines={1}>{step.label}</Text>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, isCompleted && styles.stepLineDone]} />
                )}
              </View>
            );
          }}
        />
      </View>

      {/* Messages */}
      <FlatList ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}
        data={flatData} keyExtractor={item => item.key}
        onScroll={handleScroll} scrollEventThrottle={100}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />
        }
        ListFooterComponent={liveText ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setStreamExpanded(prev => !prev)}
          >
            <View style={styles.liveStreamBox}>
              <Text style={styles.liveStreamLabel}>正在输出...</Text>
              <Text style={styles.liveStreamText} numberOfLines={streamExpanded ? undefined : 4}>
                {liveText}
              </Text>
              <Text style={styles.collapsibleToggle}>{streamExpanded ? '▲ 收起' : '▼ 展开全部'}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        renderItem={({ item }) => {
          switch (item.type) {
            case 'phase_header':
              return (
                <View style={styles.phaseTitleRow}>
                  <Ionicons name={item.icon || 'analytics'} size={18} color={colors.primary} />
                  <Text style={styles.phaseTitle}> {item.label}</Text>
                </View>
              );
            case 'msg':
              return <MsgItem m={item.m} />;
            case 'collapsible':
              return <CollapsibleBlock title={item.title} text={item.text} color={item.color} />;
            case 'hint':
              return <Text style={styles.phaseHint}>{item.content}</Text>;
            case 'chunk_progress':
              return <ChunkProgressBlock />;
            case 'awaiting':
              return (
                <View style={styles.phaseBlock}>
                  <View style={styles.phaseTitleRow}>
                    <Ionicons name="analytics" size={18} color={colors.primary} />
                    <Text style={styles.phaseTitle}> 小说分析</Text>
                  </View>
                  <Text style={styles.awaitingText}>AI 思考中...</Text>
                </View>
              );
            case 'ep_collapsible':
              return <CollapsibleBlock title={`第 ${item.epNum} 集剧本`} text={item.text} color="#2563EB" icon="film-outline" />;
            case 'ep_header':
              return <Text style={styles.epHeaderText}>{item.label}</Text>;
            case 'summary':
              return <SummaryBlock />;
            default:
              return null;
          }
        }}
      />

      {status === 'error' ? (
        <View style={styles.errorBar}>
          <Ionicons name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{errorMsg || '任务已终止'}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={resetToIdle}>
            <Text style={styles.errorBtnText}>确认返回</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomBar}>
          <Text style={styles.bottomBarText}>{detail || '上传小说后将自动处理'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  chatBubbleRow: { marginBottom: 10 },
  chatBubbleSystem: {
    backgroundColor: colors.bg.secondary, borderRadius: radii.md, borderTopLeftRadius: 4,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  chatBubbleAI: {
    backgroundColor: '#1E293B', borderRadius: radii.md, borderTopRightRadius: 4,
    padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.success,
  },
  chatBubbleLabel: { fontSize: 11, fontWeight: '600', color: colors.text.secondary, marginBottom: 4 },
  chatBubbleLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  chatBubbleText: { fontSize: 13, color: '#DDD', lineHeight: 19 },
  phaseHint: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', paddingVertical: spacing.sm, fontStyle: 'italic' },
  header: { padding: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerStatus: { fontSize: 13, color: colors.success },
  progressBarBg: { height: 3, backgroundColor: '#3A3A3A', borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 2 },
  progressBarPulse: { height: '100%', width: '30%', backgroundColor: colors.primary, borderRadius: 2, opacity: 0.6 },

  stepsContainer: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: colors.success },
  stepDotCurrent: { backgroundColor: colors.primary },
  stepDotPending: { backgroundColor: '#3A3A3A' },
  stepDotIcon: { fontSize: 12, color: '#fff', fontWeight: '700' },
  stepLabel: { fontSize: 11, marginLeft: 4, color: colors.text.secondary, maxWidth: 70 },
  stepLabelActive: { color: '#fff', fontWeight: '600' },
  stepLabelPending: { color: '#555' },
  stepLine: { width: 16, height: 2, backgroundColor: '#3A3A3A', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: colors.success },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 40 },
  phaseBlock: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  phaseTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  phaseTitle: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  epHeaderText: { fontSize: 14, fontWeight: '700', color: colors.warning, marginBottom: spacing.sm, marginTop: spacing.xs },

  collapsible: { backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm, borderLeftWidth: 3 },
  collapsibleTitle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  collapsibleText: { fontSize: 12, color: '#DDD', lineHeight: 18 },
  collapsibleToggle: { fontSize: 11, color: colors.text.secondary, marginTop: 4, textAlign: 'right' },
  awaitingText: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', paddingVertical: 20 },
  episodeCounter: { marginTop: spacing.sm },
  episodeCounterText: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  chunkProgressBox: { backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm },
  chunkProgressSummary: { fontSize: 13, color: colors.info, fontWeight: '600', marginBottom: spacing.sm },
  chunkEtaText: { fontSize: 12, color: colors.text.secondary, marginBottom: spacing.sm },
  chunkItem: { backgroundColor: colors.bg.primary, borderRadius: radii.sm, padding: spacing.sm, marginBottom: spacing.xs, borderLeftWidth: 3, borderLeftColor: '#3A3A3A' },
  chunkItemRunning: { borderLeftColor: colors.warning },
  chunkItemDone: { borderLeftColor: colors.success, opacity: 0.7 },
  chunkItemHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  chunkItemHeader: { fontSize: 12, color: colors.text.secondary, fontWeight: '600', marginBottom: 4 },
  chunkStreamText: { fontSize: 12, color: '#DDD', lineHeight: 17, fontFamily: 'monospace' },
  chunkStreamPlaceholder: { fontSize: 11, color: '#555', fontStyle: 'italic' },

  liveStreamBox: { backgroundColor: colors.bg.secondary, borderRadius: radii.md, padding: spacing.sm, marginBottom: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.warning },
  liveStreamLabel: { fontSize: 11, fontWeight: '600', color: colors.warning, marginBottom: 4 },
  liveStreamText: { fontSize: 12, color: '#DDD', lineHeight: 18, fontFamily: 'monospace' },
  summaryBlock: { backgroundColor: '#1E293B', borderRadius: radii.lg, padding: spacing.md, marginTop: spacing.sm },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: colors.success, marginBottom: spacing.sm },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  summaryItem: { fontSize: 13, color: colors.success, marginBottom: 4 },
  summaryHint: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.md, textAlign: 'center' },

  bottomBar: { padding: spacing.md, backgroundColor: colors.bg.secondary, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  bottomBarText: { fontSize: 13, color: colors.text.secondary },
  errorBar: {
    padding: spacing.md, backgroundColor: colors.bg.secondary, borderTopWidth: 1, borderTopColor: colors.error,
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.error },
  errorBtn: { backgroundColor: colors.primary, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 8 },
  errorBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  emptySub: { fontSize: 14, color: colors.text.tertiary, textAlign: 'center' },
});
