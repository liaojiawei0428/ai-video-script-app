// apps/web/src/pages/PricingPage.tsx
// v3.0.1 (S56): 收费标准透明页 (C 方案要求)
// 后端: GET /api/pricing (公开, 不需 auth)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPricingApi } from '../lib/api';
import { ArrowLeft, Tag, Loader, AlertCircle, Video, Image as ImageIcon, Crown } from 'lucide-react';

interface PricingData {
  video: {
    standard: Record<string, number>;
    vip: Record<string, number>;
    allowedDurations: number[];
  };
  image: {
    standard: { t2i: { amount: number; daily: number }; i2i: { amount: number; daily: number }; multiRef: { amount: number; daily: number } };
    vip: { t2i: { amount: number; daily: number | string }; i2i: { amount: number; daily: number | string }; multiRef: { amount: number; daily: number | string } };
  };
  refundPolicy: string;
  version: string;
  updatedAt: string;
}

function formatAmount(n: number): string {
  if (n === 0) return '免费';
  return `¥${n.toFixed(2)}`;
}

function formatDaily(d: number | string): string {
  if (d === 'unlimited') return '无限';
  return `${d} 张/天`;
}

export function PricingPage() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getPricingApi();
        setData(r.data?.data);
      } catch (e: any) {
        setErr(e?.response?.data?.error?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* 顶部返回 */}
      <div className="flex items-center gap-3">
        <Link to="/profile" className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <Tag size={18} />
          收费标准
        </h1>
      </div>

      {err && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {loading || !data ? (
        <div className="glass p-8 rounded-2xl text-center text-text-tertiary">
          <Loader size={24} className="animate-spin mx-auto mb-2" />
          加载中...
        </div>
      ) : (
        <>
          {/* 视频计费 */}
          <div className="glass p-5 rounded-2xl border border-border">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
              <Video size={18} className="text-primary" />
              视频生成
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-tertiary text-xs">
                    <th className="text-left py-2 px-2">时长</th>
                    <th className="text-center py-2 px-2">普通用户</th>
                    <th className="text-center py-2 px-2">
                      <Crown size={12} className="inline text-warning" /> VIP
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.video.allowedDurations.map((dur) => (
                    <tr key={dur} className="border-t border-border">
                      <td className="py-2.5 px-2 text-text-primary font-medium">{dur} 秒</td>
                      <td className="py-2.5 px-2 text-center">
                        {formatAmount(data.video.standard[dur] ?? 0)}
                      </td>
                      <td className="py-2.5 px-2 text-center text-warning">
                        {formatAmount(data.video.vip[dur] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              💡 时长仅支持 {data.video.allowedDurations.join(' / ')} 秒, 其他时长按最接近的计费
            </p>
          </div>

          {/* 图片计费 */}
          <div className="glass p-5 rounded-2xl border border-border">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-4">
              <ImageIcon size={18} className="text-accent" />
              图片生成
            </h2>
            <div className="space-y-3">
              {([
                { key: 't2i', label: '文生图' },
                { key: 'i2i', label: '图生图' },
                { key: 'multiRef', label: '多参考图' },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-text-primary">{label}</span>
                  <div className="text-right text-sm">
                    <p>
                      <span className="text-text-tertiary">普通: </span>
                      <span className="font-medium">{formatAmount(data.image.standard[key].amount)}</span>
                      <span className="text-xs text-text-tertiary ml-1">({formatDaily(data.image.standard[key].daily)})</span>
                    </p>
                    <p>
                      <span className="text-text-tertiary">VIP: </span>
                      <span className="font-medium text-warning">{formatAmount(data.image.vip[key].amount)}</span>
                      <span className="text-xs text-text-tertiary ml-1">({formatDaily(data.image.vip[key].daily)})</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-tertiary mt-3">
              💡 图片生成目前免费, 走每日限额; VIP 用户每日无限
            </p>
          </div>

          {/* VIP 优势 */}
          <div className="glass p-5 rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/5 to-primary/5">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2 mb-3">
              <Crown size={18} className="text-warning" />
              VIP 专享
            </h2>
            <ul className="text-sm text-text-secondary space-y-1.5">
              <li>• 视频 10 秒免费 (普通 ¥0.10)</li>
              <li>• 图片生成每日无限张</li>
              <li>• 优先审核 / 优先客服</li>
              <li className="pt-2 text-xs">
                <Link to="/vip" className="text-primary hover:underline">立即开通 VIP →</Link>
              </li>
            </ul>
          </div>

          {/* 退款政策 */}
          <div className="glass p-4 rounded-2xl border border-border">
            <h3 className="text-sm font-semibold text-text-primary mb-2">退款政策</h3>
            <p className="text-sm text-text-secondary">{data.refundPolicy}</p>
          </div>

          {/* 版本/更新时间 */}
          <p className="text-center text-xs text-text-tertiary">
            定价版本 v{data.version} · 更新于 {new Date(data.updatedAt).toLocaleString('zh-CN')}
          </p>
        </>
      )}
    </div>
  );
}
