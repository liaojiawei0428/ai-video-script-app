import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck, ChevronLeft, AlertCircle, Info, MessageSquare, Megaphone } from 'lucide-react';
import { useNotificationStore, Notification } from '../store/notifications';

// ════════════════════════════════════════════════════════════
//  通知铃铛按钮 (Header 中使用)
// ════════════════════════════════════════════════════════════
export function NotificationBell() {
  const { unreadCount, panelOpen, setPanelOpen, fetchUnreadCount } = useNotificationStore();

  // 定期刷新未读数量
  useEffect(() => {
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(timer);
  }, [fetchUnreadCount]);

  return (
    <button
      onClick={() => setPanelOpen(!panelOpen)}
      className="relative p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
      title="通知"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-error text-white text-[10px] font-bold animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
//  通知面板弹窗 (点击铃铛后弹出)
// ════════════════════════════════════════════════════════════
export function NotificationPanel() {
  const {
    notifications, panelOpen, selectedId, loading,
    setPanelOpen, setSelectedId, fetchNotifications, markRead, markAllRead, unreadCount,
  } = useNotificationStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelOpen) fetchNotifications();
  }, [panelOpen, fetchNotifications]);

  // 点击外部关闭
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen, setPanelOpen]);

  if (!panelOpen) return null;

  const selected = selectedId ? notifications.find(n => n.id === selectedId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />

      {/* 面板 */}
      <div
        ref={panelRef}
        className="relative w-full max-w-md max-h-[80vh] glass border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slideDown"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary/90 backdrop-blur">
          {selected ? (
            <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
              <ChevronLeft size={16} /> 返回列表
            </button>
          ) : (
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              通知 {unreadCount > 0 && <span className="text-xs text-error">({unreadCount} 条未读)</span>}
            </h3>
          )}
          <div className="flex items-center gap-2">
            {!selected && unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                <CheckCheck size={14} /> 全部已读
              </button>
            )}
            <button onClick={() => setPanelOpen(false)} className="p-1 rounded hover:bg-bg-tertiary">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {selected ? (
            <NotificationDetail notification={selected} onMarkRead={markRead} />
          ) : loading ? (
            <div className="p-8 text-center text-text-tertiary">加载中...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary">
              <Bell size={32} className="mx-auto mb-2 opacity-30" />
              <p>暂无通知</p>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={() => {
                  setSelectedId(n.id);
                  if (!n.isRead) markRead(n.id);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  通知列表项
// ════════════════════════════════════════════════════════════
function NotificationItem({ notification: n, onClick }: { notification: Notification; onClick: () => void }) {
  const typeIcon = {
    feedback_reply: <MessageSquare size={16} className="text-accent" />,
    announcement: <Megaphone size={16} className="text-primary" />,
    system: <AlertCircle size={16} className="text-warning" />,
  }[n.type] || <Info size={16} className="text-text-tertiary" />;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors flex items-start gap-3 ${
        !n.isRead ? 'bg-accent/5' : ''
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">{typeIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${!n.isRead ? 'text-text-primary' : 'text-text-secondary'}`}>
            {n.title}
          </span>
          {!n.isRead && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
        </div>
        <p className="text-xs text-text-tertiary truncate mt-0.5">{n.content}</p>
        <p className="text-[10px] text-text-tertiary/60 mt-1">{formatTime(n.createdAt)}</p>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════
//  通知详情
// ════════════════════════════════════════════════════════════
function NotificationDetail({ notification: n, onMarkRead }: { notification: Notification; onMarkRead: (id: string) => void }) {
  useEffect(() => {
    if (!n.isRead) onMarkRead(n.id);
  }, [n.id, n.isRead, onMarkRead]);

  const typeLabel = {
    feedback_reply: '反馈回复',
    announcement: '系统公告',
    system: '系统通知',
  }[n.type] || '通知';

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-bg-tertiary text-text-secondary">
          {typeLabel}
        </span>
        <span className="text-xs text-text-tertiary">{formatTime(n.createdAt)}</span>
      </div>
      <h4 className="font-semibold text-text-primary mb-3">{n.title}</h4>
      <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{n.content}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  Toast 弹出通知 (页面顶部下拉)
// ════════════════════════════════════════════════════════════
export function NotificationToast() {
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto w-[400px] max-w-[90vw] glass border border-border rounded-lg shadow-2xl animate-slideDown flex items-start gap-3 p-4"
        >
          <div className="flex-shrink-0 mt-0.5">
            {toast.type === 'system' ? <AlertCircle size={18} className="text-warning" /> :
             toast.type === 'feedback_reply' ? <MessageSquare size={18} className="text-accent" /> :
             <Info size={18} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-text-primary">{toast.title}</p>
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{toast.content}</p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 p-1 rounded hover:bg-bg-tertiary text-text-tertiary"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function formatTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN');
}
