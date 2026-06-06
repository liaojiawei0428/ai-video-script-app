import type { StyleBible } from '../services/styleBible';

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
  // ── v2.0.0 ──
  styleId?: string;                    // 画风 ID (默认 'realistic')
  /** v2.5.9: 风格圣经（不可变锚点，所有生成流必须引用） */
  styleBible?: StyleBible;
  outlineText?: string;                // 分集大纲 JSON
  outlineConfirmed?: boolean;          // 大纲是否已确认
  outlineConfirmedAt?: number;        // 大纲确认时间
  plotGraph?: string;                  // 事件图谱 JSON
  plotGraphGeneratedAt?: number;       // plotGraph 生成时间
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
  // ── v2.0.0 ──
  imageUrl?: string;                  // 镜头参考图 (base64 或 URL)
  imagePrompt?: string;               // AI 生图 prompt
  imageGeneratedAt?: number;          // 生图时间
  characterIds?: string[];            // 涉及角色 ID
  styleId?: string;                   // 画风 (继承自小说)
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
  // ── v2.0.0 ──
  gender?: string;                    // 别名 '男/女/其他' (移动端用)
  role?: string;                      // 别名 'protagonist/antagonist/...' (移动端用)
  description?: string;               // 11 维度结构化描述 JSON
  extraDescription?: string;          // 4 维度补充描述 JSON
  styleId?: string;                   // 画风 ID
  confirmed?: boolean;                // 用户是否已确认
  confirmedAt?: number;
  imageVariants?: Array<{ angle: string; imageData: string; prompt: string; createdAt: number }>;
  imageGenStatus?: 'none' | 'generating' | 'partial' | 'completed' | 'failed';
  imageGeneratedAt?: number;
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
  phase: 'chunking' | 'analyzing_chunks' | 'merging' | 'final_analysis' | 'character_extracting' | 'generating_episodes' | 'completed' | 'error';
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
  ipLocation?: string;
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

// ════════════════════════════════════════════════════════════
//  v2.0.0 新增类型：角色一致性 + 资产库 + 章节图谱 + 导出
// ════════════════════════════════════════════════════════════

// ── 画风预设 ──

export type StylePresetId = 'realistic' | 'ancient' | 'cyber' | 'anime' | '3d';

/** 画风预设定义（也存于数据库 style_presets 表, 此处为前端常量） */
export interface StylePreset {
  id: StylePresetId;
  name: StylePresetId;
  label: string;
  description: string;
  promptSuffix: string;
  sampleImageUrl?: string;
  isDefault?: boolean;
}

// ── 15 维度角色描述 ──

/** 11 维度基础结构化描述（生成时存, 必填） */
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

/** 4 维度补充描述（生成时存, 可空） */
export interface CharacterExtraDescription {
  relationshipsText: string;
  emotionRange: string;
  actionHabits: string;
  signatureLines: string;
}

/** 角色变体图 */
export interface ImageVariant {
  angle: 'front_bust' | 'side_bust' | 'full_body' | 'sheet';
  url: string;
  prompt: string;
  seed?: number;
  createdAt: number;
}

export type ImageGenStatus = 'none' | 'generating' | 'partial' | 'completed' | 'failed';

// ── 角色 v2.0 扩展字段 ──

export interface CharacterV2Fields {
  description?: CharacterDescription;
  extraDescription?: CharacterExtraDescription;
  styleId?: StylePresetId;
  confirmed?: boolean;
  imageVariants?: ImageVariant[];
  imageGenStatus?: ImageGenStatus;
  confirmedAt?: number;
  imageGeneratedAt?: number;
}

// ── 章节事件图谱 ──

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
  importance: number; // 1-5
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

// ── 分集大纲 ──

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

// ── 导出 ──

export type ExportFormat = 'pdf' | 'docx' | 'md';

export interface ExportOptions {
  episodeId: string;
  format: ExportFormat;
  includeCharacterIntro?: boolean;
  includeShotList?: boolean;
  includeDialogue?: boolean;
  includeAction?: boolean;
}

// ── 资产库 ──

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

// ── 积分订单 ──

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

// ── 小说 v2.0 扩展字段 ──

export interface NovelV2Fields {
  styleId?: StylePresetId;
  plotGraph?: PlotGraph;
  outlineConfirmed?: boolean;
  outlineConfirmedAt?: number;
}

// ── 剧集 v2.0 扩展字段 ──

export interface EpisodeV2Fields {
  outlineText?: string;
  confirmed?: boolean;
  characterDescriptions?: CharacterDescription[];
}

// ── 镜头 v2.0 扩展字段 ──

export interface ShotV2Fields {
  imageUrl?: string;
  characterIds?: string[];
  styleId?: StylePresetId;
  imagePrompt?: string;
  imageGeneratedAt?: number;
}
