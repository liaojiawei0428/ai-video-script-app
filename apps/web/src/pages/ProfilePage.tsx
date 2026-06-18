// apps/web/src/pages/ProfilePage.tsx
// v3.0.1 (S56): 个人中心主页
// 模仿 mobile HomeScreen.tsx 布局 (avatar/昵称/余额卡/菜单组)
// 后端: GET /users/profile + PUT /users/profile
// 菜单跳: /recharge, /pricing, /settings, /feedback, /about, /account

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { getMeApi, updateProfileApi, uploadAvatarApi } from '../lib/api';
import {
  User as UserIcon, Wallet, Crown, Bell, Edit3, Save, X, Loader,
  AlertCircle, CheckCircle, LogOut, FileText, MessageSquare, Info,
  Receipt, Tag, ChevronRight, Camera
} from 'lucide-react';

interface MenuItem {
  icon: any;
  label: string;
  to: string;
  desc?: string;
  danger?: boolean;
  external?: boolean;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: '我的服务',
    items: [
      { icon: Receipt, label: '账单明细', to: '/billing', desc: '充值 / 消费记录' },
      { icon: Tag, label: '收费标准', to: '/pricing', desc: '透明计费公式' },
      { icon: Crown, label: 'VIP 中心', to: '/vip', desc: '升级享优惠费率' },
    ],
  },
  {
    title: '账户与安全',
    items: [
      { icon: FileText, label: '修改密码', to: '/account', desc: '定期更换更安全' },
      { icon: MessageSquare, label: '意见反馈', to: '/feedback', desc: '帮助我们改进' },
      { icon: Info, label: '关于我们', to: '/about', desc: '版本号 · 法律 · 备案' },
    ],
  },
];

export function ProfilePage() {
  const nav = useNavigate();
  const { user, setUser, logout, fetchBalance } = useAuthStore();
  const [editMode, setEditMode] = useState(false);
  const [editNickname, setEditNickname] = useState(user?.nickname || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 拉一次最新 user 信息 (含 balance)
    fetchBalance();
  }, [fetchBalance]);

  // 头像选择 (从预设 6 个 + 自定义上传)
  const handleAvatarClick = () => {
    if (editMode) {
      fileInputRef.current?.click();
    }
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErr('图片大小不能超过 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErr('请选择图片文件');
      return;
    }
    // v3.0.2 (S57): 上传到 server 拿 URL (multipart/form-data) → 写到 user.avatarUrl → 保存时 PATCH
    setErr(''); setSuccess('');
    setUploadingAvatar(true);
    try {
      const r = await uploadAvatarApi(file);
      const url = r.data?.data?.url;
      if (!url) throw new Error('上传成功但未返回 URL');
      // 把 server url 写到 user 上, save 时 PATCH 保存
      setUser({ ...user!, avatarUrl: url });
      setSuccess('✅ 头像已上传, 点击"保存"后生效');
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || '头像上传失败');
    } finally {
      setUploadingAvatar(false);
      // 清 input value, 允许重选同一张图
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setErr(''); setSuccess('');
    setSaving(true);
    try {
      // v3.0.2 (S57): PATCH nickname + avatarUrl (avatarUrl 是刚才 uploadAvatarApi 拿到的 server url, 跟 user.avatarUrl 一致)
      await updateProfileApi({ nickname: editNickname, avatarUrl: user?.avatarUrl });
      setSuccess('✅ 保存成功');
      setEditMode(false);
      // 刷新 user (确保 server 端的最新 avatarUrl 跟本地一致)
      const r = await getMeApi();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUser(fresh);
      setTimeout(() => setSuccess(''), 2000);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setEditMode(false);
    setErr(''); setSuccess('');
    setEditNickname(user?.nickname || '');
    // v3.0.2 (S57): 取消时从 server 拉一次最新 user, 还原 avatarUrl (避免本地 dirty state)
    try {
      const r = await getMeApi();
      const fresh = r.data?.data?.user || r.data?.data;
      if (fresh) setUser(fresh);
    } catch {
      // 拉取失败就保持现状
    }
  };

  const handleLogout = () => {
    if (!confirm('确定要退出登录吗?')) return;
    logout();
    nav('/login');
  };

  const isVip = (user as any)?.vipLevel >= 1;
  const vipExpiry = (user as any)?.vipExpiresAt
    ? new Date((user as any).vipExpiresAt).toLocaleDateString('zh-CN')
    : '永久';

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 顶部 Profile Header */}
      <div className="glass p-6 rounded-2xl border border-border">
        <div className="flex items-start gap-4">
          {/* 头像 */}
          <div className="relative">
            <div
              onClick={handleAvatarClick}
              className={`w-20 h-20 rounded-full overflow-hidden border-2 ${isVip ? 'border-warning' : 'border-border'} bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-2xl font-bold ${editMode && !uploadingAvatar ? 'cursor-pointer' : 'cursor-default'}`}
              title={editMode ? (uploadingAvatar ? '头像上传中...' : '点击更换头像') : ''}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{(user?.nickname || user?.username || user?.email || 'U').charAt(0).toUpperCase()}</span>
              )}
              {editMode && !uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Camera size={20} className="text-white" />
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-full">
                  <Loader size={20} className="text-white animate-spin" />
                </div>
              )}
            </div>
            {isVip && (
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-warning flex items-center justify-center border-2 border-bg-primary">
                <Crown size={14} className="text-white" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* 昵称 + 用户名 */}
          <div className="flex-1 min-w-0">
            {editMode ? (
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                placeholder="设置昵称"
                maxLength={20}
                className="w-full text-lg font-semibold bg-bg-secondary border border-border rounded-lg px-3 py-1.5 focus:border-primary outline-none"
              />
            ) : (
              <h1 className="text-lg font-semibold text-text-primary truncate">
                {user?.nickname || user?.username || '未设置昵称'}
              </h1>
            )}
            <p className="text-sm text-text-tertiary mt-1">@{user?.username || user?.email}</p>
            {isVip && (
              <p className="text-xs text-warning mt-1 flex items-center gap-1">
                <Crown size={12} /> VIP 到期: {vipExpiry}
              </p>
            )}
          </div>

          {/* 编辑 / 通知按钮 */}
          <div className="flex flex-col gap-2">
            {editMode ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-1 disabled:opacity-50"
                >
                  {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                  保存
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-sm rounded-lg bg-bg-tertiary hover:bg-bg-secondary text-text-secondary flex items-center gap-1"
                >
                  <X size={14} />
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-text-primary flex items-center gap-1"
                >
                  <Edit3 size={14} />
                  编辑
                </button>
                <Link
                  to="/notifications"
                  className="px-3 py-1.5 text-sm rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-text-primary flex items-center gap-1"
                  title="通知"
                >
                  <Bell size={14} />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 错误 / 成功提示 */}
        {err && (
          <div className="mt-4 p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error flex items-center gap-2">
            <AlertCircle size={14} /> {err}
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 bg-success/10 border border-success/30 rounded-lg text-sm text-success flex items-center gap-2">
            <CheckCircle size={14} /> {success}
          </div>
        )}
      </div>

      {/* 余额卡片 (点击跳 /recharge) */}
      <Link
        to="/recharge"
        className="glass p-5 rounded-2xl border border-warning/30 bg-gradient-to-r from-warning/5 via-primary/5 to-accent/5 hover:border-warning/50 transition-colors block"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-tertiary flex items-center gap-1">
              <Wallet size={12} />
              账户余额
            </p>
            <p className="text-3xl font-bold text-text-primary mt-1">
              ¥<span className="text-warning">{(user?.balance ?? 0).toFixed(2)}</span>
            </p>
            {isVip ? (
              <p className="text-xs text-warning mt-1">VIP 享优惠费率</p>
            ) : (
              <p className="text-xs text-text-tertiary mt-1">
                开通 VIP 享 <span className="text-warning font-medium">¥10/年</span> 优惠 →
              </p>
            )}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium flex items-center gap-1">
            {isVip ? '续费 VIP' : '充值'}
            <ChevronRight size={14} />
          </div>
        </div>
      </Link>

      {/* 菜单区 */}
      {MENU_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-2">
            {section.title}
          </h2>
          <div className="glass rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {section.items.map((item) => {
              const Icon = item.icon;
              const inner = (
                <>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    {item.desc && <p className="text-xs text-text-tertiary mt-0.5">{item.desc}</p>}
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
                </>
              );
              if (item.external) {
                return (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors"
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full glass rounded-2xl border border-error/30 p-4 text-error hover:bg-error/5 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut size={16} />
        退出登录
      </button>

      {/* 版本号 */}
      <p className="text-center text-xs text-text-tertiary">
        Deep剧本 v3.0.0
      </p>
    </div>
  );
}
