import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNovelsApi, getEpisodesApi, generateEpisodesApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useTaskProgressStore } from '../store/taskProgress';
import { CheckCircle, Clock, AlertCircle, ArrowLeft, Lightbulb, Loader, ChevronDown, ChevronUp, Play, RefreshCw } from 'lucide-react';

interface StepItem { key: string; label: string; phase: string }

const ANALYSIS_STEPS: StepItem[] = [
  { key: 'prep', label: '准备分析', phase: 'prep' },
  { key: 'chunking', label: '分块处理', phase: 'chunking' },
  { key: 'analyze_chunks', label: '逐段 AI 分析', phase: 'analyzing_chunks' },
  { key: 'merge', label: '合并分析结果', phase: 'merging' },
  { key: 'final_report', label: '生成分析报告', phase: 'final_analysis' },
  { key: 'character_extract', label: '角色细节提取', phase: 'character_extracting' },
];

export function TaskProgressPage() {
  const { novelId } = useParams<{ novelId: string }>();
  const token = useAuthStore(s => s.token);
  const nav = useNavigate();

  const store = useTaskProgressStore();
  const novelProgress = novelId ? store.novels[novelId] : undefined;

  const [status, setStatus] = useState<string>('loading');
  const [progress, setProgress] = useState(0);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [phaseDetail, setPhaseDetail] = useState('正在连接...');
  const [novelTitle, setNovelTitle] = useState('');

  const [chunkPhase, setChunkPhase] = useState<string>('');
  const [chunkCurrent, setChunkCurrent] = useState(0);
  const [chunkTotal, setChunkTotal] = useState(0);

  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());
  const [generatingEp, setGeneratingEp] = useState(0);
  const [thinkingMs, setThinkingMs] = useState(0);
  const [isThinking, setIsThinking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECONNECTS = 5;
  const streamBufferRef = useRef('');
  const streamPhaseRef = useRef('');
  const novelIdRef = useRef(novelId);
  const episodeScrollRefs = useRef<Record<number, HTMLPreElement | null>>({});
  const analysisScrollRef = useRef<HTMLPreElement | null>(null);
  const currentEpCardRef = useRef<HTMLDivElement | null>(null);
  const rafIds = useRef<Record<string, number>>({});
  const lastScrolledEpRef = useRef<number>(0);
  const generatingEpRef = useRef<number>(0);
  const isThinkingRef = useRef<boolean>(false);
  const thinkingStartRef = useRef<number>(0);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { novelIdRef.current = novelId; }, [novelId]);
  useEffect(() => { generatingEpRef.current = generatingEp; }, [generatingEp]);
  useEffect(() => { isThinkingRef.current = isThinking; }, [isThinking]);

  // 自动滚动页面到当前生成中的剧集卡片
  useEffect(() => {
    if (generatingEp > 0 && generatingEp !== lastScrolledEpRef.current) {
      lastScrolledEpRef.current = generatingEp;
      setTimeout(() => {
        currentEpCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [generatingEp]);

  const startAutoScroll = useCallback((key: string, el: HTMLPreElement | null) => {
    if (rafIds.current[key]) return;
    const tick = () => {
      if (el && el.isConnected) {
        el.scrollTop = el.scrollHeight;
        rafIds.current[key] = requestAnimationFrame(tick);
      } else {
        delete rafIds.current[key];
      }
    };
    rafIds.current[key] = requestAnimationFrame(tick);
  }, []);

  const stopAutoScroll = useCallback((key: string) => {
    if (rafIds.current[key]) {
      cancelAnimationFrame(rafIds.current[key]);
      delete rafIds.current[key];
    }
  }, []);

  const stopAllAutoScroll = useCallback(() => {
    Object.keys(rafIds.current).forEach(k => {
      cancelAnimationFrame(rafIds.current[k]);
    });
    rafIds.current = {};
  }, []);

  const toggleEpisode = useCallback((epNum: number) => {
    setExpandedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(epNum)) {
        next.delete(epNum);
        stopAutoScroll(`ep_${epNum}`);
      } else {
        next.add(epNum);
      }
      return next;
    });
  }, [stopAutoScroll]);

  const startThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) return;
    thinkingStartRef.current = Date.now();
    setIsThinking(true);
    setThinkingMs(0);
    thinkingTimerRef.current = setInterval(() => {
      setThinkingMs(Date.now() - thinkingStartRef.current);
    }, 100);
  }, []);

  const stopThinkingTimer = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setIsThinking(false);
  }, []);

  const [resuming, setResuming] = useState(false);

  const handleResume = useCallback(async () => {
    if (!novelId || resuming) return;
    setResuming(true);
    try {
      await generateEpisodesApi(novelId, true);
      window.location.reload();
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || '恢复失败，请重试';
      alert(msg);
      setResuming(false);
    }
  }, [novelId, resuming]);

  const isAnalyzing = status === 'analyzing' || status === 'pending';
  const isGenerating = status === 'generating';
  const isAnalyzeDone = status === 'analyzed';
  const isDone = status === 'completed' || status === 'failed';

  // 从 store 恢复状态
  useEffect(() => {
    if (!novelId) return;
    const np = store.novels[novelId];
    if (np) {
      setStatus(np.status);
      setProgress(np.progress);
      setTotalEpisodes(np.totalEpisodes);
      setCurrentEpisode(np.currentEpisode);
      setNovelTitle(np.novelTitle);
      setGeneratingEp(np.generatingEp);
      // 恢复展开状态：当前正在生成的集 + 所有有内容的已完成集
      const epsToExpand = new Set<number>();
      if (np.generatingEp > 0) epsToExpand.add(np.generatingEp);
      Object.entries(np.episodeTexts).forEach(([ep, text]) => {
        if (text && text.length > 0) epsToExpand.add(parseInt(ep, 10));
      });
      setExpandedEpisodes(epsToExpand);
    }
  }, [novelId]);

  // 初始拉取
  useEffect(() => {
    if (!novelId) return;
    const fetch = async () => {
      try {
        const res = await getNovelsApi();
        const all = res.data?.data?.novels || [];
        const n = all.find((x: any) => x.id === novelId);
        if (n) {
          const s = n.status || 'pending';
          setStatus(s);
          setProgress(n.progress || 0);
          setNovelTitle(n.title || '');
          store.setNovelProgress(novelId, {
            novelTitle: n.title || '',
            status: s,
            progress: n.progress || 0,
          });
          setPhaseDetail(
            s === 'analyzing' ? 'AI 正在分析小说...' :
            s === 'analyzed' ? '分析完成，准备生成剧集' :
            s === 'generating' ? 'AI 正在生成剧本...' :
            s === 'completed' ? '已完成' : '等待中...'
          );
          // 加载已生成的剧集数
          if (s === 'completed' || s === 'generating') {
            try {
              const epRes = await getEpisodesApi(novelId);
              const eps = epRes.data?.data?.episodes || [];
              if (eps.length > 0) {
                setTotalEpisodes(eps.length);
                setCurrentEpisode(eps.filter((e: any) => e.status === 'completed').length);
                store.setNovelProgress(novelId, {
                  totalEpisodes: eps.length,
                  currentEpisode: eps.filter((e: any) => e.status === 'completed').length,
                });
              }
            } catch {}
          }
        }
      } catch {}
    };
    fetch();
  }, [novelId]);

  // WebSocket - 使用 ref 避免闭包问题
  useEffect(() => {
    if (!novelId || !token) return;

    const connectWs = () => {
      if (wsRef.current) return;
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsHost = window.location.host;
        const ws = new WebSocket(`${wsProtocol}://${wsHost}/ws`);
        wsRef.current = ws;

        const connTimer = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            wsRef.current = null;
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(connTimer);
          ws.send(JSON.stringify({ type: 'subscribe', novelId }));
          reconnectAttemptsRef.current = 0;
        };

        let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;
        const flushStream = () => {
          const nid = novelIdRef.current;
          if (streamBufferRef.current && nid) {
            const batch = streamBufferRef.current;
            const phase = streamPhaseRef.current;
            streamBufferRef.current = '';

            const epMatch = phase.match(/ep_(\d+)/);
            if (epMatch) {
              const epNum = parseInt(epMatch[1], 10);
              useTaskProgressStore.getState().appendEpisodeText(nid, epNum, batch);
            } else if (phase === 'analyzing') {
              useTaskProgressStore.getState().appendAnalysisText(nid, batch);
            }
          }
          streamFlushTimer = null;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const nid = novelIdRef.current;
            if (!nid) return;
            const currentState = useTaskProgressStore.getState().novels[nid]?.status || 'pending';

            if (data.type === 'progress') {
              setProgress(prev => data.progress > 0 ? Math.max(prev, data.progress) : prev);
              const s = data.status || '';
              if (s && s !== 'loading') {
                const currentIsFinal = currentState === 'completed' || currentState === 'failed' || currentState === 'analyzed';
                if (!(currentIsFinal && ['pending', 'analyzing', ''].includes(s))) {
                  setStatus(s);
                }
              }
              if (data.totalEpisodes) setTotalEpisodes(data.totalEpisodes);
              if (data.currentEpisode != null) setCurrentEpisode(data.currentEpisode);
              if (data.detail) setPhaseDetail(data.detail);

              if (nid) {
                useTaskProgressStore.getState().setNovelProgress(nid, {
                  status: data.status || currentState,
                  progress: data.progress || 0,
                  totalEpisodes: data.totalEpisodes || 0,
                  currentEpisode: data.currentEpisode || 0,
                });
              }

              if (s === 'completed') {
                const wait = () => {
                  if (streamFlushTimer) setTimeout(wait, 200);
                  else {
                    setTimeout(() => setPhaseDetail('全部完成'), 500);
                    stopAllAutoScroll();
                  }
                };
                wait();
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
              const label =
                data.phase === 'chunking' ? '正在分块处理...' :
                data.phase === 'analyzing_chunks' ? `逐段分析 ${data.current || 0}/${data.total || 0}` :
                data.phase === 'merging' ? '正在合并分析结果...' :
                data.phase === 'final_analysis' ? '生成最终分析报告...' :
                data.phase === 'character_extracting' ? `角色细节提取 ${data.current || 0}/${data.total || 0}` : '';
              if (label) setPhaseDetail(label);
            } else if (data.type === 'llm_update') {
              const phase = data.phase || '';

              if (data.stream) {
                if (isThinkingRef.current) stopThinkingTimer();
                streamPhaseRef.current = phase;
                streamBufferRef.current += (data.content || '');
                if (!streamFlushTimer) {
                  streamFlushTimer = setTimeout(flushStream, 50);
                }
                const epMatch = phase.match(/ep_(\d+)/);
                if (epMatch) {
                  const epNum = parseInt(epMatch[1], 10);
                  if (generatingEpRef.current !== epNum) {
                    // 切换到新集：自动收起旧集，展开新集
                    const oldEp = generatingEpRef.current;
                    if (oldEp > 0) {
                      stopAutoScroll(`ep_${oldEp}`);
                      setExpandedEpisodes(prev => {
                        const next = new Set(prev);
                        next.delete(oldEp);
                        return next;
                      });
                    }
                    useTaskProgressStore.getState().setGeneratingEp(nid, epNum);
                    setGeneratingEp(epNum);
                    setExpandedEpisodes(prev => {
                      const next = new Set(prev);
                      next.add(epNum);
                      return next;
                    });
                  }
                  // 自动跟随滚动（展开状态 + 流式输出中）
                  setTimeout(() => {
                    const el = episodeScrollRefs.current[epNum];
                    if (el?.isConnected) {
                      startAutoScroll(`ep_${epNum}`, el);
                    }
                  }, 0);
                }
              } else if (phase === 'episode_plan') {
                setPhaseDetail(data.content || '');
              } else if (phase.startsWith('ep_') && (data.step === 'reasoning' || data.step === 'thinking')) {
                if (streamFlushTimer) { clearTimeout(streamFlushTimer); flushStream(); }
                const epMatch = phase.match(/ep_(\d+)/);
                if (epMatch && nid) {
                  const epNum = parseInt(epMatch[1], 10);
                  // 切换到新集：自动收起旧集
                  const oldEp = generatingEpRef.current;
                  if (oldEp > 0 && oldEp !== epNum) {
                    stopAutoScroll(`ep_${oldEp}`);
                  }
                  useTaskProgressStore.getState().setGeneratingEp(nid, epNum);
                  setGeneratingEp(epNum);
                  setExpandedEpisodes(prev => {
                    const next = new Set(prev);
                    if (oldEp > 0 && oldEp !== epNum) next.delete(oldEp);
                    next.add(epNum);
                    return next;
                  });
                  stopAllAutoScroll();
                  startThinkingTimer();
                }
              } else if (phase === 'analyzing' && data.step === 'reasoning') {
                setPhaseDetail(data.content || '分析中...');
              } else if (phase === 'character_extracting') {
                // v2.5.14: 显示角色描述生成进度
                setPhaseDetail(data.content || '角色描述生成中...');
              }
            } else if (data.type === 'task_update') {
              const t = data.task;
              if (t?.progress != null) {
                setProgress(t.progress);
                if (t.status !== currentState && t.status !== 'running') setStatus(t.status);
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          if (streamFlushTimer) { clearTimeout(streamFlushTimer); flushStream(); }
          wsRef.current = null;
          if (reconnectAttemptsRef.current < MAX_RECONNECTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 16000);
            reconnectAttemptsRef.current++;
            reconnectTimerRef.current = setTimeout(connectWs, delay);
          }
        };
        ws.onerror = () => { wsRef.current = null; ws.close(); };
      } catch {}
    };

    connectWs();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectAttemptsRef.current = MAX_RECONNECTS;
      stopAllAutoScroll();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [novelId, token]);

  // 自动滚动分析内容
  useEffect(() => {
    if (isAnalyzing && novelProgress?.analysisText) {
      startAutoScroll('analysis', analysisScrollRef.current);
    } else {
      stopAutoScroll('analysis');
    }
  }, [isAnalyzing, novelProgress?.analysisText, startAutoScroll, stopAutoScroll]);

  // 自动滚动当前正在生成的集
  useEffect(() => {
    if (generatingEp > 0 && expandedEpisodes.has(generatingEp)) {
      const el = episodeScrollRefs.current[generatingEp];
      startAutoScroll(`ep_${generatingEp}`, el);
    }
  }, [generatingEp, expandedEpisodes, startAutoScroll]);

  const analysisText = novelProgress?.analysisText || '';
  const episodeTexts = novelProgress?.episodeTexts || {};
  const episodeTitles = novelProgress?.episodeTitles || {};

  const currentAnalysisStepIdx = (() => {
    if (isDone || isAnalyzeDone) return ANALYSIS_STEPS.length;
    if (status === 'loading') return -1;
    const p = chunkPhase;
    const idx = ANALYSIS_STEPS.findIndex(s => s.phase === p);
    if (idx >= 0) return idx;
    if (isAnalyzing) return 1;
    return 0;
  })();

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader size={40} className="animate-spin text-accent mx-auto" />
          <p className="text-text-secondary mt-4">加载任务状态...</p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    const isBalanceIssue = (phaseDetail || '').includes('余额') || (phaseDetail || '').includes('BALANCE');
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => nav('/')} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">任务中断</h1>
        </div>
        <div className="glass p-8 text-center">
          <AlertCircle size={48} className="text-error mx-auto mb-4" />
          <p className="text-text-secondary mb-2">{phaseDetail || '任务处理失败'}</p>
          {isBalanceIssue && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 my-4 text-left">
              <p className="text-sm text-warning font-medium mb-2">💰 余额不足导致任务中断</p>
              <p className="text-xs text-text-secondary mb-3">
                充值后点击"继续生成"，将从已完成的集数继续，无需重新开始
              </p>
              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={handleResume}
                disabled={resuming}
              >
                {resuming ? <><Loader size={16} className="animate-spin" /> 正在恢复...</> : <><Play size={16} /> 继续生成</>}
              </button>
            </div>
          )}
          {!isBalanceIssue && (
            <button
              className="btn-primary mt-6 flex items-center gap-2 mx-auto"
              onClick={handleResume}
              disabled={resuming}
            >
              {resuming ? <><Loader size={16} className="animate-spin" /> 正在恢复...</> : <><RefreshCw size={16} /> 恢复任务</>}
            </button>
          )}
          <button className="btn-ghost mt-3 block mx-auto" onClick={() => nav('/')}>返回书架</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => nav('/')} className="text-text-tertiary hover:text-text-primary">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">{novelTitle || '任务进度'}</h1>
      </div>

      {/* 实时流式生成状态横幅 - 用户最关心的 */}
      {isGenerating && (
        <div className="glass p-4 mb-4 border border-accent/30 bg-gradient-to-r from-accent/5 via-primary/5 to-accent/5">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Loader size={24} className="text-accent animate-spin" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-accent">{isThinking ? 'AI 思考中' : '实时生成中'}</span>
                <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded font-mono">
                  {isThinking ? `⏱ ${(thinkingMs / 1000).toFixed(1)}s` : 'LIVE'}
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {generatingEp > 0 && totalEpisodes > 0
                  ? `正在生成第 ${generatingEp} / ${totalEpisodes} 集`
                  : phaseDetail || 'AI 正在创作...'}
                {currentEpisode > 0 && ` · 已完成 ${currentEpisode} 集`}
                {isThinking && generatingEp > 0 && ' · 等待首个字符返回'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="glass p-6 mb-4">
        <h3 className="font-semibold mb-3">
          {isAnalyzing ? 'AI 小说分析' :
           isGenerating ? 'AI 剧本生成' :
           isAnalyzeDone ? '分析完成' :
           '全部完成'}
        </h3>

        {!isDone && !isAnalyzeDone && (
          <>
            <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(progress, 2)}%`,
                  background: 'linear-gradient(90deg, var(--color-accent), var(--color-primary))',
                }}
              />
            </div>
            <p className="text-2xl font-bold text-accent text-center">{progress}%</p>
          </>
        )}

        {isDone && (
          <div className="text-center py-4">
            <CheckCircle size={48} className="text-success mx-auto mb-2" />
            <p className="text-lg font-bold text-success">全部完成</p>
            <p className="text-sm text-text-tertiary mt-1">该小说已生成完毕，可在书架上查看</p>
            <button className="btn-primary mt-4" onClick={() => nav(`/novels/${novelId}`)}>
              查看详情
            </button>
          </div>
        )}

        {isAnalyzeDone && (
          <div className="text-center py-4">
            <CheckCircle size={48} className="text-success mx-auto mb-2" />
            <p className="text-lg font-bold text-success">分析完成</p>
            <p className="text-sm text-text-tertiary mt-1">正在自动生成剧集，请稍候...</p>
          </div>
        )}

        {phaseDetail && !isDone && !isAnalyzeDone && (
          <p className="text-sm text-text-secondary text-center mt-2">{phaseDetail}</p>
        )}
      </div>

      {(isAnalyzing || isAnalyzeDone) && (
        <div className="glass p-6 mb-4">
          <h3 className="font-semibold mb-3">分析步骤</h3>
          {ANALYSIS_STEPS.map((step, i) => {
            const completed = i < currentAnalysisStepIdx;
            const current = i === currentAnalysisStepIdx && !isDone;
            const detail = step.phase === chunkPhase && chunkTotal > 0
              ? ` ${chunkCurrent}/${chunkTotal}` : '';

            return (
              <div key={step.key} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  completed ? 'bg-success' :
                  current ? 'bg-accent' :
                  'bg-bg-tertiary'
                }`}>
                  {completed ? (
                    <CheckCircle size={14} className="text-white" />
                  ) : current ? (
                    <Loader size={12} className="animate-spin text-white" />
                  ) : (
                    <Clock size={12} className="text-text-tertiary" />
                  )}
                </div>
                <span className={`flex-1 text-sm ${
                  completed ? 'text-success font-medium' :
                  current ? 'text-accent font-medium' :
                  'text-text-tertiary'
                }`}>{step.label}{detail}</span>
                <span className={`text-xs ${
                  completed ? 'text-success' :
                  current ? 'text-accent' :
                  'text-text-tertiary'
                }`}>
                  {completed ? '已完成' : current ? '进行中' : '等待中'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 分析内容 - 持久化显示 */}
      {analysisText && (
        <div className="glass p-4 mb-4">
          <h3 className="font-semibold mb-2 text-sm">分析内容</h3>
          <pre
            ref={analysisScrollRef}
            className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto"
          >
            {analysisText}
            {isAnalyzing && <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse ml-0.5 align-text-bottom" />}
          </pre>
        </div>
      )}

      {/* 剧集生成 - 仅在生成中或有已完成内容时显示 */}
      {(isGenerating || isDone) && (totalEpisodes > 0 || Object.keys(episodeTexts).length > 0 || isGenerating) && (
        <div className="space-y-3 mb-4">
          {Array.from({ length: Math.max(totalEpisodes, Object.keys(episodeTexts).length, generatingEp || 0, 1) }, (_, i) => {
            const epNum = i + 1;
            const isCompleted = epNum <= currentEpisode;
            const isCurrent = epNum === generatingEp && epNum > currentEpisode;
            const isPending = epNum > currentEpisode && epNum !== generatingEp;
            const isExpanded = expandedEpisodes.has(epNum);
            const text = episodeTexts[epNum] || '';
            const title = episodeTitles[epNum] || '';

            return (
              <div
                key={epNum}
                ref={isCurrent ? (el => { currentEpCardRef.current = el; }) : undefined}
                className={`glass overflow-hidden transition-all ${
                  isCurrent ? 'ring-2 ring-accent shadow-lg shadow-accent/30' : ''
                }`}
              >
                <button
                  onClick={() => toggleEpisode(epNum)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-bg-tertiary/50 transition-colors"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-success' :
                    isCurrent ? 'bg-accent animate-pulse' :
                    'bg-bg-tertiary'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle size={14} className="text-white" />
                    ) : isCurrent ? (
                      <Loader size={12} className="animate-spin text-white" />
                    ) : (
                      <Clock size={12} className="text-text-tertiary" />
                    )}
                  </div>
                  <span className={`flex-1 text-sm font-medium text-left ${
                    isCompleted ? 'text-success' :
                    isCurrent ? 'text-accent' :
                    'text-text-tertiary'
                  }`}>
                    第 {epNum} 集{title ? ` - ${title}` : ''}
                  </span>
                  <span className={`text-xs mr-2 flex items-center gap-1 ${
                    isCompleted ? 'text-success' :
                    isCurrent ? 'text-accent' :
                    'text-text-tertiary'
                  }`}>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                    {isCompleted ? '已完成' : isCurrent ? '实时生成中' : isPending ? '等待中' : ''}
                  </span>
                  {text && (
                    isExpanded ? <ChevronUp size={16} className="text-text-tertiary" />
                               : <ChevronDown size={16} className="text-text-tertiary" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-bg-secondary/30">
                    {isCurrent && isThinking && (
                      <div className="px-4 py-2 text-xs text-accent flex items-center gap-2 border-b border-border/50">
                        <Loader size={12} className="animate-spin" />
                        <span>🧠 AI 构思中</span>
                        <span className="font-mono text-accent/80">⏱ {(thinkingMs / 1000).toFixed(1)}s</span>
                      </div>
                    )}
                    <pre
                      ref={el => {
                        episodeScrollRefs.current[epNum] = el;
                        if (el && isCurrent && isExpanded) {
                          startAutoScroll(`ep_${epNum}`, el);
                        }
                      }}
                      className="text-[13px] text-text-primary whitespace-pre-wrap font-mono leading-relaxed p-4 max-h-[500px] overflow-y-auto"
                    >
                      {text || (isCurrent && isThinking ? '（等待 AI 输出首个字符...）' : '')}
                      {isCurrent && !isThinking && <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom" />}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 bg-bg-tertiary rounded-xl p-3">
        <Lightbulb size={16} className="text-text-tertiary flex-shrink-0" />
        <p className="text-xs text-text-tertiary">关闭页面后任务仍在后台进行，可随时回来看进度</p>
      </div>
    </div>
  );
}
