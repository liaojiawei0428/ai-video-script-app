import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getEpisodeApi, updateEpisodeApi,
  generateShotsApi, getShotsApi, updateShotApi,
  exportEpisodeApi,
} from '../lib/api';
import {
  ArrowLeft, FileText, Download, Sparkles, Image as ImageIcon,
  Edit2, Save, X, Loader, AlertCircle, CheckCircle, RefreshCw, Activity, Camera, Mic, Sun, MapPin,
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

  // 分镜生成状态
  const [genState, setGenState] = useState<'idle' | 'queued' | 'running' | 'completed' | 'failed'>('idle');
  const [genStep, setGenStep] = useState(0);  // 0..SHOT_STEPS.length-1
  const [streamText, setStreamText] = useState('');
  const [streamPhase, setStreamPhase] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  useEffect(() => {
    return () => { if (wsRef.current) wsRef.current.close(); };
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

  const connectShotWs = (novelId: string) => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} }
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsHost = window.location.host;
      const ws = new WebSocket(`${wsProtocol}://${wsHost}/ws`);
      wsRef.current = ws;
      const connTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) { try { ws.close(); } catch {} }
      }, 5000);
      ws.onopen = () => {
        clearTimeout(connTimer);
        ws.send(JSON.stringify({ type: 'subscribe', novelId }));
      };
      let streamBuffer = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        if (streamBuffer) {
          setStreamText(prev => prev + streamBuffer);
          streamBuffer = '';
        }
        flushTimer = null;
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'progress') {
            const s = data.status || '';
            if (s === 'shot_gen' || s === 'generating' || s === 'running') {
              setGenState('running');
              setGenStep(prev => Math.max(prev, 2));
            }
            if (s === 'completed') {
              setGenState('completed');
              setGenStep(SHOT_STEPS.length - 1);
              if (flushTimer) { clearTimeout(flushTimer); flush(); }
              setTimeout(() => { load(); setGenState('idle'); setStreamText(''); setStreamPhase(''); setTaskId(null); }, 2000);
            }
            if (s === 'error' || s === 'failed') {
              setGenState('failed');
            }
          } else if (data.type === 'llm_update') {
            const phase = data.phase || '';
            if (phase === 'error') {
              // v2.5.15: 显示错误消息 (余额不足等)
              setStreamText(prev => prev + '\n\n❌ ' + (data.content || '任务失败'));
              setGenState('failed');
            } else if (phase === 'shot_gen') {
              setStreamPhase('AI 实时生成分镜');
              if (data.stream) {
                streamBuffer += data.content || '';
                if (!flushTimer) flushTimer = setTimeout(flush, 50);
                setGenStep(prev => Math.max(prev, 3));
              } else if (data.step === 'reasoning') {
                setGenStep(prev => Math.max(prev, 2));
              }
            }
          } else if (data.type === 'task_update') {
            const t = data.task;
            if (t?.status === 'completed') {
              setGenState('completed');
              setGenStep(SHOT_STEPS.length - 1);
              if (flushTimer) { clearTimeout(flushTimer); flush(); }
              setTimeout(() => { load(); setGenState('idle'); setStreamText(''); setStreamPhase(''); setTaskId(null); }, 2000);
            } else if (t?.status === 'running') {
              setGenState('running');
              setGenStep(prev => Math.max(prev, 1));
            } else if (t?.status === 'failed') {
              setGenState('failed');
            }
          }
        } catch {}
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onclose = () => { if (flushTimer) { clearTimeout(flushTimer); flush(); } };
    } catch (e) {
      console.error('WS error', e);
    }
  };

  const handleGenerateShots = async () => {
    if (!id || !episode?.novelId) return;
    setGenState('queued');
    setGenStep(0);
    setStreamText('');
    setStreamPhase('');
    setPolling(true);
    try {
      const r = await generateShotsApi(id);
      const tid = r.data?.data?.taskId;
      setTaskId(tid || null);
      // 启动 WS
      connectShotWs(episode.novelId);
    } catch (e: any) {
      setGenState('failed');
      const msg = e?.response?.data?.error?.message || '提交失败';
      setStreamText('❌ ' + msg);
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
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} className="text-accent animate-pulse" />
            <h3 className="font-bold text-accent">🎬 正在生成分镜</h3>
            <span className="text-xs text-text-tertiary ml-2">({streamText.length} 字符)</span>
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
                  {active && streamPhase && <span className="text-text-tertiary">— {streamPhase}</span>}
                </div>
              );
            })}
          </div>
          {/* 实时流式输出 */}
          {streamText && (
            <div className="mt-2 p-3 bg-bg-secondary rounded-lg max-h-64 overflow-y-auto">
              <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">{streamText}<span className="animate-pulse">▌</span></pre>
            </div>
          )}
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
          <p className="text-text-tertiary mb-4">暂无分镜</p>
          {!isGenerating && (
            <button onClick={handleGenerateShots} className="btn-primary inline-flex items-center gap-2">
              <Sparkles size={16} /> 立即生成分镜
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {validShots.map(s => (
            <ShotCard
              key={s.id}
              shot={s}
              editing={editShotId === s.id}
              draft={editShotId === s.id ? shotDraft : null}
              onStartEdit={() => startEditShot(s)}
              onCancelEdit={cancelEditShot}
              onChangeDraft={setShotDraft}
              onSave={saveShot}
              saving={savingShot && editShotId === s.id}
            />
          ))}
        </div>
      )}
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
    <div className="glass p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold flex-shrink-0">
          {shot.shotNumber}
        </div>
        {shot.imageUrl ? (
          <img src={shot.imageUrl.startsWith('data:') ? shot.imageUrl : `data:image/svg+xml;base64,${shot.imageUrl}`} alt="" className="w-32 h-20 object-cover rounded flex-shrink-0" />
        ) : (
          <div className="w-32 h-20 bg-bg-tertiary rounded flex items-center justify-center flex-shrink-0">
            <ImageIcon size={20} className="text-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-text-tertiary flex-wrap">
              <span>镜头 {shot.shotNumber}</span>
              <span>· {shot.durationSec}秒</span>
              {shot.location && <span>· 📍 {shot.location}</span>}
              {shot.sceneType && <span>· {shot.sceneType}</span>}
              {shot.cameraAngle && <span>· 📷 {shot.cameraAngle}</span>}
            </div>
            <button onClick={onStartEdit} className="text-xs px-1.5 py-0.5 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-0.5">
              <Edit2 size={10} /> 编辑
            </button>
          </div>
          <p className="text-sm text-text-primary leading-relaxed line-clamp-3 mb-1">{shot.description || <span className="text-text-tertiary">（空）</span>}</p>
          {(shot.dialogue || shot.action) && (
            <p className="text-xs text-text-secondary line-clamp-2">
              {shot.action && <span>🏃 {shot.action} </span>}
              {shot.dialogue && <span>💬 "{shot.dialogue}"</span>}
            </p>
          )}
        </div>
      </div>
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
