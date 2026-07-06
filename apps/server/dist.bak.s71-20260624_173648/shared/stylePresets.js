"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STYLE_ID = exports.STYLE_PRESET_LIST = exports.STYLE_PRESETS = void 0;
exports.getStylePreset = getStylePreset;
exports.getStylePromptSuffix = getStylePromptSuffix;
exports.getStyleLabel = getStyleLabel;
exports.isValidStyleId = isValidStyleId;
exports.STYLE_PRESETS = {
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
exports.STYLE_PRESET_LIST = Object.values(exports.STYLE_PRESETS);
exports.DEFAULT_STYLE_ID = 'realistic';
function getStylePreset(id) {
    if (id && id in exports.STYLE_PRESETS)
        return exports.STYLE_PRESETS[id];
    return exports.STYLE_PRESETS[exports.DEFAULT_STYLE_ID];
}
function getStylePromptSuffix(id) {
    return getStylePreset(id).promptSuffix;
}
function getStyleLabel(id) {
    return getStylePreset(id).label;
}
function isValidStyleId(id) {
    return !!id && id in exports.STYLE_PRESETS;
}
