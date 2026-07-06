/**
 * 分镜生成 prompt (v2.5.13 — 风格感知版)
 * 关键: 镜头描述本身就是"画面", 必须按所选画风的渲染语言来写
 *  - 古风: 湿墨晕染, 留白, 矿物颜料, 不用 "三点布光/浅景深"
 *  - 动漫: 赛璐璐, 平涂, 速度线, 不用 "皮肤毛孔/HDRI"
 *  - 赛博: 霓虹边缘光, 全息, 雨夜反射, 不用 "暖色烛光"
 *  - 写实: 85mm, 三点布光, 胶片, 不用 "动漫赛璐璐"
 *  - 3D: HDRI, SSS, PBR, 不用 "真人摄影"
 */
export declare const shotGenerationSystemPrompt: (styleBibleBlock?: string, voiceAndToneBlock?: string) => string;
export declare const shotGenerationUserPrompt: (scriptContent: string, characters: string, scenes: string, styleBibleBlock?: string, voiceAndToneBlock?: string) => string;
