// apps/web/src/pages/BillingPage.tsx
// v3.0.32 (S71 BUG-078): 账单明细 - 充值 + 消费 + 免费 完整记录
// 后端: GET /api/billing/transactions (auth) + GET /api/billing/summary
// 旧版 v3.0.1 (S56) 只查充值记录 /recharge/my, 缺消费 + 免费 → BUG-078

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getBillingTransactionsApi,
  getBillingSummaryApi,
  getRechargeHistoryApi,
} from '../lib/api';
import {
  ArrowLeft,
  Receipt,
  Loader,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Gift,
  BookOpen,
  Layers,
  ImageIcon,
  VideoIcon,
  UserCircle,
  Wand2,
  Sparkles,
} from 'lucide-react';

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

interface BillingTransaction {
  id: string;
  userId: string;
  type: 'charge' | 'consumption' | 'refund';
  amount: number;
  balanceAfter: number;
  novelId?: string;
  description: string;
  wordCount: number;
  isFree: number;        // 0/1
  refType: string;       // novel_analyze / episode / shot / comic / character_variant / image / video / prompt_optimize / recharge / refund
  refId: string;
  refLabel: string;      // 人类可读 "小说分析《XXX》" / "分镜 #5"
  createdAt: number;
}

interface BillingSummary {
  totalCharge: number;
  totalConsumption: number;
  totalFree: number;
  balance: number;
  todayConsumption: number;
  todayFree: number;
}

// refType → icon + 标签 (web 端"账单明细"页核心)
const REF_TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
  novel_analyze:       { icon: BookOpen,    label: '小说分析', color: 'text-blue-500' },
  episode:             { icon: Layers,      label: '剧本生成', color: 'text-indigo-500' },
  shot:                { icon: Wand2,       label: '分镜分析', color: 'text-purple-500' },
  comic:               { icon: Sparkles,    label: '漫画生成', color: 'text-pink-500' },
  character_variant:   { icon: UserCircle,  label: '角色三视图', color: 'text-orange-500' },
  image:               { icon: ImageIcon,   label: '图片生成', color: 'text-emerald-500' },
  video:               { icon: VideoIcon,   label: '视频生成', color: 'text-rose-500' },
  prompt_optimize:     { icon: Wand2,       label: 'Prompt 优化', color: 'text-cyan-500' },
  recharge:            { icon: TrendingUp,  label: '充值',      color: 'text-green-600' },
  refund:              { icon: TrendingDown,label: '退款',      color: 'text-red-500' },
};

export function BillingPage() {
  const [recharges, setRecharges] = useState<RechargeRecord[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<'all' | 'consumption' | 'recharge'>('all');

  useEffect(() => {
    (async () => {
      try {
        // 并行拉 3 个数据源
        const [rcRes, txRes, sumRes] = await Promise.all([
          getRechargeHistoryApi(),
          getBillingTransactionsApi({ limit: 100 }),
          getBillingSummaryApi(),
        ]);
        const txItems = txRes.data?.data?.items || [];
        // v3.0.32 (BUG-080 S71 后置): 验证 API 返回的 items 必带 type 字段 (前端 tab filter 依赖)
        // 之前没 assert, 漏 type 时 filter 全空也 silent fail, 修了没 assert 也会重蹈
        if (txItems.length > 0 && typeof txItems[0]?.type !== 'string') {
          console.error('[BillingPage] /api/billing/transactions items 缺 type 字段, 消费/充值 tab filter 会全空 (BUG-080)');
        }
        setRecharges(rcRes.data?.data?.records || []);
        setTransactions(txItems);
        setSummary(sumRes.data?.data || null);
      } catch (e: any) {
        setErr(e?.response?.data?.error?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 合并充值 + 交易 (统一按 createdAt 倒序)
  const mergedRecords = useMemo(() => {
    const all: Array<RechargeRecord & { kind: 'recharge_pending' | 'billing_tx' }> = [];
    // 充值记录 (status=pending/approved/rejected, 走旧 recharge table)
    recharges.forEach((r) => {
      all.push({ ...r, kind: 'recharge_pending' });
    });
    // 交易记录 (billing_logs)
    // v3.0.32 (BUG-080 S71 后置): 必须 push t.type 字段, 否则 L137 'consumption' / L138 'recharge' tab filter
    // 里 (r as any).type 永远是 undefined, 消费记录 tab 会全空 (用户反馈)
    // 修法: spread 整个 t (含 type/refType/refLabel/balanceAfter/wordCount/isFree/novelId/description),
    // 同时保留上层 status 字段 (RechargeRecord 类型要求 status, 旧逻辑用 'approved'/'settled' 占位)
    transactions.forEach((t) => {
      all.push({
        ...t,
        status: t.type === 'charge' ? 'approved' : 'settled',
        ip: '',
        kind: 'billing_tx',
      } as any);
    });
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }, [recharges, transactions]);

  // 按 tab 筛选
  const filteredRecords = useMemo(() => {
    if (tab === 'all') return mergedRecords;
    if (tab === 'consumption') return mergedRecords.filter((r) => (r as any).kind === 'billing_tx' && (r as any).type === 'consumption');
    if (tab === 'recharge') return mergedRecords.filter((r) =>
      (r as any).kind === 'recharge_pending' || ((r as any).kind === 'billing_tx' && (r as any).type === 'charge')
    );
    return mergedRecords;
  }, [mergedRecords, tab]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-12">
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

      {/* 顶部 Summary (4 卡) */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass p-4 rounded-xl border border-border">
            <p className="text-xs text-text-tertiary mb-1">当前余额</p>
            <p className="text-2xl font-bold text-text-primary">¥{summary.balance.toFixed(2)}</p>
          </div>
          <div className="glass p-4 rounded-xl border border-border">
            <p className="text-xs text-text-tertiary mb-1">累计充值</p>
            <p className="text-2xl font-bold text-success flex items-center gap-1">
              <TrendingUp size={16} />
              ¥{summary.totalCharge.toFixed(2)}
            </p>
          </div>
          <div className="glass p-4 rounded-xl border border-border">
            <p className="text-xs text-text-tertiary mb-1">累计消费</p>
            <p className="text-2xl font-bold text-text-primary flex items-center gap-1">
              <TrendingDown size={16} />
              ¥{summary.totalConsumption.toFixed(2)}
            </p>
          </div>
          <div className="glass p-4 rounded-xl border border-border">
            <p className="text-xs text-text-tertiary mb-1">免费生成</p>
            <p className="text-2xl font-bold text-warning flex items-center gap-1">
              <Gift size={16} />
              {summary.totalFree} 次
            </p>
          </div>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'all' ? 'text-primary border-b-2 border-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          全部
        </button>
        <button
          onClick={() => setTab('consumption')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'consumption' ? 'text-primary border-b-2 border-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          消费记录
        </button>
        <button
          onClick={() => setTab('recharge')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'recharge' ? 'text-primary border-b-2 border-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          充值记录
        </button>
      </div>

      {loading ? (
        <div className="glass p-8 rounded-2xl text-center text-text-tertiary">
          <Loader size={24} className="animate-spin mx-auto mb-2" />
          加载中...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="glass p-12 rounded-2xl text-center">
          <Receipt size={48} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary">
            {tab === 'consumption' ? '暂无消费记录' : tab === 'recharge' ? '暂无充值记录' : '暂无账单记录'}
          </p>
          <Link to="/recharge" className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm">
            去充值
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((rec) => {
            const kind = (rec as any).kind as 'recharge_pending' | 'billing_tx';
            if (kind === 'recharge_pending') {
              // 旧版充值记录 (待审核/已到账/已拒绝)
              const status = (rec as any).status as string;
              const meta = STATUS_META[status] || STATUS_META.pending;
              const Icon = meta.icon;
              return (
                <div key={rec.id} className="glass p-4 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-success" />
                        <p className="text-lg font-semibold text-text-primary">+¥{rec.amount.toFixed(2)}</p>
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
                    <p className="text-xs text-text-tertiary font-mono">充值申请</p>
                  </div>
                </div>
              );
            }
            // billing_logs 交易 (充值完成 / 消费 / 免费)
            const tx = transactions.find((t) => t.id === rec.id)!;
            return <TransactionRow key={rec.id} tx={tx} />;
          })}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ tx }: { tx: BillingTransaction }) {
  const isCharge = tx.type === 'charge';
  const isRefund = tx.type === 'refund';
  const isFree = tx.isFree === 1;
  const meta = REF_TYPE_META[tx.refType] || { icon: Receipt, label: tx.refType, color: 'text-text-tertiary' };
  const Icon = meta.icon;

  // 符号: 充值 +, 退款 -, 消费 -
  const sign = isCharge ? '+' : '-';
  const amountColor = isCharge ? 'text-success' : isFree ? 'text-text-secondary' : 'text-text-primary';

  return (
    <div className="glass p-4 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={14} className={meta.color} />
            <p className={`text-lg font-semibold ${amountColor}`}>
              {sign}¥{tx.amount.toFixed(2)}
            </p>
            {isFree && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium text-warning bg-warning/10 flex items-center gap-1">
                <Gift size={12} /> 免费
              </span>
            )}
            {!isCharge && !isRefund && !isFree && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium text-text-secondary bg-bg-secondary">
                消费
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium bg-bg-secondary ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          {tx.refLabel && (
            <p className="text-sm text-text-secondary mt-1">{tx.refLabel}</p>
          )}
          {tx.description && tx.description !== tx.refLabel && (
            <p className="text-xs text-text-tertiary mt-0.5">{tx.description}</p>
          )}
          <p className="text-xs text-text-tertiary mt-1">
            {new Date(tx.createdAt).toLocaleString('zh-CN')}
            <span className="ml-2">余额: ¥{tx.balanceAfter.toFixed(2)}</span>
          </p>
        </div>
        <p className="text-xs text-text-tertiary font-mono">{tx.id.slice(0, 8)}</p>
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: '待审核', color: 'text-warning bg-warning/10', icon: Clock },
  approved: { label: '已到账', color: 'text-success bg-success/10', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'text-error bg-error/10', icon: XCircle },
};