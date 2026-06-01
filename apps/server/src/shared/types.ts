export interface Scene {
  name: string;
  description: string;
  importance: number;
}

export interface PlotPoint {
  chapter: number;
  description: string;
  importance: number;
  type?: 'setup' | 'rising_action' | 'climax' | 'falling_action' | 'resolution';
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  userId?: string;
  contentText?: string;
  filePath?: string;
  totalChars: number;
  totalWords: number;
  genre: string;
  theme: string;
  style: string;
  tone: string;
  scenes?: Scene[];
  plotPoints?: PlotPoint[];
  status: 'pending' | 'analyzing' | 'analyzed' | 'generating' | 'completed' | 'error';
  /** 全文摘要（分块合并后生成，用于剧本生成和重试） */
  fullSummary?: string;
  /** AI分析报告（JSON或文本） */
  analysisReport?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Episode {
  id: string;
  novelId: string;
  episodeNumber: number;
  title: string;
  summary: string;
  durationSec: number;
  sceneLocation: string;
  characters: string[];
  scriptContent: string;
  scriptFormat: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'error';
  createdAt: number;
  updatedAt?: number;
}

export interface Shot {
  id: string;
  episodeId: string;
  shotNumber: number;
  sceneType: 'INT' | 'EXT';
  location: string;
  timeOfDay: '日' | '夜' | '晨' | '昏';
  description: string;
  cameraAngle: string;
  cameraMove: string;
  lighting: string;
  durationSec: number;
  audioNote: string;
  dialogue: string;
  action: string;
  status: 'pending' | 'completed';
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  aliases: string[];
  appearance: string;
  personality: string;
  roleType: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  relationships: Array<{ target: string; relation: string }>;
  referenceImage?: string;
  createdAt: number;
}

export interface TaskJob {
  id: string;
  novelId: string;
  type: 'upload' | 'analyze' | 'episode_generate' | 'shot_generate';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  totalSteps: number;
  currentStep: number;
  resultData?: Record<string, unknown>;
  errorMsg?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface NovelAnalysis {
  genre: string;
  theme: string;
  style: string;
  tone: string;
  characters: Character[];
  scenes: Scene[];
  plotPoints: PlotPoint[];
}

export interface EpisodePlan {
  episodeNumber: number;
  title: string;
  startCharIndex: number;
  endCharIndex: number;
  summary: string;
  estimatedDuration: number;
  keyCharacters: string[];
  keyScenes: string[];
}

// ── 分块系统类型 ──

/** 小说分块 */
export interface Chunk {
  index: number;
  content: string;
  startChar: number;
  endChar: number;
}

/** 单块 AI 分析结果 */
export interface ChunkSummary {
  index: number;
  content: string;
  failed?: boolean;
  error?: string;
}

/** 单块状态（用于前端进度显示） */
export interface ChunkStatus {
  index: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
}

/** 分块进度广播消息 */
export interface ChunkProgress {
  phase: 'chunking' | 'analyzing_chunks' | 'merging' | 'final_analysis' | 'generating_episodes' | 'completed' | 'error';
  current: number;
  total: number;
  unitLabel: string;
  detail?: string;
  chunkStates: ChunkStatus[];
  error?: { step: string; message: string };
  eta?: number;
}

// ── 用户类型 ──

export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  nickname: string;
  avatarUrl: string;
  balance: number;
  totalGenerations: number;
  vipLevel: number;
  vipExpiresAt?: number;
  lastIp?: string;
  role: string;
  createdAt: number;
  updatedAt: number;
}

export interface BillingLog {
  id: string;
  userId: string;
  type: 'charge' | 'consumption' | 'refund';
  amount: number;
  balanceAfter: number;
  novelId?: string;
  description: string;
  wordCount: number;
  createdAt: number;
}

// ── 通用类型 ──

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
