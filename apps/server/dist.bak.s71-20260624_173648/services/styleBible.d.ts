/**
 * 风格圣经 (Style Bible) 系统 — v2.5.13 重构
 *
 * 核心原则: "style-as-suffix" 不起作用, 必须把风格触发词**嵌入场景描写**里。
 *  - 剧本/角色/镜头/图片 prompt 在末尾追加 `<style_name>` 会被模型忽略
 *  - 正确做法: 在场景描写中使用 painterly / anime / cyber / photographic 等具体语言
 *
 * 一份"风格圣经"在所有生成流中作为不可变锚点:
 *  1. 剧本内容生成 (脚本/对话/场景)
 *  2. 角色描述生成
 *  3. 角色三视图生成
 *  4. 剧本场景图片生成
 *  5. 视频生成 (未来)
 */
export type StylePresetId = 'realistic' | 'ancient' | 'cyber' | 'anime' | '3d';
export interface StyleBible {
    version: string;
    styleId: StylePresetId;
    styleName: string;
    styleNameEn: string;
    generatedAt: number;
    generatedBy: 'preset' | 'llm' | 'manual';
    visual: {
        genre_zh: string;
        genre_en: string;
        /** v2.5.13 — 具体到"使用何种绘画/摄影语言描述", 而非简单 "电影写实" */
        renderer_zh: string;
        renderer_en: string;
        quality_zh: string;
        quality_en: string;
        lighting_zh: string;
        lighting_en: string;
        colorStyle_zh: string;
        colorStyle_en: string;
        background_zh: string;
        background_en: string;
        ethnicity: string;
        palette: {
            saturation: 'low' | 'medium' | 'high';
            temperature: 'warm' | 'cool' | 'neutral';
            hexPrimary: string[];
            hexAccent: string[];
        };
        composition: {
            camera_default: string;
            framing: string;
            aspectRatio: string;
        };
        /** v2.5.13 — 风格专属"动作描写"语言, 注入剧本和分镜 prompt */
        motionLanguage_zh: string;
        motionLanguage_en: string;
    };
    fidelityAnchors: {
        zh: string[];
        en: string[];
    };
    contentToAvoid: {
        zh: string[];
        en: string[];
    };
    negativePrompt: string[];
    /** v2.5.13 — 关键短语锚点, 用来"强迫 LLM 在描述中至少使用这些词" */
    styleTriggerWords: {
        zh: string[];
        en: string[];
    };
    voiceAndTone: {
        writingStyle: string;
        narrativeVoice: string;
        emotionalTone: string;
        vocabulary: string;
        dialogueStyle: string;
        sentencePattern: string;
        /** v2.5.13 — 给剧本生成时用, 具体的对白示例 */
        dialogueExample: string;
    };
    rendering: {
        imageEngine: string;
        videoEngine: string;
        referenceStrategy: string;
    };
}
export declare function buildStyleBible(styleId: StylePresetId): StyleBible;
export declare function buildStyleAnchorPrefix(bible: StyleBible, lang?: 'zh' | 'en' | 'both'): string;
export declare function buildStyleNegativePrompt(bible: StyleBible): string;
/**
 * v2.5.13 — 把"风格触发的对白示范 + 文风指南"一并注入, 让 LLM 看一眼就知道
 * 这种风格的对白长什么样。
 */
export declare function buildVoiceAndToneBlock(bible: StyleBible): string;
export declare function buildStyleBibleJsonBlock(bible: StyleBible): string;
export declare function parseStyleBible(json: string | null | undefined): StyleBible | null;
export declare function listStylePresets(): Array<{
    id: StylePresetId;
    name: string;
    nameEn: string;
}>;
