import { create } from 'zustand';
import { Novel, Episode, Character, Shot } from '@ai-script/shared-types';

export interface TaskProgress {
  novelId: string;
  novelTitle: string;
  genre: string;
  taskId: string;
  status: string;
  progress: number;
  phase: string;
}

export interface ChunkStatus {
  index: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

export interface ChunkProgress {
  phase: string;
  current: number;
  total: number;
  unitLabel: string;
  detail?: string;
  chunkStates: ChunkStatus[];
  error?: { step: string; message: string };
  eta?: number;
}

export interface LlmMessage {
  id: string;
  novelId: string;
  type: 'reasoning' | 'output' | 'phase_start' | 'phase_end' | 'completed';
  phase: string;
  content: string;
  tokens?: number;
  timestamp: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  nickname: string;
  avatarUrl: string;
  balance: number;
  totalGenerations: number;
  role?: string;
  vipLevel?: number;
  vipExpiresAt?: number;
  createdAt: number;
}

interface NovelState {
  novels: Novel[];
  currentNovel: Novel | null;
  episodes: Episode[];
  characters: Character[];
  currentShots: Shot[];
  activeTasks: TaskProgress[];
  llmMessages: LlmMessage[];
  chunkProgress: ChunkProgress | null;
  chunkStreams: Record<number, string>;
  userInfo: UserInfo | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  queueStatus: Record<string, { position: number; runningCount: number; waitingCount: number }>;

  setNovels: (novels: Novel[]) => void;
  addNovel: (novel: Novel) => void;
  removeNovel: (novelId: string) => void;
  addActiveTask: (task: TaskProgress) => void;
  updateTaskProgress: (novelId: string, progress: number, status: string, phase: string) => void;
  removeTask: (novelId: string) => void;
  setQueueStatus: (novelId: string, position: number, runningCount: number, waitingCount: number) => void;
  clearQueueStatus: (novelId: string) => void;
  updateEpisode: (episode: Episode) => void;
  updateShot: (shot: Shot) => void;
  addLlmMessage: (msg: LlmMessage) => void;
  appendLlmContent: (novelId: string, phase: string, content: string) => void;
  clearLlmMessages: () => void;
  setChunkProgress: (progress: ChunkProgress | null) => void;
  setChunkStream: (chunkIndex: number, content: string) => void;
  appendChunkStream: (chunkIndex: number, token: string) => void;
  clearChunkStreams: () => void;
  setUserInfo: (user: UserInfo | null) => void;
  setLoggedIn: (loggedIn: boolean) => void;
  setAdmin: (admin: boolean) => void;
  logout: () => void;
}

let msgId = 0;

export const useNovelStore = create<NovelState>((set) => ({
  novels: [],
  currentNovel: null,
  episodes: [],
  characters: [],
  currentShots: [],
  activeTasks: [],
  llmMessages: [],
  chunkProgress: null,
  chunkStreams: {},
  userInfo: null,
  isLoggedIn: false,
  isAdmin: false,
  queueStatus: {},

  setNovels: (novels) => set({ novels }),
  setCurrentNovel: (novel) => set({ currentNovel: novel }),
  setEpisodes: (episodes) => set({ episodes }),
  setCharacters: (characters) => set({ characters }),
  setCurrentShots: (shots) => set({ currentShots: shots }),
  addNovel: (novel) => set((state) => ({ novels: [novel, ...state.novels] })),
  removeNovel: (novelId) => set((state) => ({
    novels: state.novels.filter(n => n.id !== novelId),
    activeTasks: state.activeTasks.filter(t => t.novelId !== novelId),
  })),
  addActiveTask: (task) => set((state) => ({
    activeTasks: [task, ...state.activeTasks.filter(t => t.novelId !== task.novelId)],
  })),
  updateTaskProgress: (novelId, progress, status, phase) => set((state) => ({
    activeTasks: state.activeTasks.map(t =>
      t.novelId === novelId ? { ...t, progress, status, phase } : t
    ),
    novels: state.novels.map(n =>
      n.id === novelId ? { ...n, status: status as any } : n
    ),
  })),
  removeTask: (novelId) => set((state) => ({
    activeTasks: state.activeTasks.filter(t => t.novelId !== novelId),
  })),
  updateEpisode: (episode) => set((state) => ({
    episodes: state.episodes.map(e => e.id === episode.id ? episode : e),
  })),
  updateShot: (shot) => set((state) => ({
    currentShots: state.currentShots.map(s => s.id === shot.id ? shot : s),
  })),
  addLlmMessage: (msg) => set((state) => ({
    llmMessages: [...state.llmMessages, msg],
  })),
  appendLlmContent: (novelId, phase, content) => set((state) => {
    const msgs = [...state.llmMessages];
    let found = false;
    // 只追加到类型为 'output' 的消息（不追加到 reasoning/提示消息）
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].novelId === novelId && msgs[i].phase === phase && msgs[i].type === 'output') {
        msgs[i] = { ...msgs[i], content: msgs[i].content + content };
        found = true;
        break;
      }
    }
    if (!found) {
      // 第一条流消息，创建新的 output 消息
      msgId++;
      msgs.push({ id: String(msgId), novelId, type: 'output', phase, content, tokens: content.length, timestamp: Date.now() });
    }
    return { llmMessages: msgs };
  }),
  clearLlmMessages: () => set({ llmMessages: [] }),
  setChunkProgress: (progress) => set({ chunkProgress: progress }),
  setChunkStream: (chunkIndex, content) => set((state) => ({
    chunkStreams: { ...state.chunkStreams, [chunkIndex]: content },
  })),
  appendChunkStream: (chunkIndex, token) => set((state) => {
    const existing = state.chunkStreams[chunkIndex] || '';
    return { chunkStreams: { ...state.chunkStreams, [chunkIndex]: existing + token } };
  }),
  clearChunkStreams: () => set({ chunkStreams: {} }),
  setUserInfo: (user) => set({ userInfo: user }),
  setLoggedIn: (loggedIn) => set({ isLoggedIn: loggedIn }),
  setAdmin: (admin) => set({ isAdmin: admin }),
  logout: () => set({ userInfo: null, isLoggedIn: false, isAdmin: false }),
  setQueueStatus: (novelId, position, runningCount, waitingCount) => set((state) => {
    const updatedNovels = state.novels.map(n => {
      if (n.id === novelId && position > 0 && n.status !== 'generating') {
        return { ...n, status: 'queued' as any };
      }
      if (n.id === novelId && position === 0 && (n.status as string) === 'queued') {
        return { ...n, status: 'analyzing' as any };
      }
      return n;
    });
    return {
      queueStatus: { ...state.queueStatus, [novelId]: { position, runningCount, waitingCount } },
      novels: updatedNovels,
    };
  }),
  clearQueueStatus: (novelId) => set((state) => {
    const next = { ...state.queueStatus };
    delete next[novelId];
    return { queueStatus: next };
  }),
}));

export function createLlmMessage(novelId: string, type: LlmMessage['type'], phase: string, content: string, tokens?: number): LlmMessage {
  return { id: String(++msgId), novelId, type, phase, content, tokens, timestamp: Date.now() };
}
