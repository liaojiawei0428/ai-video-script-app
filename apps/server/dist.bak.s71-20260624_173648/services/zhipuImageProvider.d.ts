import { ImageProvider, ImageGenOptions, ImageGenResult } from './imageProvider';
export declare class ZhipuImageProvider implements ImageProvider {
    readonly name = "zhipu-glm-image";
    readonly supportsNegativePrompt = false;
    private apiKey;
    constructor(apiKey?: string);
    generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
