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
    styleId?: string;
    /** v2.5.9: 风格圣经（不可变锚点，所有生成流必须引用） */
    styleBible?: StyleBible;
    outlineText?: string;
    outlineConfirmed?: boolean;
    outlineConfirmedAt?: number;
    plotGraph?: string;
    plotGraphGeneratedAt?: number;
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
    comicImageUrl?: string;
    comicGeneratedAt?: number;
    comicLayout?: string;
    comicTotalPages?: number;
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
    imageUrl?: string;
    imagePrompt?: string;
    imageGeneratedAt?: number;
    characterIds?: string[];
    styleId?: string;
}
export interface Character {
    id: string;
    novelId: string;
    name: string;
    aliases: string[];
    appearance: string;
    personality: string;
    roleType: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    relationships: Array<{
        target: string;
        relation: string;
    }>;
    referenceImage?: string;
    gender?: string;
    role?: string;
    description?: string;
    extraDescription?: string;
    styleId?: string;
    confirmed?: boolean;
    confirmedAt?: number;
    imageVariants?: Array<{
        angle: string;
        imageData: string;
        prompt: string;
        createdAt: number;
    }>;
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
    error?: {
        step: string;
        message: string;
    };
    eta?: number;
}
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
    isFree?: number;
    refType?: string;
    refId?: string;
    refLabel?: string;
    createdAt: number;
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
export type PlotEventType = 'setup' | 'rising_action' | 'climax' | 'falling_action' | 'resolution' | 'turning_point';
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
export type ExportFormat = 'pdf' | 'docx' | 'md';
export interface ExportOptions {
    episodeId: string;
    format: ExportFormat;
    includeCharacterIntro?: boolean;
    includeShotList?: boolean;
    includeDialogue?: boolean;
    includeAction?: boolean;
}
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
export interface NovelV2Fields {
    styleId?: StylePresetId;
    plotGraph?: PlotGraph;
    outlineConfirmed?: boolean;
    outlineConfirmedAt?: number;
}
export interface EpisodeV2Fields {
    outlineText?: string;
    confirmed?: boolean;
    characterDescriptions?: CharacterDescription[];
}
export interface ShotV2Fields {
    imageUrl?: string;
    characterIds?: string[];
    styleId?: StylePresetId;
    imagePrompt?: string;
    imageGeneratedAt?: number;
}
/** 方案数据 (生图 plan_ready / 视频 plan_ready 时用) */
export interface PlanData {
    prompt: string;
    aspectRatio?: string;
    style?: string;
    refImageUrls?: string[];
    durationSec?: number;
    width?: number;
    height?: number;
    fps?: number;
    estimatedCost?: number;
}
/** 询问数据 (LLM 引导用户时用) */
export interface QuestionData {
    question: string;
    options?: Array<{
        label: string;
        value: string;
    }>;
    defaultValue?: string;
}
/** 消息 part 类型 (借鉴 Vercel AI SDK UIMessage.parts) */
export type AgentPart = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    url: string;
    role: 'reference' | 'result';
} | {
    type: 'plan';
    data: PlanData;
} | {
    type: 'question';
    data: QuestionData;
} | {
    type: 'progress';
    value: number;
    label?: string;
} | {
    type: 'video';
    url: string;
    duration: number;
} | {
    type: 'error';
    message: string;
};
/** Agent 消息 (V3.0.0 新格式) - 单气泡可混合多 part */
export interface AgentMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts: AgentPart[];
    metadata?: {
        taskId?: string;
        stage?: string;
    };
    createdAt: number;
}
/** Agent 会话状态机 (V3.0.0.2 12 态) - 借鉴 Vercel tool state machine */
export type AgentConversationStatus = 'idle' | 'ai_clarifying' | 'awaiting_clarification' | 'ai_planning' | 'plan_cn_ready' | 'plan_translating' | 'plan_ready' | 'awaiting_confirmation' | 'tool_queued' | 'tool_executing' | 'tool_completed' | 'tool_throttled' | 'tool_failed';
/** WebSocket 任务消息 (V3.0.0 typed 协议 - 借鉴 ComfyUI + Vercel) */
export type WSTaskMessage = {
    type: 'task_update';
    task: {
        id: string;
        status: 'queued' | 'in_progress';
        progress: number;
        message?: string;
    };
} | {
    type: 'task_completed';
    task: {
        id: string;
        resultUrl: string;
        metadata?: Record<string, unknown>;
    };
} | {
    type: 'task_failed';
    task: {
        id: string;
        error: string;
        retryable: boolean;
    };
};
/** Agent 业务类型 (前端路由判别用) */
export type AgentBusinessType = 'text' | 'image' | 'video';
