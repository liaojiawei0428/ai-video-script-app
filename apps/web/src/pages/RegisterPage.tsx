import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Sparkles, Smartphone, Download, ChevronRight } from 'lucide-react';

export function RegisterPage() {
  const nav = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (username.length < 2) return setErr('用户名至少 2 个字符');
    if (password.length < 6) return setErr('密码至少 6 位');
    if (password !== confirm) return setErr('两次密码不一致');
    setLoading(true);
    try {
      const r = await registerApi(username, password);
      const data = r.data?.data;
      setAuth(data.user, data.token);
      nav('/');
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || '注册失败');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-8 bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="w-full max-w-md p-8 glass">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center gradient-text mb-6">注册新用户</h1>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">用户名 (2-50 字符)</label>
            <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required minLength={2} maxLength={50} />
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">密码 (至少 6 位)</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">确认密码</label>
            <input type="password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} />
          </div>
          {err && <div className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg">{err}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-text-tertiary">
          已有用户？<Link to="/login" className="text-primary hover:text-accent">立即登录</Link>
        </div>
      </div>

      {/* v3.0.0 (S58 P1): 下载 APP 入口 - 注册页同样入口, 注册前后都能下载 */}
      <a
        href="/download"
        className="w-full max-w-md glass rounded-2xl border border-primary/30 hover:border-primary/60 hover:bg-primary/5 p-4 flex items-center gap-3 transition-all group block"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
          <Smartphone size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
            <Download size={13} className="text-primary" />
            下载 Deep剧本 APP
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">
            v3.0.0 · 29.8 MB · Android 5.0+ · 浏览器扫码安装
          </div>
        </div>
        <ChevronRight size={18} className="text-text-tertiary group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </a>
    </div>
  );
}
