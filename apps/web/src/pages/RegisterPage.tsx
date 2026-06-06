import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Sparkles } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
      <div className="w-full max-w-md p-8 glass">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles size={28} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center gradient-text mb-6">注册账号</h1>

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
          已有账号? <Link to="/login" className="text-primary hover:text-accent">立即登录</Link>
        </div>
      </div>
    </div>
  );
}
