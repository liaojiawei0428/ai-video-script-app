export type ComicLayout = string;
export type ComicStyle = 'realistic_cinematic' | 'chinese_realistic' | 'cyberpunk_realistic' | 'chinese_anime' | 'cg_3d';
export declare const STYLE_SYSTEM: Record<ComicStyle, {
    zh: string;
    en: string;
}>;
export interface ComicShotInput {
    shotNumber: number;
    sceneType: string;
    cameraMove: string;
    visual: string;
    dialogue: string;
    lighting: string;
    colorTone: string;
    audioNote: string;
    imagePrompt: string;
}
export interface ComicCharacterInput {
    name: string;
    description: string;
    visualDna?: string;
    hasSheet?: boolean;
    roleType?: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    referenceSheetUrl?: string;
    appearanceCount?: number;
}
export interface ComicPageInput {
    pageNumber: number;
    totalPages: number;
    episodeTitle: string;
    episodeScript: string;
    shots: ComicShotInput[];
    characters: ComicCharacterInput[];
    style: ComicStyle;
    layout: ComicLayout;
}
/**
 * 从 novelId styleBible 自动推断漫画风格
 */
export declare function inferComicStyle(styleBible: any, userOverride?: ComicStyle): ComicStyle;
/**
 * v2.5.29: 从角色库三视图 prompt 提取"简短身份描述" (用于 prompt 文字部分)
 * 输入: imageVariants[0].prompt (完整 ~2500 字符)
 * 输出: 压缩到 1-2 句的身份描述 (约 200 字符), 用于识别角色
 * 策略: 只保留"脸型+发色+发式+服装+主色" 5 个核心字段
 *       完全删除 "character sheet" "multiple views" 等元指令
 */
export declare function extractShortIdentity(sheetPrompt: string): string;
/**
 * v2.5.29: 选主参考图角色 (出现频次最高 + 是主角)
 * 用于 agnes-image-2.1-flash 的 image_url 字段
 */
export declare function selectMainReferenceCharacter(characters: ComicCharacterInput[]): ComicCharacterInput | null;
/**
 * v2.5.29: 构建 CAST 块 (角色档案 - 简短)
 * 重点: 强调"角色名 = 这段简短的视觉特征", 跟参考图绑定
 * 不堆 DNA, 只用 1 句 + 角色名, 跟参考图解耦 (agness 参考图理解能力强)
 */
export declare function buildCastBlock(characters: ComicCharacterInput[], mainRef: ComicCharacterInput | null): string;
/**
 * v2.5.21: 系统 prompt - 简化, 关键指令放到 user prompt 末尾
 * v2.5.29: 完全英文, 明确"STORY PAGE, not character sheet"
 */
export declare function comicGenerationSystemPrompt(style: ComicStyle, layout: ComicLayout, characters: ComicCharacterInput[]): string;
/**
 * v2.5.29: 用户 prompt - 英文 + 强区分
 * 设计:
 *   1. 头部: 明确 STORY COMIC, NOT character sheet
 *   2. CAST: 简短身份 + 角色名 + 哪个 = reference image
 *   3. PANELS: 每格显式说"STORY SCENE with [Character] doing X in Y"
 *   4. 末尾: 强负面 (NOT a character portrait, NOT a character sheet page)
 */
export declare function comicGenerationUserPrompt(input: ComicPageInput): string;
/**
 * 计算分镜数量对应的漫画布局
 *   ≤4 → 2x2
 *   5-6 → 3x2
 *   7+  → 3x3 (多页, 每页 9 个)
 */
export declare function calculateComicLayout(shotCount: number): {
    layout: ComicLayout;
    shotsPerPage: number;
    totalPages: number;
};
