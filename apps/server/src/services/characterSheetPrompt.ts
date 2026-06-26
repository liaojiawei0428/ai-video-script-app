// apps/server/src/services/characterSheetPrompt.ts
// v3.0.0.40 BUG-105 重写: 不用 37 字段限制, 完全用 description 自由文本拼 prompt
//
// 之前 (v2.5.13 → v2.5.14): CharacterSheetData 37 字段 (face/eyes/eyebrows/nose/lips/hair_*/clothing_*/...)
//   buildEnglishVisualDescription 按 37 字段拼 visual, buildChineseVisualDescription 同样
//   → 跟 user 明确"必须基于剧情内容来描述, 不得乱写" 冲突 (逼 LLM 填不存在的字段)
//   → 生图 prompt 跟 description 实际内容脱节
//
// 现在 (v3.0.0.40): CharacterSheetData 删 37 字段, 保留 4 个核心字段:
//   - name: 角色名
//   - styleId: 画风 (realistic/ancient/cyber/anime/3d)
//   - visualDescription: 主要视觉描述 (从 description 提取的 Markdown 自由文本)
//     ↑ 这个已经是 characterService 翻译后的英文 (中文→英文 promptTranslator.ts 翻译)
//   - gender: 性别 (兜底字段, 兼容性保留)
//
// 生图 prompt 直接用 visualDescription 自由文本, 不再按 37 字段拼装
// 跟 description 内容 1:1 对齐, 跟 user "根据剧情内容" 100% 一致

import { StyleBible, StylePresetId, buildStyleNegativePrompt } from './styleBible';

export interface CharacterSheetData {
  /** 角色名 */
  name: string;
  /** 画风 ID (realistic / ancient / cyber / anime / 3d) */
  styleId?: string;
  /**
   * v3.0.0.40 BUG-105: 主要视觉描述 (Markdown 自由文本)
   * 来自 characterService.generateImageVariants 翻译后的英文
   * (原文: characters.description 字段, characterDescription.ts 新版 prompt 生成的 Markdown 5 section)
   */
  visualDescription?: string;
  /** 性别 (兜底字段, 兼容性保留) */
  gender?: string;
}

const CONSISTENCY_KEYWORDS_EN = [
  'same character across all views',
  'identical face identity',
  'consistent character identity',
  'same person in all three views',
  'no identity change',
  'no face change',
  'same hairstyle, same clothes, same accessories in every view',
  'character sheet, turnaround, multiple views of the same person',
];

const CONSISTENCY_KEYWORDS_ZH = [
  '同一人物',
  '相同面容',
  '三视图保持绝对一致的身份特征',
  '不要改变人物形象',
  '同一发型、同一服装、同一配饰贯穿三视图',
];

/**
 * v3.0.0.40 BUG-105: 动态负面提示 (按风格排除, 不硬编码互相冲突的词)
 */
function buildDynamicNegativeKeywords(styleId?: string): string[] {
  const base = [
    'different person', 'inconsistent face', 'identity change', 'face change',
    'extra limbs', 'extra arms', 'extra legs', 'extra fingers',
    'deformed face', 'bad anatomy', 'mutated', 'disfigured',
    'blurry', 'low quality', 'low resolution', 'jpeg artifacts',
    'watermark', 'text', 'logo', 'signature', 'frame', 'border',
    'cropped', 'out of frame', 'duplicate', 'clone', 'split image',
    'multiple people', 'two people', 'group',
    'background scenery', 'busy background',
    'nudity', 'nsfw', 'bad hands', 'fused fingers', 'too many fingers',
  ];

  // 按风格排除对立风格的关键词
  switch (styleId) {
    case 'anime':
      return [...base, 'photorealistic, realistic, photo, 3d render, skin pores, subsurface scattering, bokeh, film grain, ink wash, watercolor'];
    case 'ancient':
      return [...base, 'modern, contemporary, neon, LED, electric, cyberpunk, western clothing, suits, ties, photorealistic, 8k uhd, anime, cartoon'];
    case 'cyber':
      return [...base, 'ancient, traditional, hanfu, pastoral, warm tone, sunset, candlelight, ink wash, anime'];
    case 'realistic':
      return [...base, 'anime, cartoon, chibi, illustration, painting, sketch, cyberpunk, neon, ink wash, watercolor'];
    case '3d':
      return [...base, 'anime, hand-drawn, illustration, real photography, ink wash, watercolor, pixel art'];
    default:
      return base;
  }
}

/**
 * v3.0.0.40 BUG-105: 主要 visual block 直接用 visualDescription 自由文本
 * 之前: buildEnglishVisualDescription 按 37 字段拼装, 跟 description 脱节
 * 现在: 完全用 characterDescription.ts 生成的 Markdown 内容, 1:1 对齐
 */
function buildPrimaryVisualBlock(data: CharacterSheetData): string {
  if (data.visualDescription) {
    return data.visualDescription;
  }
  // 兜底: 没有 visualDescription 时, 退到只描述"角色名 + 性别" (避免空 prompt)
  const fallback: string[] = [];
  if (data.gender) {
    fallback.push(`a ${data.gender === '男' ? 'male' : 'female'} character`);
  }
  if (data.name) {
    fallback.push(`named ${data.name}`);
  }
  return fallback.join(', ') || 'a character';
}

/**
 * v3.0.0.40 BUG-105: 拼三视图 prompt (完全用 description 自由文本)
 */
export function buildCharacterSheetPrompt(data: CharacterSheetData, styleBible?: StyleBible | null): string {
  const styleId = (data.styleId as StylePresetId) || 'realistic';

  // v2.5.13: 用 styleBible 的完整数据, 不再用独立 STYLE_PRESETS
  const genreEn = styleBible?.visual.genre_en || 'ultra realistic, photorealistic, cinematic photography';
  const qualityEn = styleBible?.visual.quality_en || '8k uhd, high detail, sharp focus';
  const lightingEn = styleBible?.visual.lighting_en || 'studio soft light, three-point lighting';
  const colorEn = styleBible?.visual.colorStyle_en || 'natural color grading';
  const backgroundEn = styleBible?.visual.background_en || 'clean backdrop';
  const ethnicity = styleBible?.visual.ethnicity || 'east asian';
  const rendererEn = styleBible?.visual.renderer_en || '';

  // v3.0.0.40 BUG-105: 主要 visual block = visualDescription 自由文本 (不再按 37 字段拼)
  const primaryVisual = buildPrimaryVisualBlock(data);

  const identityParts: string[] = [];
  if (data.name) identityParts.push(`character name: ${data.name}`);
  if (data.gender) identityParts.push(`gender: ${data.gender === '男' ? 'male' : 'female'}`);

  const rendererNote = rendererEn ? `\n[renderer: ${rendererEn}]` : '';

  // v3.0.0.40 BUG-105: 简化 jsonLikeStructure, 不再列 37 字段
  const jsonLikeStructure = [
    `[task: character_turnaround_portrait]`,
    `[style: ${genreEn}]`,
    `[composition: character turnaround sheet, 3 horizontal views, aspect_ratio 3:2]`,
    `[left: close-up portrait, 85mm lens, shallow depth of field, chest up, front facing]`,
    `[middle: side bust view, 90 degree side angle, upper body]`,
    `[right: full body standing, 50mm lens, orthographic feel, full body centered, natural standing pose]`,
    `[background: ${backgroundEn}]`,
    `[lighting: ${lightingEn}]`,
    `[camera_setup: portrait 85mm + body 50mm]`,
    `[identity: ${identityParts.join(', ')}]`,
    `[ethnicity: ${ethnicity}]`,
    // v3.0.0.40 BUG-105: 关键改动 - 整段 description 自由文本作为 face details
    `[face details: ${primaryVisual}]`,
    `[expression: neutral calm gaze]`,
  ].join('\n');

  const crossModelPrompt = `character sheet, turnaround, multiple views of the same person, ${primaryVisual}

${genreEn}, ${qualityEn}, ${lightingEn}, ${colorEn}, ${backgroundEn}

${CONSISTENCY_KEYWORDS_EN.join(', ')}`;

  // v3.0.0.40 BUG-105: 简化 chinesePart, 不再按 37 字段拼 (用 visualDescription 原文)
  const chinesePart = `\n\n中文描述：\n${primaryVisual}\n${CONSISTENCY_KEYWORDS_ZH.join('，')}`;

  const negativeKeywords = buildDynamicNegativeKeywords(styleId);
  const embeddedNegative = `\n\n[AVOID: ${negativeKeywords.join(', ')}]`;

  // v2.5.13: 风格专属负面提示 (从 styleBible)
  const styleNegative = styleBible?.negativePrompt
    ? `\n\n[STYLE NEGATIVE: ${styleBible.negativePrompt.join(', ')}]`
    : '';

  const fullPrompt = `${jsonLikeStructure}${rendererNote}\n\n---\n\n${crossModelPrompt}${chinesePart}${embeddedNegative}${styleNegative}`;

  return fullPrompt.length > 3900 ? fullPrompt.slice(0, 3897) + '...' : fullPrompt;
}

/**
 * v3.0.0.40 BUG-105: 单角度 prompt (跟三视图同源, 简化)
 */
export function buildSingleAnglePrompt(
  data: CharacterSheetData,
  angle: 'front_bust' | 'side_bust' | 'full_body',
  styleBible?: StyleBible | null,
): string {
  const genreEn = styleBible?.visual.genre_en || 'ultra realistic, photorealistic, cinematic photography';
  const qualityEn = styleBible?.visual.quality_en || '8k uhd, high detail, sharp focus';
  const lightingEn = styleBible?.visual.lighting_en || 'studio soft light, three-point lighting';
  const colorEn = styleBible?.visual.colorStyle_en || 'natural color grading';
  const backgroundEn = styleBible?.visual.background_en || 'clean backdrop';

  // v3.0.0.40 BUG-105: 主要 visual block = visualDescription 自由文本
  const primaryVisual = buildPrimaryVisualBlock(data);

  const angleDescEn: Record<string, string> = {
    front_bust: `close-up portrait, chest up, front facing the camera, 85mm lens, shallow depth of field`,
    side_bust: `side bust portrait, 90 degree side angle, upper body, profile view`,
    full_body: `full body shot, standing straight, full body centered, 50mm lens, orthographic feel, natural standing pose`,
  };

  const angleDescZh: Record<string, string> = {
    front_bust: `正面半身肖像，胸部以上构图，直面镜头，85mm镜头浅景深效果`,
    side_bust: `侧面半身肖像，90度侧面角度，上半身构图`,
    full_body: `正面全身站立照，全身居中，自然站姿，50mm镜头效果`,
  };

  const identityParts: string[] = [];
  if (data.name) identityParts.push(`character name: ${data.name}`);
  if (data.gender) identityParts.push(`gender: ${data.gender === '男' ? 'male' : 'female'}`);

  const styleNegative = styleBible?.negativePrompt
    ? `\n\n[STYLE NEGATIVE: ${styleBible.negativePrompt.join(', ')}]`
    : '';

  const prompt = `[task: single_angle_character_portrait]
[angle: ${angle}]
[view: ${angleDescEn[angle]}]

${primaryVisual}

${genreEn}, ${qualityEn}
${lightingEn}, ${backgroundEn}, ${colorEn}

identity: ${identityParts.join(', ')}

${CONSISTENCY_KEYWORDS_EN.slice(0, 3).join(', ')}

中文：${angleDescZh[angle]}，${primaryVisual}，${CONSISTENCY_KEYWORDS_ZH[0]}

[AVOID: ${buildDynamicNegativeKeywords(data.styleId).slice(0, 15).join(', ')}]${styleNegative}`;

  return prompt.length > 3900 ? prompt.slice(0, 3897) + '...' : prompt;
}
