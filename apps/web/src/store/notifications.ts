import { create } from 'zustand';
import {
  getNotificationsApi,
  getUnreadCountApi,
  markNotificationReadApi,
  markAllReadApi,
} from '../lib/api';
import { useAuthStore } from './auth';

export interface Notification {
  id: string;
  userId: string;
  type: 'feedback_reply' | 'announcement' | 'system';
  title: string;
  content: string;
  isRead: boolean;
  relatedId: string;
  createdAt: number;
}

interface ToastItem {
  id: string;
  title: string;
  content: string;
  type: Notification['type'];
  timestamp: number;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  panelOpen: boolean;
  selectedId: string | null;
  toasts: ToastItem[];
  loading: boolean;

  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  setSelectedId: (id: string | null) => void;
  addToast: (toast: Omit<ToastItem, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  panelOpen: false,
  selectedId: null,
  toasts: [],
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const r = await getNotificationsApi();
      const data = r.data?.data;
      const notifications = data?.notifications || [];
      set({
        notifications,
        unreadCount: data?.unreadCount || 0,
        loading: false,
      });
      // v2.5.17: 如果有未读的"充值成功"通知, 自动刷新余额
      const hasRecharge = notifications.some((n: Notification) => !n.isRead && n.title.includes('充值成功'));
      if (hasRecharge) {
        useAuthStore.getState().fetchBalance();
      }
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const r = await getUnreadCountApi();
      set({ unreadCount: r.data?.data?.unreadCount || 0 });
    } catch {}
  },

  markRead: async (id: string) => {
    try {
      await markNotificationReadApi(id);
      set(state => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await markAllReadApi();
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  setPanelOpen: (open: boolean) => set({ panelOpen: open, selectedId: null }),
  setSelectedId: (id: string | null) => set({ selectedId: id }),

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newToast: ToastItem = { ...toast, id, timestamp: Date.now() };
    set(state => ({ toasts: [...state.toasts, newToast] }));
    // 自动移除 (8秒)
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 8000);
  },

  removeToast: (id: string) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));
