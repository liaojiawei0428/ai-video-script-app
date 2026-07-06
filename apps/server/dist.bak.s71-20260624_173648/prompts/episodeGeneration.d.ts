/**
 * 剧本生成 prompt (v2.5.13 — 风格感知版)
 * 关键变化: system + user 都接受 styleBible, 把"风格触发词"和"对白示范"
 * 一并注入, 让 LLM 看一眼就知道这种风格的对白长什么样。
 */
export declare const episodeScriptSystemPrompt: (styleBibleBlock?: string, voiceAndToneBlock?: string) => string;
export declare const episodeScriptUserPrompt: (episodeText: string, episodeNumber: number, totalEpisodes: number, characters: string, summary: string, styleBibleBlock?: string, voiceAndToneBlock?: string) => string;
