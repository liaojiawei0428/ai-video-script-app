import { ImageVariant } from '../shared/types';
import { StylePresetId } from '../shared/types';
export interface ImageGenOptions {
    prompt: string;
    negativePrompt?: string;
    styleId?: StylePresetId;
    angle: 'front_bust' | 'side_bust' | 'full_body' | 'sheet' | 'comic';
    width?: number;
    height?: number;
    seed?: number;
    referenceImages?: string[];
}
export interface ImageGenResult {
    url: string;
    seed: number;
    durationMs: number;
}
export interface ImageProvider {
    readonly name: string;
    readonly supportsNegativePrompt: boolean;
    generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
/** 占位 Provider: 生成 SVG data URL */
export declare class PlaceholderImageProvider implements ImageProvider {
    readonly name = "placeholder-svg";
    readonly supportsNegativePrompt = false;
    generate(options: ImageGenOptions): Promise<ImageGenResult>;
}
export declare const imageProvider: ImageProvider;
export declare function getDefaultImageProvider(): ImageProvider;
export declare function registerImageProvider(provider: ImageProvider): void;
/** 一次性生成 3 张变体图 (串行，避免 API 限流) */
export declare function generateThreeVariants(prompt: string, styleId: StylePresetId | undefined, baseSeed?: number): Promise<ImageVariant[]>;
