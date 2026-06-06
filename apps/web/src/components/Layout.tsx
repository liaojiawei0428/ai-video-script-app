import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { BookOpen, Sparkles, Wallet, LogOut, Home, ListChecks } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const nav = useNavigate();

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
            <span className="text-xs text-text-tertiary ml-1">v2.0.0</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItem('/', Home, '书架')}
            {navItem('/tasks', ListChecks, '进度')}
            {navItem('/assistant', Sparkles, 'AI 助手')}
            {navItem('/recharge', Wallet, '充值')}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{user?.email}</span>
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
