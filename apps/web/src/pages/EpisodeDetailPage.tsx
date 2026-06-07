import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getEpisodeApi, updateEpisodeApi,
  generateShotsApi, getShotsApi, updateShotApi,
  exportEpisodeApi,
} from '../lib/api';
import { useTaskProgressStore } from '../store/taskProgress';
import { useAuthStore } from '../store/auth';
import {
  ArrowLeft, FileText, Download, Sparkles, Image as ImageIcon,
  Edit2, Save, X, Loader, AlertCircle, CheckCircle, RefreshCw, Activity, Camera, Mic, Sun, MapPin,
  ChevronDown, ChevronUp, Layers, MessageSquare, Clock, Wand2, Eye, Hash,
} from 'lucide-react';

interface Episode {
  id: string; novelId?: string; episodeNumber: number;
  title: string; summary?: string; scriptContent: string;
  durationSec: number; status: string; sceneLocation?: string;
}
interface Shot {
  id: string; shotNumber: number; description: string; durationSec: number;
  imageUrl?: string; sceneType?: string; location?: string;
  timeOfDay?: string; cameraAngle?: string; cameraMove?: string;
  lighting?: string; dialogue?: string; action?: string;
  audioNote?: string; imagePrompt?: string;
}

const SHOT_STEPS = [
  { key: 'queued',     label: '任务排队中',   phase: 'queued' },
  { key: 'running',    label: '任务启动',     phase: 'running' },
  { key: 'analyzing',  label: '分析剧本结构', phase: 'reasoning' },
  { key: 'streaming',  label: 'AI 实时生成分镜', phase: 'streaming' },
  { key: 'parsing',    label: '解析分镜数据', phase: 'parsing' },
  { key: 'saving',     label: '保存到数据库', phase: 'saving' },
  { key: 'completed',  label: '完成',         phase: 'completed' },
];

export function EpisodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore(s => s.token);
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);

  // 剧本内容编辑
  const [editingScript, setEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState({ title: '', summary: '', scriptContent: '', durationSec: 60, sceneLocation: '' });
  const [savingScript, setSavingScript] = useState(false);
  const [editShotId, setEditShotId] = useState<string | null>(null);
  const [shotDraft, setShotDraft] = useState<Partial<Shot>>({});
  const [savingShot, setSavingShot] = useState(false);

  // 分镜生成状态 - 使用 zustand store
  const store = useTaskProgressStore();
  const novelId = episode?.novelId;
  const streamText = (novelId && id) ? (store.novels[novelId]?.shotStreamText?.[id] || '') : '';
  const genState = (novelId && id) ? (store.novels[novelId]?.shotGenState?.[id] || 'idle') : 'idle';
  const wsConnected = (novelId && id) ? (store.novels[novelId]?.shotWsConnected?.[id] || false) : false;
  const wsMsgCount = (novelId && id) ? (store.novels[novelId]?.shotMsgCount?.[id] || 0) : 0;
  const [genStep, setGenStep] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef<string>('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsMsgCountRef = useRef(0);
  const episodeIdRef = useRef<string | null>(null);
  const novelIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    episodeIdRef.current = id || null;
  }, [id]);
  useEffect(() => {
    novelIdRef.current = novelId || null;
  }, [novelId]);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  useEffect(() => {
    return () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getEpisodeApi(id).catch(() => null),
      getShotsApi(id).catch(() => ({ data: { data: { shots: [] } } })),
    ]).then(([e, s]) => {
      const ep = e?.data?.data?.episode || e?.data?.data;
      if (ep) {
        setEpisode(ep);
        setScriptDraft({
          title: ep.title || '',
          summary: ep.summary || '',
          scriptContent: ep.scriptContent || '',
          durationSec: ep.durationSec || 60,
          sceneLocation: ep.sceneLocation || '',
        });
      }
      setShots(s.data?.data?.shots || []);
    }).finally(() => setLoading(false));
  }, [id]);

  const startEditScript = () => {
    if (!episode) return;
    setScriptDraft({
      title: episode.title || '',
      summary: episode.summary || '',
      scriptContent: episode.scriptContent || '',
      durationSec: episode.durationSec || 60,
      sceneLocation: episode.sceneLocation || '',
    });
    setEditingScript(true);
  };

  const saveScript = async () => {
    if (!id || savingScript) return;
    setSavingScript(true);
    try {
      await updateEpisodeApi(id, scriptDraft);
      setEpisode(prev => prev ? { ...prev, ...scriptDraft } : prev);
      setEditingScript(false);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setSavingScript(false); }
  };

  const startEditShot = (shot: Shot) => {
    setEditShotId(shot.id);
    setShotDraft({ ...shot });
  };
  const saveShot = async () => {
    if (!editShotId || savingShot) return;
    setSavingShot(true);
    try {
      const payload = {
        shotNumber: shotDraft.shotNumber,
        description: shotDraft.description,
        durationSec: shotDraft.durationSec,
        sceneType: shotDraft.sceneType,
        location: shotDraft.location,
        timeOfDay: shotDraft.timeOfDay,
        cameraAngle: shotDraft.cameraAngle,
        cameraMove: shotDraft.cameraMove,
        lighting: shotDraft.lighting,
        dialogue: shotDraft.dialogue,
        action: shotDraft.action,
        audioNote: shotDraft.audioNote,
        imagePrompt: shotDraft.imagePrompt,
      };
      await updateShotApi(editShotId, payload);
      setShots(prev => prev.map(s => s.id === editShotId ? { ...s, ...payload } as Shot : s));
      setEditShotId(null);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setSavingShot(false); }
  };

  const cancelEditShot = () => { setEditShotId(null); setShotDraft({}); };

  const flushStream = () => {
    const buf = streamBufferRef.current;
    const eid = episodeIdRef.current;
    const nid = novelIdRef.current;
    if (buf && eid && nid) {
      useTaskProgressStore.getState().appendShotStreamText(nid, eid, buf);
      streamBufferRef.current = '';
    }
    flushTimerRef.current = null;
  };

  const connectShotWs = (novelId: string, episodeId: string) => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}://${wsHost}/ws`);
      wsRef.current = ws;
      wsMsgCountRef.current = 0;
      useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, false);
      useTaskProgressStore.getState().setShotMsgCount(novelId, episodeId, 0);
      useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'queued');
      setGenStep(0);

      const connTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch {} }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connTimer);
        useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, true);
        ws.send(JSON.stringify({ type: 'subscribe', novelId }));
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          wsMsgCountRef.current += 1;
          if (wsMsgCountRef.current % 5 === 0 || data.type !== 'llm_update') {
            useTaskProgressStore.getState().setShotMsgCount(novelId, episodeId, wsMsgCountRef.current);
          }
          if (data.type === 'progress') {
            const s = data.status || '';
            if (s === 'shot_gen' || s === 'generating' || s === 'running') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'running');
              setGenStep(prev => Math.max(prev, 2));
            }
            if (s === 'completed') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'completed');
              setGenStep(SHOT_STEPS.length - 1);
              if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushStream(); }
              setTimeout(() => { load(); }, 1500);
            }
            if (s === 'error' || s === 'failed') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'failed');
            }
          } else if (data.type === 'llm_update') {
            const phase = data.phase || '';
            if (phase === 'error') {
              useTaskProgressStore.getState().appendShotStreamText(novelId, episodeId, '\n\n❌ ' + (data.content || '任务失败'));
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'failed');
            } else if (phase === 'shot_gen') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'running');
              if (data.stream) {
                streamBufferRef.current += data.content || '';
                if (!flushTimerRef.current) {
                  flushTimerRef.current = setTimeout(flushStream, 30);
                }
                setGenStep(prev => Math.max(prev, 3));
              } else if (data.step === 'reasoning') {
                setGenStep(prev => Math.max(prev, 2));
              }
            }
          } else if (data.type === 'task_update') {
            const t = data.task;
            if (t?.status === 'completed') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'completed');
              setGenStep(SHOT_STEPS.length - 1);
              if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushStream(); }
              setTimeout(() => { load(); }, 1500);
            } else if (t?.status === 'running') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'running');
              setGenStep(prev => Math.max(prev, 1));
            } else if (t?.status === 'failed') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'failed');
            }
          }
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => {
        useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, false);
        if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushStream(); }
      };
    } catch (e) {
      console.error('[shot-ws] init error', e);
    }
  };

  const handleGenerateShots = async () => {
    if (!id || !episode?.novelId) return;
    // 一次性重置面板状态 (避免多次 setState 触发多次重渲染)
    useTaskProgressStore.getState().resetShotPanel(episode.novelId, id);
    streamBufferRef.current = '';
    setGenStep(0);
    try {
      const r = await generateShotsApi(id);
      const tid = r.data?.data?.taskId;
      connectShotWs(episode.novelId, id);
      // 轮询兜底: 每3秒检查任务状态, WebSocket 失效时仍能刷新
      if (tid) {
        const poll = setInterval(async () => {
          try {
            const sr = await getShotsApi(id);
            const shotsData = sr.data?.data?.shots || [];
            if (shotsData.length > 0) {
              clearInterval(poll);
              setShots(shotsData);
              useTaskProgressStore.getState().setShotGenState(episode.novelId!, id, 'completed');
              setGenStep(SHOT_STEPS.length - 1);
              if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushStream(); }
            }
          } catch {}
        }, 3000);
        setTimeout(() => clearInterval(poll), 300000);
      }
    } catch (e: any) {
      useTaskProgressStore.getState().setShotGenState(episode.novelId, id, 'failed');
      const msg = e?.response?.data?.error?.message || '提交失败';
      useTaskProgressStore.getState().appendShotStreamText(episode.novelId, id, '❌ ' + msg);
      alert(msg);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(format);
    try {
      const r = await exportEpisodeApi(id!, format);
      const url = r.data?.data?.url;
      if (url) window.open(url, '_blank');
      else alert('导出失败');
    } catch (e: any) { alert(e?.response?.data?.error?.message || '导出失败'); }
    finally { setExporting(null); }
  };

  if (loading) return <div className="text-center py-20 text-text-tertiary">加载中...</div>;
  if (!episode) return <div className="text-center py-20 text-text-tertiary">剧集不存在</div>;

  const isGenerating = genState === 'queued' || genState === 'running';
  const validShots = shots.filter(s => s.shotNumber > 0 && !s.description.startsWith('好的，专业分镜师'));

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <Link to={episode.novelId ? `/novels/${episode.novelId}` : '/'} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回剧本详情
      </Link>

      {/* 标题区 */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          {editingScript ? (
            <div className="space-y-2">
              <input
                value={scriptDraft.title}
                onChange={e => setScriptDraft({ ...scriptDraft, title: e.target.value })}
                className="text-2xl font-bold w-full bg-bg-secondary border border-border rounded px-3 py-2"
                placeholder="集标题"
              />
              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <span className="text-text-tertiary">时长(秒):</span>
                  <input
                    type="number"
                    value={scriptDraft.durationSec}
                    onChange={e => setScriptDraft({ ...scriptDraft, durationSec: parseInt(e.target.value) || 60 })}
                    className="w-20 bg-bg-secondary border border-border rounded px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-1 flex-1">
                  <span className="text-text-tertiary">场景:</span>
                  <input
                    value={scriptDraft.sceneLocation}
                    onChange={e => setScriptDraft({ ...scriptDraft, sceneLocation: e.target.value })}
                    className="flex-1 bg-bg-secondary border border-border rounded px-2 py-1"
                    placeholder="如: 皇城大殿"
                  />
                </label>
              </div>
              <input
                value={scriptDraft.summary}
                onChange={e => setScriptDraft({ ...scriptDraft, summary: e.target.value })}
                className="text-sm w-full bg-bg-secondary border border-border rounded px-3 py-2"
                placeholder="本集简介 (summary)"
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-1">{episode.title}</h1>
              <p className="text-text-tertiary text-sm">第 {episode.episodeNumber} 集 · {episode.durationSec}秒{episode.sceneLocation ? ` · 📍 ${episode.sceneLocation}` : ''}</p>
              {episode.summary && <p className="text-sm text-text-secondary mt-2">{episode.summary}</p>}
            </>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          {editingScript ? (
            <>
              <button onClick={() => setEditingScript(false)} className="btn-ghost flex items-center gap-1 text-sm">
                <X size={16} /> 取消
              </button>
              <button onClick={saveScript} disabled={savingScript} className="btn-primary flex items-center gap-1 text-sm">
                {savingScript ? <Loader size={16} className="animate-spin" /> : <Save size={16} />} 保存
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditScript} className="btn-ghost flex items-center gap-1 text-sm">
                <Edit2 size={16} /> 编辑
              </button>
              <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => handleExport('pdf')} disabled={!!exporting}>
                <Download size={16} /> {exporting === 'pdf' ? '导出中...' : 'PDF'}
              </button>
              <button className="btn-ghost flex items-center gap-1 text-sm" onClick={() => handleExport('docx')} disabled={!!exporting}>
                <Download size={16} /> {exporting === 'docx' ? '导出中...' : 'Word'}
              </button>
              <button onClick={handleGenerateShots} disabled={isGenerating} className="btn-primary flex items-center gap-1 text-sm">
                {isGenerating ? <><Loader size={16} className="animate-spin" /> 生成中...</> : <><Sparkles size={16} /> {validShots.length > 0 ? '重新生成分镜' : '生成分镜'}</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 分镜生成进度面板 - 与 TaskProgressPage 样式一致 */}
      {isGenerating && (
        <div className="glass p-5 mb-4 border border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Activity size={18} className="text-accent animate-pulse" />
            <h3 className="font-bold text-accent">🎬 正在生成分镜</h3>
            <span className="text-xs text-text-tertiary ml-2">({streamText.length} 字符 · 已接收 {wsMsgCount} 条消息)</span>
            <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              WS {wsConnected ? '✓ 已连接' : '✗ 断开'}
            </span>
          </div>
          {/* 步骤进度 */}
          <div className="space-y-1.5 mb-3">
            {SHOT_STEPS.map((s, i) => {
              const done = i < genStep;
              const active = i === genStep;
              return (
                <div key={s.key} className={`flex items-center gap-2 text-xs ${done ? 'text-success' : active ? 'text-accent' : 'text-text-tertiary'}`}>
                  {done ? <CheckCircle size={14} /> : active ? <Loader size={14} className="animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-current" />}
                  <span className={active ? 'font-semibold' : ''}>{s.label}</span>
                  {active && <span className="text-text-tertiary">— AI 实时生成分镜</span>}
                </div>
              );
            })}
          </div>
          {/* 实时流式输出 - 用 callback ref + requestAnimationFrame 持续 autoScroll */}
          <div
            ref={(el) => {
              if (el && isGenerating) {
                const tick = () => {
                  if (el.isConnected) {
                    el.scrollTop = el.scrollHeight;
                    rafIdRef.current = requestAnimationFrame(tick);
                  } else {
                    rafIdRef.current = null;
                  }
                };
                if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = requestAnimationFrame(tick);
              } else if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
              }
            }}
            className="mt-2 p-3 bg-bg-secondary rounded-lg max-h-[500px] overflow-y-auto border border-border"
          >
            {streamText ? (
              <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap leading-relaxed">{streamText}<span className="inline-block w-2 h-3.5 bg-accent animate-pulse ml-0.5 align-text-bottom" /></pre>
            ) : (
              <div className="text-xs text-text-tertiary text-center py-4">⏳ 等待 AI 开始输出...</div>
            )}
          </div>
        </div>
      )}

      {/* 剧本内容 */}
      <div className="glass p-6 mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText size={18} /> 剧本内容</h2>
        {editingScript ? (
          <textarea
            value={scriptDraft.scriptContent}
            onChange={e => setScriptDraft({ ...scriptDraft, scriptContent: e.target.value })}
            rows={20}
            placeholder="剧本正文...&#10;&#10;支持 Markdown 格式, AI 生成的内容会保留全部原始文字"
            className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono leading-relaxed resize-y"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-text-secondary leading-relaxed font-sans">
            {episode.scriptContent || <span className="text-text-tertiary">暂无剧本内容 — 等待 AI 生成或点击右上"编辑"手动填写</span>}
          </pre>
        )}
      </div>

      {/* 分镜列表 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ImageIcon size={20} /> 分镜列表 ({validShots.length})
        </h2>
        {!isGenerating && validShots.length > 0 && (
          <button onClick={handleGenerateShots} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-1">
            <RefreshCw size={12} /> 重新生成
          </button>
        )}
      </div>

      {validShots.length === 0 ? (
        <div className="glass p-10 text-center">
          <ImageIcon size={48} className="mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-tertiary">暂无分镜 — 点击右上"生成分镜"按钮开始</p>
        </div>
      ) : (
        <ShotsByScene
          shots={validShots}
          editingId={editShotId}
          draft={editShotId ? shotDraft : null}
          onStartEdit={startEditShot}
          onCancelEdit={cancelEditShot}
          onChangeDraft={setShotDraft}
          onSave={saveShot}
          savingShot={savingShot}
        />
      )}
    </div>
  );
}

/**
 * 按场景分组的分镜列表
 * 每个场景作为一个可折叠卡片, 内部是镜头卡片
 */
function ShotsByScene({ shots, editingId, draft, onStartEdit, onCancelEdit, onChangeDraft, onSave, savingShot }: {
  shots: Shot[];
  editingId: string | null;
  draft: Partial<Shot> | null;
  onStartEdit: (s: Shot) => void;
  onCancelEdit: () => void;
  onChangeDraft: (d: Partial<Shot>) => void;
  onSave: () => void;
  savingShot: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 按场景分组 (从 description 提取场景标识)
  const groups = useMemo(() => {
    const map = new Map<string, Shot[]>();
    for (const shot of shots) {
      // 优先用 description 中"画面:"后面的第一句前 12 字符作为场景标识
      const visualMatch = (shot.description || '').match(/画面[::]\s*([^。\n]+)/);
      const firstSentence = visualMatch ? visualMatch[1] : (shot.description || '').split(/[。\n]/)[0] || '';
      let sceneName = firstSentence.slice(0, 14).trim();
      if (!sceneName) sceneName = `场景 ${shot.shotNumber}`;
      if (!map.has(sceneName)) map.set(sceneName, []);
      map.get(sceneName)!.push(shot);
    }
    return Array.from(map.entries()).map(([sceneName, list]) => {
      const totalDuration = list.reduce((sum, s) => sum + (s.durationSec || 0), 0);
      const dialogueCount = list.filter(s => s.dialogue && s.dialogue.trim()).length;
      return { sceneName, shots: list, totalDuration, dialogueCount };
    });
  }, [shots]);

  // 默认全部展开
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const g of groups) init[g.sceneName] = true;
    setExpanded(prev => ({ ...init, ...prev }));
  }, [groups.length]);

  // 总计
  const totalShots = shots.length;
  const totalDuration = shots.reduce((s, sh) => s + (sh.durationSec || 0), 0);
  const totalDialogues = shots.filter(s => s.dialogue && s.dialogue.trim()).length;

  return (
    <div className="space-y-3">
      {/* 顶部统计 */}
      <div className="glass p-3 flex items-center gap-4 text-xs text-text-secondary flex-wrap">
        <span className="flex items-center gap-1"><Hash size={12} className="text-accent" /> <strong className="text-text-primary">{totalShots}</strong> 个镜头</span>
        <span className="flex items-center gap-1"><Clock size={12} className="text-accent" /> <strong className="text-text-primary">{totalDuration.toFixed(1)}</strong> 秒</span>
        <span className="flex items-center gap-1"><MessageSquare size={12} className="text-accent" /> <strong className="text-text-primary">{totalDialogues}</strong> 句对白</span>
        <span className="flex items-center gap-1"><Layers size={12} className="text-accent" /> <strong className="text-text-primary">{groups.length}</strong> 个场景</span>
        <span className="ml-auto text-text-tertiary text-[10px]">💡 数据可被漫画生成/视频生图复用</span>
      </div>

      {/* 场景分组 */}
      {groups.map((group, gi) => {
        const isOpen = expanded[group.sceneName] ?? true;
        return (
          <div key={group.sceneName} className="glass overflow-hidden">
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [group.sceneName]: !prev[group.sceneName] }))}
              className="w-full flex items-center gap-2 p-3 hover:bg-bg-secondary/40 transition-colors"
            >
              {isOpen ? <ChevronUp size={16} className="text-text-tertiary flex-shrink-0" /> : <ChevronDown size={16} className="text-text-tertiary flex-shrink-0" />}
              <div className="w-7 h-7 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {gi + 1}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">📍 {group.sceneName}</div>
                <div className="text-[10px] text-text-tertiary flex items-center gap-2 mt-0.5">
                  <span>{group.shots.length} 镜头</span>
                  <span>·</span>
                  <span>{group.totalDuration.toFixed(1)}秒</span>
                  {group.dialogueCount > 0 && <><span>·</span><span>{group.dialogueCount} 对白</span></>}
                </div>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border space-y-2 p-2 bg-bg-secondary/20">
                {group.shots.map(s => (
                  <ShotCard
                    key={s.id}
                    shot={s}
                    editing={editingId === s.id}
                    draft={editingId === s.id ? draft : null}
                    onStartEdit={() => onStartEdit(s)}
                    onCancelEdit={onCancelEdit}
                    onChangeDraft={onChangeDraft}
                    onSave={onSave}
                    saving={savingShot && editingId === s.id}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShotCard({ shot, editing, draft, onStartEdit, onCancelEdit, onChangeDraft, onSave, saving }: {
  shot: Shot;
  editing: boolean;
  draft: Partial<Shot> | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeDraft: (d: Partial<Shot>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [shotExpanded, setShotExpanded] = useState(false);
  if (editing && draft) {
    return (
      <div className="glass p-4 border border-primary/40">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={draft.shotNumber || 0}
              onChange={e => onChangeDraft({ ...draft, shotNumber: parseInt(e.target.value) || 0 })}
              className="w-14 text-sm bg-bg-secondary border border-border rounded px-2 py-1"
            />
            <span className="text-xs text-text-tertiary">号镜头</span>
            <input
              type="number"
              value={draft.durationSec || 0}
              onChange={e => onChangeDraft({ ...draft, durationSec: parseInt(e.target.value) || 0 })}
              className="w-16 text-sm bg-bg-secondary border border-border rounded px-2 py-1"
            />
            <span className="text-xs text-text-tertiary">秒</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={onCancelEdit} className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-secondary flex items-center gap-1">
              <X size={12} /> 取消
            </button>
            <button onClick={onSave} disabled={saving} className="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />} 保存
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="🎬 镜头描述" textarea value={draft.description || ''} onChange={v => onChangeDraft({ ...draft, description: v })} rows={2} />
          <Field label="🏃 动作" textarea value={draft.action || ''} onChange={v => onChangeDraft({ ...draft, action: v })} rows={2} />
          <Field label="💬 对白/旁白" textarea value={draft.dialogue || ''} onChange={v => onChangeDraft({ ...draft, dialogue: v })} rows={2} />
          <Field label="📍 场景/地点" value={draft.location || ''} onChange={v => onChangeDraft({ ...draft, location: v })} icon={<MapPin size={12} />} />
          <Field label="📷 镜头角度" value={draft.cameraAngle || ''} onChange={v => onChangeDraft({ ...draft, cameraAngle: v })} icon={<Camera size={12} />} />
          <Field label="🎥 镜头运动" value={draft.cameraMove || ''} onChange={v => onChangeDraft({ ...draft, cameraMove: v })} icon={<Camera size={12} />} />
          <Field label="☀️ 光线" value={draft.lighting || ''} onChange={v => onChangeDraft({ ...draft, lighting: v })} icon={<Sun size={12} />} />
          <Field label="🕐 时间" value={draft.timeOfDay || ''} onChange={v => onChangeDraft({ ...draft, timeOfDay: v })} />
          <Field label="🎙 音效/音乐" value={draft.audioNote || ''} onChange={v => onChangeDraft({ ...draft, audioNote: v })} icon={<Mic size={12} />} />
          <Field label="🎬 场景类型 (中景/特写/远景)" value={draft.sceneType || ''} onChange={v => onChangeDraft({ ...draft, sceneType: v })} />
          <Field label="🤖 AI 生图 prompt" textarea value={draft.imagePrompt || ''} onChange={v => onChangeDraft({ ...draft, imagePrompt: v })} rows={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      {/* 头部: 始终显示 (镜头号 + 元数据 + 操作) */}
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setShotExpanded(prev => !prev)}
          className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold flex-shrink-0 hover:opacity-90 transition-opacity"
          title={shotExpanded ? '收起详情' : '展开全部内容'}
        >
          {shot.shotNumber}
        </button>
        {shot.imageUrl ? (
          <img src={shot.imageUrl.startsWith('data:') ? shot.imageUrl : `data:image/svg+xml;base64,${shot.imageUrl}`} alt="" className="w-24 h-16 object-cover rounded flex-shrink-0" />
        ) : (
          <div className="w-24 h-16 bg-bg-tertiary rounded flex items-center justify-center flex-shrink-0">
            <ImageIcon size={16} className="text-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary flex-wrap min-w-0">
              <span className="font-semibold text-text-secondary">镜头 {shot.shotNumber}</span>
              <span>· {shot.durationSec}秒</span>
              {shot.sceneType && <span className="px-1 bg-primary/20 text-primary rounded">{shot.sceneType}</span>}
              {shot.cameraMove && <span>🎥 {shot.cameraMove}</span>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={onStartEdit} className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-0.5">
                <Edit2 size={10} /> 编辑
              </button>
              <button
                onClick={() => setShotExpanded(prev => !prev)}
                className="text-[10px] px-1.5 py-0.5 bg-bg-tertiary text-text-secondary rounded hover:bg-bg-secondary flex items-center gap-0.5"
                title={shotExpanded ? '收起' : '展开全部内容'}
              >
                {shotExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {shotExpanded ? '收起' : '展开'}
              </button>
            </div>
          </div>
          {/* 折叠时只显示一行 description 摘要 */}
          {!shotExpanded && (
            <p className="text-xs text-text-secondary mt-1 truncate">
              {shot.description?.replace(/\n/g, ' ').slice(0, 100) || <span className="text-text-tertiary">（空）</span>}
            </p>
          )}
        </div>
      </div>

      {/* 展开时显示全部内容 */}
      {shotExpanded && (
        <div className="border-t border-border p-3 space-y-2 bg-bg-secondary/20">
          {/* 镜头描述 (完整, 无截断) */}
          <div>
            <div className="text-[10px] text-text-tertiary mb-1 flex items-center gap-1">
              🎬 <span className="font-semibold">镜头描述</span>
            </div>
            <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
              {shot.description || <span className="text-text-tertiary">（空）</span>}
            </div>
          </div>

          {/* 动作 + 对白 (完整) */}
          {(shot.action || shot.dialogue) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {shot.action && (
                <div>
                  <div className="text-[10px] text-text-tertiary mb-1 flex items-center gap-1">🏃 <span className="font-semibold">动作</span></div>
                  <div className="text-xs text-text-primary whitespace-pre-wrap break-words">{shot.action}</div>
                </div>
              )}
              {shot.dialogue && (
                <div>
                  <div className="text-[10px] text-text-tertiary mb-1 flex items-center gap-1">💬 <span className="font-semibold">对白/旁白</span></div>
                  <div className="text-xs text-text-primary whitespace-pre-wrap break-words">{shot.dialogue}</div>
                </div>
              )}
            </div>
          )}

          {/* 字段网格 (元数据) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
            {shot.location && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary flex items-center gap-1 mb-0.5"><MapPin size={10} /> 场景/地点</div>
                <div className="text-text-primary break-words">{shot.location}</div>
              </div>
            )}
            {shot.timeOfDay && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary mb-0.5">🕐 时间</div>
                <div className="text-text-primary">{shot.timeOfDay}</div>
              </div>
            )}
            {shot.cameraAngle && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary flex items-center gap-1 mb-0.5"><Camera size={10} /> 镜头角度</div>
                <div className="text-text-primary break-words">{shot.cameraAngle}</div>
              </div>
            )}
            {shot.cameraMove && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary flex items-center gap-1 mb-0.5"><Camera size={10} /> 镜头运动</div>
                <div className="text-text-primary break-words">{shot.cameraMove}</div>
              </div>
            )}
            {shot.lighting && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary flex items-center gap-1 mb-0.5"><Sun size={10} /> 光线</div>
                <div className="text-text-primary break-words">{shot.lighting}</div>
              </div>
            )}
            {shot.audioNote && (
              <div className="bg-bg-secondary/40 rounded p-2">
                <div className="text-[10px] text-text-tertiary flex items-center gap-1 mb-0.5"><Mic size={10} /> 音效/音乐</div>
                <div className="text-text-primary break-words">{shot.audioNote}</div>
              </div>
            )}
          </div>

          {/* AI 生图 prompt */}
          {shot.imagePrompt && (
            <details className="bg-bg-secondary/40 rounded p-2">
              <summary className="text-[10px] text-text-tertiary cursor-pointer hover:text-text-secondary flex items-center gap-1">
                🤖 <span className="font-semibold">AI 生图 prompt ({shot.imagePrompt.length} 字符)</span>
              </summary>
              <div className="text-[10px] text-text-secondary mt-1.5 whitespace-pre-wrap break-words font-mono leading-relaxed">
                {shot.imagePrompt}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, textarea, rows = 1, icon }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; rows?: number; icon?: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-tertiary mb-1 flex items-center gap-1">{icon}{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
          className="w-full text-xs bg-bg-secondary border border-border rounded p-2 resize-y" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)}
          className="w-full text-xs bg-bg-secondary border border-border rounded p-2" />
      )}
    </div>
  );
}
