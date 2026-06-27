import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNovelsApi, uploadNovelApi, deleteNovelApi } from '../lib/api';
import { getLocalNovels, saveNovelIfChanged, diffNovelsByHash } from '../db/indexedDb';
import { Search, Upload, BookOpen, Filter, X, Trash2 } from 'lucide-react';

interface Novel { id: string; title: string; author: string; status: string; totalChars?: number; createdAt: number; styleId?: string; }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'text-warning' },
  analyzing: { label: '分析中', color: 'text-accent' },
  generating: { label: '生成中', color: 'text-accent' },
  completed: { label: '已完成', color: 'text-success' },
  failed: { label: '失败', color: 'text-error' },
};

const STYLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  realistic: { label: '电影写实', color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
  ancient: { label: '古风水墨', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  anime: { label: '国漫动漫', color: 'text-pink-400', bg: 'bg-pink-500/15 border-pink-500/30' },
  cyber: { label: '赛博朋克', color: 'text-cyan-400', bg: 'bg-cyan-500/15 border-cyan-500/30' },
  '3d': { label: '3D CG', color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
};

export function BookshelfPage() {
  const nav = useNavigate();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadStyle, setUploadStyle] = useState('realistic');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Novel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshNovels = async () => {
    setLoading(true);
    // 🆕 S72 batch 16 v3.0.45 BUG-115 缓存方案 A.5: 本地优先 + hash 比对 (跨端铁律 4++ 跟 mobile BookshelfScreen 1:1)
    const local = await getLocalNovels().catch(() => []);
    if (local.length > 0) {
      setNovels(local);
      setLoading(false); // 本地有数据就立即显示
    }
    try {
      const serverRes = await getNovelsApi();
      const serverNovels = serverRes.data?.data?.novels || [];
      // hash 比对: 没变不 setState + 不写 IndexedDB
      const { changed } = await diffNovelsByHash(serverNovels);
      // 🆕 S72 batch 17 v3.0.46 BUG-116 缓存方案 B.5: ETag/304 短路检查
      const fromCache = (serverRes as any)?.headers?.['x-cache'] === 'HIT-304';
      if (changed.length > 0 && !fromCache) {
        setNovels(serverNovels);
        for (const n of changed) await saveNovelIfChanged(n).catch(() => {});
      }
      // else: 304 命中 或 hash 一致 → skip setState 避免 re-render
    } catch {
      // server 不可达, 已显示本地数据
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteNovelApi(deleteTarget.id);
      setDeleteTarget(null);
      refreshNovels();
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    refreshNovels();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadTitle(file.name.replace(/\.(txt|md)$/i, ''));
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const r = await uploadNovelApi(uploadFile, uploadTitle || undefined, uploadStyle);
      const nid = r.data?.data?.novelId || r.data?.data?.id;
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle('');
      setUploadStyle('realistic');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (nid) {
        nav(`/progress/${nid}`);
      } else {
        refreshNovels();
      }
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = novels;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(n => (n.title || '').toLowerCase().includes(q));
    }
    if (filter === 'active') list = list.filter(n => ['pending', 'analyzing', 'generating'].includes(n.status));
    else if (filter === 'completed') list = list.filter(n => n.status === 'completed');
    return list;
  }, [novels, searchQ, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">我的书架</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowUpload(true)}>
          <Upload size={18} /> 上传小说
        </button>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            className="input pl-10"
            placeholder="搜索小说标题..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>
        <div className="flex bg-bg-secondary rounded-lg p-1 gap-1">
          {([['all', '全部'], ['active', '进行中'], ['completed', '已完成']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filter === k ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
              }`}
            >{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-text-tertiary">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen size={64} className="mx-auto text-text-tertiary mb-4" />
          <p className="text-text-secondary">{novels.length === 0 ? '书架为空' : '没有匹配的剧本'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(n => {
            const cfg = STATUS_LABEL[n.status] || { label: n.status, color: 'text-text-tertiary' };
            return (
              <div key={n.id} className="glass p-5 hover:border-primary/40 transition-colors flex items-center gap-3">
                <Link to={`/novels/${n.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-text-primary line-clamp-1">{n.title}</h3>
                    {n.styleId && STYLE_BADGE[n.styleId] && (
                      <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium ${STYLE_BADGE[n.styleId].color} ${STYLE_BADGE[n.styleId].bg}`}>
                        {STYLE_BADGE[n.styleId].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary mb-3">{n.author || '佚名'} · {n.totalChars || 0} 字</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-text-tertiary">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
                <button
                  onClick={() => setDeleteTarget(n)}
                  className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
                  title="删除"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold mb-2">确认删除</h2>
            <p className="text-sm text-text-secondary mb-2">
              确定要删除 <span className="font-medium text-text-primary">《{deleteTarget.title}》</span> 吗？
            </p>
            <p className="text-xs text-error/80 mb-5">此操作不可撤销，所有相关数据将被永久删除。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost flex-1" disabled={deleting}>取消</button>
              <button onClick={handleDelete} className="btn-primary flex-1 bg-error hover:bg-error/90" disabled={deleting}>
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 上传对话框 */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-primary rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">上传小说</h2>
              <button onClick={() => setShowUpload(false)} className="text-text-tertiary hover:text-text-primary">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">选择文件</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileSelect}
                  className="input"
                />
                <p className="text-xs text-text-tertiary mt-1">支持 .txt, .md 格式</p>
              </div>

              {uploadFile && (
                <>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">小说标题</label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={e => setUploadTitle(e.target.value)}
                      className="input"
                      placeholder="留空则使用文件名"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-text-secondary mb-1">画风</label>
                    <select
                      value={uploadStyle}
                      onChange={e => setUploadStyle(e.target.value)}
                      className="input"
                    >
                      <option value="realistic">写实电影风</option>
                      <option value="ancient">古风水墨</option>
                      <option value="cyber">赛博朋克</option>
                      <option value="anime">动漫风</option>
                      <option value="3d">3D 渲染</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowUpload(false)}
                  className="btn-ghost flex-1"
                  disabled={uploading}
                >
                  取消
                </button>
                <button
                  onClick={handleUpload}
                  className="btn-primary flex-1"
                  disabled={!uploadFile || uploading}
                >
                  {uploading ? '上传中...' : '上传'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
