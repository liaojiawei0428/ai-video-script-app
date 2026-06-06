import { useState, useEffect } from 'react';
import { createRechargeApi } from '../lib/api';
import { Wallet, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/auth';

const PRESETS = [10, 30, 50, 100, 200, 500];

export function RechargePage() {
  const { user, fetchBalance } = useAuthStore();
  const balance = user?.balance ?? 0;
  const [amount, setAmount] = useState(30);
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const submit = async () => {
    setLoading(true);
    setQrCodeUrl('');
    setMessage('');
    try {
      const r: any = await createRechargeApi(amount);
      const data = r.data?.data;
      const url = data?.qrCodeUrl || data?.payUrl || data?.url;
      if (url) {
        setQrCodeUrl(url);
        setOrderId(data?.id || '');
        setMessage(data?.message || '');
      } else {
        alert('支付链接生成失败');
      }
    } catch (e: any) { alert(e?.response?.data?.error?.message || '提交失败'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">账户充值</h1>

      <div className="glass p-6 mb-6">
        <div className="text-text-tertiary text-sm">当前余额</div>
        <div className="text-4xl font-bold gradient-text mt-1">¥{balance.toFixed(2)}</div>
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
          <p className="text-sm text-text-secondary mb-4">{message}</p>
          <div className="flex justify-center mb-4">
            <img src={qrCodeUrl} alt="支付宝收款码" className="w-64 h-64 rounded-xl border border-border" />
          </div>
          <div className="text-center text-sm text-text-tertiary">
            订单号: <span className="font-mono text-xs">{orderId}</span>
          </div>
          <div className="mt-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
            <p className="text-sm text-accent flex items-center gap-2">
              <CheckCircle size={16} />
              支付完成后，管理员审核通过即到账
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
