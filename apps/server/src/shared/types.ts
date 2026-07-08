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
  /** v3.0.0.30: 小说原文片段 (含角色描写) — 角色描述生成的核心信息源 */
  novelExcerpts?: string;
  /** AI分析报告（JSON或文本） */
  analysisReport?: string;
  // ── v2.0.0 ──
  styleId?: string;                    // 画风 ID (默认 'realistic')
  /** v2.5.9: 风格圣经（不可变锚点，所有生成流必须引用） */
  styleBible?: StyleBible;
  outlineText?: string;                // 分集大纲 JSON
  outlineConfirmed?: boolean;          // 大纲是否已确认
  outlineConfirmedAt?: number;        // 大纲确认时间
  outlineStatus?: 'pending' | 'generating' | 'completed' | 'failed';  // S72 v3.0.33 P0 #3 修复 (ADR-0002)
  plotGraph?: string;                  // 事件图谱 JSON
  plotGraphGeneratedAt?: number;       // plotGraph 生成时间
  plotGraphStatus?: 'pending' | 'generating' | 'completed' | 'failed';  // S72 v3.0.33 P0 #3 修复 (ADR-0002)
  autoGenerateEpisodes?: boolean;  // S72 v3.0.33 P2 #9 修复 (ADR-0002): 默认 0=不自动触发剧集生成, 用户手动触发
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
  // ── v2.5.19 漫画生成 ──
  comicImageUrl?: string;       // 漫画图 URL (data:image/... 或 http)
  comicGeneratedAt?: number;    // 漫画生成时间戳
  comicLayout?: string;         // '2x2' | '3x2' | '3x3'
  comicTotalPages?: number;     // 漫画总页数
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
  roleType: 'protagonist' | 'major_supporting' | 'minor_supporting' | 'extra' | 'passerby';
  alignment?: string;  // righteous|villain|neutral|ambiguous (v3.0.106 角色分析系统重构)
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
  type: 'upload' | 'analyze' | 'episode_generate' | 'shot_generate' | 'comic_generate';
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
  isFree?: number;          // v3.0.32 BUG-078: 1=免费额度内(0元); 0=实际扣费
  refType?: string;        // v3.0.32 BUG-078: novel_analyze / episode / shot / comic / character_variant / image / video / prompt_optimize / recharge / refund
  refId?: string;          // v3.0.32 BUG-078: 关联 entity id (novel/episode/character/image_generation/video_generation)
  refLabel?: string;       // v3.0.32 BUG-078: 人类可读标签 "小说分析《XXX》" / "分镜 #5" / "角色变体 4 张" / "图片生成"
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

// ── 角色描述 ──

/**
 * 角色描述 (v2.5.34 重构失败回退 - 恢复 v2.5.33 之前的 11 维结构化字段)
 * v2.5.34 曾尝试简化为自由文本 (description + extraDescription), 但 characterService.ts
 * 实际还在用 11 维字段 (makeFallbackDescription), types 简化导致编译失败
 * v3.0.0: 恢复 11 维字段保持向后兼容
 */
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

/**
 * 角色补充描述 (4 维, v2.5.33+)
 * characterService.ts:17 import 此类型, 必须保留
 */
export interface CharacterExtraDescription {
  relationshipsText: string;
  emotionRange: string;
  actionHabits: string;
  signatureLines: string;
}

/** 角色变体图 */
export interface ImageVariant {
  angle: 'front_bust' | 'side_bust' | 'full_body' | 'sheet' | 'comic';
  url: string;
  prompt: string;
  seed?: number;
  createdAt: number;
}

export type ImageGenStatus = 'none' | 'generating' | 'partial' | 'completed' | 'failed';

// ── 角色 v2.0 扩展字段 ──

export interface CharacterV2Fields {
  description?: CharacterDescription;
  extraDescription?: CharacterExtraDescription;  // 4 维补充描述 (relationshipsText / emotionRange / actionHabits / signatureLines)
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

// ════════════════════════════════════════════════════════════
//  v3.0.0 新增类型：Agent 矩阵 (3 个 Agent 板块 + 消息 parts 数组)
//  借鉴 Vercel AI SDK UIMessage.parts + LobeChat Agent Builder
//  详细设计: docs/V3_AGENT_MATRIX.md §0.5
// ════════════════════════════════════════════════════════════

/** 方案数据 (生图 plan_ready / 视频 plan_ready 时用) */
export interface PlanData {
  prompt: string;                  // 英文 prompt, 用于调 agnes
  aspectRatio?: string;            // 生图用 (如 "1024x1024")
  style?: string;                  // 生图用 (写实/动漫/3D/油画)
  refImageUrls?: string[];         // 参考图 URL 列表
  durationSec?: number;            // 视频用 (5/10/15)
  width?: number;                  // 视频用 (如 1152)
  height?: number;                 // 视频用 (如 768)
  fps?: number;                    // 视频用 (默认 24)
  estimatedCost?: number;          // 估算费用 (元)
  // v3.0.58 (BUG-128 followup): 跨端 1:1 镜像 (server + web + mobile PlanData 同步)
  negativePrompt?: string;         // 排除内容 (三视图展示/走样/低质量 等), 默认模板来自 server DEFAULT_NEGATIVE_PROMPT_VIDEO
  refImageCount?: number;          // 参考图数量 (UI 显示用, 让用户知道"模型看图, 文字只补动态")
}

/** 询问数据 (LLM 引导用户时用) */
export interface QuestionData {
  question: string;
  options?: Array<{ label: string; value: string }>;
  defaultValue?: string;
}

/** 消息 part 类型 (借鉴 Vercel AI SDK UIMessage.parts) */
export type AgentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; role: 'reference' | 'result' }
  | { type: 'plan'; data: PlanData }
  | { type: 'question'; data: QuestionData }
  | { type: 'progress'; value: number; label?: string }   // 视频进度 0-100
  | { type: 'video'; url: string; duration: number }
  | { type: 'error'; message: string };

/** Agent 消息 (V3.0.0 新格式) - 单气泡可混合多 part */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentPart[];
  metadata?: { taskId?: string; stage?: string };
  createdAt: number;
}

/** Agent 会话状态机 (V3.0.0.2 12 态) - 借鉴 Vercel tool state machine */
export type AgentConversationStatus =
  | 'idle'                      // 初始
  | 'ai_clarifying'             // AI 在问澄清问题 (LLM 思考中)
  | 'awaiting_clarification'    // 等用户回答
  | 'ai_planning'               // AI 在生成方案 (LLM 思考中)
  | 'plan_cn_ready'             // v3.0.0.2: 中文方案就绪 (10 字段), 等用户确认/改字段
  | 'plan_translating'          // v3.0.0.2: LLM 翻译中文→英文 prompt 中
  | 'plan_ready'                // 英文 prompt 就绪, 等用户最终确认
  | 'awaiting_confirmation'     // 等用户点"确认生成"
  | 'tool_queued'               // 已调 Agnes, 拿 taskId, 等待执行
  | 'tool_executing'            // 任务执行中 (WS 推送 progress)
  | 'tool_completed'            // 完成
  | 'tool_throttled'            // 限流暂停 (v3.0.0 加: 429 持续失败 5 次后, 留 manual retry 余地)
  | 'tool_failed';              // 失败 (可重试, 最多 3 次)

/** WebSocket 任务消息 (V3.0.0 typed 协议 - 借鉴 ComfyUI + Vercel) */
export type WSTaskMessage =
  | { type: 'task_update'; task: { id: string; status: 'queued' | 'in_progress'; progress: number; message?: string } }
  | { type: 'task_completed'; task: { id: string; resultUrl: string; metadata?: Record<string, unknown> } }
  | { type: 'task_failed'; task: { id: string; error: string; retryable: boolean } };

/** Agent 业务类型 (前端路由判别用) */
export type AgentBusinessType = 'text' | 'image' | 'video';
