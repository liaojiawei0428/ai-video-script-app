import { AgentMessage, AgentPart, AgentConversationStatus } from '../shared/types';
export declare class VideoAgentService {
    createConversation(userId: string): Promise<{
        conversationId: string;
        welcome: AgentMessage;
    }>;
    /**
     * v3.0.0.14 极简 passthrough — 不调 LLM
     *   - 拿用户原文 + 末尾 quality tags
     *   - 直接 plan_ready (视频没有"中文方案"概念, 第一轮直接出)
     *   - aspectRatio 独立参数
     */
    processTurn(conversationId: string, userInputParts: AgentPart[], aspectRatioFromClient?: string, durationSecFromClient?: number): Promise<{
        conversationId: string;
        aiMessage: AgentMessage;
        status: AgentConversationStatus;
    }>;
    confirm(conversationId: string): Promise<{
        taskId: string;
        videoId: string;
        status: 'queued' | 'failed';
        error?: string;
    }>;
    /**
     * v3.0.0.26 (S45): 后台跑 createTask + 失败回滚 + 持久化 + startPolling
     * 从 confirm() 拆出来, fire-and-forget. 不阻塞 HTTP 响应.
     */
    private runCreateTaskInBackground;
    /** 后台轮询 — 起步 5s, 失败 backoff 到 30s 上限, 连续失败 5 次暂停 */
    private startPolling;
    /** v3.0.0.1: 把 video 从 agens 拉到 shipin-APP 本地, 用户从本地磁盘读, 跳过外网
     *  - 文件名: 跟 googleapis URL 末段一致 (含 .mp4)
     *  - 存到: ${UPLOAD_DIR}/videos/{userId}/{filename}
     *  - 写 DB 字段: local_video_path 相对路径
     *  - 失败不阻塞, 业务侧 fallback 到 result_video_url (agens URL) */
    private cacheVideoToLocal;
}
export declare const videoAgentService: VideoAgentService;
