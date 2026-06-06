import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader } from 'lucide-react';
import { adminLoginApi } from '../lib/api';

export function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      const r = await adminLoginApi(username, password);
      const { token, user } = r.data?.data || {};
      if (token && user?.role === 'admin') {
        localStorage.setItem('admin_token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));
        nav('/admin');
      } else {
        setError('登录失败：非管理员账号');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <form onSubmit={handleLogin} className="glass p-8 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-error to-warning flex items-center justify-center">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">管理员登录</h1>
            <p className="text-xs text-text-tertiary">Deep剧本 后台管理系统</p>
          </div>
        </div>
        {error && <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm">{error}</div>}
        <div className="space-y-3">
          <input
            value={username} onChange={e => setUsername(e.target.value)}
            placeholder="管理员账号"
            className="input"
            autoFocus
          />
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder="密码"
            className="input"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Loader size={16} className="animate-spin" /> : <Shield size={16} />}
            {loading ? '登录中...' : '登录后台'}
          </button>
        </div>
      </form>
    </div>
  );
}
