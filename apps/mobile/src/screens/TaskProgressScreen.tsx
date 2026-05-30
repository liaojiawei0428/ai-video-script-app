import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getNovels } from '../api/client';
import { WS_BASE_URL } from '../config';
import { GlassCard, ProgressBar, PulseProgressBar } from '../components';
import { colors, spacing, radii, typography } from '../theme';

interface StepItem { key: string; label: string; phase: string }

const ANALYSIS_STEPS: StepItem[] = [
  { key: 'prep', label: '准备分析', phase: 'prep' },
  { key: 'chunking', label: '分块处理', phase: 'chunking' },
  { key: 'analyze_chunks', label: '逐段 AI 分析', phase: 'analyzing_chunks' },
  { key: 'merge', label: '合并分析结果', phase: 'merging' },
  { key: 'final_report', label: '生成分析报告', phase: 'final_analysis' },
];

export function TaskProgressScreen(): React.JSX.Element {
  const route = useRoute<any>();
  const { novelId, novelTitle } = route.params || {};

  const [status, setStatus] = useState<string>('loading');
  const [progress, setProgress] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [phaseDetail, setPhaseDetail] = useState('正在连接...');

  const [chunkPhase, setChunkPhase] = useState<string>('');
  const [chunkCurrent, setChunkCurrent] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);
  const [streamText, setStreamText] = useState(''); // 流式输出内容
  const [episodeTitle, setEpisodeTitle] = useState(''); // 当前集标题（如"🎬 第 1/13 集"）

  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECTS = 5;

  // 进入页面立即从 HTTP API 拉取当前状态
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await getNovels();
        const allNovels = res?.data?.data?.novels || [];
        const n = allNovels.find((x: any) => x.id === novelId);
        if (n?.status) {
          setStatus(n.status);
          setProgress(n.progress || 0);
          setPhaseDetail(n.status === 'analyzing' ? 'AI 正在分析小说...' :
                         n.status === 'generating' ? 'AI 正在生成剧本...' :
                         n.status === 'completed' ? '已完成' : '等待中...');
          loadedRef.current = true;
        }
      } catch {}
      if (!loadedRef.current) {
        setTimeout(fetchInitial, 1000);
      }
    };
    fetchInitial();
  }, [novelId]);

  // WebSocket 实时更新 + HTTP 轮询兜底
  useEffect(() => {
    const connectWs = () => {
      if (wsRef.current) return;
      try {
        const baseUrl = (WS_BASE_URL || 'http://159.75.16.110:6000').replace('http', 'ws');
        const ws = new WebSocket(baseUrl + '/ws');
        wsRef.current = ws;

        // 连接超时 5 秒
        const connTimer = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            wsRef.current = null;
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(connTimer);
          ws.send(JSON.stringify({ type: 'subscribe', novelId }));
          setPhaseDetail('已连接，实时更新中...');
          reconnectAttemptsRef.current = 0;
        };

        // 流式内容缓冲（对标 EpisodeDetailScreen 的 shotBuffer 模式）
        let streamBuffer = '';
        let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushStream = () => {
          if (streamBuffer) {
            const batch = streamBuffer;
            streamBuffer = '';
            setStreamText(prev => prev + batch);
          }
          streamFlushTimer = null;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
              setProgress(data.progress || 0);
              const s = data.status || status;
              setStatus(s);
              if (data.totalEpisodes) setTotalEpisodes(data.totalEpisodes);
              if (data.currentEpisode) setCurrentEpisode(data.currentEpisode);
              if (data.detail) setPhaseDetail(data.detail);
              if (s === 'completed') {
                // 收到完成消息时，等待流式内容处理完毕再显示完成
                const waitForStreamDone = () => {
                  if (streamFlushTimer) {
                    // 还有未刷新的流式内容，等待
                    setTimeout(waitForStreamDone, 200);
                  } else {
                    // 流式内容已全部刷新，延迟一点确保渲染完成
                    setTimeout(() => {
                      setPhaseDetail('全部完成');
                    }, 500);
                  }
                };
                waitForStreamDone();
              }
              if (s === 'analyzing') setPhaseDetail(`AI 分析中 ${data.progress || 0}%`);
              if (s === 'generating') {
                setPhaseDetail(data.totalEpisodes
                  ? `生成剧集 ${data.currentEpisode || 0}/${data.totalEpisodes}`
                  : `AI 生成中 ${data.progress || 0}%`);
              }
            } else if (data.type === 'chunk_progress') {
              setChunkPhase(data.phase || '');
              setChunkCurrent(data.current || 0);
              setChunkTotal(data.total || 0);
              const phaseLabel = data.phase === 'chunking' ? '正在分块处理...' :
                                 data.phase === 'analyzing_chunks' ? `逐段分析 ${data.current || 0}/${data.total || 0}` :
                                 data.phase === 'merging' ? '正在合并分析结果...' :
                                 data.phase === 'final_analysis' ? '生成最终分析报告...' : '';
              if (phaseLabel) setPhaseDetail(phaseLabel);
            } else if (data.type === 'llm_update') {
              if (data.stream) {
                // 流式内容增量追加（对标 EpisodeDetailScreen）
                streamBuffer += (data.content || '');
                if (!streamFlushTimer) {
                  streamFlushTimer = setTimeout(flushStream, 100);
                }
              } else if (data.phase?.startsWith('ep_') && data.step === 'reasoning') {
                // 新一集开始：更新标题，清空上集流式内容
                if (streamFlushTimer) { clearTimeout(streamFlushTimer); flushStream(); }
                setEpisodeTitle(data.content || ''); // 设置当前集标题（如"🎬 第 1/13 集"）
                setStreamText('');
              } else if (data.phase === 'analyzing' && data.step === 'reasoning') {
                setPhaseDetail(data.content || '分析中...');
              }
            } else if (data.type === 'task_update') {
              const t = data.task;
              if (t?.progress != null) {
                setProgress(t.progress);
                setStatus(t.status === 'running' ? (status === 'generating' ? 'generating' : 'analyzing') : t.status);
              }
            } else if (data.type === 'queue_status') {
              store.setQueueStatus(novelId, data.position || 0, data.runningCount || 0, data.waitingCount || 0);
            }
          } catch {}
        };

        ws.onclose = () => {
          if (streamFlushTimer) { clearTimeout(streamFlushTimer); flushStream(); }
          wsRef.current = null;
          // 自动重连（指数退避）
          if (reconnectAttemptsRef.current < MAX_RECONNECTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
            reconnectAttemptsRef.current++;
            reconnectTimerRef.current = setTimeout(connectWs, delay);
          }
        };
        ws.onerror = () => {
          wsRef.current = null;
          ws.close();
        };
      } catch {}
    };

    const pollStatus = setInterval(async () => {
      try {
        const res = await getNovels();
        const allNovels = res?.data?.data?.novels || [];
        const n = allNovels.find((x: any) => x.id === novelId);
        if (n?.status) {
          setStatus(n.status);
        }
      } catch {}
    }, 2000);

    connectWs();

    return () => {
      clearInterval(pollStatus);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = MAX_RECONNECTS;
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [novelId]);

  const isAnalyzing = status === 'analyzing' || status === 'pending' || status === 'analyzed';
  const isGenerating = status === 'generating';
  const isDone = status === 'completed';
  const isLoading = status === 'loading';

  // 当前分析步骤索引
  const currentAnalysisStepIdx = (() => {
    if (isDone) return ANALYSIS_STEPS.length;
    if (isLoading) return -1;
    const p = chunkPhase;
    const idx = ANALYSIS_STEPS.findIndex(s => s.phase === p);
    if (idx >= 0) return idx;
    if (isAnalyzing) return 1; // 至少显示"准备分析"已完成
    return 0;
  })();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 60 }} />
        <Text style={{ ...typography.body, textAlign: 'center', marginTop: 16 }}>加载任务状态...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{novelTitle || '任务进度'}</Text>

      <GlassCard padded={true} style={{ marginBottom: spacing.lg }}>
        <Text style={styles.sectionTitle}>
          {isAnalyzing ? '📊 AI 小说分析' :
           isGenerating ? '📝 AI 剧本生成' :
           isDone ? '✅ 全部完成' : '处理中'}
        </Text>

        {!isDone && (
          <>
            {progress > 0 ? (
              <ProgressBar progress={progress} height={4} />
            ) : (
              <PulseProgressBar height={4} />
            )}
            <Text style={styles.progressValue}>{progress}%</Text>
          </>
        )}

        {isDone && (
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.completedText}>✅ 全部完成</Text>
            <Text style={styles.completedSub}>该小说已生成完毕，可在书架中查看</Text>
          </View>
        )}

        {phaseDetail ? (
          <Text style={styles.phaseDetail}>{phaseDetail}</Text>
        ) : null}
      </GlassCard>

      {isAnalyzing && (
        <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>分析步骤</Text>
          {ANALYSIS_STEPS.map((step, i) => {
            const isCompleted = i < currentAnalysisStepIdx || isDone;
            const isCurrent = i === currentAnalysisStepIdx && !isDone;
            const isPending = i > currentAnalysisStepIdx && !isDone;
            const stepDetail = step.phase === chunkPhase && chunkTotal > 0
              ? ` ${chunkCurrent}/${chunkTotal}` : '';

            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={[
                  styles.stepDotSmall,
                  isCompleted && styles.stepDotDoneSmall,
                  isCurrent && styles.stepDotCurrentSmall,
                  isPending && styles.stepDotPendingSmall,
                ]}>
                  {isCompleted ? (
                    <Text style={styles.stepDotCheck}>✓</Text>
                  ) : isCurrent ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.stepDotPendingText}>○</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabelText,
                  isCompleted && styles.stepLabelDone,
                  isCurrent && styles.stepLabelActive,
                  isPending && styles.stepLabelPending,
                ]}>{step.label}{stepDetail}</Text>
                {isCurrent && <Text style={styles.stepStatusRunning}>进行中</Text>}
                {isCompleted && <Text style={styles.stepStatusDone}>已完成</Text>}
                {isPending && <Text style={styles.stepStatusPending}>等待中</Text>}
              </View>
            );
          })}
        </GlassCard>
      )}

      {isGenerating && (
        <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>生成步骤</Text>
          {totalEpisodes > 0 && (
            <View style={styles.episodeSection}>
              <ProgressBar progress={(currentEpisode / totalEpisodes) * 100} height={4} color={colors.success} />
              <Text style={styles.episodeText}>
                {currentEpisode > 0 && currentEpisode < totalEpisodes
                  ? `正在生成第 ${currentEpisode + 1} 集（已完成 ${currentEpisode}/${totalEpisodes}）`
                  : currentEpisode >= totalEpisodes
                    ? `全部 ${totalEpisodes} 集生成完毕`
                    : `准备生成（共 ${totalEpisodes} 集）`}
              </Text>
            </View>
          )}
          {phaseDetail ? (
            <Text style={styles.stepDetail}>{phaseDetail}</Text>
          ) : null}
        </GlassCard>
      )}

      {/* 当前集标题（如"🎬 第 1/13 集"） */}
      {isGenerating && episodeTitle ? (
        <GlassCard padded={true} style={{ marginBottom: spacing.md, backgroundColor: colors.bg.secondary }}>
          <Text style={styles.episodeTitle}>{episodeTitle}</Text>
        </GlassCard>
      ) : null}

      {/* 剧本实时输出内容 */}
      {streamText ? (
        <GlassCard padded={true} style={{ marginBottom: spacing.md }}>
          <Text style={styles.sectionTitle}>📝 剧本内容</Text>
          <Text style={styles.streamText}>{streamText}</Text>
        </GlassCard>
      ) : null}

      <View style={styles.hintBox}>
        <Text style={styles.hintIcon}>💡</Text>
        <Text style={styles.hintText}>关闭页面后任务仍在后台进行，可随时回来看进度</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  pageTitle: { ...typography.h1, marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.text.primary, marginBottom: spacing.md },
  progressValue: { ...typography.h2, color: colors.accent, textAlign: 'center', marginTop: spacing.sm },
  phaseDetail: { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm },
  completedText: { ...typography.h2, color: colors.success },
  completedSub: { ...typography.body, color: colors.text.secondary, marginTop: spacing.xs },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stepDotSmall: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
  },
  stepDotDoneSmall: { backgroundColor: colors.success },
  stepDotCurrentSmall: { backgroundColor: colors.accent },
  stepDotPendingSmall: { backgroundColor: colors.bg.tertiary },
  stepDotCheck: { fontSize: 12, color: '#fff', fontWeight: '700' },
  stepDotPendingText: { fontSize: 12, color: colors.text.tertiary },
  stepLabelText: { ...typography.body, color: colors.text.primary, flex: 1 },
  stepLabelDone: { color: colors.success },
  stepLabelActive: { color: colors.accent, fontWeight: '600' },
  stepLabelPending: { color: colors.text.tertiary },

  stepStatusRunning: { ...typography.tag, color: colors.accent, marginLeft: spacing.sm },
  stepStatusDone: { ...typography.tag, color: colors.success, marginLeft: spacing.sm },
  stepStatusPending: { ...typography.tag, color: colors.text.tertiary, marginLeft: spacing.sm },
  stepDetail: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.sm },

  episodeSection: { marginBottom: spacing.md },
  episodeText: { ...typography.body, color: colors.text.secondary, textAlign: 'center', marginTop: spacing.sm },
  episodeTitle: { ...typography.h3, color: colors.accent, textAlign: 'center', fontWeight: '600' },

  hintBox: {
    flexDirection: 'row', backgroundColor: colors.bg.tertiary,
    borderRadius: radii.md, padding: spacing.sm + 2, alignItems: 'center', marginTop: spacing.md,
  },
  hintIcon: { fontSize: 16, marginRight: spacing.sm },
  hintText: { ...typography.body, color: colors.text.tertiary, flex: 1 },
  streamText: { ...typography.body, color: colors.text.secondary, fontFamily: 'monospace', lineHeight: 20 },
});
