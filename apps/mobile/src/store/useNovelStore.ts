import { create } from 'zustand';
import { Novel, Episode, Character, TaskJob } from '@ai-script/shared-types';

interface NovelState {
  novels: Novel[];
  currentNovel: Novel | null;
  episodes: Episode[];
  characters: Character[];
  currentTask: TaskJob | null;

  setNovels: (novels: Novel[]) => void;
  setCurrentNovel: (novel: Novel | null) => void;
  setEpisodes: (episodes: Episode[]) => void;
  setCharacters: (characters: Character[]) => void;
  setCurrentTask: (task: TaskJob | null) => void;
  addNovel: (novel: Novel) => void;
  updateTaskProgress: (progress: number) => void;
}

export const useNovelStore = create<NovelState>((set) => ({
  novels: [],
  currentNovel: null,
  episodes: [],
  characters: [],
  currentTask: null,

  setNovels: (novels) => set({ novels }),
  setCurrentNovel: (novel) => set({ currentNovel: novel }),
  setEpisodes: (episodes) => set({ episodes }),
  setCharacters: (characters) => set({ characters }),
  setCurrentTask: (task) => set({ currentTask: task }),
  addNovel: (novel) => set((state) => ({ novels: [novel, ...state.novels] })),
  updateTaskProgress: (progress) =>
    set((state) => ({
      currentTask: state.currentTask
        ? { ...state.currentTask, progress }
        : null,
    })),
}));
