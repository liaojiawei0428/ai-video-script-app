export interface ImageConversationRow {
    id: string;
    user_id: string;
    status: string;
    mode: string;
    messages: any;
    plan: any;
    plan_fields: any;
    result_image_url: string | null;
    last_result_url: string | null;
    aspect_ratio: string | null;
    style_id: string | null;
    charged_amount: number;
    error_msg: string | null;
    retry_count: number;
    created_at: number;
    updated_at: number;
}
export interface ImageGenerationRow {
    id: string;
    conversation_id: string;
    prompt: string | null;
    ref_image_urls: any;
    result_url: string | null;
    status: string;
    charged_amount: number;
    error_msg: string | null;
    created_at: number;
}
export declare class ImageConversationModel {
    create(opts: {
        userId: string;
        mode?: string;
    }): Promise<string>;
    findById(id: string): Promise<ImageConversationRow | undefined>;
    findByUserId(userId: string, limit?: number): Promise<ImageConversationRow[]>;
    update(id: string, data: Partial<ImageConversationRow>): Promise<void>;
    delete(id: string): Promise<void>;
}
export declare class ImageGenerationModel {
    create(opts: {
        conversationId: string;
        prompt: string;
        refImageUrls?: string[];
    }): Promise<string>;
    update(id: string, data: Partial<ImageGenerationRow>): Promise<void>;
    findById(id: string): Promise<ImageGenerationRow | undefined>;
    findByConversationId(conversationId: string): Promise<ImageGenerationRow[]>;
}
export declare const imageConversationModel: ImageConversationModel;
export declare const imageGenerationModel: ImageGenerationModel;
