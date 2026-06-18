// apps/server/src/prompts/comicGeneration.ts
// v2.5.21: 自然语言格式 + 显式面板序列 (放弃 JSON 模板, 改用 drama-director 风格)
// 核心改进: 解决 5x5/4x4 网格问题 (之前 JSON 模板让 agnes 忽略了 grid 指令)
// v2.5.27: 角色视觉 DNA 注入 - 提取角色库三视图 prompt 作为跨分镜一致性锚点
// v2.5.29: 完全重写 - 英文 prompt + 强区分 "CAST visual reference" vs "STORY panel content"
// 解决: 加 referenceImage 后, agnes 把图当成主体, 生成"角色图"而非"剧情图"
// 关键: 每格显式说 "STORY SCENE with character IN ACTION", 弱化参考图权重

// v2.5.31: ComicLayout 是字符串 (N×M), 由 agnes 实际生成决定
// 我们用 calculateComicLayout 推荐一个, 但 prompt 让 agnes 自由选
export type ComicLayout = string;
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
  // v2.5.27: 角色库三视图 prompt 注入 (视觉 DNA)
  visualDna?: string;
  // v2.5.27: 角色库已有三视图 (用于决策是否注入 DNA 块)
  hasSheet?: boolean;
  // v2.5.27: 角色主类型, 主角优先注入 (节省 token)
  roleType?: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  // v2.5.28: 角色三视图图 URL, 用于 agnes-image-2.1-flash 多模态生成 (image_url 字段)
  referenceSheetUrl?: string;
  // v2.5.29: 角色在当前 episode shots 中出现的次数 (用于选主参考图)
  appearanceCount?: number;
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
function positionLabel(index: number): string {
  const labels = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ];
  return labels[index - 1] || `position-${index}`;
}

/**
 * v2.5.29: 从角色库三视图 prompt 提取"简短身份描述" (用于 prompt 文字部分)
 * 输入: imageVariants[0].prompt (完整 ~2500 字符)
 * 输出: 压缩到 1-2 句的身份描述 (约 200 字符), 用于识别角色
 * 策略: 只保留"脸型+发色+发式+服装+主色" 5 个核心字段
 *       完全删除 "character sheet" "multiple views" 等元指令
 */
export function extractShortIdentity(sheetPrompt: string): string {
  if (!sheetPrompt || !sheetPrompt.trim()) return '';

  // 切到 --- 之前 (去掉 "character sheet, multiple views" 段)
  let text = sheetPrompt;
  const dashIdx = text.indexOf('---');
  if (dashIdx > 0) text = text.slice(0, dashIdx);

  // 移除元标签 [mood] [lighting] [renderer] 等, 保留 [face details] [identity]
  let cleaned = text
    .replace(/\[(mood|lighting|camera_setup|renderer|do_not_change|expression|AVOID|avoid|do not change)[^\]]*\]/gi, ' ')
    .replace(/\[/g, ' ')
    .replace(/\]/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 提取 [face details: ...] 段, 这是角色身份最浓缩的描述
  const faceMatch = cleaned.match(/face details[:\s]+(.*?)(?:\s+\[|$)/i);
  if (faceMatch) {
    const faceText = faceMatch[1].trim();
    // 截前 250 字符
    return `face/hair/outfit: ${faceText.slice(0, 250)}`;
  }

  // 兜底: 截前 200 字符
  return `appearance: ${cleaned.slice(0, 200)}`;
}

/**
 * v2.5.29: 选主参考图角色 (出现频次最高 + 是主角)
 * 用于 agnes-image-2.1-flash 的 image_url 字段
 */
export function selectMainReferenceCharacter(
  characters: ComicCharacterInput[],
): ComicCharacterInput | null {
  if (characters.length === 0) return null;
  const rolePriority: Record<string, number> = {
    protagonist: 0,
    antagonist: 1,
    supporting: 2,
    minor: 3,
  };

  const withSheet = characters.filter(c => c.hasSheet && c.referenceSheetUrl);
  if (withSheet.length === 0) return null;

  // 排序: protagonist 优先, 然后 appearanceCount 高的
  const sorted = [...withSheet].sort((a, b) => {
    const roleA = rolePriority[a.roleType || 'minor'] ?? 99;
    const roleB = rolePriority[b.roleType || 'minor'] ?? 99;
    if (roleA !== roleB) return roleA - roleB;
    return (b.appearanceCount || 0) - (a.appearanceCount || 0);
  });

  return sorted[0];
}

/**
 * v2.5.29: 构建 CAST 块 (角色档案 - 简短)
 * 重点: 强调"角色名 = 这段简短的视觉特征", 跟参考图绑定
 * 不堆 DNA, 只用 1 句 + 角色名, 跟参考图解耦 (agness 参考图理解能力强)
 */
export function buildCastBlock(
  characters: ComicCharacterInput[],
  mainRef: ComicCharacterInput | null,
): string {
  if (characters.length === 0) return '';

  // 过滤: 至少有 hasSheet 或 description 的
  const cast = characters.filter(c => c.hasSheet || (c.description && c.description.length > 10));
  if (cast.length === 0) return '';

  // 取 TOP 3
  const top = cast.slice(0, 3);

  const lines: string[] = [
    '\n\n===== CAST (visual identity reference) =====',
  ];

  if (mainRef) {
    lines.push(`A character reference image is attached. It represents the LEAD CHARACTER (${mainRef.name}).`);
    lines.push('Use it ONLY for the lead character\'s face shape, hairstyle, hair color, and outfit color.');
    lines.push('Do NOT mirror its pose, composition, or background into the panels.');
    lines.push('');
  }

  lines.push('Characters in this story:');
  top.forEach((c, idx) => {
    const label = String.fromCharCode(65 + idx); // A, B, C
    const isMain = mainRef && c.name === mainRef.name;
    const shortId = c.hasSheet ? extractShortIdentity(c.visualDna || '') : '';
    const desc = shortId || (c.description || '').slice(0, 100);
    const roleLabel = isMain ? ' [LEAD = reference image]' : '';
    lines.push(`  • Character ${label} (${c.name})${roleLabel}: ${desc}`);
  });

  return lines.join('\n');
}

/**
 * v2.5.21: 系统 prompt - 简化, 关键指令放到 user prompt 末尾
 * v2.5.29: 完全英文, 明确"STORY PAGE, not character sheet"
 */
export function comicGenerationSystemPrompt(
  style: ComicStyle,
  layout: ComicLayout,
  characters: ComicCharacterInput[],
): string {
  const styleDef = STYLE_SYSTEM[style];
  const charCount = characters.length;

  return `You are a comic storyboard renderer. Your task: render ${layout} STORY PANELS as ONE image, depicting sequential narrative scenes from a story.

CRITICAL:
- This is a STORY COMIC PAGE with multiple story panels, NOT a character sheet, NOT a reference page.
- Each panel shows a DIFFERENT scene/action/moment from the story.
- The characters IN the panels are DOING THINGS, not posing.
- If a character reference image is attached, it is ONLY for matching that character's face/hair/outfit COLOR. The COMPOSITION of each panel follows the PANEL DESCRIPTION, not the reference image.

Style: ${styleDef.en}.
Cast size: ${charCount} character(s).`;
}

/**
 * v2.5.29: 用户 prompt - 英文 + 强区分
 * 设计:
 *   1. 头部: 明确 STORY COMIC, NOT character sheet
 *   2. CAST: 简短身份 + 角色名 + 哪个 = reference image
 *   3. PANELS: 每格显式说"STORY SCENE with [Character] doing X in Y"
 *   4. 末尾: 强负面 (NOT a character portrait, NOT a character sheet page)
 */
export function comicGenerationUserPrompt(input: ComicPageInput): string {
  const { pageNumber, totalPages, episodeTitle, episodeScript, shots, characters, style, layout } = input;
  const styleDef = STYLE_SYSTEM[style];
  const [rows, cols] = layout.split('x').map(Number);

  // 选主参考图角色
  const mainRef = selectMainReferenceCharacter(characters);

  // ── 第一部分: 头部整体指令 (强剧情定位) ──
  let prompt = `A ${layout} comic storyboard page from the episode "${episodeTitle}".

This page contains ${shots.length} SEQUENTIAL STORY PANELS (NOT a character sheet, NOT a turn-around, NOT a character reference page).

Read order: left-to-right, top-to-bottom.

Art style: ${styleDef.en}.`;

  // ── 第二部分: CAST 简短档案 (英文 + 简短) ──
  prompt += buildCastBlock(characters, mainRef);

  // ── 第三部分: 剧本上下文 (一句话, 极简) ──
  if (episodeScript && episodeScript.trim()) {
    const summary = episodeScript.slice(0, 300).replace(/\n+/g, ' ').trim();
    prompt += `\n\nStory context: ${summary}${episodeScript.length > 300 ? '...' : ''}`;
  }

  // ── 第四部分: 每格显式编号 + 剧情 (核心: 强调 STORY SCENE) ──
  prompt += `\n\n===== PANELS (each is a STORY SCENE with characters IN ACTION) =====`;

  // 角色名映射: shot 中出现哪些角色 (从 description 找)
  // 简化: 把所有主角列表给 agnes, 让他在每格按描述自然挑选
  const characterNames = characters.map((c, i) => {
    const label = String.fromCharCode(65 + i);
    return `Character ${label} = "${c.name}"`;
  }).join('; ');

  shots.forEach((shot, i) => {
    const position = positionLabel(i + 1);
    const positionShort = position.replace('-', ' ');

    // 优先用 visual, 然后 imagePrompt (后端解析的)
    const visual = (shot.visual && shot.visual.trim())
      ? shot.visual.trim()
      : (shot.imagePrompt && shot.imagePrompt.trim()) ? shot.imagePrompt.slice(0, 250).trim()
      : `${shot.sceneType || 'scene'} shot`;

    const dialogue = shot.dialogue && shot.dialogue.trim()
      ? ` Speech bubble: "${shot.dialogue.trim().replace(/"/g, "'").slice(0, 80)}".`
      : '';
    const lighting = shot.lighting && shot.lighting.trim()
      ? ` Lighting: ${shot.lighting.trim()}.`
      : '';
    const camera = shot.cameraMove && shot.cameraMove.trim()
      ? ` Camera: ${shot.cameraMove.trim()}.`
      : '';

    // 关键: 显式说"this is a STORY SCENE, not a portrait"
    // 角色名从 CAST 段绑定
    prompt += `\n\nPanel ${i + 1} (${positionShort}) — STORY SCENE: ${visual}.${camera}${lighting}${dialogue}`;
  });

  // 角色名映射放在所有 PANEL 之后, 避免 agnes 把角色名当成面板标签
  if (characterNames) {
    prompt += `\n\nCharacter label map: ${characterNames}.`;
  }

  // ── 第五部分: 强风格一致性 + 自由 grid + 强留白约束 ──
  // v2.5.31: 不再硬指定 grid (3x3/3x4), 让 agnes 按 portrait 2:3 比例自由选
  // 关键: 只约束"必须 N 个填的, 其他全空", 不约束 grid 形状
  const totalCells = rows * cols;  // 9 (按用户期望)
  const emptyCount = totalCells - shots.length;

  prompt += `\n\n===== STYLE & LAYOUT (MANDATORY) =====

Art style (ALL filled panels MUST share):
- Style: ${styleDef.en}
- SAME character appearance across panels: same face, same hair, same outfit color
- SAME lighting mood and color palette

Grid layout (PORTRAIT 2:3 aspect ratio, STRICTLY follow this mapping):
- This page contains EXACTLY ${shots.length} FILLED panel(s) + the rest as EMPTY cells
- Use the grid that matches your shot count (don't deviate):
  * 1-2 panels → 2x1 (2 cells)
  * 3-4 panels → 2x2 (4 cells)
  * 5-6 panels → 3x4 (12 cells) — ${shots.length} filled + ${12 - shots.length} empty
  * 7-9 panels → 3x3 (9 cells)
  * 10-12 panels → 3x4 (12 cells) — all filled
  * 13-15 panels → 5x3 (15 cells) — all filled
  * 16-18 panels → 6x3 (18 cells) — all filled
  * 19+ panels → split into multiple pages
- The grid must have rows >= cols (portrait orientation)
- All cells (filled AND empty) MUST have the SAME rectangular SIZE
- Bold BLACK borders (3-5px thick) around ALL cells
- Read order: left-to-right, top-to-bottom

EMPTY cells (${emptyCount} cell(s) in the grid):
- MUST be PURE BLANK BACKGROUND — flat single solid color (paper white / cream / light beige)
- NO content at all
- NO characters, NO scenery, NO faces, NO close-ups
- NO text, NO speech bubbles, NO captions
- NO panels-in-miniature, NO faded/ghost versions of filled panels
- NO artistic embellishments, NO borders decorations inside the empty cell
- Just a SOLID FLAT COLOR filling the cell, surrounded by a BLACK border (same as filled cells)

Each FILLED cell:
- Shows ONLY its corresponding Panel N's scene (1-to-1 mapping, no mixing)
- Each filled panel = a DIFFERENT story moment (different action, angle, or location)
- Speech bubbles (if any) must be INSIDE their panel only
- Characters IN ACTION, not posing portraits

NEGATIVE (NEVER do these):
- 4x4, 5x5, 6x6 grid or any grid with WAY more cells than needed
- 1x1 grid (single huge image)
- A single big character portrait filling the whole page
- All panels showing the same pose of the character from the reference image
- Panels merged without borders
- Filling EMPTY cells with random content (faces, characters, scenery, close-ups, panels-in-miniature, faded/ghost versions, or ANY artistic decoration)
- Treating EMPTY cells as if they have panels to draw
- Watermarks, signatures, page numbers
- Each panel being a portrait of a single character — every FILLED panel MUST be a STORY SCENE with action, environment, and (if present) dialogue`;

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

  // v2.5.32: 对齐 agnes 实际选择的 grid (实测 portrait 2:3 时):
  let cellsPerPage: number;
  let layout: string;
  if (shotCount <= 2) {
    cellsPerPage = 2; layout = '2x1';
  } else if (shotCount <= 4) {
    cellsPerPage = 4; layout = '2x2';
  } else if (shotCount <= 6) {
    // 5-6 镜头: agnes 选 3x4 (12 cells), 留 6-7
    cellsPerPage = 12; layout = '3x4';
  } else if (shotCount <= 9) {
    cellsPerPage = 9; layout = '3x3';
  } else if (shotCount <= 12) {
    cellsPerPage = 12; layout = '3x4';
  } else if (shotCount <= 15) {
    cellsPerPage = 15; layout = '5x3';
  } else if (shotCount <= 18) {
    cellsPerPage = 18; layout = '6x3';
  } else {
    cellsPerPage = 9; layout = '3x3';
  }

  const totalPages = Math.ceil(shotCount / cellsPerPage);
  return { layout, shotsPerPage: cellsPerPage, totalPages };
}
