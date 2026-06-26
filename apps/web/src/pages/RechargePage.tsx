import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createRechargeApi, notifyRechargePaidApi, getRechargeHistoryApi } from '../lib/api';
import { Wallet, CheckCircle, AlertCircle, Crown, Loader } from 'lucide-react';
import { useAuthStore } from '../store/auth';

const PRESETS = [10, 30, 50, 100, 200, 500];

export function RechargePage() {
  const { user, fetchBalance } = useAuthStore();
  const balance = user?.balance ?? 0;
  const [amount, setAmount] = useState(30);
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState<'pending' | 'user_notified' | 'approved' | 'rejected' | ''>('');
  const [orderMessage, setOrderMessage] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifiedAt, setNotifiedAt] = useState<number>(0);

  // v3.0.37 (S72 batch 7 BUG-092): 订单状态 4 态文案 (修 BUG-092, 跟状态机 1:1 对齐)
  const STAGE_TEXT: Record<string, string> = { pending: '待支付', user_notified: '待审核', approved: '已通过', rejected: '已拒绝' };
  type OrderStage = 'pending' | 'user_notified' | 'approved' | 'rejected' | '';
  const ORDER_STAGES: OrderStage[] = ['pending', 'user_notified', 'approved', 'rejected'];

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // v3.0.37 (S72 batch 7 BUG-092): 轮询订单状态 (跟 BUG-089 教训一致: polling 完成 alert 关闭后 setTimeout)
  // 触发条件: 已扫码 (qrCodeUrl 非空) + status='user_notified' (用户已点"我已付款") — 等待 admin approve
  useEffect(() => {
    if (!orderId || orderStatus !== 'user_notified') return;
    const timer = setInterval(async () => {
      try {
        const r: any = await getRechargeHistoryApi();
        const records = r.data?.data?.records || [];
        const cur = records.find((x: any) => x.id === orderId);
        if (cur && cur.status !== orderStatus) {
          // v3.0.37 (S72 batch 7 BUG-092): type guard 收紧, server 返未知 status 时不 set (防 S54 BUG-073 同款 cast 警告)
          if (ORDER_STAGES.includes(cur.status as OrderStage)) {
            setOrderStatus(cur.status as OrderStage);
          }
          if (cur.status === 'approved') {
            fetchBalance();
            setOrderMessage(`✅ 充值已到账! 您的余额: ¥${cur.amount}`);
          } else if (cur.status === 'rejected') {
            setOrderMessage('❌ 充值被拒绝, 请联系客服');
          }
        }
      } catch (e) { /* 静默, 跟 BUG-089 refreshHistory 教训一致 */ }
    }, 5000);
    return () => clearInterval(timer);
  }, [orderId, orderStatus, fetchBalance]);

  const submit = async () => {
    setLoading(true);
    setQrCodeUrl('');
    setOrderMessage('');
    setOrderStatus('');
    setNotifiedAt(0);
    try {
      const r: any = await createRechargeApi(amount);
      const data = r.data?.data;
      const url = data?.qrCodeUrl || data?.payUrl || data?.url;
      if (url) {
        setQrCodeUrl(url);
        setOrderId(data?.id || '');
        setOrderStatus('pending');
        setOrderMessage(data?.message || '请扫码支付');
      } else {
        alert('支付链接生成失败');
      }
    } catch (e: any) { alert(e?.response?.data?.error?.message || '提交失败'); }
    finally { setLoading(false); }
  };

  // v3.0.37 (S72 batch 7 BUG-092): 用户点"我已付款" — 调 POST /api/recharge/:id/notify-paid
  // 配套: 1) authMiddleware 鉴权 2) 验证订单属于该 user (越权保护) 3) 验证 status='pending'
  // 4) 标记 user_notified_at 5) 上层 effect 轮询 status → approved 后 setOrderMessage + fetchBalance
  const handleNotifyPaid = async () => {
    if (!orderId) return;
    setNotifyLoading(true);
    try {
      const r: any = await notifyRechargePaidApi(orderId);
      setOrderStatus('user_notified');
      setNotifiedAt(Date.now());
      setOrderMessage(r.data?.message || '已通知管理员, 请耐心等待审核 (通常 5 分钟内到账)');
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '通知失败, 请稍后重试');
    } finally {
      setNotifyLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">账户充值</h1>

      <div className="glass p-6 mb-6">
        <div className="text-text-tertiary text-sm">当前余额</div>
        <div className="text-4xl font-bold gradient-text mt-1">¥{balance.toFixed(2)}</div>
      </div>

      {/* v3.0.0.32 (S52): VIP 会员入口 (跟 Mobile HomeScreen.tsx:360-380 1:1 一致) */}
      <div className="glass p-6 mb-6">
        {user && (user as any).vipLevel >= 1 ? (
          <div className="flex items-center gap-4">
            <Crown size={32} className="text-warning flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold text-warning">VIP 会员</div>
              <div className="text-xs text-text-tertiary mt-1">
                ¥0.01/千字 · ¥0.04/集分镜
                {(user as any).vipExpiresAt && (
                  <span> · 到期: {new Date((user as any).vipExpiresAt).toLocaleDateString('zh-CN')}</span>
                )}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-semibold">已激活</span>
            <Link to="/vip" className="text-xs text-text-tertiary hover:text-text-primary underline">详情</Link>
          </div>
        ) : (
          <Link to="/vip" className="flex items-center gap-4 hover:bg-bg-tertiary/30 transition-colors -m-2 p-2 rounded-lg">
            <Crown size={32} className="text-warning flex-shrink-0" />
            <div className="flex-1">
              <div className="font-semibold">开通 VIP 会员</div>
              <div className="text-xs text-text-tertiary mt-1">¥10/年 · 享 8 折优惠费率</div>
            </div>
            <span className="px-3 py-1 rounded-md bg-warning/15 text-warning text-sm font-semibold">开通 ›</span>
          </Link>
        )}
      </div>

      <div className="glass p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Wallet size={18} /> 选择充值金额</h2>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {PRESETS.map(p => (
            <button
              key={p}
              className={`p-4 rounded-xl border-2 transition-colors ${
                amount === p ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
              }`}
              onClick={() => setAmount(p)}
            >
              <div className="text-2xl font-bold">¥{p}</div>
            </button>
          ))}
        </div>
        <button className="btn-primary w-full text-lg py-3" onClick={submit} disabled={loading}>
          {loading ? '提交中...' : `充值 ¥${amount}`}
        </button>
      </div>

      {qrCodeUrl && (
        <div className="glass p-6 mt-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-accent" /> 扫码支付
          </h2>
          <p className="text-sm text-text-secondary mb-4">{orderMessage}</p>
          <div className="flex justify-center mb-4">
            <img src={qrCodeUrl} alt="支付宝收款码" className="w-64 h-64 rounded-xl border border-border" />
          </div>
          <div className="text-center text-sm text-text-tertiary mb-4">
            订单号: <span className="font-mono text-xs">{orderId}</span>
            <span className="ml-3 inline-block px-2 py-0.5 rounded text-xs bg-bg-tertiary">
              {STAGE_TEXT[orderStatus] || '待支付'}
            </span>
          </div>

          {/* v3.0.37 (S72 batch 7 BUG-092): "我已付款" 按钮 — 修 BUG-092 (之前扫码支付页面没这个按钮) */}
          {orderStatus === 'pending' && (
            <button
              className="btn-primary w-full text-base py-3 mb-3 flex items-center justify-center gap-2"
              onClick={handleNotifyPaid}
              disabled={notifyLoading}
            >
              {notifyLoading ? <><Loader size={16} className="animate-spin" /> 提交中...</> : <><CheckCircle size={16} /> 我已付款</>}
            </button>
          )}
          {orderStatus === 'user_notified' && (
            <div className="mb-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <p className="text-sm text-warning flex items-center gap-2">
                <Loader size={16} className="animate-spin" />
                已通知管理员, 正在审核中... 请耐心等待 (通常 5 分钟内到账)
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                重复充值请先联系客服 (微信/QQ), 避免重复到账
              </p>
            </div>
          )}
          {orderStatus === 'approved' && (
            <div className="mb-3 p-3 bg-success/10 border border-success/30 rounded-lg">
              <p className="text-sm text-success flex items-center gap-2">
                <CheckCircle size={16} /> 充值已到账! 余额已更新
              </p>
            </div>
          )}
          {orderStatus === 'rejected' && (
            <div className="mb-3 p-3 bg-error/10 border border-error/30 rounded-lg">
              <p className="text-sm text-error flex items-center gap-2">
                <AlertCircle size={16} /> 充值被拒绝, 请联系客服
              </p>
            </div>
          )}

          <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
            <p className="text-sm text-accent flex items-center gap-2">
              <CheckCircle size={16} />
              支付完成后，请点击"我已付款"按钮提交审核 (管理员审核通过即到账)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
