import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, ShoppingCart, BarChart3, Megaphone, LogOut,
  CheckCircle, XCircle, Clock, Loader, Send, MessageSquare,
  Settings, Activity, RefreshCw, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  adminDashboardApi, adminOrdersApi, adminApproveApi, adminRejectApi,
  adminUsersDetailApi, adminSendMsgApi, sendAnnouncementApi, adminActiveTasksApi,
  adminMaintenanceApi,
} from '../lib/api';

type Tab = 'dashboard' | 'orders' | 'users' | 'announcement' | 'settings';

export function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const nav = useNavigate();

  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('admin_user') || '{}'); } catch { return {}; }
  })();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    nav('/admin/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="border-b border-border bg-bg-primary/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-error to-warning flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg">管理后台</span>
            <span className="text-xs text-text-tertiary">Deep剧本</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-text-secondary">{adminUser?.username || '管理员'}</span>
            <button onClick={handleLogout} className="p-2 rounded-lg text-text-tertiary hover:text-error transition-colors" title="退出">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {[
            { key: 'dashboard', icon: BarChart3, label: '数据概览' },
            { key: 'orders', icon: ShoppingCart, label: '充值订单' },
            { key: 'users', icon: Users, label: '用户管理' },
            { key: 'announcement', icon: Megaphone, label: '发送公告' },
            { key: 'settings', icon: Settings, label: '系统设置' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as Tab)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                tab === item.key
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'announcement' && <AnnouncementTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  数据概览
// ════════════════════════════════════════════════════════════
function DashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminDashboardApi().then(r => setData(r.data?.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-text-tertiary"><Loader className="animate-spin mx-auto" /></div>;

  const cards = [
    { label: '总用户数', value: data?.totalUsers ?? 0, icon: Users, color: 'text-primary' },
    { label: '今日新增', value: data?.todayUsers ?? 0, icon: Users, color: 'text-success' },
    { label: '待审订单', value: data?.pendingOrders ?? 0, icon: Clock, color: 'text-warning' },
    { label: '今日订单', value: data?.todayOrders ?? 0, icon: ShoppingCart, color: 'text-accent' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">数据概览</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="glass p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-tertiary">{c.label}</span>
              <c.icon size={16} className={c.color} />
            </div>
            <div className="text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  充值订单
// ════════════════════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);

  const load = (s: string) => {
    setLoading(true);
    setStatus(s);
    adminOrdersApi(s).then(r => setOrders(r.data?.data?.orders || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load('pending'); }, []);

  const handleApprove = async (id: string) => {
    if (!confirm('确认此充值申请已收到款项？')) return;
    try {
      await adminApproveApi(id);
      load(status);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '操作失败');
    }
  };

  const handleReject = async (id: string) => {
    const remark = prompt('拒绝原因（可选）');
    try {
      await adminRejectApi(id, remark || undefined);
      load(status);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '操作失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">充值订单</h2>
        <button onClick={() => load(status)} className="btn-ghost text-xs flex items-center gap-1">
          <RefreshCw size={12} /> 刷新
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button
            key={s}
            onClick={() => load(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              status === s ? 'bg-primary text-white' : 'bg-bg-tertiary text-text-secondary hover:bg-border'
            }`}
          >
            {{ pending: '待审核', approved: '已通过', rejected: '已拒绝', all: '全部' }[s as keyof Record<string, string>] || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-text-tertiary"><Loader className="animate-spin mx-auto" /></div>
      ) : orders.length === 0 ? (
        <div className="glass p-8 text-center text-text-tertiary">暂无订单</div>
      ) : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="glass p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{o.username || o.userId?.slice(0, 8)}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary font-medium">¥{o.amount?.toFixed(2)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    o.status === 'pending' ? 'bg-warning/15 text-warning' :
                    o.status === 'approved' ? 'bg-success/15 text-success' :
                    'bg-error/15 text-error'
                  }`}>
                    {{ pending: '待审核', approved: '已通过', rejected: '已拒绝' }[o.status as keyof Record<string, string>] || o.status}
                  </span>
                  {/* v3.0.37 (S72 batch 7 BUG-092): 用户已通知标记 (优先处理, 跟 BUG-089 教训一致: 区分"用户主动" vs "系统触发") */}
                  {o.userNotifiedAt && o.userNotifiedAt > 0 && o.status === 'pending' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/15 text-accent font-medium flex items-center gap-1">
                      💬 用户已通知已付款 · {new Date(o.userNotifiedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary">
                  {o.paymentMethod || '微信'} · {new Date(o.createdAt).toLocaleString('zh-CN')}
                  {o.remark && ` · ${o.remark}`}
                </div>
              </div>
              {o.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprove(o.id)} className="px-3 py-1.5 rounded-lg text-xs bg-success/15 text-success hover:bg-success/25 flex items-center gap-1">
                    <CheckCircle size={12} /> 到账
                  </button>
                  <button onClick={() => handleReject(o.id)} className="px-3 py-1.5 rounded-lg text-xs bg-error/15 text-error hover:bg-error/25 flex items-center gap-1">
                    <XCircle size={12} /> 拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  用户管理
// ════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msgTarget, setMsgTarget] = useState<any>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminUsersDetailApi().then(r => setUsers(r.data?.data?.users || [])).finally(() => setLoading(false));
  }, []);

  const handleSendMsg = async () => {
    if (!msgTarget || !msgTitle.trim() || !msgContent.trim()) return;
    setMsgSending(true);
    try {
      await adminSendMsgApi(msgTarget.id, msgTitle.trim(), msgContent.trim());
      alert(`已发送消息给 ${msgTarget.nickname || msgTarget.username}`);
      setMsgTarget(null); setMsgTitle(''); setMsgContent('');
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '发送失败');
    } finally { setMsgSending(false); }
  };

  if (loading) return <div className="p-8 text-center text-text-tertiary"><Loader className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">用户管理 ({users.length})</h2>

      {/* 发消息弹窗 */}
      {msgTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="glass p-6 w-full max-w-md">
            <h3 className="font-bold mb-3">发送消息给 {msgTarget.nickname || msgTarget.username}</h3>
            <input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="标题" className="input mb-2" />
            <textarea value={msgContent} onChange={e => setMsgContent(e.target.value)} placeholder="内容" rows={4} className="input mb-3 resize-y" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMsgTarget(null)} className="btn-ghost text-sm">取消</button>
              <button onClick={handleSendMsg} disabled={msgSending} className="btn-primary text-sm flex items-center gap-1">
                {msgSending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />} 发送
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="glass">
            <button
              onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold">
                  {(u.nickname || u.username || '?')[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{u.nickname || u.username}</span>
                    {u.vipLevel >= 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium">VIP</span>}
                    {u.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-error/15 text-error font-medium">管理员</span>}
                  </div>
                  <div className="text-xs text-text-tertiary">{u.email || u.username} · 注册: {new Date(u.createdAt).toLocaleDateString('zh-CN')}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-medium">¥{u.balance?.toFixed(2) ?? '0.00'}</div>
                  <div className="text-[10px] text-text-tertiary">{u.novelCount ?? 0} 本 · {u.totalGenerations ?? 0} 次</div>
                </div>
                {expandedId === u.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {expandedId === u.id && (
              <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0 pt-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                  <div><span className="text-text-tertiary">ID:</span> <span className="font-mono">{u.id?.slice(0, 8)}...</span></div>
                  <div><span className="text-text-tertiary">余额:</span> ¥{u.balance?.toFixed(2) ?? '0.00'}</div>
                  <div><span className="text-text-tertiary">书架:</span> {u.novelCount ?? 0} 本</div>
                  <div><span className="text-text-tertiary">生成:</span> {u.totalGenerations ?? 0} 次</div>
                  <div><span className="text-text-tertiary">充值:</span> ¥{u.totalRecharged?.toFixed(2) ?? '0.00'}</div>
                  <div><span className="text-text-tertiary">消费:</span> ¥{u.totalConsumed?.toFixed(2) ?? '0.00'}</div>
                  <div><span className="text-text-tertiary">VIP:</span> {u.vipLevel >= 1 ? `Lv.${u.vipLevel}` : '无'}</div>
                  <div><span className="text-text-tertiary">IP:</span> {u.lastIp || '无'}</div>
                </div>
                <button onClick={() => setMsgTarget(u)} className="btn-ghost text-xs flex items-center gap-1">
                  <MessageSquare size={12} /> 发送消息
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  发送公告
// ════════════════════════════════════════════════════════════
function AnnouncementTab() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) { alert('请输入标题和内容'); return; }
    if (!confirm(`确定要向所有用户发送公告？\n\n标题：${title}\n内容：${content.slice(0, 100)}...`)) return;
    setSending(true);
    setResult('');
    try {
      const r = await sendAnnouncementApi(title.trim(), content.trim());
      setResult(`✅ ${r.data?.data?.message || '发送成功'}`);
      setTitle(''); setContent('');
    } catch (e: any) {
      setResult(`❌ ${e?.response?.data?.error?.message || '发送失败'}`);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">发送系统公告</h2>
      <div className="glass p-5 space-y-3">
        <div>
          <label className="text-xs text-text-tertiary mb-1 block">公告标题</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="如：系统维护通知" className="input" />
        </div>
        <div>
          <label className="text-xs text-text-tertiary mb-1 block">公告内容</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="公告正文..." rows={6} className="input resize-y" />
        </div>
        {result && <div className="p-3 rounded-lg bg-bg-tertiary text-sm">{result}</div>}
        <button onClick={handleSend} disabled={sending} className="btn-primary flex items-center gap-2">
          {sending ? <Loader size={16} className="animate-spin" /> : <Megaphone size={16} />}
          {sending ? '发送中...' : '发送公告给所有用户'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  系统设置
// ════════════════════════════════════════════════════════════
function SettingsTab() {
  const [activeTasks, setActiveTasks] = useState<number | null>(null);
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminActiveTasksApi().then(r => setActiveTasks(r.data?.data?.count ?? 0)).catch(() => {});
  }, []);

  const toggleMaintenance = async () => {
    const newState = !maintenance;
    if (!confirm(newState ? '确定开启维护模式？所有用户将无法访问。' : '确定关闭维护模式？')) return;
    setLoading(true);
    try {
      await adminMaintenanceApi(newState);
      setMaintenance(newState);
      alert(newState ? '维护模式已开启' : '维护模式已关闭');
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || '操作失败');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">系统设置</h2>

      <div className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">活跃任务数</div>
            <div className="text-xs text-text-tertiary">当前正在运行或排队的任务</div>
          </div>
          <span className="text-2xl font-bold">{activeTasks ?? '-'}</span>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">维护模式</div>
              <div className="text-xs text-text-tertiary">开启后所有用户无法访问</div>
            </div>
            <button
              onClick={toggleMaintenance}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                maintenance
                  ? 'bg-error text-white hover:bg-error/80'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-border'
              }`}
            >
              {loading ? <Loader size={14} className="animate-spin" /> : maintenance ? '关闭维护模式' : '开启维护模式'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
