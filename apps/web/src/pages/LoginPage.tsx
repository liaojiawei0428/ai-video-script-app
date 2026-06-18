import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginApi } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Sparkles, Smartphone, Download, ChevronRight } from 'lucide-react';

export function LoginPage() {
  const nav = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      // trim 去除首尾空格，避免 bcrypt 校验失败
      const trimmedUsername = username.trim();
      const trimmedPassword = password.trim();
      if (!trimmedUsername || !trimmedPassword) {
        setErr('用户名和密码不能为空');
        setLoading(false);
        return;
      }
      const r = await loginApi(trimmedUsername, trimmedPassword);
      const data = r.data?.data;
      setAuth(data.user, data.token);
      nav('/');
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || '登录失败');
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
        <h1 className="text-2xl font-bold text-center gradient-text mb-2">Deep剧本</h1>
        <p className="text-center text-text-tertiary text-sm mb-6">登录开�?AI 视频剧本创作</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">用户名</label>
            <input type="text" className="input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">密码</label>
            <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <div className="text-error text-sm bg-error/10 px-3 py-2 rounded-lg">{err}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-text-tertiary">
          还没有账�? <Link to="/register" className="text-primary hover:text-accent">立即注册</Link>
        </div>
      </div>

      {/* v3.0.0 (S58 P1): 下载 APP 入口 - 登录页就放, 不用先登录也能下载 */}
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
            v3.0.0 · 29.8 MB · Android 5.0+ · 直接浏览器扫码下载
          </div>
        </div>
        <ChevronRight size={18} className="text-text-tertiary group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </a>
    </div>
  );
}
