/**
 * v2.5.13 - 章节事件图谱 prompt (风格感知版)
 * 输出: JSON { chapters: [{ chapter, title, events: [{ type, summary, characters, importance }] }] }
 */
export declare const plotGraphSystemPrompt: (styleBibleBlock?: string) => string;
export declare function buildPlotGraphUserPrompt(params: {
    novelTitle: string;
    totalChars: number;
    characters: {
        name: string;
        role: string;
    }[];
    fullContent: string;
    styleBibleBlock?: string;
}): string;
