export interface VideoConversationRow {
    id: string;
    user_id: string;
    status: string;
    mode: string;
    messages: any;
    plan: any;
    result_video_url: string | null;
    local_video_path: string | null;
    last_result_url: string | null;
    duration_sec: number;
    resolution: string | null;
    fps: number;
    task_id: string | null;
    video_id: string | null;
    retry_count: number;
    charged_amount: number;
    billing_status: string;
    error_msg: string | null;
    created_at: number;
    updated_at: number;
}
export interface VideoGenerationRow {
    id: string;
    conversation_id: string;
    prompt: string | null;
    ref_image_urls: any;
    result_url: string | null;
    status: string;
    duration_sec: number | null;
    resolution: string | null;
    charged_amount: number;
    error_msg: string | null;
    created_at: number;
}
export declare class VideoConversationModel {
    create(opts: {
        userId: string;
        mode?: string;
    }): Promise<string>;
    findById(id: string): Promise<VideoConversationRow | undefined>;
    findByUserId(userId: string, limit?: number): Promise<VideoConversationRow[]>;
    update(id: string, data: Partial<VideoConversationRow>): Promise<void>;
    delete(id: string): Promise<void>;
}
export declare class VideoGenerationModel {
    create(opts: {
        conversationId: string;
        prompt: string;
        refImageUrls?: string[];
        durationSec?: number;
        resolution?: string;
    }): Promise<string>;
    update(id: string, data: Partial<VideoGenerationRow>): Promise<void>;
    findById(id: string): Promise<VideoGenerationRow | undefined>;
}
export declare const videoConversationModel: VideoConversationModel;
export declare const videoGenerationModel: VideoGenerationModel;
