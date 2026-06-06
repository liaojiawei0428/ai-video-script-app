import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listAssetsApi } from '../lib/api';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';

interface Asset { id: string; name: string; gender?: string; imageVariants: { imageData?: string }[]; }

export function AssetLibraryPage() {
  const { id } = useParams<{ id: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    listAssetsApi(id).then(r => setAssets(r.data?.data?.characters || r.data?.data?.assets || [])).finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <Link to={`/novels/${id}`} className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm">
        <ArrowLeft size={16} /> 返回
      </Link>
      <h1 className="text-2xl font-bold mb-6">资产库 ({assets.length})</h1>
      {loading ? (
        <div className="text-center py-20 text-text-tertiary">加载中...</div>
      ) : assets.length === 0 ? (
        <div className="glass p-10 text-center text-text-tertiary">
          <ImageIcon size={48} className="mx-auto mb-3" /> 暂无资产, 请在 App 中完成角色描述确认
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map(a => (
            <div key={a.id} className="glass p-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(a.imageVariants || []).slice(0, 3).map((v, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-bg-tertiary">
                    {v.imageData ? (
                      <img src={v.imageData.startsWith('data:') ? v.imageData : `data:image/svg+xml;base64,${v.imageData}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon size={20} className="text-text-tertiary" /></div>
                    )}
                  </div>
                ))}
              </div>
              <h3 className="font-semibold">{a.name}</h3>
              <p className="text-xs text-text-tertiary">{a.gender || '?'} · {a.imageVariants?.length || 0} 张变体</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
