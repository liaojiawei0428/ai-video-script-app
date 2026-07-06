/** v3.0.0.28: 100% 原文 passthrough — 不追加任何 quality tags / i2v prefix */
export declare function buildPassthroughPrompt(userText: string): string;
/** v3.0.0.28: i2v modification 100% 原文 passthrough — 不加 [Modification Mode] prefix */
export declare function buildI2VModificationPrompt(userText: string): string;
/** 合并用户负向 + 默认负向 */
export declare function buildNegativePrompt(userNegative: string): string;
/** v3.0.0.28: 完整链路 — 用户原文 → enPrompt + negative (100% passthrough, 不调 LLM) */
export declare function buildFinalEnglishPrompt(userText: string, userNegative?: string): {
    enPrompt: string;
    negative: string;
};
/** 兼容旧调用: PlanFields 不再用, 只取 userText 字段 */
export declare function buildFinalEnglishPromptFromFields(fields: any): Promise<{
    enPrompt: string;
    negative: string;
}>;
/** 兼容旧调用, 默认返回 true (不再做必填字段检查) */
export declare function isCompletePlanFields(_fields: any): boolean;
/** 兼容旧调用, noop */
export declare function expandChineseDescription(_fields: any): Promise<string>;
/** 兼容旧调用, noop */
export declare function translateToEnglishPrompt(_cnDescription: string): Promise<string>;
