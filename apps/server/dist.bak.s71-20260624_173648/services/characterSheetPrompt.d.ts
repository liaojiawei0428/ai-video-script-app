/**
 * 角色三视图提示词生成器 v3.1 (v2.5.13 风格感知重构)
 *
 * 核心改动:
 *  1. prompt_safe_description 作为 primary visual description (LLM 已按风格生成)
 *  2. 结构化字段作为 supplement (补充 LLM 可能遗漏的细节)
 *  3. 删除独立 STYLE_PRESETS, 统一用 styleBible.ts 的完整风格数据
 *  4. 负面提示按风格动态生成 (不再硬编码 anime/cartoon 等互相冲突的词)
 */
import { StyleBible } from './styleBible';
export interface CharacterSheetData {
    name: string;
    gender?: string;
    age?: string;
    height?: string;
    build?: string;
    face?: string;
    skin?: string;
    eyes?: string;
    eyebrows?: string;
    nose?: string;
    lips?: string;
    hair_color?: string;
    hair_style?: string;
    hair_length?: string;
    hair_texture?: string;
    hair_accessories?: string;
    clothing_top?: string;
    clothing_bottom?: string;
    clothing_outer?: string;
    clothing_shoes?: string;
    clothing_underwear?: string;
    clothing_socks?: string;
    accessories_neck?: string;
    accessories_ears?: string;
    accessories_hands?: string;
    accessories_waist?: string;
    accessories_other?: string;
    props?: string;
    distinctive_features?: string;
    do_not_change?: string;
    makeup?: string;
    default_expression?: string;
    emotional_range?: string;
    body_language?: string;
    personality_visual?: string;
    social_class_visual?: string;
    prompt_safe_description?: string;
    negative_prompt_suggestion?: string;
    styleId?: string;
}
export declare function buildCharacterSheetPrompt(data: CharacterSheetData, styleBible?: StyleBible | null): string;
export declare function buildSingleAnglePrompt(data: CharacterSheetData, angle: 'front_bust' | 'side_bust' | 'full_body', styleBible?: StyleBible | null): string;
