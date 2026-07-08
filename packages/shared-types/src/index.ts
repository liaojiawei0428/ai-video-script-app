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
  fullSummary?: string;
  analysisReport?: string;
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
  roleType: 'protagonist' | 'major_supporting' | 'minor_supporting' | 'extra' | 'passerby';
  alignment?: string;  // righteous|villain|neutral|ambiguous
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

// ════════════════════════════════════════════════════════════
//  v2.0.0 新增类型: 角色一致性 + 资产库 + 章节图谱
// ════════════════════════════════════════════════════════════

// 画风预设
export type StylePresetId = 'realistic' | 'ancient' | 'cyber' | 'anime' | '3d';

export interface StylePreset {
  id: StylePresetId;
  name: StylePresetId;
  label: string;
  description: string;
  promptSuffix: string;
  sampleImageUrl?: string;
  isDefault?: boolean;
}

// 11 维度基础结构化描述
export interface CharacterDescription {
  name: string;
  age: string;
  height: string;
  build: string;
  face: string;
  features: string;
  hair: string;
  signature: string;
  clothes: string;
  personality: string;
  aliases: string[];
}

// 4 维度补充描述
export interface CharacterExtraDescription {
  relationshipsText: string;
  emotionRange: string;
  actionHabits: string;
  signatureLines: string;
}

// 角色变体图
export interface ImageVariant {
  angle: 'front_bust' | 'side_bust' | 'full_body';
  url: string;
  prompt: string;
  seed?: number;
  createdAt: number;
}

export type ImageGenStatus = 'none' | 'generating' | 'partial' | 'completed' | 'failed';

// 角色 v2.0 扩展 (Character 已有, 这里加可选字段)
declare module './index' {
  interface Character {
    description?: CharacterDescription;
    extraDescription?: CharacterExtraDescription;
    styleId?: StylePresetId;
    confirmed?: boolean;
    imageVariants?: ImageVariant[];
    imageGenStatus?: ImageGenStatus;
    confirmedAt?: number;
    imageGeneratedAt?: number;
  }
}

// 章节事件图谱
export type PlotEventType =
  | 'setup'
  | 'rising_action'
  | 'climax'
  | 'falling_action'
  | 'resolution'
  | 'turning_point';

export interface PlotGraphEvent {
  type: PlotEventType;
  summary: string;
  characters: string[];
  importance: number;
}

export interface PlotGraphChapter {
  chapter: number;
  title: string;
  events: PlotGraphEvent[];
}

export interface PlotGraph {
  chapters: PlotGraphChapter[];
  generatedAt: number;
}

// 分集大纲
export interface EpisodeOutlineItem {
  episodeNumber: number;
  title: string;
  summary: string;
  keyCharacters: string[];
  estimatedDuration: number;
}

export interface EpisodeOutline {
  novelId: string;
  items: EpisodeOutlineItem[];
  generatedAt: number;
  confirmedAt?: number;
}

// 导出
export type ExportFormat = 'pdf' | 'docx' | 'md';

export interface ExportOptions {
  episodeId: string;
  format: ExportFormat;
  includeCharacterIntro?: boolean;
  includeShotList?: boolean;
  includeDialogue?: boolean;
  includeAction?: boolean;
}

// 资产库
export type AssetType = 'character' | 'scene' | 'prop' | 'costume';

export interface Asset {
  id: string;
  novelId: string;
  type: AssetType;
  name: string;
  description?: Record<string, unknown>;
  styleId?: StylePresetId;
  referenceImage?: string;
  createdAt: number;
}

// 积分订单
export type PointsOrderType = 'recharge' | 'consumption' | 'refund';
export type PointsOrderStatus = 'pending' | 'paid' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface PointsOrder {
  id: string;
  userId: string;
  type: PointsOrderType;
  amount: number;
  status: PointsOrderStatus;
  paymentMethod?: string;
  transactionId?: string;
  relatedId?: string;
  remark?: string;
  createdAt: number;
  completedAt?: number;
}

// Novel/Episode/Shot v2.0 扩展 (在原接口加可选字段)
declare module './index' {
  interface Novel {
    styleId?: StylePresetId;
    plotGraph?: PlotGraph;
    outlineConfirmed?: boolean;
    outlineConfirmedAt?: number;
  }
  interface Episode {
    outlineText?: string;
    confirmed?: boolean;
    characterDescriptions?: CharacterDescription[];
  }
  interface Shot {
    imageUrl?: string;
    characterIds?: string[];
    styleId?: StylePresetId;
    imagePrompt?: string;
    imageGeneratedAt?: number;
  }
}
