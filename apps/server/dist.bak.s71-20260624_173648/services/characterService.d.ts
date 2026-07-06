import { Character, CharacterDescription, StylePresetId, ImageVariant } from '../shared/types';
export interface CharacterDescriptionGenResult {
    total: number;
    succeeded: number;
    failed: number;
    characters: Array<{
        id: string;
        name: string;
        roleType?: string;
        description: CharacterDescription;
        extraDescription: CharacterDescription;
    }>;
}
/**
 * 基于全文摘要, 为小说中所有未确认的角色生成 15 维度结构化描述
 * 仅生成文字, 不生图, 不扣费
 */
export declare function extractDescriptions(novelId: string, fullSummary?: string, novelTitle?: string, styleId?: StylePresetId): Promise<CharacterDescriptionGenResult>;
/**
 * v2.5.35: 把 LLM 误返回的旧 11 字段 JSON (字符串或对象) 归一化为 markdown 文本
 * 输入可能是:
 *   - 字符串: "{\"name\":\"X\",\"age\":\"18\",...}"  (双层转义)
 *   - 对象: {name: "X", age: "18", ...}
 *   - 字符串: {"name":"X",...}  (普通 JSON 字符串)
 * 输出: markdown 文本 "# 基本信息\n- name: X\n- age: 18\n..." 格式
 */
export declare function normalizeOldDescriptionFormat(s: string): string;
/**
 * 用户确认/编辑角色描述
 * @param userEdits 用户编辑的 15 维度 (含 name 必须匹配)
 */
export declare function confirmDescription(characterId: string, userEdits: {
    description: CharacterDescription;
    extraDescription: CharacterDescription;
}): Promise<{
    success: boolean;
    confirmedAt: number;
}>;
export interface ImageGenBatchResult {
    characterId: string;
    characterName: string;
    totalRequested: number;
    totalSucceeded: number;
    totalFailed: number;
    charged: number;
    variants: ImageVariant[];
}
/**
 * 为单个角色生成 3 张变体图 (正面半身/侧面半身/全身)
 * 按张扣费 (成功才扣, 失败不扣)
 */
export declare function generateImageVariants(characterId: string, userId: string, options?: {
    onlyAngles?: Array<'front_bust' | 'side_bust' | 'full_body'>;
}): Promise<ImageGenBatchResult>;
export interface ShotImageGenResult {
    shotId: string;
    imageUrl: string;
    charged: number;
}
/**
 * 为单个镜头生成参考图
 * 选前 2 角色 + 镜头描述合成 prompt
 */
export declare function generateImageForShot(shotId: string, userId: string): Promise<ShotImageGenResult>;
export declare function findCharacterById(characterId: string): Promise<Character | null>;
export declare function listCharactersByNovel(novelId: string): Promise<Character[]>;
