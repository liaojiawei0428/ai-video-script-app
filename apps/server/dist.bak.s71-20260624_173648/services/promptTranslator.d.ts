/**
 * 把中文角色视觉描述翻译成专业英文 prompt (给 agens image model 用)
 * @param zhText 中文角色描述 (来自 UI prompt_safe_description 或 LLM generate 的中文)
 * @returns 英文 prompt 字符串 (保留 trigger 词)
 */
export declare function translateCharacterDescriptionToEnglish(zhText: string): Promise<string>;
