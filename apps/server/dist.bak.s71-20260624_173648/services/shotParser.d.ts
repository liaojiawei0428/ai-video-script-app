/**
 * 分镜文本解析器
 * 将 AI 生成的自然语言分镜文本解析为结构化字段
 * 格式示例:
 *   【镜头1 | 5秒】
 *   景别: 中景 | 构图: 三分法
 *   运镜: 固定
 *   画面: ...
 *   对白: 【秋霞】"主子..."
 *   灯光: 侧光+暖色轮廓光
 *   色彩: 暖调+低饱和
 *   音效: 远处蝉鸣
 *   转场: 硬切
 *   [image_prompt] 完整英文 prompt
 */
export interface ParsedShot {
    shotNumber: number;
    durationSec: number;
    sceneType: string;
    composition: string;
    cameraMove: string;
    visual: string;
    dialogue: string;
    dialogueLines: Array<{
        character: string;
        line: string;
        emotion?: string;
    }>;
    action: string;
    lighting: string;
    colorTone: string;
    audioNote: string;
    transition: string;
    imagePrompt: string;
    rawText: string;
    isHeader: boolean;
}
/**
 * 解析单个镜头段落
 */
export declare function parseShotSegment(seg: string, index: number): ParsedShot;
/**
 * 判断段落是否是开场白/元数据
 */
export declare function isMetaParagraph(seg: string): boolean;
/**
 * 解析整段 AI 输出
 * 返回结构化分镜列表 (自动过滤开场白)
 */
export declare function parseShotList(rawText: string): ParsedShot[];
/**
 * 按场景分组 (基于 location 字段, 或者从 description 中提取)
 */
export declare function groupShotsByScene(shots: ParsedShot[]): Array<{
    location: string;
    shots: ParsedShot[];
    totalDuration: number;
}>;
