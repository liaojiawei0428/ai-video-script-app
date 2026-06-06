/**
 * 角色三视图提示词生成器 v3.1 (v2.5.13 风格感知重构)
 *
 * 核心改动:
 *  1. prompt_safe_description 作为 primary visual description (LLM 已按风格生成)
 *  2. 结构化字段作为 supplement (补充 LLM 可能遗漏的细节)
 *  3. 删除独立 STYLE_PRESETS, 统一用 styleBible.ts 的完整风格数据
 *  4. 负面提示按风格动态生成 (不再硬编码 anime/cartoon 等互相冲突的词)
 */

import { StyleBible, StylePresetId, buildStyleAnchorPrefix, buildStyleNegativePrompt } from './styleBible';

export interface CharacterSheetData {
  name: string;
  gender?: string;
  age?: string;
  height?: string;
  build?: string;
  face?: string;
  skin?: string;
  eyes?: string;
  eyebrows?: string;
  nose?: string;
  lips?: string;
  hair_color?: string;
  hair_style?: string;
  hair_length?: string;
  hair_texture?: string;
  hair_accessories?: string;
  clothing_top?: string;
  clothing_bottom?: string;
  clothing_outer?: string;
  clothing_shoes?: string;
  clothing_underwear?: string;
  clothing_socks?: string;
  accessories_neck?: string;
  accessories_ears?: string;
  accessories_hands?: string;
  accessories_waist?: string;
  accessories_other?: string;
  props?: string;
  distinctive_features?: string;
  do_not_change?: string;
  makeup?: string;
  default_expression?: string;
  emotional_range?: string;
  body_language?: string;
  personality_visual?: string;
  social_class_visual?: string;
  prompt_safe_description?: string;
  negative_prompt_suggestion?: string;
  styleId?: string;
}

function buildEnglishVisualDescription(data: CharacterSheetData): string {
  const parts: string[] = [];
  if (data.gender) parts.push(`a ${data.gender === '男' ? 'male' : 'female'} character`);
  if (data.age) parts.push(`aged ${data.age}`);
  if (data.height) parts.push(`${data.height} tall`);
  if (data.build) parts.push(`with ${data.build} body type`);

  const faceParts: string[] = [];
  if (data.face) faceParts.push(`${data.face} face shape`);
  if (data.eyes) faceParts.push(`${data.eyes} eyes`);
  if (data.eyebrows) faceParts.push(`${data.eyebrows} eyebrows`);
  if (data.nose) faceParts.push(`${data.nose} nose`);
  if (data.lips) faceParts.push(`${data.lips} lips`);
  if (data.skin) faceParts.push(`${data.skin} skin`);
  if (faceParts.length > 0) parts.push(faceParts.join(', '));

  const hairParts: string[] = [];
  if (data.hair_color) hairParts.push(`${data.hair_color} hair color`);
  if (data.hair_style) hairParts.push(`${data.hair_style} hairstyle`);
  if (data.hair_length) hairParts.push(`${data.hair_length} length`);
  if (data.hair_texture) hairParts.push(`${data.hair_texture} hair texture`);
  if (data.hair_accessories) hairParts.push(`wearing ${data.hair_accessories}`);
  if (hairParts.length > 0) parts.push(hairParts.join(', '));

  const clothingParts: string[] = [];
  if (data.clothing_top) clothingParts.push(`top: ${data.clothing_top}`);
  if (data.clothing_bottom) clothingParts.push(`bottom: ${data.clothing_bottom}`);
  if (data.clothing_outer) clothingParts.push(`outerwear: ${data.clothing_outer}`);
  if (data.clothing_shoes) clothingParts.push(`shoes: ${data.clothing_shoes}`);
  if (clothingParts.length > 0) parts.push(`wearing ${clothingParts.join('; ')}`);

  const accessoryParts: string[] = [];
  if (data.accessories_neck) accessoryParts.push(`neck: ${data.accessories_neck}`);
  if (data.accessories_ears) accessoryParts.push(`ears: ${data.accessories_ears}`);
  if (data.accessories_hands) accessoryParts.push(`hands: ${data.accessories_hands}`);
  if (data.accessories_waist) accessoryParts.push(`waist: ${data.accessories_waist}`);
  if (data.accessories_other) accessoryParts.push(`other: ${data.accessories_other}`);
  if (accessoryParts.length > 0) parts.push(`accessories - ${accessoryParts.join('; ')}`);

  if (data.props) parts.push(`holding or near ${data.props}`);
  if (data.distinctive_features) parts.push(`distinctive features: ${data.distinctive_features}`);
  if (data.makeup) parts.push(`makeup: ${data.makeup}`);
  if (data.default_expression) parts.push(`expression: ${data.default_expression}`);

  return parts.join(', ');
}

function buildChineseVisualDescription(data: CharacterSheetData): string {
  const parts: string[] = [];
  const headParts: string[] = [];
  if (data.face) headParts.push(`${data.face}脸型`);
  if (data.eyes) headParts.push(`${data.eyes}眼睛`);
  if (data.eyebrows) headParts.push(`${data.eyebrows}眉毛`);
  if (data.nose) headParts.push(`${data.nose}鼻子`);
  if (data.lips) headParts.push(`${data.lips}嘴唇`);
  if (data.skin) headParts.push(`${data.skin}肤色`);
  if (headParts.length > 0) parts.push(`面部：${headParts.join('，')}`);

  const hairParts: string[] = [];
  if (data.hair_color) hairParts.push(`${data.hair_color}发色`);
  if (data.hair_style) hairParts.push(`${data.hair_style}`);
  if (data.hair_length) hairParts.push(`${data.hair_length}长度`);
  if (data.hair_texture) hairParts.push(`${data.hair_texture}发质`);
  if (data.hair_accessories) hairParts.push(`佩戴${data.hair_accessories}`);
  if (hairParts.length > 0) parts.push(`发型：${hairParts.join('，')}`);

  const clothingParts: string[] = [];
  if (data.clothing_top) clothingParts.push(`上衣：${data.clothing_top}`);
  if (data.clothing_bottom) clothingParts.push(`下装：${data.clothing_bottom}`);
  if (data.clothing_outer) clothingParts.push(`外套：${data.clothing_outer}`);
  if (data.clothing_shoes) clothingParts.push(`鞋子：${data.clothing_shoes}`);
  if (clothingParts.length > 0) parts.push(`服装：${clothingParts.join('；')}`);

  const accessoryParts: string[] = [];
  if (data.accessories_neck) accessoryParts.push(`颈部：${data.accessories_neck}`);
  if (data.accessories_ears) accessoryParts.push(`耳部：${data.accessories_ears}`);
  if (data.accessories_hands) accessoryParts.push(`手部：${data.accessories_hands}`);
  if (data.accessories_waist) accessoryParts.push(`腰部：${data.accessories_waist}`);
  if (data.accessories_other) accessoryParts.push(`其他：${data.accessories_other}`);
  if (accessoryParts.length > 0) parts.push(`配饰：${accessoryParts.join('；')}`);

  if (data.props) parts.push(`随身道具：${data.props}`);
  if (data.distinctive_features) parts.push(`标志性特征：${data.distinctive_features}`);
  if (data.makeup) parts.push(`妆容：${data.makeup}`);
  if (data.default_expression) parts.push(`默认表情：${data.default_expression}`);

  return parts.join('。\n');
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
 * v2.5.13 — 动态负面提示 (按风格排除, 不硬编码互相冲突的词)
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
 * v2.5.13 — 核心改动: prompt_safe_description 作为主要视觉描述
 *
 * 之前: 只用 buildEnglishVisualDescription() 手动拼接 → 遗漏 prompt_safe_description
 * 现在: prompt_safe_description 为主体, 结构化字段为补充
 */
function buildPrimaryVisualBlock(data: CharacterSheetData): string {
  if (data.prompt_safe_description) {
    // prompt_safe_description 是 LLM 按风格生成的最完整描述, 优先使用
    const supplemental = buildEnglishVisualDescription(data);
    if (supplemental && supplemental !== data.prompt_safe_description) {
      return `${data.prompt_safe_description}\n\nAdditional structured details: ${supplemental}`;
    }
    return data.prompt_safe_description;
  }
  // fallback: 没有 prompt_safe_description 时用结构化字段
  return buildEnglishVisualDescription(data);
}

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

  const primaryVisual = buildPrimaryVisualBlock(data);
  const zhVisual = buildChineseVisualDescription(data);

  const identityParts: string[] = [];
  if (data.name) identityParts.push(`character name: ${data.name}`);
  if (data.gender) identityParts.push(`gender: ${data.gender === '男' ? 'male' : 'female'}`);
  if (data.age) identityParts.push(`age: ${data.age}`);
  if (data.height) identityParts.push(`height: ${data.height}`);
  if (data.build) identityParts.push(`build: ${data.build}`);
  if (data.makeup) identityParts.push(`makeup style: ${data.makeup}`);

  const doNotChangeParts: string[] = [];
  if (data.do_not_change) doNotChangeParts.push(data.do_not_change);
  if (data.distinctive_features) doNotChangeParts.push(data.distinctive_features);

  // v2.5.13: 渲染语言指令 (如 "use brush-and-paper language, NOT photographic terms")
  const rendererNote = rendererEn ? `\n[renderer: ${rendererEn}]` : '';

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
    `[face details: ${primaryVisual}]`,
    `[do_not_change: ${doNotChangeParts.join(' / ') || 'face shape, hairstyle, outfit, accessories'}]`,
    `[expression: ${data.default_expression || 'neutral calm gaze'}]`,
  ].join('\n');

  const crossModelPrompt = `character sheet, turnaround, multiple views of the same person, ${primaryVisual}

${genreEn}, ${qualityEn}, ${lightingEn}, ${colorEn}, ${backgroundEn}

${CONSISTENCY_KEYWORDS_EN.join(', ')}`;

  const chinesePart = `\n\n中文描述：\n${zhVisual}\n${CONSISTENCY_KEYWORDS_ZH.join('，')}`;

  const negativeKeywords = buildDynamicNegativeKeywords(styleId);
  const embeddedNegative = `\n\n[AVOID: ${negativeKeywords.join(', ')}]`;

  // v2.5.13: 风格专属负面提示 (从 styleBible)
  const styleNegative = styleBible?.negativePrompt
    ? `\n\n[STYLE NEGATIVE: ${styleBible.negativePrompt.join(', ')}]`
    : '';

  const fullPrompt = `${jsonLikeStructure}${rendererNote}\n\n---\n\n${crossModelPrompt}${chinesePart}${embeddedNegative}${styleNegative}`;

  return fullPrompt.length > 3900 ? fullPrompt.slice(0, 3897) + '...' : fullPrompt;
}

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

  const primaryVisual = buildPrimaryVisualBlock(data);
  const zhVisual = buildChineseVisualDescription(data);

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

  const angleNote: Record<string, string> = {
    front_bust: `focus on facial features, eyes, expression ${data.default_expression || 'neutral calm gaze'}`,
    side_bust: `focus on side profile, silhouette, hair style, side clothing details`,
    full_body: `focus on full outfit, accessories, body proportions, overall look`,
  };

  const identityParts: string[] = [];
  if (data.name) identityParts.push(`character name: ${data.name}`);
  if (data.gender) identityParts.push(`gender: ${data.gender === '男' ? 'male' : 'female'}`);
  if (data.age) identityParts.push(`age: ${data.age}`);

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
${angleNote[angle]}

${CONSISTENCY_KEYWORDS_EN.slice(0, 3).join(', ')}

中文：${angleDescZh[angle]}，${zhVisual}，${CONSISTENCY_KEYWORDS_ZH[0]}

[AVOID: ${buildDynamicNegativeKeywords(data.styleId).slice(0, 15).join(', ')}]${styleNegative}`;

  return prompt.length > 3900 ? prompt.slice(0, 3897) + '...' : prompt;
}
