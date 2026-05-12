export interface Novel {
  id: string;
  title: string;
  author: string;
  contentText?: string;
  filePath?: string;
  totalChars: number;
  totalWords: number;
  genre: string;
  theme: string;
  style: string;
  tone: string;
  status: 'pending' | 'analyzing' | 'analyzed' | 'generating' | 'completed' | 'error';
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
  status: 'pending' | 'generating' | 'completed' | 'error';
  createdAt: number;
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
  scenes: Array<{ name: string; description: string; importance: number }>;
  plotPoints: Array<{ chapter: number; description: string; importance: number }>;
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
