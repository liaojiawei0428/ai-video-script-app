import { ImageProvider, ImageGenOptions, ImageGenResult } from './imageProvider';
export declare class AgnesImageProvider implements ImageProvider {
    readonly name = "agnes-image-2.1-flash";
    readonly supportsNegativePrompt = false;
    private apiKey;
    constructor(apiKey?: string);
    /** v3.0.0.1: 把 /api/agent/uploads/ 本地 URL 读取并转 base64 data URL, agnes 拉不到鉴权 URL 必须内联 */
    private inlineIfLocal;
    generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
