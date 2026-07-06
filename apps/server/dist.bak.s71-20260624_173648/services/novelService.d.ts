import { Novel, TaskJob } from '../shared/types';
export declare class NovelService {
    private static cancelledNovels;
    static markCancelled(novelId: string): void;
    static isCancelled(novelId: string): boolean;
    static clearCancelled(novelId: string): void;
    /**
     * v2.5.10 公开：从 analysis_report 文本中解析角色列表
     * 兼容 4 种区段头: "🎭 角色分析：" / "🎭 分析：" / "角色分析：" / "分析："
     * 兼容 LLM 偶尔漏冒号: "外貌 " / "性格 " / "类型 "
     */
    /**
     * v2.5.14: 从分析报告中解析角色详细描述 (37 字段格式)
     * 返回值包含完整的 description JSON, 不再只是 appearance/personality 简单字段
     */
    static parseCharactersFromReport(fullContent: string): Array<{
        name: string;
        appearance: string;
        personality: string;
        roleType: string;
        description: Record<string, any>;
    }>;
    /**
     * v2.5.10: 回填 - 从已有 analysis_report 重新解析并创建角色（不重跑 LLM）
     * 用于修复历史 novel（如 33ca8e0a）的角色库为空问题
     */
    backfillCharactersFromReport(novelId: string): Promise<{
        created: number;
        total: number;
        alreadyExisted: number;
        descriptionsGenerated: number;
    }>;
    createNovel(title: string, author: string, filePath: string, userId?: string, styleId?: string): Promise<Novel>;
    analyzeNovel(novelId: string): Promise<TaskJob>;
    private executeAnalysis;
    /**
     * 短篇小说（<=80K）直接流式分析，不走分块管道
     */
    private streamAnalysis;
    /**
     * 解析 AI 分析结果并保存到数据库
     */
    private parseAndSave;
    getNovel(novelId: string): Promise<Novel | undefined>;
    listNovels(): Promise<Novel[]>;
    deleteNovel(novelId: string): Promise<void>;
}
export declare const novelService: NovelService;
