// apps/server/src/prompts/comicGeneration.ts
// v2.5.21: 自然语言格式 + 显式面板序列 (放弃 JSON 模板, 改用 drama-director 风格)
// 核心改进: 解决 5x5/4x4 网格问题 (之前 JSON 模板让 agnes 忽略了 grid 指令)

export type ComicLayout = '2x2' | '3x2' | '3x3';
export type ComicStyle =
  | 'realistic_cinematic'
  | 'chinese_realistic'
  | 'cyberpunk_realistic'
  | 'chinese_anime'
  | 'cg_3d';

// ── 风格系统 (5 套预设) ──
export const STYLE_SYSTEM: Record<ComicStyle, { zh: string; en: string }> = {
  realistic_cinematic: {
    zh: '电影写实风格',
    en: 'cinematic realism, HDR, realistic lighting, film grain, 35mm lens, realistic proportions, physically based rendering, cinematic color grading, dramatic tension',
  },
  chinese_realistic: {
    zh: '中国古风写实',
    en: 'Chinese ancient realistic style, oriental aesthetics, hanfu silk clothing, ink-wash lighting, realistic material textures, soft volumetric light, ancient architecture details, xianxia atmosphere',
  },
  cyberpunk_realistic: {
    zh: '赛博朋克写实',
    en: 'cyberpunk realism, neon blue and purple tones, high contrast, cybernetic implant details, wet rainy reflections, volumetric fog, futuristic tech, holographic elements',
  },
  chinese_anime: {
    zh: '中国国漫',
    en: 'Chinese anime style, 2D animation, clean lineart, flat shading with gradients, beautiful stylized characters, traditional Chinese color palette, gongbi heavy color painting, xianxia charm',
  },
  cg_3d: {
    zh: '3D CG',
    en: '3D CG style, PBR materials, realistic rendering, global illumination, subsurface scattering skin, cinematic modeling, high-poly details, toy-like color tones',
  },
};

export interface ComicShotInput {
  shotNumber: number;
  sceneType: string;
  cameraMove: string;
  visual: string;
  dialogue: string;
  lighting: string;
  colorTone: string;
  audioNote: string;
  imagePrompt: string;
}

export interface ComicCharacterInput {
  name: string;
  description: string;
}

export interface ComicPageInput {
  pageNumber: number;
  totalPages: number;
  episodeTitle: string;
  episodeScript: string;
  shots: ComicShotInput[];
  characters: ComicCharacterInput[];
  style: ComicStyle;
  layout: ComicLayout;
}

/**
 * 从 novelId styleBible 自动推断漫画风格
 */
export function inferComicStyle(styleBible: any, userOverride?: ComicStyle): ComicStyle {
  if (userOverride) return userOverride;
  if (!styleBible) return 'realistic_cinematic';
  const sid = styleBible.styleId || styleBible.id;
  const map: Record<string, ComicStyle> = {
    'realistic': 'realistic_cinematic',
    'ancient': 'chinese_realistic',
    'cyber': 'cyberpunk_realistic',
    'anime': 'chinese_anime',
    '3d': 'cg_3d',
  };
  return map[sid] || 'realistic_cinematic';
}

// ── 工具: 把面板位置数字映射成英文标签 ──
//   1=top-left, 2=top-center, 3=top-right
//   4=middle-left, 5=middle-center, 6=middle-right
//   7=bottom-left, 8=bottom-center, 9=bottom-right
function positionLabel(index: number): string {
  const labels = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ];
  return labels[index - 1] || `position-${index}`;
}

/**
 * v2.5.21: 系统 prompt - 简化, 关键指令放到 user prompt 末尾
 * Agnes 对简短 system prompt + 详细 user prompt 模式更稳定
 */
export function comicGenerationSystemPrompt(
  style: ComicStyle,
  layout: ComicLayout,
  characters: ComicCharacterInput[],
): string {
  const styleDef = STYLE_SYSTEM[style];
  const charAnchor = characters.length > 0
    ? `\nCharacters (SAME in all panels): ${characters.map(c => `${c.name}: ${c.description}`).join('; ')}.`
    : '';

  return `You are a comic storyboard renderer. Render the following content as ONE image showing multiple panels in a grid.${charAnchor}

Render style: ${styleDef.en}.`;
}

/**
 * v2.5.21: 用户 prompt - 自然语言格式, 显式面板序列
 * 参考 drama-director 最佳实践: 每个 panel 单独编号, 末尾强调风格一致性
 * 关键改进: Negative prompt 显式禁 5x5/4x4, 强制 2x2/3x2/3x3 网格
 */
export function comicGenerationUserPrompt(input: ComicPageInput): string {
  const { pageNumber, totalPages, episodeTitle, episodeScript, shots, characters, style, layout } = input;
  const styleDef = STYLE_SYSTEM[style];
  const [rows, cols] = layout.split('x').map(Number);

  // ── 第一部分: 头部整体指令 ──
  let prompt = `A cinematic ${layout} comic book page with exactly ${shots.length} panels depicting "${episodeTitle}".

Read order: left-to-right, top-to-bottom.

Render style: ${styleDef.en}.`;

  // ── 第二部分: 角色档案 (跨分格锚定) ──
  if (characters.length > 0) {
    prompt += `\n\nCharacters (same character MUST look identical in every panel they appear): ${characters.map(c => `${c.name} (${c.description})`).join('; ')}.`;
  }

  // ── 第三部分: 剧本上下文 (简短摘要, 帮助模型理解剧情) ──
  if (episodeScript && episodeScript.trim()) {
    const summary = episodeScript.slice(0, 500).trim();
    prompt += `\n\nStory context: ${summary}${episodeScript.length > 500 ? '...' : ''}`;
  }

  // ── 第四部分: 每格显式编号 + 内容 (核心: 解决网格错乱问题) ──
  prompt += `\n\n===== PANELS (each MUST be rendered in its specified position) =====`;

  shots.forEach((shot, i) => {
    const position = positionLabel(i + 1);
    const dialogue = shot.dialogue && shot.dialogue.trim()
      ? ` Speech bubble in this panel: "${shot.dialogue.trim()}".`
      : '';
    const lighting = shot.lighting && shot.lighting.trim()
      ? ` Lighting: ${shot.lighting.trim()}.`
      : '';
    const camera = shot.cameraMove && shot.cameraMove.trim()
      ? ` Camera: ${shot.cameraMove.trim()}.`
      : '';
    const visual = (shot.visual && shot.visual.trim())
      ? shot.visual.trim()
      : (shot.imagePrompt && shot.imagePrompt.trim()) ? shot.imagePrompt.slice(0, 200).trim()
      : `${shot.sceneType || 'scene'} shot`;

    prompt += `\n\nPanel ${i + 1} (${position}): ${visual}.${camera}${lighting}${dialogue}`;
  });

  // ── 第五部分: 强风格一致性 + 强制网格 (末尾强调) ──
  // 实验证明末尾指令权重更高, 这是关键
  // v2.5.23: 强调正确的行列分布, 帮助模型按 aspect ratio 正确分配
  prompt += `\n\n===== STYLE & LAYOUT (MANDATORY) =====

Style consistency (ALL panels MUST share):
- SAME art style: ${styleDef.en}
- SAME character appearance/outfit/hair in every panel they appear
- SAME lighting mood and color palette across all panels
- SAME level of detail and rendering quality

Layout (MUST be exactly ${layout} grid, NO other layout):
- Count the panels: this page has EXACTLY ${shots.length} panels in ${rows} rows and ${cols} columns
- Row 1 (top): ${cols} panels — top-left, top-center${cols >= 3 ? ', top-right' : ''}${cols >= 4 ? ', top-far-right' : ''}
- Row 2 (middle): ${cols} panels${rows >= 2 ? ' — middle-left, middle-center' + (cols >= 3 ? ', middle-right' : '') + (cols >= 4 ? ', middle-far-right' : '') : ''}
${rows >= 3 ? `- Row 3 (bottom): ${cols} panels — bottom-left, bottom-center${cols >= 3 ? ', bottom-right' : ''}${cols >= 4 ? ', bottom-far-right' : ''}` : ''}
- Each panel is rectangular and roughly equal size
- Bold BLACK panel borders clearly separating each panel
- Thin WHITE gutters between panels
- Speech bubbles INSIDE their panel only
- NO text, watermark, logo, page number outside the panels

Negative (NEVER do these):
- 4x4 grid layout (16 panels)
- 5x5 grid layout (25 panels)
- 2x3 or 3x4 grid (wrong column/row count)
- All panels showing the same content
- Panels merged into one big image without borders
- Watermarks, signatures, or page numbers
- Low quality, blurry, deformed, extra limbs`;

  return prompt;
}

/**
 * 计算分镜数量对应的漫画布局
 *   ≤4 → 2x2
 *   5-6 → 3x2
 *   7+  → 3x3 (多页, 每页 9 个)
 */
export function calculateComicLayout(shotCount: number): {
  layout: ComicLayout;
  shotsPerPage: number;
  totalPages: number;
} {
  if (shotCount <= 0) return { layout: '3x3', shotsPerPage: 9, totalPages: 0 };
  if (shotCount <= 4) return { layout: '2x2', shotsPerPage: 4, totalPages: 1 };
  if (shotCount <= 6) return { layout: '3x2', shotsPerPage: 6, totalPages: 1 };
  const totalPages = Math.ceil(shotCount / 9);
  return { layout: '3x3', shotsPerPage: 9, totalPages };
}