/**
 * v2.5.13 - 段落合并 prompt (风格感知版)
 * 注入风格圣经, 让全文概要也保持所选画风的文风
 */
export declare const chunkMergeSystemPrompt: (styleBibleBlock?: string) => string;
export declare const chunkMergeUserPrompt: (summariesText: string, styleBibleBlock?: string) => string;
