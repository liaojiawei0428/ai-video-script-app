import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getEpisodeApi, updateEpisodeApi,
  generateShotsApi, getShotsApi,
  exportEpisodeApi,
  generateComicApi, getComicApi,
} from '../lib/api';
import { useTaskProgressStore } from '../store/taskProgress';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import { ImageWithLoading } from '../components/ui';
import {
  ArrowLeft, FileText, Download, Sparkles, Image as ImageIcon,
  Edit2, Save, X, Loader, AlertCircle, CheckCircle, RefreshCw, Activity, Camera, Mic, Sun, MapPin,
  Layers, MessageSquare, Clock, Wand2, Eye, Hash, BookOpen, Users,
  Copy, Check,
} from 'lucide-react';

interface Episode {
  id: string; novelId?: string; episodeNumber: number;
  title: string; summary?: string; scriptContent: string;
  durationSec: number; status: string; sceneLocation?: string;
  // v2.5.19 漫画字段
  comicImageUrl?: string;
  comicGeneratedAt?: number;
  comicLayout?: string;
  comicTotalPages?: number;
  // v3.0.101 BUG-178: 用户编辑过的整段分镜文本 (server shots_text_cache 字段)
  //   v3.0.102 (S85 2026-07-07): BUG-179 web 端用整段 textarea 显示 + 编辑
  shotsTextCache?: string;
}
interface Shot {
  id: string; shotNumber: number; description: string; durationSec: number;
  imageUrl?: string; sceneType?: string; location?: string;
  timeOfDay?: string; cameraAngle?: string; cameraMove?: string;
  lighting?: string; dialogue?: string; action?: string;
  audioNote?: string; imagePrompt?: string;
}

// v3.0.102 (S85 2026-07-07) BUG-179: 把 shots 数组拼接成整段文本 (跟 mobile loadShots 1:1 镜像)
function formatShotsToText(shots: Shot[]): string {
  return shots.map((s, i) => {
    if (!s.cameraAngle && !s.cameraMove && !s.lighting) {
      return s.description || '';
    }
    return `【镜头${i + 1} | ${s.durationSec || 0}秒】\n景别：${s.cameraAngle || '中景'} | 运镜：${s.cameraMove || '固定'} | 灯光：${s.lighting || '自然光'}\n画面：${s.description || ''}${s.dialogue ? `\n对白：「${s.dialogue}」` : ''}${s.audioNote ? `\n音效：${s.audioNote}` : ''}`;
  }).join('\n\n---\n\n');
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
  // v3.0.102 BUG-179: 整段 textarea 模式 (跟 mobile 1:1 镜像)
  const [shotsTextDraft, setShotsTextDraft] = useState('');
  const [savingShotsText, setSavingShotsText] = useState(false);

  // 分镜生成状态 - 使用 zustand store
  const store = useTaskProgressStore();
  const novelId = episode?.novelId;
  const streamText = (novelId && id) ? (store.novels[novelId]?.shotStreamText?.[id] || '') : '';
  const genState = (novelId && id) ? (store.novels[novelId]?.shotGenState?.[id] || 'idle') : 'idle';
  const wsConnected = (novelId && id) ? (store.novels[novelId]?.shotWsConnected?.[id] || false) : false;
  const wsMsgCount = (novelId && id) ? (store.novels[novelId]?.shotMsgCount?.[id] || 0) : 0;
  // v2.5.19 漫画生成状态
  const comicGenState = (novelId && id) ? (store.novels[novelId]?.comicGenState?.[id] || 'idle') : 'idle';
  const comicWsConnected = (novelId && id) ? (store.novels[novelId]?.comicWsConnected?.[id] || false) : false;
  const comicMsgCount = (novelId && id) ? (store.novels[novelId]?.comicMsgCount?.[id] || 0) : 0;
  const comicCurrentStep = (novelId && id) ? (store.novels[novelId]?.comicCurrentStep?.[id] || '') : '';
  const [genStep, setGenStep] = useState(0);
  // v3.0.102 BUG-179: 提取 addToast 给 saveShotsText 用
  const addToast = useNotificationStore(s => s.addToast);

  // 漫画显示状态 (从后端加载)
  const [comicImages, setComicImages] = useState<string[]>([]);
  const [comicLayout, setComicLayout] = useState<string>('');
  const [comicTotalPages, setComicTotalPages] = useState<number>(0);
  const [comicGeneratedAt, setComicGeneratedAt] = useState<number | null>(null);
  // v2.5.27: 用户可选是否使用角色库 (默认开启, 注入三视图视觉 DNA 提升角色一致性)
  const [useCharacterLibrary, setUseCharacterLibrary] = useState<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);
  const streamBufferRef = useRef<string>('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsMsgCountRef = useRef(0);
  const wsContextRef = useRef<'shot' | 'comic'>('shot');
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

  // v3.0.102 BUG-179: 同步 shots → shotsTextDraft (跟 mobile loadShots 1:1 镜像)
  const lastShotsSigRef = useRef<string>('');
  useEffect(() => {
    const sig = (episode?.shotsTextCache || '') + '|' + shots.map(s => s.id + ':' + s.shotNumber).join(',');
    if (sig === lastShotsSigRef.current) return;
    lastShotsSigRef.current = sig;
    if (episode?.shotsTextCache && episode.shotsTextCache.trim()) {
      if (shotsTextDraft !== episode.shotsTextCache) setShotsTextDraft(episode.shotsTextCache);
    } else if (shots.length > 0) {
      const text = formatShotsToText(shots);
      if (shotsTextDraft !== text) setShotsTextDraft(text);
    }
  }, [episode?.shotsTextCache, shots]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getEpisodeApi(id).catch(() => null),
      getShotsApi(id).catch(() => ({ data: { data: { shots: [] } } })),
      getComicApi(id).catch(() => ({ data: { data: { images: [], layout: null, totalPages: 0, generatedAt: null } } })),
    ]).then(([e, s, c]) => {
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
      // v2.5.19 漫画
      const cd = c?.data?.data || {};
      setComicImages(cd.images || []);
      setComicLayout(cd.layout || '');
      setComicTotalPages(cd.totalPages || 0);
      setComicGeneratedAt(cd.generatedAt || null);
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

// v3.0.102 BUG-179: 替换为 saveShotsText (跟 mobile handleSaveShots 1:1 镜像)
  const saveShotsText = async () => {
    if (savingShotsText) return;
    setSavingShotsText(true);
    try {
      await updateEpisodeApi(id!, { shotsTextCache: shotsTextDraft });
      setEpisode(prev => prev ? { ...prev, shotsTextCache: shotsTextDraft } : prev);
      addToast({ type: 'system', title: '分镜内容已保存', content: `已保存到 episode.shotsTextCache (${shotsTextDraft.length} 字符)` });
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e?.message || '网络错误'));
    } finally { setSavingShotsText(false); }
  };

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

  const connectShotWs = (novelId: string, episodeId: string, context: 'shot' | 'comic' = 'shot') => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    wsContextRef.current = context;
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}://${wsHost}/ws`);
      wsRef.current = ws;
      wsMsgCountRef.current = 0;
      // 同时重置 shot 和 comic 的 WS 状态 (共享一个连接, 但两个面板都需要显示)
      useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, false);
      useTaskProgressStore.getState().setShotMsgCount(novelId, episodeId, 0);
      useTaskProgressStore.getState().setComicWsConnected(novelId, episodeId, false);
      useTaskProgressStore.getState().setComicMsgCount(novelId, episodeId, 0);
      if (context === 'shot') {
        useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'queued');
        setGenStep(0);
      } else {
        // comic 不需要 genStep
      }

      const connTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch {} }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connTimer);
        useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, true);
        useTaskProgressStore.getState().setComicWsConnected(novelId, episodeId, true);
        ws.send(JSON.stringify({ type: 'subscribe', novelId }));
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          wsMsgCountRef.current += 1;
          // 同时更新 shot 和 comic 的消息计数 (共享一个 WS, 两个面板都需要显示)
          if (wsMsgCountRef.current % 5 === 0 || data.type !== 'llm_update') {
            useTaskProgressStore.getState().setShotMsgCount(novelId, episodeId, wsMsgCountRef.current);
            useTaskProgressStore.getState().setComicMsgCount(novelId, episodeId, wsMsgCountRef.current);
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
              // v2.5.19: 漫画错误也透传
              useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'failed');
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
            } else if (phase === 'comic_gen') {
              // v2.5.19 漫画生成进度
              if (data.step === 'error') {
                // v2.5.20: 漫画自己的 error 阶段 (不是顶层 phase='error')
                useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'failed');
                useTaskProgressStore.getState().setComicCurrentStep(novelId, episodeId, 'error');
              } else if (data.step === 'done') {
                // v2.5.21: 漫画完成 - 立即 load() 刷新显示 (不等 task_update)
                useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'completed');
                useTaskProgressStore.getState().setComicCurrentStep(novelId, episodeId, 'done');
                setTimeout(() => { load(); }, 1000);
              } else {
                useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'running');
                useTaskProgressStore.getState().setComicCurrentStep(novelId, episodeId, data.step || '');
              }
            }
          } else if (data.type === 'task_update') {
            const t = data.task;
            if (t?.status === 'completed') {
              // v2.5.21: 检查 comicGenState 状态 (running/completed 都需要 load)
              const curComic = useTaskProgressStore.getState().novels[novelId]?.comicGenState?.[episodeId];
              if (curComic === 'running' || curComic === 'completed') {
                // 漫画生成完成 (running→completed 转换或已 completed)
                if (curComic === 'running') {
                  useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'completed');
                }
                setTimeout(() => { load(); }, 1000);
              } else {
                // 分镜生成完成
                useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'completed');
                setGenStep(SHOT_STEPS.length - 1);
                if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushStream(); }
                setTimeout(() => { load(); }, 1500);
              }
            } else if (t?.status === 'running') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'running');
              setGenStep(prev => Math.max(prev, 1));
            } else if (t?.status === 'failed') {
              useTaskProgressStore.getState().setShotGenState(novelId, episodeId, 'failed');
              useTaskProgressStore.getState().setComicGenState(novelId, episodeId, 'failed');
            }
          }
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => {
        useTaskProgressStore.getState().setShotWsConnected(novelId, episodeId, false);
        useTaskProgressStore.getState().setComicWsConnected(novelId, episodeId, false);
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

  // v2.5.19: 漫画生成
  const handleGenerateComic = async () => {
    if (!id || !episode?.novelId) return;
    if (shots.length === 0) {
      alert('请先生成分镜, 再生成漫画');
      return;
    }
    useTaskProgressStore.getState().resetComicPanel(episode.novelId, id);
    try {
      const r = await generateComicApi(id, useCharacterLibrary);
      const tid = r.data?.data?.taskId;
      if (!tid) {
        useTaskProgressStore.getState().setComicGenState(episode.novelId, id, 'failed');
        alert('提交漫画生成失败');
        return;
      }
      // 确保 WS 已连接 (用于接收 comic_gen 进度)
      connectShotWs(episode.novelId, id, 'comic');
      // 轮询兜底: 每5秒检查任务/漫画完成
      const poll = setInterval(async () => {
        try {
          const cr = await getComicApi(id);
          const cd = cr?.data?.data || {};
          if (cd.images && cd.images.length > 0) {
            clearInterval(poll);
            setComicImages(cd.images);
            setComicLayout(cd.layout || '');
            setComicTotalPages(cd.totalPages || 0);
            setComicGeneratedAt(cd.generatedAt || null);
            useTaskProgressStore.getState().setComicGenState(episode.novelId!, id, 'completed');
          }
        } catch {}
      }, 5000);
      setTimeout(() => clearInterval(poll), 600000); // 10分钟超时
    } catch (e: any) {
      useTaskProgressStore.getState().setComicGenState(episode.novelId, id, 'failed');
      const msg = e?.response?.data?.error?.message || '提交失败';
      alert('❌ ' + msg);
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
              {/* v2.5.19: 漫画生成按钮 + v2.5.27 角色库开关 (仅在有分镜时显示) */}
              {validShots.length > 0 && (
                <div className="flex items-center gap-2">
                  {/* 角色库视觉 DNA 开关 */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary hover:text-text-primary select-none" title="开启时: 注入角色库三视图视觉 DNA, 跨分镜角色外观一致; 关闭时: 纯剧本+风格生成">
                    <input
                      type="checkbox"
                      checked={useCharacterLibrary}
                      onChange={(e) => setUseCharacterLibrary(e.target.checked)}
                      disabled={comicGenState === 'running' || comicGenState === 'queued'}
                      className="w-3.5 h-3.5 accent-pink-500 cursor-pointer disabled:opacity-50"
                    />
                    <Users size={13} className="text-pink-400" />
                    <span>角色库</span>
                  </label>
                  <button onClick={handleGenerateComic} disabled={comicGenState === 'running' || comicGenState === 'queued'} className="btn-primary flex items-center gap-1 text-sm">
                    {comicGenState === 'running' || comicGenState === 'queued'
                      ? <><Loader size={16} className="animate-spin" /> 漫画生成中...</>
                      : <><BookOpen size={16} /> {comicImages.length > 0 ? '重新生成漫画' : '生成漫画'}</>}
                  </button>
                </div>
              )}
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

      {/* v2.5.19: 漫画生成进度面板 */}
      {(comicGenState === 'running' || comicGenState === 'queued') && (
        <div className="glass p-5 mb-4 border border-pink-500/40 bg-pink-500/5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <BookOpen size={18} className="text-pink-400 animate-pulse" />
            <h3 className="font-bold text-pink-400">📖 正在生成漫画</h3>
            <span className="text-xs text-text-tertiary ml-2">
              (当前步骤: {comicCurrentStep || 'preparing'} · 已接收 {comicMsgCount} 条消息)
            </span>
            <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${comicWsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              WS {comicWsConnected ? '✓ 已连接' : '✗ 断开'}
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <Loader size={12} className="animate-spin text-pink-400" />
              <span>AI 正在根据本集所有分镜数据生成漫画分格图, 请耐心等待...</span>
            </div>
            <div className="text-text-tertiary text-[10px] ml-5">
              💡 数据源: 仅使用本集已生成的分镜 (景别/运镜/画面/对白/灯光/色彩/音效/AI生图prompt), 严格按真实分镜数据生成
            </div>
          </div>
        </div>
      )}

      {/* v2.5.19: 漫画生成失败提示 */}
      {comicGenState === 'failed' && comicImages.length === 0 && (
        <div className="glass p-4 mb-4 border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={16} />
            <span>上次漫画生成失败, 请点击"重新生成漫画"重试 (常见原因: AI 出图超时/余额不足)</span>
          </div>
        </div>
      )}

      {/* v2.5.26: 漫画显示区域 - 完全重构, 1 张图 = 1 页漫画包含 N 个分镜 */}
      {/* 核心设计: 每页是 1 张图, 内部通过 AI prompt 包含多个分镜面板 */}
      {comicImages.length > 0 && (
        <div className="glass p-4 mb-4 border-2 border-pink-500/50 bg-pink-500/5">
          {/* 顶部状态条 - 明确告知用户"1 张图 = 1 页" */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <BookOpen size={20} className="text-pink-400" />
              <h3 className="font-bold text-pink-400 text-base">📖 漫画预览</h3>
              <span className="text-xs text-text-tertiary">
                <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-300 rounded font-semibold">
                  {comicLayout} 网格
                </span>
                <span className="ml-2">
                  {comicTotalPages} 张图 · 每张图含 {comicLayout === '3x3' ? 9 : comicLayout === '3x2' ? 6 : 4} 个分镜
                </span>
                {comicGeneratedAt && (
                  <span className="ml-2 text-text-tertiary">
                    · {new Date(comicGeneratedAt).toLocaleString('zh-CN')}
                  </span>
                )}
              </span>
            </div>
            <div className="text-xs text-text-tertiary flex items-center gap-2">
              {useCharacterLibrary && (
                <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded flex items-center gap-1" title="本次生成已注入角色库三视图视觉 DNA">
                  <Users size={11} /> 角色库已注入
                </span>
              )}
              {comicTotalPages > 1 ? `共 ${comicTotalPages} 页` : '1 页漫画'}
            </div>
          </div>

          {/* 关键提示: 明确告诉用户每张图是什么 */}
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-3 mb-3 text-xs text-pink-200">
            <p className="font-semibold mb-1">📌 阅读说明</p>
            <p>
              {comicTotalPages === 1 ? (
                <>下方显示 <strong>1 张完整的漫画页</strong> (像漫画书的一页),
                内部通过 {comicLayout} 网格切分为 {comicLayout === '3x3' ? 9 : comicLayout === '3x2' ? 6 : 4} 个分镜面板,
                每个分镜面板对应本集的一个分镜头。</>
              ) : (
                <>下方显示 <strong>{comicTotalPages} 张完整的漫画页</strong> (像漫画书的 {comicTotalPages} 页),
                每页通过 {comicLayout} 网格切分为 {comicLayout === '3x3' ? 9 : comicLayout === '3x2' ? 6 : 4} 个分镜面板。</>
              )}
            </p>
            <p className="mt-1 text-pink-300/80">
              ✨ 每张图都是 <strong>AI 一次性生成的多格漫画</strong>, 不是 1 张图 = 1 个分镜。
              网格内的不同分镜是同一张图的不同区域。
            </p>
          </div>

          {/* 下载按钮 (顶部) */}
          {comicTotalPages > 1 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {comicImages.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  download={`comic-page-${i + 1}.png`}
                  className="text-xs px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 rounded flex items-center gap-1.5 font-semibold"
                >
                  <Download size={14} /> 📥 下载第 {i + 1} 页 ({comicLayout})
                </a>
              ))}
            </div>
          )}

          {/* 漫画图片显示 - 单张大图, 不用 grid 切碎 */}
          <div className="space-y-4">
            {comicImages.map((url, pageIdx) => (
              <div key={pageIdx} className="bg-bg-tertiary rounded-xl overflow-hidden border border-pink-500/20">
                {/* 页码标签 */}
                {comicTotalPages > 1 && (
                  <div className="bg-pink-500/15 px-3 py-1.5 text-xs text-pink-200 font-semibold flex items-center justify-between">
                    <span>📄 第 {pageIdx + 1} / {comicTotalPages} 页</span>
                    <a
                      href={url}
                      download={`comic-page-${pageIdx + 1}.png`}
                      className="text-pink-300 hover:text-pink-100 flex items-center gap-1"
                    >
                      <Download size={12} /> 下载此页
                    </a>
                  </div>
                )}
                {/* 单张漫画图 (整张图, 不是切碎) */}
                <div className="p-2 bg-black/20">
                  <ImageWithLoading
                    src={comicImageSrc(url)}
                    alt={`第 ${pageIdx + 1} 页漫画 (${comicLayout} 网格)`}
                    containerClassName="w-full h-auto rounded overflow-hidden"
                    className="w-full h-auto object-contain"
                  />
                </div>
                {/* 图下方说明: 这张图内部包含 N 个分镜 */}
                <div className="p-3 text-center text-xs text-text-secondary bg-pink-500/5">
                  这张图内部包含 <strong className="text-pink-300">
                    {comicLayout === '3x3' ? '9' : comicLayout === '3x2' ? '6' : '4'}
                  </strong> 个分镜面板
                  (按从左到右、从上到下顺序对应本集的分镜头)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {validShots.length === 0 && !shotsTextDraft.trim() ? (
        <div className="glass p-10 text-center">
          <ImageIcon size={48} className="mx-auto mb-3 text-text-tertiary" />
          <p className="text-text-tertiary">暂无分镜 — 点击右上"生成分镜"按钮开始</p>
        </div>
      ) : (
        // v3.0.102 BUG-179: 1 个 textarea 永远 active, 像 TXT 文档一样编辑
        <div className="glass p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              分镜头描述
              <span className="text-sm text-text-secondary font-normal">
                · {validShots.length} 个镜头 · {validShots.reduce((s, sh) => s + (sh.durationSec || 0), 0).toFixed(1)} 秒
                {shotsTextDraft.length > 0 && <> · {shotsTextDraft.length} 字符</>}
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!shotsTextDraft.trim()) {
                    addToast({ type: 'system', title: '没有可复制的内容', content: '请先生成或编辑分镜' });
                    return;
                  }
                  navigator.clipboard.writeText(shotsTextDraft)
                    .then(() => addToast({ type: 'system', title: `已复制分镜内容`, content: `${shotsTextDraft.length} 字符已复制到剪贴板, 可粘贴到任何 AI 工具` }))
                    .catch(() => {
                      const ta = document.createElement('textarea');
                      ta.value = shotsTextDraft; document.body.appendChild(ta); ta.select();
                      document.execCommand('copy'); document.body.removeChild(ta);
                      addToast({ type: 'system', title: `已复制分镜内容 (降级模式)`, content: `${shotsTextDraft.length} 字符已复制` });
                    });
                }}
                className="px-3 py-1.5 text-sm bg-bg-secondary/60 hover:bg-primary/20 border border-border rounded text-text-secondary hover:text-primary flex items-center gap-1.5 transition-colors"
              >
                <Copy size={14} /> 复制全部
              </button>
              <button
                onClick={saveShotsText}
                disabled={savingShotsText}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingShotsText ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                保存修改
              </button>
            </div>
          </div>
          <textarea
            value={shotsTextDraft}
            onChange={e => setShotsTextDraft(e.target.value)}
            rows={Math.max(20, Math.min(60, Math.ceil(shotsTextDraft.length / 80)))}
            placeholder="分镜描述内容...&#10;&#10;支持任意编辑, 删除, 复制. 编辑后点击右上'保存修改'持久化到 server.&#10;&#10;新生成的分镜会自动填到这里, 也可以手动编辑后保存覆盖。"
            className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono leading-relaxed resize-y focus:border-primary/60 focus:outline-none"
          />
          <p className="text-xs text-text-tertiary mt-2">
            💡 这个文本框跟 TXT 文档一样, 随时编辑、复制、删除任意内容. 保存后会持久化到 episode.shotsTextCache, 后续漫画/视频生图也会以你保存的版本为准.
          </p>
        </div>
      )}
    </div>
  );
}

// v3.0.101 BUG-178 (S84 2026-07-07): 分镜列表 UI 重设计
//   修前: 按场景分组 + 每场景卡片 + 每镜头卡片 + 8 字段分类展示 (用户痛点: 分类多, 没法一次性复制)
//   修法: 单 '分镜头描述' 折叠卡片 (默认折叠), 里面所有分镜按 shotNumber 排序, 每个只显示 description 完整文本
//         + 3 个复制按钮 (每分镜 📋 + 顶部/底部 📋 复制全部)
//         行内编辑能力保留 (复用现有 draft/editingId 状态管理)
//   跨项目通用铁律 (跟 BUG-079 假报告 + BUG-097 漏修 100% 同源): UI 字段过度分类是过度设计,
//                       用户要的是 '完整可复制' 不是 '字段精细可编辑'

/**
 * 规范化漫画图片 src:
 * - 如果是 http(s) URL → 直接使用
 * - 如果是 data: URL → 直接使用
 * - 如果是纯 base64 字符串 → 加上 data:image/png;base64, 前缀
 */
function comicImageSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // 纯 base64 字符串
  return `data:image/png;base64,${url}`;
}
