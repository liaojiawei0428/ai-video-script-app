// apps/web/src/pages/AccountPage.tsx
// v2.5.34: 账号设置页面 - 修改密码
// 后端: PUT /api/users/password (auth 中间件)
// 流程: 验证旧密码 → bcrypt 校验 → 写新 hash → 返回成功

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Lock, Save, Loader, AlertCircle, CheckCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function AccountPage() {
  const nav = useNavigate();
  const user = useAuthStore(s => s.user);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 显示/隐藏密码
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');

  // 密码强度 (1-4)
  const strength = (pwd: string): { level: 0 | 1 | 2 | 3 | 4; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: 'bg-bg-secondary' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: '弱', color: 'bg-red-500' };
    if (score === 2) return { level: 2, label: '中等', color: 'bg-yellow-500' };
    if (score === 3) return { level: 3, label: '强', color: 'bg-blue-500' };
    return { level: 4, label: '很强', color: 'bg-green-500' };
  };
  const newPwdStrength = strength(newPassword);

  const validate = (): string | null => {
    if (!oldPassword) return '请输入旧密码';
    if (!newPassword) return '请输入新密码';
    if (newPassword.length < 6) return '新密码长度不能少于 6 位';
    if (newPassword === oldPassword) return '新密码不能与旧密码相同';
    if (newPassword !== confirmPassword) return '两次输入的新密码不一致';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSuccess('');
    const validationErr = validate();
    if (validationErr) {
      setErr(validationErr);
      return;
    }

    setSaving(true);
    try {
      const { changePasswordApi } = await import('../lib/api');
      const r = await changePasswordApi(oldPassword, newPassword);
      setSuccess('✅ 密码修改成功！请使用新密码重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // 3 秒后自动登出, 让用户用新密码重新登录
      setTimeout(() => {
        const logout = useAuthStore.getState().logout;
        logout();
        nav('/login');
      }, 3000);
    } catch (e: any) {
      const code = e?.response?.data?.error?.code;
      const msg = e?.response?.data?.error?.message;
      if (code === 'AUTH_FAILED') {
        setErr('❌ 旧密码错误, 请重试');
      } else {
        setErr('❌ ' + (msg || e?.message || '修改失败'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <button
        onClick={() => nav(-1)}
        className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary mb-4 text-sm"
      >
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="glass p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={20} className="text-primary" />
          <h1 className="text-xl font-bold">账号设置</h1>
        </div>
        <p className="text-sm text-text-tertiary mb-6">
           {user?.email ? `当前账号: ${user.email}` : '登录后修改密码'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 旧密码 */}
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">旧密码</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                className="input w-full pr-10"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="输入当前密码"
                autoComplete="current-password"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                tabIndex={-1}
              >
                {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">新密码</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className="input w-full pr-10"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="至少 6 位, 建议字母+数字+符号混合"
                autoComplete="new-password"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* 强度条 */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded ${i <= newPwdStrength.level ? newPwdStrength.color : 'bg-bg-secondary'}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-text-tertiary">
                  密码强度: <span className={
                    newPwdStrength.level === 1 ? 'text-red-400' :
                    newPwdStrength.level === 2 ? 'text-yellow-400' :
                    newPwdStrength.level === 3 ? 'text-blue-400' :
                    'text-green-400'
                  }>{newPwdStrength.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* 确认新密码 */}
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">确认新密码</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="input w-full pr-10"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="再输入一次新密码"
                autoComplete="new-password"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* 一致性提示 */}
            {confirmPassword && newPassword && (
              <div className={`text-xs mt-1 ${newPassword === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                {newPassword === confirmPassword ? '✓ 两次密码一致' : '✗ 两次密码不一致'}
              </div>
            )}
          </div>

          {/* 错误/成功提示 */}
          {err && (
            <div className="text-sm bg-red-500/10 text-red-400 px-3 py-2 rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}
          {success && (
            <div className="text-sm bg-green-500/10 text-green-400 px-3 py-2 rounded-lg flex items-start gap-2">
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              disabled={saving}
              className="btn-ghost text-sm"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {saving ? (
                <><Loader size={14} className="animate-spin" />提交中...</>
              ) : (
                <><Save size={14} />修改密码</>
              )}
            </button>
          </div>
        </form>

        {/* 安全提示 */}
        <div className="mt-6 pt-4 border-t border-border text-xs text-text-tertiary space-y-1">
          <p>💡 <strong>密码安全建议</strong>:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>至少 6 位, 推荐 10 位以上</li>
            <li>大小写字母 + 数字 + 符号混合</li>
            <li>不要使用生日/手机号/连续数字 (123456, abcdef)</li>
            <li>修改后请记住新密码, 我们不支持找回密码</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
