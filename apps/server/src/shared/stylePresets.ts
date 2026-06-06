// 画风预设常量定义
// 与数据库 style_presets 表保持一致, 此处为前端代码使用
import { StylePreset, StylePresetId } from './types';

export const STYLE_PRESETS: Record<StylePresetId, StylePreset> = {
  realistic: {
    id: 'realistic',
    name: 'realistic',
    label: '写实电影风',
    description: '真人质感, 电影级光影, 写实摄影, 高细节',
    promptSuffix: 'photorealistic, cinematic lighting, high detail, 8K, film grain, DSLR quality, real human skin texture, natural color grading',
    sampleImageUrl: '/static/styles/realistic.png',
    isDefault: true,
  },
  ancient: {
    id: 'ancient',
    name: 'ancient',
    label: '古风水墨',
    description: '中国传统水墨画风格, 飘逸写意, 古韵悠长',
    promptSuffix: 'Chinese ink painting, traditional shuimo style, flowing brushwork, misty mountains, ancient costume, elegant composition, rice paper texture',
    sampleImageUrl: '/static/styles/ancient.png',
  },
  cyber: {
    id: 'cyber',
    name: 'cyber',
    label: '赛博朋克',
    description: '未来科技感, 霓虹灯光, 数字朋克美学',
    promptSuffix: 'cyberpunk aesthetic, neon lights, futuristic, holographic displays, dark urban atmosphere, rain-soaked streets, high-tech low-life',
    sampleImageUrl: '/static/styles/cyber.png',
  },
  anime: {
    id: 'anime',
    name: 'anime',
    label: '动漫风',
    description: '日系动漫插画, 鲜艳色彩, 精致线条',
    promptSuffix: 'anime style illustration, vibrant colors, detailed line art, expressive eyes, cel shading, studio quality, Japanese animation aesthetic',
    sampleImageUrl: '/static/styles/anime.png',
  },
  '3d': {
    id: '3d',
    name: '3d',
    label: '3D 渲染',
    description: '3D 渲染风, Pixar 质感, 半写实卡通',
    promptSuffix: '3D render, Pixar style, soft lighting, subsurface scattering, stylized realism, octane render, depth of field',
    sampleImageUrl: '/static/styles/3d.png',
  },
};

export const STYLE_PRESET_LIST: StylePreset[] = Object.values(STYLE_PRESETS);
export const DEFAULT_STYLE_ID: StylePresetId = 'realistic';

export function getStylePreset(id: string | undefined): StylePreset {
  if (id && id in STYLE_PRESETS) return STYLE_PRESETS[id as StylePresetId];
  return STYLE_PRESETS[DEFAULT_STYLE_ID];
}

export function getStylePromptSuffix(id: string | undefined): string {
  return getStylePreset(id).promptSuffix;
}

export function getStyleLabel(id: string | undefined): string {
  return getStylePreset(id).label;
}

export function isValidStyleId(id: string | undefined): id is StylePresetId {
  return !!id && id in STYLE_PRESETS;
}
