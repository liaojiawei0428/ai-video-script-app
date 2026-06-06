import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPlotGraphApi, generatePlotGraphApi } from '../lib/api';
import { ArrowLeft, Network } from 'lucide-react';

interface PlotEvent { type: string; summary: string; characters: string[]; importance: number; }
interface Chapter { chapter: number; title: string; events: PlotEvent[]; }

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  setup: { label: '背景', color: 'bg-gray-500' },
  inciting_incident: { label: '诱发', color: 'bg-yellow-500' },
  rising_action: { label: '上升', color: 'bg-blue-500' },
  climax: { label: '高潮', color: 'bg-red-500' },
  falling_action: { label: '下落', color: 'bg-purple-500' },
  resolution: { label: '结局', color: 'bg-green-500' },
  turning_point: { label: '转折', color: 'bg-pink-500' },
};

export function PlotGraphPage() {
  const { id } = useParams<{ id: string }>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getPlotGraphApi(id);
      setChapters(r.data?.data?.chapters || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleGen = async () => {
    setGenerating(true);
    try { await generatePlotGraphApi(id!); await load(); }
    catch (e: any) { alert(e?.response?.data?.error?.message || '生成失败'); }
    finally { setGenerating(false); }
  };

  return (
    <div>
      <Link to={`/novels/${id}`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Network /> 章节事件图谱</h1>
        <button className="btn-primary" onClick={handleGen} disabled={generating}>
          {generating ? '解构中...' : (chapters.length > 0 ? '重新生成' : '生成图谱')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-tertiary">加载中...</div>
      ) : chapters.length === 0 ? (
        <div className="glass p-10 text-center text-text-tertiary">暂无事件图谱</div>
      ) : (
        <div className="space-y-6">
          {chapters.map(ch => (
            <div key={ch.chapter} className="glass p-5">
              <h2 className="text-lg font-bold mb-4">第{ch.chapter}章 · {ch.title}</h2>
              <div className="space-y-2">
                {ch.events.map((e, i) => {
                  const meta = TYPE_LABEL[e.type] || TYPE_LABEL.setup;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-bg-tertiary">
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${meta.color}`}>{meta.label}</span>
                      <div className="flex-1">
                        <p className="text-sm">{e.summary}</p>
                        <div className="text-xs text-text-tertiary mt-1">
                          {'⭐'.repeat(e.importance)} · {e.characters.join('、') || '无角色'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
