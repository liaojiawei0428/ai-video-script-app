/**
 * imagePromptLibrary.ts - v3.0.0.12 SDXL prompt 模板库
 * Source: twri/sdxl_prompt_styler (https://github.com/twri/sdxl_prompt_styler, MIT)
 * Compile: shipin-APP 2026-06-10
 *
 * 第一次出图: 根据 scene_type + style 选最佳模板, 替换 {prompt} 为用户 enPrompt
 * 修改出图: 不再用模板 (见 imageAgentService.confirm finalPrompt)
 */
import { SceneType } from './imagePlanFields';
export interface PromptTemplate {
    id: string;
    name: string;
    scene: SceneType[];
    tags: string[];
    prompt: string;
    negative: string;
}
export declare const PROMPT_TEMPLATES: PromptTemplate[];
export declare const SCENE_TEMPLATES: Record<SceneType, PromptTemplate[]>;
export declare function selectBestTemplate(sceneType: SceneType, styleKeywords: string[]): PromptTemplate;
export declare function applyTemplate(tpl: PromptTemplate, userPrompt: string, userNegative?: string): {
    positive: string;
    negative: string;
};
