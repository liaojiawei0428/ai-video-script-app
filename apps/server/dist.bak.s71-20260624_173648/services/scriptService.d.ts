import { TaskJob } from '../shared/types';
export declare class ScriptService {
    generateEpisodes(novelId: string, targetDuration?: number, tolerance?: number): Promise<TaskJob>;
    /**
     * 继续生成：从已有 N 集继续生成后续集
     * 适用于：余额不足中断后充值、用户主动中断后恢复
     */
    continueEpisodeGeneration(novelId: string, targetDuration?: number): Promise<TaskJob>;
    private executeEpisodeGeneration;
    /** 按段落分割小说（保留自然断点） */
    private splitParagraphs;
    /** 从 ID 列表中找语义切分点（LumberChunker 风格） */
    private findSemanticBoundary;
    /** AI 剧集规划：返回集数+剧情大阶段 */
    private aiEpisodePlan;
    /** 构建分集计划（公式预估边界 + 语义微调） */
    private buildEpisodePlans;
    /** 生成单集剧本流 */
    private generateEpisodeStream;
    /** 构建滚动状态卡 */
    private buildStateCard;
    /** 从已生成的剧本中提取角色状态变化 */
    private updateCharacterStatesSync;
    /** 提取未解决伏笔 */
    private extractUnresolvedHooks;
    /**
     * P1: 压缩最近 N 集剧本结尾为短摘要 (滚动剧情摘要)
     * 用于注入后续 LLM 调用，保证长距离剧情连贯
     */
    private summarizeRecentScripts;
    regenerateEpisode(episodeId: string): Promise<TaskJob>;
    private executeEpisodeRegeneration;
    generateShots(episodeId: string): Promise<TaskJob>;
    private executeShotGeneration;
    private generateShotImagesAsync;
}
export declare const scriptService: ScriptService;
