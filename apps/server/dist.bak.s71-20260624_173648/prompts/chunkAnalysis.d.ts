/**
 * v2.5.13 - 分段分析 prompt (风格感知版)
 * 注入风格圣经, 让"角色状态""剧情点"描述都符合所选画风文风
 */
export declare const chunkAnalysisSystemPrompt: (styleBibleBlock?: string) => string;
export declare const chunkAnalysisUserPrompt: (chunkText: string, styleBibleBlock?: string) => string;
