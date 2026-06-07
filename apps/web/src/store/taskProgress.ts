import { create } from 'zustand';

interface NovelProgress {
  novelId: string;
  novelTitle: string;
  status: string;
  progress: number;
  totalEpisodes: number;
  currentEpisode: number;
  generatingEp: number;
  analysisText: string;
  episodeTexts: Record<number, string>;
  episodeTitles: Record<number, string>;
  shotStreamText: Record<string, string>;
  shotGenState: Record<string, 'idle' | 'queued' | 'running' | 'completed' | 'failed'>;
  shotWsConnected: Record<string, boolean>;
  shotMsgCount: Record<string, number>;
  lastUpdated: number;
}

interface TaskProgressState {
  novels: Record<string, NovelProgress>;
  setNovelProgress: (novelId: string, data: Partial<NovelProgress>) => void;
  appendAnalysisText: (novelId: string, text: string) => void;
  appendEpisodeText: (novelId: string, epNum: number, text: string) => void;
  setEpisodeTitle: (novelId: string, epNum: number, title: string) => void;
  setGeneratingEp: (novelId: string, epNum: number) => void;
  appendShotStreamText: (novelId: string, episodeId: string, text: string) => void;
  setShotStreamText: (novelId: string, episodeId: string, text: string) => void;
  setShotGenState: (novelId: string, episodeId: string, state: 'idle' | 'queued' | 'running' | 'completed' | 'failed') => void;
  setShotWsConnected: (novelId: string, episodeId: string, connected: boolean) => void;
  setShotMsgCount: (novelId: string, episodeId: string, count: number) => void;
  resetShotPanel: (novelId: string, episodeId: string) => void;
  clearNovelProgress: (novelId: string) => void;
  clearAllProgress: () => void;
  getNovelProgress: (novelId: string) => NovelProgress | undefined;
}

const empty: Omit<NovelProgress, 'novelId'> = {
  novelTitle: '',
  status: 'pending',
  progress: 0,
  totalEpisodes: 0,
  currentEpisode: 0,
  generatingEp: 0,
  analysisText: '',
  episodeTexts: {},
  episodeTitles: {},
  shotStreamText: {},
  shotGenState: {},
  shotWsConnected: {},
  shotMsgCount: {},
  lastUpdated: Date.now(),
};

export const useTaskProgressStore = create<TaskProgressState>()((set, get) => ({
  novels: {},

  setNovelProgress: (novelId, data) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: { ...existing, ...data, lastUpdated: Date.now() },
      },
    };
  }),

  appendAnalysisText: (novelId, text) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          analysisText: existing.analysisText + text,
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  appendEpisodeText: (novelId, epNum, text) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          episodeTexts: {
            ...existing.episodeTexts,
            [epNum]: (existing.episodeTexts[epNum] || '') + text,
          },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setEpisodeTitle: (novelId, epNum, title) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          episodeTitles: { ...existing.episodeTitles, [epNum]: title },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setGeneratingEp: (novelId, epNum) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          generatingEp: epNum,
          episodeTexts: {
            ...existing.episodeTexts,
            [epNum]: existing.episodeTexts[epNum] || '',
          },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  appendShotStreamText: (novelId, episodeId, text) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    const prev = existing.shotStreamText[episodeId] || '';
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotStreamText: { ...existing.shotStreamText, [episodeId]: prev + text },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setShotStreamText: (novelId, episodeId, text) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotStreamText: { ...existing.shotStreamText, [episodeId]: text },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setShotGenState: (novelId, episodeId, shotGenState) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotGenState: { ...existing.shotGenState, [episodeId]: shotGenState },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setShotWsConnected: (novelId, episodeId, connected) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotWsConnected: { ...existing.shotWsConnected, [episodeId]: connected },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  setShotMsgCount: (novelId, episodeId, count) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotMsgCount: { ...existing.shotMsgCount, [episodeId]: count },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  resetShotPanel: (novelId, episodeId) => set((state) => {
    const existing = state.novels[novelId] || { novelId, ...empty };
    return {
      novels: {
        ...state.novels,
        [novelId]: {
          ...existing,
          shotStreamText: { ...existing.shotStreamText, [episodeId]: '' },
          shotGenState: { ...existing.shotGenState, [episodeId]: 'queued' },
          shotWsConnected: { ...existing.shotWsConnected, [episodeId]: false },
          shotMsgCount: { ...existing.shotMsgCount, [episodeId]: 0 },
          lastUpdated: Date.now(),
        },
      },
    };
  }),

  clearNovelProgress: (novelId) => set((state) => {
    const { [novelId]: _, ...rest } = state.novels;
    return { novels: rest };
  }),

  clearAllProgress: () => set({ novels: {} }),

  getNovelProgress: (novelId) => get().novels[novelId],
}));
