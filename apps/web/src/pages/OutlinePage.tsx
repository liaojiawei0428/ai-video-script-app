import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOutlineApi, generateOutlineApi, confirmOutlineApi } from '../lib/api';
import { ArrowLeft, ListTree, CheckCircle } from 'lucide-react';

interface OutlineItem { episodeNumber: number; title: string; summary: string; keyCharacters?: string[]; estimatedDuration: number; }
interface Outline { items: OutlineItem[]; generatedAt: number; confirmedAt?: number; }

export function OutlinePage() {
  const { id } = useParams<{ id: string }>();
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getOutlineApi(id);
      setOutline(r.data?.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleGen = async () => {
    setGenerating(true);
    try { await generateOutlineApi(id!); await load(); }
    catch (e: any) { alert(e?.response?.data?.error?.message || '生成失败'); }
    finally { setGenerating(false); }
  };

  const handleConfirm = async () => {
    try { await confirmOutlineApi(id!); await load(); alert('大纲已确认'); }
    catch (e: any) { alert(e?.response?.data?.error?.message || '确认失败'); }
  };

  return (
    <div>
      <Link to={`/novels/${id}`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ListTree /> 分集大纲</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={handleGen} disabled={generating}>
            {generating ? '生成中...' : (outline ? '重新生成' : '生成大纲')}
          </button>
          {outline && !outline.confirmedAt && (
            <button className="btn-primary" onClick={handleConfirm}>确认大纲</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-tertiary">加载中...</div>
      ) : !outline || outline.items.length === 0 ? (
        <div className="glass p-10 text-center text-text-tertiary">暂无大纲, 点击上方按钮生成</div>
      ) : (
        <div className="space-y-3">
          {outline.items.map(item => (
            <div key={item.episodeNumber} className="glass p-4 flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                {item.episodeNumber}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  {outline.confirmedAt && <CheckCircle size={14} className="text-success" />}
                </div>
                <p className="text-sm text-text-secondary mb-2">{item.summary}</p>
                <div className="text-xs text-text-tertiary">
                  {item.estimatedDuration}秒 · {item.keyCharacters?.join('、') || '无角色'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
