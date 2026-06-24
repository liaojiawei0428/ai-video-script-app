import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNovelsApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Loader, CheckCircle, AlertCircle, Clock, ChevronRight, Sparkles } from 'lucide-react';

interface ActiveTask {
  id: string;
  title: string;
  status: string;
  progress: number;
  phaseDetail: string;
  streamText: string;
  episodeTitle: string;
  totalEpisodes: number;
  currentEpisode: number;
  chunkPhase: string;
  chunkCurrent: number;
  chunkTotal: number;
}

export function TasksPage() {
  const token = useAuthStore(s => s.token);
  const nav = useNavigate();

  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [loading, setLoading] = useState(true);

  // 轮询所有小说状态
  useEffect(() => {
    if (!token) return;
    const poll = () => {
      getNovelsApi().then(r => {
        const all = r.data?.data?.novels || [];
        const active = all.filter((n: any) =>
          ['pending', 'analyzing', 'generating', 'analyzed'].includes(n.status)
        );
        setTasks(prev => {
          const merged = active.map((n: any) => {
            const old = prev.find((p: ActiveTask) => p.id === n.id);
            return {
              id: n.id,
              title: n.title || '未命名',
              status: n.status,
              progress: n.progress || 0,
              phaseDetail: n.status === 'analyzing' ? 'AI 分析中...' :
                          n.status === 'generating' ? 'AI 生成中...' :
                          n.status === 'analyzed' ? '分析完成' :
                          n.status === 'pending' ? '等待中...' : n.status,
              streamText: old?.streamText || '',
              episodeTitle: old?.episodeTitle || '',
              totalEpisodes: n.totalEpisodes || old?.totalEpisodes || 0,
              currentEpisode: n.currentEpisode || old?.currentEpisode || 0,
              chunkPhase: old?.chunkPhase || '',
              chunkCurrent: old?.chunkCurrent || 0,
              chunkTotal: old?.chunkTotal || 0,
            };
          });
          return merged;
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [token]);

  // WebSocket: 订阅所有活跃任务
  useEffect(() => {
    if (!token || tasks.length === 0) return;
    const activeIds = tasks.map(t => t.id);
    if (activeIds.length === 0) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECTS = 5;

    ws.onopen = () => {
      // 订阅所有活跃任务
      for (const nid of activeIds) {
        ws.send(JSON.stringify({ type: 'subscribe', novelId: nid }));
      }
      reconnectAttempts = 0;
    };

    // 流式缓冲
    const buffers: Record<string, string> = {};
    const flushTimers: Record<string, ReturnType<typeof setTimeout>> = {};

    const flush = (nid: string) => {
      if (buffers[nid]) {
        const batch = buffers[nid];
        buffers[nid] = '';
        setTasks(prev => prev.map(t =>
          t.id === nid ? { ...t, streamText: t.streamText + batch } : t
        ));
      }
      delete flushTimers[nid];
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const nid = data.novelId;
        if (!nid) return;

        if (data.type === 'progress') {
          setTasks(prev => prev.map(t =>
            t.id === nid ? {
              ...t,
              progress: data.progress > 0 ? Math.max(t.progress, data.progress) : t.progress,
              status: !['completed', 'analyzed', 'failed'].includes(t.status) || ['generating', 'analyzing'].includes(data.status)
                ? (data.status || t.status) : t.status,
              phaseDetail: data.detail ||
                (data.status === 'analyzing' ? `AI 分析中 ${data.progress || 0}%` :
                 data.status === 'analyzed' ? '分析完成' :
                 data.status === 'generating' && data.totalEpisodes
                   ? `生成剧集 ${data.currentEpisode || 0}/${data.totalEpisodes}`
                   : data.status === 'generating' ? `AI 生成中 ${data.progress || 0}%` : ''),
              totalEpisodes: data.totalEpisodes || t.totalEpisodes,
              currentEpisode: data.currentEpisode || t.currentEpisode,
            } : t
          ));
        } else if (data.type === 'chunk_progress') {
          setTasks(prev => prev.map(t =>
            t.id === nid ? {
              ...t,
              chunkPhase: data.phase || '',
              chunkCurrent: data.current || 0,
              chunkTotal: data.total || 0,
              phaseDetail:
                data.phase === 'chunking' ? '正在分块处理...' :
                data.phase === 'analyzing_chunks' ? `逐段分析 ${data.current || 0}/${data.total || 0}` :
                data.phase === 'merging' ? '正在合并分析结果...' :
                data.phase === 'final_analysis' ? '生成最终分析报告...' : '',
            } : t
          ));
        } else if (data.type === 'llm_update') {
          if (data.stream) {
            buffers[nid] = (buffers[nid] || '') + (data.content || '');
            if (!flushTimers[nid]) {
              flushTimers[nid] = setTimeout(() => flush(nid), 100);
            }
          } else if (data.phase?.startsWith('ep_') && data.step === 'reasoning') {
            if (flushTimers[nid]) { clearTimeout(flushTimers[nid]); flush(nid); }
            setTasks(prev => prev.map(t =>
              t.id === nid ? { ...t, episodeTitle: data.content || '', streamText: '' } : t
            ));
          }
        } else if (data.type === 'task_update') {
          const t = data.task;
          if (t?.progress !== null && t?.progress !== undefined) {
            setTasks(prev => prev.map(tt =>
              tt.id === nid ? { ...tt, progress: t.progress, status: t.status } : tt
            ));
          }
        }
      } catch {}
    };

    ws.onclose = () => {
      for (const k of Object.keys(flushTimers)) {
        clearTimeout(flushTimers[k]);
        flush(k);
      }
      if (reconnectAttempts < MAX_RECONNECTS) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 16000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => {
          // Re-run WS effect by triggering re-render
        }, delay);
      }
    };
    ws.onerror = () => ws.close();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const k of Object.keys(flushTimers)) clearTimeout(flushTimers[k]);
      ws.close();
    };
  }, [token, tasks.length > 0 ? tasks.map(t => t.id).join(',') : 'empty']);

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader size={40} className="animate-spin text-accent mx-auto mb-4" />
        <p className="text-text-tertiary">加载中...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Loader size={20} className="text-accent" />
        <h1 className="text-2xl font-bold">任务进度</h1>
        {tasks.length > 0 && (
          <span className="text-sm text-text-tertiary">({tasks.length} 个活跃任务)</span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="glass p-12 text-center">
          <CheckCircle size={48} className="text-success mx-auto mb-3" />
          <p className="text-text-secondary">当前没有正在执行的任务</p>
          <p className="text-sm text-text-tertiary mt-1">上传小说后会自动在这里显示进度</p>
          <button className="btn-primary mt-4" onClick={() => nav('/')}>去上传</button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, idx) => {
            const isAnalyzing = task.status === 'analyzing' || task.status === 'pending';
            const isGenerating = task.status === 'generating';
            const isAnalyzeDone = task.status === 'analyzed';
            const isActive = isAnalyzing || isGenerating || isAnalyzeDone;

            return (
              <div key={task.id} className="glass overflow-hidden">
                {/* 标题栏 */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                  onClick={() => nav(`/progress/${task.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isAnalyzing ? 'bg-accent animate-pulse' :
                      isGenerating ? 'bg-primary animate-pulse' :
                      isAnalyzeDone ? 'bg-success' :
                      'bg-success'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {task.status === 'analyzing' ? '分析中' :
                         task.status === 'generating' ? '生成中' :
                         task.status === 'pending' ? '等待中' : task.status}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
                </div>

                {/* 进度条 */}
                {isActive && (
                  <div className="px-4 pb-3">
                    <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(task.progress, 2)}%`,
                          background: isGenerating
                            ? 'linear-gradient(90deg, var(--color-primary), #22c55e)'
                            : 'linear-gradient(90deg, var(--color-accent), var(--color-primary))',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-text-tertiary">{task.phaseDetail}</span>
                      <span className="text-xs font-bold text-accent">{task.progress}%</span>
                    </div>

                    {/* 分块步骤 (分析阶段) */}
                    {isAnalyzing && (task.chunkPhase || task.progress > 0) && (
                      <div className="mt-2 text-xs text-text-tertiary space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={task.chunkPhase === 'chunking' || task.progress > 5 ? 'text-success' : ''}>
                            {task.chunkPhase === 'chunking' ? '⟳' : task.progress > 5 ? '✓' : '○'} 准备
                          </span>
                          <span className={task.chunkPhase === 'analyzing_chunks' ? 'text-accent' : task.progress > 20 ? 'text-success' : ''}>
                            {task.chunkPhase === 'analyzing_chunks' ? '⟳' : task.progress > 20 ? '✓' : '○'} 分析
                          </span>
                          <span className={task.chunkPhase === 'merging' ? 'text-accent' : task.progress > 50 ? 'text-success' : ''}>
                            {task.chunkPhase === 'merging' ? '⟳' : task.progress > 50 ? '✓' : '○'} 合并
                          </span>
                          <span className={task.chunkPhase === 'final_analysis' ? 'text-accent' : task.progress > 80 ? 'text-success' : ''}>
                            {task.chunkPhase === 'final_analysis' ? '⟳' : task.progress > 80 ? '✓' : '○'} 报告
                          </span>
                        </div>
                        {task.chunkCurrent > 0 && task.chunkTotal > 0 && (
                          <p className="text-text-tertiary">
                            第 {task.chunkCurrent}/{task.chunkTotal} 块
                          </p>
                        )}
                      </div>
                    )}

                    {/* 生成阶段剧集进度 */}
                    {isGenerating && task.totalEpisodes > 0 && (
                      <div className="mt-2">
                        <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-success"
                            style={{ width: `${(task.currentEpisode / task.totalEpisodes) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-text-tertiary mt-1">
                          {task.currentEpisode}/{task.totalEpisodes} 集
                        </p>
                      </div>
                    )}

                    {/* 流式内容 */}
                    {task.streamText && (
                      <div className="mt-2 p-2 bg-bg-tertiary/50 rounded-lg max-h-32 overflow-y-auto">
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                          {task.streamText}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* 已完成状态 */}
                {task.status === 'completed' && (
                  <div className="px-4 pb-3 flex items-center gap-2 text-success text-sm">
                    <CheckCircle size={14} />
                    <span>已完成</span>
                  </div>
                )}
                {task.status === 'failed' && (
                  <div className="px-4 pb-3 flex items-center gap-2 text-error text-sm">
                    <AlertCircle size={14} />
                    <span>{task.phaseDetail || '失败'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
