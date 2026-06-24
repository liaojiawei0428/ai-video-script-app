import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BookOpen, Sparkles, Wallet, LogOut, Home, ListChecks, Settings, Image as ImageIcon, Video as VideoIcon, Crown, User as UserIcon, Smartphone } from 'lucide-react';
import { NotificationBell, NotificationPanel, NotificationToast } from './Notifications';
import { useEffect } from 'react';
// v3.0.29 (S64): 版本号从 src/config/version.ts 单一来源读取 (修复 BUG-067)
import { APP_VERSION } from '../config/version';

export function Layout() {
  const { user, logout, fetchBalance } = useAuthStore();
  const location = useLocation();
  const nav = useNavigate();

  // 页面加载时刷新余额, 每60秒轮询
  useEffect(() => {
    fetchBalance();
    const timer = setInterval(fetchBalance, 60000);
    return () => clearInterval(timer);
  }, [fetchBalance]);

  const navItem = (to: string, Icon: any, label: string) => {
    const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          active ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
        }`}
      >
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-bg-primary/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">Deep剧本</span>
            <span className="text-xs text-text-tertiary ml-1">v{APP_VERSION}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItem('/', Home, '书架')}
            {navItem('/tasks', ListChecks, '进度')}
            {navItem('/image-agent', ImageIcon, '生图')}
            {navItem('/video-agent', VideoIcon, '视频')}
            {navItem('/assistant', Sparkles, 'AI 助手')}
            {navItem('/recharge', Wallet, '充值')}
            {navItem('/vip', Crown, 'VIP')}
            {/* v3.0.0 (S58): APP 下载入口 (公开) */}
            <Link
              to="/download"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              title="下载手机 APP"
            >
              <Smartphone size={16} />
              <span className="text-sm font-semibold">下载 APP</span>
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {/* v3.0.0.32 (S52): VIP 状态徽章 (跟 Mobile HomeScreen.tsx:360 一致) */}
            {(user as any)?.vipLevel >= 1 ? (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-warning/15 text-warning text-xs font-semibold" title={`VIP 到期: ${(user as any)?.vipExpiresAt ? new Date((user as any).vipExpiresAt).toLocaleDateString('zh-CN') : '永久'}`}>
                <Crown size={12} />
                VIP
              </span>
            ) : (
              <Link to="/recharge" className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-warning/10 hover:bg-warning/20 text-warning text-xs font-medium transition-colors" title="开通 VIP 享 ¥10/年 优惠费率">
                <Crown size={12} />
                开通 VIP
              </Link>
            )}
            {/* 余额显示 */}
            <Link to="/recharge" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors" title="充值">
              <Wallet size={14} className="text-primary" />
              <span className="text-sm font-medium text-primary">¥{(user?.balance ?? 0).toFixed(2)}</span>
            </Link>
            <span className="text-sm text-text-secondary hidden sm:inline">{user?.email}</span>
            <NotificationBell />
            {/* v3.0.1 (S56): 个人中心入口 (头像/昵称/账单/设置 都在这里) */}
            <Link
              to="/profile"
              className="p-2 rounded-lg text-text-tertiary hover:text-text-primary transition-colors"
              title="个人中心"
            >
              <UserIcon size={18} />
            </Link>
            <button
              onClick={() => { logout(); nav('/login'); }}
              className="p-2 rounded-lg text-text-tertiary hover:text-error transition-colors"
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* 全局通知组件 */}
      <NotificationPanel />
      <NotificationToast />

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-text-tertiary">
        © 2026 Deep剧本 · maque.uno
      </footer>
    </div>
  );
}
