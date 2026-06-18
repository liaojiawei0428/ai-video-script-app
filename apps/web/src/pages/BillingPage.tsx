// apps/web/src/pages/BillingPage.tsx
// v3.0.1 (S56): 账单明细 - 充值/消费记录
// 后端: GET /recharge/my (auth middleware)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRechargeHistoryApi } from '../lib/api';
import { ArrowLeft, Receipt, Loader, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface RechargeRecord {
  id: string;
  amount: number;
  status: string;
  ip: string;
  ipLocation?: string;
  createdAt: number;
  reviewedAt?: number;
  rejectReason?: string;
}

export function BillingPage() {
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await getRechargeHistoryApi();
        setRecords(r.data?.data?.records || []);
      } catch (e: any) {
        setErr(e?.response?.data?.error?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
    pending:  { label: '待审核', color: 'text-warning bg-warning/10', icon: Clock },
    approved: { label: '已到账', color: 'text-success bg-success/10', icon: CheckCircle },
    rejected: { label: '已拒绝', color: 'text-error bg-error/10', icon: XCircle },
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* 顶部返回 */}
      <div className="flex items-center gap-3">
        <Link to="/profile" className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <Receipt size={18} />
          账单明细
        </h1>
      </div>

      {err && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
          <AlertCircle size={14} /> {err}
        </div>
      )}

      {loading ? (
        <div className="glass p-8 rounded-2xl text-center text-text-tertiary">
          <Loader size={24} className="animate-spin mx-auto mb-2" />
          加载中...
        </div>
      ) : records.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center">
          <Receipt size={48} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary">暂无账单记录</p>
          <Link to="/recharge" className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
            去充值
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => {
            const meta = STATUS_META[rec.status] || STATUS_META.pending;
            const Icon = meta.icon;
            return (
              <div key={rec.id} className="glass p-4 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-text-primary">¥{rec.amount.toFixed(2)}</p>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${meta.color} flex items-center gap-1`}>
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">
                      {new Date(rec.createdAt).toLocaleString('zh-CN')}
                    </p>
                    {rec.ipLocation && (
                      <p className="text-xs text-text-tertiary mt-0.5">📍 {rec.ipLocation}</p>
                    )}
                    {rec.rejectReason && (
                      <p className="text-xs text-error mt-1">原因: {rec.rejectReason}</p>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary font-mono">{rec.id.slice(0, 8)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
