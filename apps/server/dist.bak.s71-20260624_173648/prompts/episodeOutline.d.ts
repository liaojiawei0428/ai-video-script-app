/**
 * v2.5.13 - 分集大纲 prompt (风格感知版)
 * 输入: 全文 + 角色 + 风格圣经
 * 输出: JSON { items: [{ episodeNumber, title, summary, keyCharacters, estimatedDuration }] }
 */
export declare const episodeOutlineSystemPrompt: (styleBibleBlock?: string) => string;
export declare function buildEpisodeOutlineUserPrompt(params: {
    novelTitle: string;
    totalChars: number;
    styleName: string;
    characters: {
        name: string;
        role: string;
        description?: string;
    }[];
    fullContent: string;
    styleBibleBlock?: string;
}): string;
