/**
 * imageAgentSystem.ts — v3.0.0.2 生图 Agent system prompt + JSON schema
 *                              v3.0.0.8 改造为通用型 (支持 LOGO/风景/产品/概念图等)
 *
 * 核心规则:
 *   1. **先识别 scene_type** (character/logo/scene/product/concept/other)
 *   2. 不同场景用不同字段子集 (不再硬套人物 10 字段)
 *   3. 只有 subject + style + quality 是软必填, 其它都是 optional
 *   4. 多轮问答 (max 3 轮), 每次只问 1 个最关键的字段
 *   5. 累计满 3 轮强制出 plan_cn_ready
 *   6. 输出严格 JSON, 禁止 thinking/Markdown
 *
 * 借鉴 learningprompt.wiki SD Prompt 基础
 */
import { findFirstMissingField } from './imagePlanFields';
export declare const SYSTEM_PROMPT: string;
/** LLM 输出 schema (v3.0.0.8: 加 scene_type) */
export interface LLMDecisionV2 {
    status: 'clarify' | 'plan_cn_ready';
    missing_field?: string;
    question?: string;
    partial_fields?: Record<string, string>;
    plan_fields?: Record<string, string>;
    aspect_ratio?: '1024x1024' | '1152x768' | '768x1152';
    ref_image_urls?: string[];
}
/** 手动校验 LLMDecisionV2 (替代 zod, v3.0.0.8 加 scene_type) */
export declare function parseLLMDecisionV2(raw: unknown, currentFields: Record<string, string> | null): LLMDecisionV2;
/** 跟踪 plan_fields 累计填了多少必填字段 (v3.0.0.8: 只数 subject + style + quality) */
export declare function countRequiredFilled(fields: Record<string, string> | null | undefined): number;
/** 复用 imagePlanFields.findFirstMissingField */
export { findFirstMissingField };
