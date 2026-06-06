import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  lastUpdated: number;
}

interface TaskProgressState {
  novels: Record<string, NovelProgress>;
  setNovelProgress: (novelId: string, data: Partial<NovelProgress>) => void;
  appendAnalysisText: (novelId: string, text: string) => void;
  appendEpisodeText: (novelId: string, epNum: number, text: string) => void;
  setEpisodeTitle: (novelId: string, epNum: number, title: string) => void;
  setGeneratingEp: (novelId: string, epNum: number) => void;
  clearNovelProgress: (novelId: string) => void;
  clearAllProgress: () => void;
  getNovelProgress: (novelId: string) => NovelProgress | undefined;
}

export const useTaskProgressStore = create<TaskProgressState>()(
  persist(
    (set, get) => ({
      novels: {},

      setNovelProgress: (novelId, data) => set((state) => {
        const existing = state.novels[novelId] || {
          novelId,
          novelTitle: '',
          status: 'pending',
          progress: 0,
          totalEpisodes: 0,
          currentEpisode: 0,
          generatingEp: 0,
          analysisText: '',
          episodeTexts: {},
          episodeTitles: {},
          lastUpdated: Date.now(),
        };
        return {
          novels: {
            ...state.novels,
            [novelId]: { ...existing, ...data, lastUpdated: Date.now() },
          },
        };
      }),

      appendAnalysisText: (novelId, text) => set((state) => {
        const existing = state.novels[novelId] || {
          novelId,
          novelTitle: '',
          status: 'pending',
          progress: 0,
          totalEpisodes: 0,
          currentEpisode: 0,
          generatingEp: 0,
          analysisText: '',
          episodeTexts: {},
          episodeTitles: {},
          lastUpdated: Date.now(),
        };
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
        const existing = state.novels[novelId] || {
          novelId,
          novelTitle: '',
          status: 'pending',
          progress: 0,
          totalEpisodes: 0,
          currentEpisode: 0,
          generatingEp: 0,
          analysisText: '',
          episodeTexts: {},
          episodeTitles: {},
          lastUpdated: Date.now(),
        };
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
        const existing = state.novels[novelId] || {
          novelId,
          novelTitle: '',
          status: 'pending',
          progress: 0,
          totalEpisodes: 0,
          currentEpisode: 0,
          generatingEp: 0,
          analysisText: '',
          episodeTexts: {},
          episodeTitles: {},
          lastUpdated: Date.now(),
        };
        return {
          novels: {
            ...state.novels,
            [novelId]: {
              ...existing,
              episodeTitles: {
                ...existing.episodeTitles,
                [epNum]: title,
              },
              lastUpdated: Date.now(),
            },
          },
        };
      }),

      setGeneratingEp: (novelId, epNum) => set((state) => {
        const existing = state.novels[novelId] || {
          novelId,
          novelTitle: '',
          status: 'pending',
          progress: 0,
          totalEpisodes: 0,
          currentEpisode: 0,
          generatingEp: 0,
          analysisText: '',
          episodeTexts: {},
          episodeTitles: {},
          lastUpdated: Date.now(),
        };
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

      clearNovelProgress: (novelId) => set((state) => {
        const { [novelId]: _, ...rest } = state.novels;
        return { novels: rest };
      }),

      clearAllProgress: () => set({ novels: {} }),

      getNovelProgress: (novelId) => get().novels[novelId],
    }),
    {
      name: 'ai-script-task-progress',
      partialize: (state) => ({
        novels: Object.fromEntries(
          Object.entries(state.novels).map(([id, data]) => [id, {
            ...data,
            episodeTexts: Object.fromEntries(
              Object.entries(data.episodeTexts).map(([ep, text]) => [ep, text.slice(-50000)])
            ),
            analysisText: data.analysisText.slice(-100000),
          }])
        ),
      }),
    }
  )
);
