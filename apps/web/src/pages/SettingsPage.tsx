// apps/web/src/pages/SettingsPage.tsx
// v3.0.1 (S56): 设置页 (跟 mobile SettingsScreen.tsx 一致, 含法律 + 关于 + 退出登录)
// 实际改密跳 /account (旧页)

import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  ArrowLeft, Settings as SettingsIcon, Lock, FileText, Shield, Info,
  MessageSquare, LogOut, ChevronRight, Database
} from 'lucide-react';

interface MenuItem {
  icon: any;
  label: string;
  to: string;
  desc?: string;
  danger?: boolean;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: '账户与安全',
    items: [
      { icon: Lock, label: '修改密码', to: '/account', desc: '定期更换更安全' },
    ],
  },
  {
    title: '帮助与反馈',
    items: [
      { icon: MessageSquare, label: '意见反馈', to: '/feedback', desc: '帮助我们改进' },
    ],
  },
  {
    title: '法律合规',
    items: [
      { icon: FileText, label: '用户服务协议', to: '/about#agreement', desc: '查看完整条款' },
      { icon: Shield, label: '隐私政策', to: '/about#privacy', desc: '数据收集与使用' },
    ],
  },
  {
    title: '信息公示',
    items: [
      { icon: Info, label: '关于我们', to: '/about', desc: '版本号 · 算法备案' },
    ],
  },
];

export function SettingsPage() {
  const nav = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    if (!confirm('确定要退出登录吗?')) return;
    logout();
    nav('/login');
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* 顶部 */}
      <div className="flex items-center gap-3">
        <Link to="/profile" className="p-2 rounded-lg hover:bg-bg-secondary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
          <SettingsIcon size={18} />
          设置
        </h1>
      </div>

      {/* 菜单组 */}
      {MENU_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-2">
            {section.title}
          </h2>
          <div className="glass rounded-2xl border border-border overflow-hidden divide-y divide-border">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 p-4 hover:bg-bg-secondary/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    {item.desc && <p className="text-xs text-text-tertiary mt-0.5">{item.desc}</p>}
                  </div>
                  <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
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

      <p className="text-center text-xs text-text-tertiary">Deep剧本 v3.0.0</p>
    </div>
  );
}
