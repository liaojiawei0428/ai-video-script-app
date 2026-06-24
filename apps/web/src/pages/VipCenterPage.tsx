// apps/web/src/pages/VipCenterPage.tsx
// v3.0.0.32 (S52): VIP 中心 (跟 Mobile HomeScreen.tsx:360-380 1:1 一致)
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { buyVipApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Crown, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export function VipCenterPage() {
  const { user, fetchBalance } = useAuthStore();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const isVip = (user as any)?.vipLevel >= 1;
  const vipExpiresAt = (user as any)?.vipExpiresAt as number | undefined;

  const handleBuyVip = async () => {
    if (!confirm('开通 VIP 会员\n¥10 尊享 1 年 VIP 会员\n享受生图无限 + 视频 5+10s 免费 + 漫画/分镜/小说 8 折优惠')) return;
    setLoading(true);
    setMsg(null);
    try {
      const r: any = await buyVipApi();
      if (r.data?.success) {
        const d = r.data.data;
        setMsg({ type: 'success', text: `开通成功！VIP 会员已激活（有效期 1 年），余额 ¥${d.balance.toFixed(2)}` });
        await fetchBalance();
      } else {
        const errCode = r.data?.error?.code;
        if (errCode === 'INSUFFICIENT') {
          setMsg({ type: 'error', text: r.data.error.message + ' 请先充值' });
          setTimeout(() => nav('/recharge'), 2000);
        } else {
          setMsg({ type: 'error', text: r.data?.error?.message || '开通失败' });
        }
      }
    } catch (e: any) {
      const errCode = e?.response?.data?.error?.code;
      if (errCode === 'INSUFFICIENT') {
        setMsg({ type: 'error', text: e.response.data.error.message + ' 请先充值' });
        setTimeout(() => nav('/recharge'), 2000);
      } else {
        setMsg({ type: 'error', text: e?.response?.data?.error?.message || e?.message || '操作失败' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Crown size={24} className="text-warning" />
        VIP 会员中心
      </h1>
      <p className="text-sm text-text-tertiary mb-6">解锁全部功能，享优惠费率</p>

      {/* 当前状态卡 (跟 Mobile HomeScreen.tsx:360 一致) */}
      <div className="glass p-6 mb-6">
        {isVip ? (
          <div className="flex items-center gap-4">
            <Crown size={40} className="text-warning" />
            <div className="flex-1">
              <div className="text-lg font-semibold text-warning mb-1">VIP 会员已激活</div>
              <div className="text-sm text-text-secondary">
                ¥0.01/千字 · ¥0.04/集分镜 · 视频 5+10s 免费
                {vipExpiresAt && (
                  <div className="text-xs text-text-tertiary mt-1">
                    到期时间: {new Date(vipExpiresAt).toLocaleDateString('zh-CN')}
                  </div>
                )}
              </div>
            </div>
            <span className="px-3 py-1 rounded-md bg-success/15 text-success text-xs font-semibold">已激活</span>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Crown size={40} className="text-text-tertiary" />
            <div className="flex-1">
              <div className="text-lg font-semibold mb-1">开通 VIP 会员</div>
              <div className="text-sm text-text-secondary">¥10/年 · 享 8 折优惠费率</div>
            </div>
            <button
              onClick={handleBuyVip}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-warning text-white text-sm font-semibold hover:bg-warning/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />}
              立即开通
            </button>
          </div>
        )}
      </div>

      {/* 消息提示 */}
      {msg && (
        <div className={`glass p-4 mb-6 flex items-center gap-2 ${msg.type === 'success' ? 'border-success/30' : 'border-error/30'}`}>
          {msg.type === 'success' ? (
            <CheckCircle size={18} className="text-success" />
          ) : (
            <AlertCircle size={18} className="text-error" />
          )}
          <span className={`text-sm ${msg.type === 'success' ? 'text-success' : 'text-error'}`}>{msg.text}</span>
        </div>
      )}

      {/* 套餐详情 (跟 Mobile 一致) */}
      <div className="glass p-6 mb-6">
        <h2 className="font-semibold mb-4">VIP 会员特权</h2>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong>生图无限</strong>：取消每日 30 张限额</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong>视频 5s + 10s 免费</strong>（普通用户 5s 免费，10s/15s 各收 0.1 元）</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong>小说分析 ¥0.01/千字</strong>（普通用户 ¥0.012/千字）</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong>分镜生成 ¥0.04/集</strong>（普通用户 ¥0.05/集）</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong>漫画生成 ¥0.08/页</strong>（普通用户 ¥0.10/页）</span>
          </li>
        </ul>
      </div>

      {/* 价格 (跟 Mobile 一致) */}
      <div className="glass p-6">
        <div className="text-center">
          <div className="text-sm text-text-tertiary mb-2">VIP 会员价格</div>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl text-text-tertiary line-through">¥{isVip ? 10 : 0}</span>
            <span className="text-5xl font-bold gradient-text">¥10</span>
            <span className="text-text-secondary">/年</span>
          </div>
          <p className="text-xs text-text-tertiary mt-2">从余额扣除，1 年有效</p>
          {!isVip && (
            <button
              onClick={handleBuyVip}
              disabled={loading}
              className="btn-primary w-full text-lg py-3 mt-6 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
              {loading ? '处理中...' : '立即开通 VIP 会员'}
            </button>
          )}
          <p className="text-xs text-text-tertiary mt-3">
            需要先 <Link to="/recharge" className="text-primary hover:underline">充值</Link>，确保余额 ≥ ¥10
          </p>
        </div>
      </div>
    </div>
  );
}
