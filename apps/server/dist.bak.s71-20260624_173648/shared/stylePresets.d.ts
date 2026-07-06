import { StylePreset, StylePresetId } from './types';
export declare const STYLE_PRESETS: Record<StylePresetId, StylePreset>;
export declare const STYLE_PRESET_LIST: StylePreset[];
export declare const DEFAULT_STYLE_ID: StylePresetId;
export declare function getStylePreset(id: string | undefined): StylePreset;
export declare function getStylePromptSuffix(id: string | undefined): string;
export declare function getStyleLabel(id: string | undefined): string;
export declare function isValidStyleId(id: string | undefined): id is StylePresetId;
