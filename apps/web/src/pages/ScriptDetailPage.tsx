import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getNovelApi, getEpisodesApi, generateEpisodesApi,
  updateNovelMetaApi, updateAnalysisReportApi,
} from '../lib/api';
import {
  ArrowLeft, Play, Sparkles, Users, Network, Image as ImageIcon, ListTree, Activity, RefreshCw, Loader,
  Edit2, Check, X, BookOpen, Palette, Target, Heart, FileText, ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import { GeneratingLoader } from '../components/ui';

interface Novel {
  id: string; title: string; author: string; status: string;
  genre?: string; theme?: string; style?: string; tone?: string;
  analysisReport?: string; fullSummary?: string;
  outlineText?: string; outlineConfirmed?: number | boolean;
  plotGraph?: string;
  styleId?: string;
}
interface Episode { id: string; episodeNumber: number; title: string; summary?: string; durationSec: number; status: string; }

const SECTION_RE = {
  // eslint-disable-next-line no-misleading-character-class -- emoji 用 surrogate pair, 现有 JS 引擎兼容
  genre:  /(?:📖\s*类型|类型)[：:]\s*([^\n📌🎨💭🎭📜🏞️]+)/u,
  // eslint-disable-next-line no-misleading-character-class -- emoji 用 surrogate pair, 现有 JS 引擎兼容
  theme:  /(?:📌\s*主题|主题)[：:]\s*([^\n📖🎨💭🎭📜🏞️]+)/u,
  // eslint-disable-next-line no-misleading-character-class -- emoji 用 surrogate pair, 现有 JS 引擎兼容
  style:  /(?:🎨\s*风格|风格)[：:]\s*([^\n📖📌💭🎭📜🏞️]+)/u,
  // eslint-disable-next-line no-misleading-character-class -- emoji 用 surrogate pair, 现有 JS 引擎兼容
  tone:   /(?:💭\s*基调|基调)[：:]\s*([^\n📖📌🎨🎭📜🏞️]+)/u,
  // eslint-disable-next-line no-misleading-character-class -- emoji 用 surrogate pair, 现有 JS 引擎兼容
  plot:   /(?:📜\s*剧情要点|剧情要点)[：:]\s*([\s\S]*?)(?=🏞️|主要场景|$)/u,
  scenes: /(?:🏞️?\s*主要场景|主要场景)[：:]\s*([\s\S]*?)$/,
};

function parseReport(report?: string) {
  if (!report) return { genre: '', theme: '', style: '', tone: '', plot: '', scenes: '', charactersBlock: '' };
  const get = (re: RegExp) => (report.match(re) || ['', ''])[1].trim();
  return {
    genre: get(SECTION_RE.genre),
    theme: get(SECTION_RE.theme),
    style: get(SECTION_RE.style),
    tone:  get(SECTION_RE.tone),
    plot:  get(SECTION_RE.plot),
    scenes: get(SECTION_RE.scenes),
    charactersBlock: (report.match(/🎭[^\n]*?(?:角色)?分析[：:][\s\S]*?(?=📜|🏞️|$)/) || ['',''])[0].trim(),
  };
}

export function ScriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);

  // 编辑状态
  const [editMeta, setEditMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState({ genre: '', theme: '', style: '', tone: '' });
  const [metaSaving, setMetaSaving] = useState(false);

  const [editReport, setEditReport] = useState(false);
  const [reportDraft, setReportDraft] = useState('');
  const [reportSaving, setReportSaving] = useState(false);

  // v2.5.12: 剧情要点 + 主要场景 独立编辑
  const [editPlot, setEditPlot] = useState(false);
  const [plotDraft, setPlotDraft] = useState('');
  const [editScenes, setEditScenes] = useState(false);
  const [scenesDraft, setScenesDraft] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);

  const [showFullReport, setShowFullReport] = useState(false);
  const [showPlot, setShowPlot] = useState(true);
  const [showScenes, setShowScenes] = useState(true);
  const [showCharactersBlock, setShowCharactersBlock] = useState(false);

  const handleResume = async () => {
    if (!id || resuming) return;
    setResuming(true);
    try {
      await generateEpisodesApi(id, true);
      nav(`/progress/${id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || '恢复失败';
      alert(msg);
      setResuming(false);
    }
  };

  const load = async () => {
    if (!id) return;
    try {
      const [n, e] = await Promise.all([getNovelApi(id), getEpisodesApi(id)]);
      const nw = n.data?.data?.novel || n.data?.data;
      setNovel(nw);
      setMetaDraft({ genre: nw?.genre || '', theme: nw?.theme || '', style: nw?.style || '', tone: nw?.tone || '' });
      setReportDraft(nw?.analysisReport || '');
      setEpisodes(e.data?.data?.episodes || []);
      if (nw && (nw.status === 'analyzing' || nw.status === 'pending' || nw.status === 'analyzed')) {
        nav(`/progress/${id}`, { replace: true });
        return;
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const startEditMeta = () => {
    if (!novel) return;
    setMetaDraft({ genre: novel.genre || '', theme: novel.theme || '', style: novel.style || '', tone: novel.tone || '' });
    setEditMeta(true);
  };
  const saveMeta = async () => {
    if (!id || metaSaving) return;
    setMetaSaving(true);
    try {
      await updateNovelMetaApi(id, metaDraft);
      setNovel(prev => prev ? { ...prev, ...metaDraft } : prev);
      setEditMeta(false);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setMetaSaving(false); }
  };

  const startEditReport = () => { setReportDraft(novel?.analysisReport || ''); setEditReport(true); };
  const saveReport = async () => {
    if (!id || reportSaving) return;
    setReportSaving(true);
    try {
      await updateAnalysisReportApi(id, reportDraft);
      setNovel(prev => prev ? { ...prev, analysisReport: reportDraft } : prev);
      setEditReport(false);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setReportSaving(false); }
  };

  // v2.5.12: 用新值替换 analysis_report 中的指定 section
  const startEditPlot = () => { setPlotDraft(parsed.plot); setEditPlot(true); };
  const startEditScenes = () => { setScenesDraft(parsed.scenes); setEditScenes(true); };
  const saveSection = async (sectionKey: 'plot' | 'scenes', newValue: string) => {
    if (!id || sectionSaving) return;
    setSectionSaving(true);
    try {
      const current = novel?.analysisReport || '';
      let updated: string;
      if (sectionKey === 'plot') {
        // 替换 "📜 剧情要点：" 段到 "🏞️" / "主要场景" / 结尾
        updated = current.replace(
          /(📜\s*剧情要点[：:][\s\S]*?)(?=🏞️|主要场景|$)/,
          `📜 剧情要点：\n${newValue}\n\n`
        );
        if (updated === current) {
          // 没有原 section, 在末尾追加
          updated = current + `\n\n📜 剧情要点：\n${newValue}`;
        }
      } else {
        // 替换 "🏞️ 主要场景：" 段到结尾
        updated = current.replace(
          /(🏞️?\s*主要场景[：:][\s\S]*?)$/,
          `🏞️ 主要场景：\n${newValue}`
        );
        if (updated === current) {
          updated = current + `\n\n🏞️ 主要场景：\n${newValue}`;
        }
      }
      await updateAnalysisReportApi(id, updated);
      setNovel(prev => prev ? { ...prev, analysisReport: updated } : prev);
      if (sectionKey === 'plot') setEditPlot(false); else setEditScenes(false);
    } catch (e: any) {
      alert('保存失败: ' + (e?.response?.data?.error?.message || e.message));
    } finally { setSectionSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <GeneratingLoader size="lg" label="正在加载剧集..." />
        <div className="text-sm text-text-tertiary">首次加载可能需要几秒钟</div>
      </div>
    );
  }
  if (!novel) return <div className="text-center py-20 text-text-tertiary">小说不存在</div>;

  const parsed = parseReport(novel.analysisReport);
  const hasReport = !!novel.analysisReport;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回书架
      </Link>

      <div className="glass p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-2">{novel.title}</h1>
            <p className="text-text-tertiary text-sm">{novel.author || '佚名'}</p>
          </div>
          {/* v2.5.15: 风格标识 */}
          {novel.styleId && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 ${
              novel.styleId === 'realistic' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
              novel.styleId === 'ancient' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
              novel.styleId === 'anime' ? 'bg-pink-500/15 text-pink-400 border border-pink-500/30' :
              novel.styleId === 'cyber' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30' :
              novel.styleId === '3d' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
              'bg-gray-500/15 text-gray-400 border border-gray-500/30'
            }`}>
              {novel.styleId === 'realistic' && '🎬 电影写实风'}
              {novel.styleId === 'ancient' && '🏮 古风水墨'}
              {novel.styleId === 'anime' && '🎨 国漫动漫'}
              {novel.styleId === 'cyber' && '🌃 赛博朋克'}
              {novel.styleId === '3d' && '🧊 3D CG'}
            </span>
          )}
        </div>
      </div>

      {/* 实时进度横幅 */}
      {novel && novel.status !== 'completed' && novel.status !== 'failed' && (
        <Link
          to={`/progress/${id}`}
          className="glass p-4 mb-6 flex items-center gap-3 border border-accent/40 bg-gradient-to-r from-accent/10 to-primary/10 hover:border-accent transition-colors block"
        >
          <Activity size={24} className="text-accent animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-accent">
              {novel.status === 'analyzing' && 'AI 正在分析小说...'}
              {novel.status === 'pending' && '任务排队中...'}
              {novel.status === 'analyzed' && '分析完成，即将开始生成剧集'}
              {novel.status === 'generating' && '🔴 正在生成剧集，点击查看实时流式输出'}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">所有内容会实时显示</div>
          </div>
          <div className="text-accent text-sm">→</div>
        </Link>
      )}

      {/* 任务中断 - 恢复按钮 */}
      {novel && novel.status === 'error' && (
        <div className="glass p-4 mb-6 border border-warning/40 bg-warning/5">
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-warning" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-warning">任务中断</div>
              <div className="text-xs text-text-secondary mt-0.5">
                {episodes.length > 0
                  ? `已生成 ${episodes.length} 集，充值后点击"继续生成"将从第 ${episodes.length + 1} 集开始`
                  : '充值后点击"继续生成"将从头开始'}
              </div>
            </div>
            <button onClick={handleResume} disabled={resuming} className="btn-primary flex items-center gap-2 flex-shrink-0">
              {resuming ? <><Loader size={16} className="animate-spin" /> 恢复中</> : <><Play size={16} /> 继续生成</>}
            </button>
          </div>
        </div>
      )}

      {/* v2.5.11: AI 分析内容卡片 (类型/主题/风格/基调) - 可编辑 */}
      <div className="glass p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2"><BookOpen size={18} className="text-primary" /> 小说分析</h3>
          {hasReport && !editMeta && (
            <button onClick={startEditMeta} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-1">
              <Edit2 size={12} /> 编辑
            </button>
          )}
        </div>
        {!hasReport ? (
          <p className="text-sm text-text-tertiary">尚未生成分析报告（仅当 AI 分析完成后才会出现）</p>
        ) : editMeta ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MetaField label="类型" icon={<BookOpen size={14} />} value={metaDraft.genre} onChange={v => setMetaDraft({ ...metaDraft, genre: v })} />
            <MetaField label="基调" icon={<Heart size={14} />} value={metaDraft.tone} onChange={v => setMetaDraft({ ...metaDraft, tone: v })} />
            <MetaField label="主题" icon={<Target size={14} />} value={metaDraft.theme} onChange={v => setMetaDraft({ ...metaDraft, theme: v })} textarea />
            <MetaField label="风格" icon={<Palette size={14} />} value={metaDraft.style} onChange={v => setMetaDraft({ ...metaDraft, style: v })} textarea />
            <div className="md:col-span-2 flex gap-2 justify-end">
              <button onClick={() => setEditMeta(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg-secondary flex items-center gap-1">
                <X size={14} /> 取消
              </button>
              <button onClick={saveMeta} disabled={metaSaving} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
                <Save size={14} /> {metaSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MetaDisplay label="类型" icon={<BookOpen size={14} />} value={novel.genre} />
            <MetaDisplay label="基调" icon={<Heart size={14} />} value={novel.tone} />
            <MetaDisplay label="主题" icon={<Target size={14} />} value={novel.theme} />
            <MetaDisplay label="风格" icon={<Palette size={14} />} value={novel.style} />
          </div>
        )}
      </div>

      {/* v2.5.11: 剧情要点 卡片 (来自 analysis_report) */}
      {(parsed.plot || editPlot) && (
        <div className="glass p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setShowPlot(!showPlot)}>
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={18} className="text-primary" /> 剧情要点</h3>
              {showPlot ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            {showPlot && !editPlot && (
              <button onClick={startEditPlot} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-1">
                <Edit2 size={12} /> 编辑
              </button>
            )}
          </div>
          {showPlot && (
            editPlot ? (
              <div>
                <textarea
                  value={plotDraft}
                  onChange={e => setPlotDraft(e.target.value)}
                  rows={Math.max(6, plotDraft.split('\n').length + 2)}
                  placeholder="每行一个剧情要点，可使用 • - 开头&#10;• 主角初遇反派&#10;• 反派身份揭晓&#10;• 最终决战"
                  className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 leading-relaxed resize-y"
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => setEditPlot(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg-secondary flex items-center gap-1">
                    <X size={14} /> 取消
                  </button>
                  <button onClick={() => saveSection('plot', plotDraft)} disabled={sectionSaving} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
                    <Save size={14} /> {sectionSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                {parsed.plot.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} className="mb-1.5 pl-3 border-l-2 border-primary/30">{line.replace(/^[•·\-]\s*/, '')}</div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* v2.5.11: 主要场景 卡片 */}
      {(parsed.scenes || editScenes) && (
        <div className="glass p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => setShowScenes(!showScenes)}>
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={18} className="text-primary" /> 主要场景</h3>
              {showScenes ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            {showScenes && !editScenes && (
              <button onClick={startEditScenes} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 flex items-center gap-1">
                <Edit2 size={12} /> 编辑
              </button>
            )}
          </div>
          {showScenes && (
            editScenes ? (
              <div>
                <textarea
                  value={scenesDraft}
                  onChange={e => setScenesDraft(e.target.value)}
                  rows={Math.max(5, scenesDraft.split('\n').length + 2)}
                  placeholder="每行一个场景&#10;• 皇城大殿 - 金碧辉煌，是朝政议事之所&#10;• 冷宫 - 阴暗潮湿，关押失势嫔妃"
                  className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 leading-relaxed resize-y"
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => setEditScenes(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg-secondary flex items-center gap-1">
                    <X size={14} /> 取消
                  </button>
                  <button onClick={() => saveSection('scenes', scenesDraft)} disabled={sectionSaving} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
                    <Save size={14} /> {sectionSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
                {parsed.scenes.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} className="mb-1.5 pl-3 border-l-2 border-accent/30">{line.replace(/^[•·\-]\s*/, '')}</div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* v2.5.11: 完整分析报告 (可编辑) */}
      {hasReport && (
        <div className="glass p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setShowFullReport(!showFullReport)}>
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={18} className="text-primary" /> 完整 AI 分析报告</h3>
              {showFullReport ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            {showFullReport && !editReport && (
              <button onClick={startEditReport} className="text-xs px-2 py-1 bg-primary/20 text-primary rounded hover:bg-primary/30 flex items-center gap-1">
                <Edit2 size={12} /> 编辑
              </button>
            )}
          </div>
          {showFullReport && (
            editReport ? (
              <div>
                <textarea
                  value={reportDraft}
                  onChange={e => setReportDraft(e.target.value)}
                  rows={20}
                  className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-3 font-mono leading-relaxed"
                />
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => setEditReport(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-bg-secondary flex items-center gap-1">
                    <X size={14} /> 取消
                  </button>
                  <button onClick={saveReport} disabled={reportSaving} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50">
                    <Save size={14} /> {reportSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed bg-bg-secondary/50 p-3 rounded-lg max-h-96 overflow-y-auto">
                {novel.analysisReport}
              </pre>
            )
          )}
        </div>
      )}

      {/* v2.5.11: 工具栏 - 跳转各模块 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Link to={`/novels/${id}/characters`} className="glass p-4 hover:border-primary/40 transition-colors text-center">
          <Users className="mx-auto mb-2 text-primary" size={24} />
          <div className="text-sm font-medium">角色库</div>
        </Link>
        <Link to={`/novels/${id}/outline`} className="glass p-4 hover:border-primary/40 transition-colors text-center">
          <ListTree className="mx-auto mb-2 text-primary" size={24} />
          <div className="text-sm font-medium">分集大纲</div>
        </Link>
        <Link to={`/novels/${id}/plot-graph`} className="glass p-4 hover:border-primary/40 transition-colors text-center">
          <Network className="mx-auto mb-2 text-primary" size={24} />
          <div className="text-sm font-medium">事件图谱</div>
        </Link>
        <Link to={`/novels/${id}/assets`} className="glass p-4 hover:border-primary/40 transition-colors text-center">
          <ImageIcon className="mx-auto mb-2 text-primary" size={24} />
          <div className="text-sm font-medium">资产库</div>
        </Link>
        <Link to={`/assistant/${id}`} className="glass p-4 hover:border-primary/40 transition-colors text-center">
          <Sparkles className="mx-auto mb-2 text-primary" size={24} />
          <div className="text-sm font-medium">AI 助手</div>
        </Link>
      </div>

      {/* 剧集列表 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">剧集列表 ({episodes.length})</h2>
      </div>

      {episodes.length === 0 ? (
        <div className="glass p-10 text-center">
          <p className="text-text-tertiary mb-4">暂无剧集内容</p>
          {novel && (novel.status === 'analyzing' || novel.status === 'generating' || novel.status === 'pending' || novel.status === 'analyzed') ? (
            <Link to={`/progress/${id}`} className="btn-primary inline-flex items-center gap-2">
              <Activity size={16} /> 前往实时进度页
            </Link>
          ) : (
            <p className="text-xs text-text-tertiary">生成完成后将自动显示在这里</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {episodes.map(ep => (
            <Link
              key={ep.id}
              to={`/episodes/${ep.id}`}
              className="glass p-4 flex items-center gap-4 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold flex-shrink-0">
                {ep.episodeNumber}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1 line-clamp-1">{ep.title || `第${ep.episodeNumber}集`}</h3>
                {ep.summary && <p className="text-xs text-text-tertiary line-clamp-1">{ep.summary}</p>}
                <div className="text-xs text-text-tertiary mt-1">{ep.durationSec}秒</div>
              </div>
              <Play size={20} className="text-text-tertiary" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaField({ label, icon, value, onChange, textarea }: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="text-xs text-text-tertiary mb-1 flex items-center gap-1">{icon} {label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
          className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2 resize-y" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full text-sm bg-bg-secondary border border-border rounded-lg p-2" />
      )}
    </div>
  );
}

function MetaDisplay({ label, icon, value }: { label: string; icon: React.ReactNode; value?: string }) {
  return (
    <div>
      <div className="text-xs text-text-tertiary mb-1 flex items-center gap-1">{icon} {label}</div>
      <div className="text-sm text-text-primary whitespace-pre-line">{value || <span className="text-text-tertiary">（未填写）</span>}</div>
    </div>
  );
}
