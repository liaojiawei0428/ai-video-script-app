export interface AgnesVideoCreateOptions {
    prompt: string;
    image?: string;
    images?: string[];
    width?: number;
    height?: number;
    numFrames?: number;
    frameRate?: number;
    mode?: 'keyframes';
    negativePrompt?: string;
    seed?: number;
}
export interface AgnesVideoCreateResult {
    taskId: string;
    videoId: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    seconds?: number;
    size?: string;
}
export interface AgnesVideoStatusResult {
    taskId: string;
    videoId: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    /** 视频 URL 字段, 注意: agnes 在 completed 时把 URL 放在 remixed_from_video_id 字段 (反人类) */
    videoUrl?: string;
    error?: string;
}
export declare class AgnesVideoProvider {
    private apiKey;
    constructor(apiKey?: string);
    /** v3.0.0.18: 把 shipin-APP 同源 URL 规范化成相对路径 + 读盘转纯 base64
     *  - web 端可能发 https://ab.maque.uno/api/agent/uploads/... (拼了 origin)
     *  - agens 拿同源 URL 会 401 (没 JWT), 必须转 base64 inline
     *  - agnes video 期待纯 base64 字符串 (不带 data: 前缀) */
    private inlineIfLocal;
    /** 创建视频任务 — 自动重试 503/429/5xx 错误 (backoff 1s → 2s → 4s, 最多 3 次) */
    createTask(opts: AgnesVideoCreateOptions): Promise<AgnesVideoCreateResult>;
    /** 查询任务状态 */
    queryStatus(videoId: string): Promise<AgnesVideoStatusResult>;
}
export declare const agnesVideoProvider: AgnesVideoProvider;
