import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMeApi } from '../lib/api';

interface User { id: string; email: string; username?: string; nickname?: string; avatarUrl?: string; balance?: number; role?: string; vipLevel?: number; vipExpiresAt?: number; }
interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User | null) => void;
  fetchBalance: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      setUser: (user) => set({ user }),
      fetchBalance: async () => {
        if (!get().token) return;
        try {
          const r = await getMeApi();
          const balance = r.data?.data?.user?.balance ?? r.data?.data?.balance ?? 0;
          set(state => state.user ? { user: { ...state.user, balance } } : {});
        } catch {}
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'ai-script-auth' }
  )
);
