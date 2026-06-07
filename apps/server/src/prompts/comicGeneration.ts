// apps/server/src/prompts/comicGeneration.ts
// v2.5.20: 专业级多风格统一漫画生成 - JSON 模板架构
// 核心思想: 同一套分镜结构 + 不同风格渲染层 (style system)
// 每个 panel.prompt 严格使用对应分镜的 visual 字段, 确保每格内容独立

export type ComicLayout = '2x2' | '3x2' | '3x3';
export type ComicStyle =
  | 'realistic_cinematic'    // 电影写实
  | 'chinese_realistic'      // 中国古风写实
  | 'cyberpunk_realistic'    // 赛博朋克写实
  | 'chinese_anime'          // 中国国漫
  | 'cg_3d';                 // 3D CG

// ── 风格系统 (5 套预设, 中英双语) ──
export const STYLE_SYSTEM: Record<ComicStyle, { zh: string; en: string }> = {
  realistic_cinematic: {
    zh: '电影写实风格, 高动态范围, 真实光影, 胶片质感, 35mm镜头, 真实人物比例, 物理光照, 电影级调色, 戏剧张力',
    en: 'cinematic realism, HDR, realistic lighting, film grain, 35mm lens, realistic proportions, physically based rendering, cinematic color grading, dramatic tension',
  },
  chinese_realistic: {
    zh: '中国古风写实, 东方美学, 汉服丝绸质感, 水墨留白光影, 真实材质纹理, 柔和体积光, 古建筑细节, 仙侠氛围',
    en: 'Chinese ancient realistic style, oriental aesthetics, hanfu silk clothing, ink-wash lighting, realistic material textures, soft volumetric light, ancient architecture details, xianxia atmosphere',
  },
  cyberpunk_realistic: {
    zh: '赛博朋克写实风, 霓虹蓝紫调, 高对比度, 机械义体细节, 雨夜湿润反射, 体积光雾, 未来科技感, 全息元素',
    en: 'cyberpunk realism, neon blue and purple tones, high contrast, cybernetic implant details, wet rainy reflections, volumetric fog, futuristic tech, holographic elements',
  },
  chinese_anime: {
    zh: '中国国漫风, 二维动画风格, 干净线条, 平涂+渐变上色, 人物美型精致, 国风配色, 工笔重彩, 仙侠神韵',
    en: 'Chinese anime style, 2D animation, clean lineart, flat shading with gradients, beautiful stylized characters, traditional Chinese color palette, gongbi heavy color painting, xianxia charm',
  },
  cg_3d: {
    zh: '3D CG风格, PBR材质, 真实渲染, 全局光照, 次表面散射皮肤, 电影级建模, 高模细节, 玩具感色调',
    en: '3D CG style, PBR materials, realistic rendering, global illumination, subsurface scattering skin, cinematic modeling, high-poly details, toy-like color tones',
  },
};

export interface ComicShotInput {
  shotNumber: number;
  sceneType: string;       // 中景/特写/全景 etc.
  cameraMove: string;      // 固定/推/拉/摇
  visual: string;          // 画面描述 (核心: 每格画面)
  dialogue: string;        // 对白
  lighting: string;        // 灯光
  colorTone: string;       // 色彩
  audioNote: string;       // 音效
  imagePrompt: string;     // 镜头AI生图 prompt (可选)
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
  style: ComicStyle;       // 选定风格
  layout: ComicLayout;
}

/**
 * 风格系统模块 (从 novelId styleBible 自动推断, 也可用户覆盖)
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

// ── 全局通用 prompt (与具体剧本内容无关) ──
const GLOBAL_PROMPT_ZH = '漫画分镜页面, 网格布局, 每个格子为独立镜头, 统一构图和节奏, 电影分镜语言, 高细节, 专业漫画分格';
const GLOBAL_PROMPT_EN = 'comic storyboard page, grid layout, each panel is a cinematic shot, consistent composition and pacing, high detail, professional comic panel composition';

const NEGATIVE_PROMPT_ZH = '低质量, 模糊, 畸形, 多肢体, 透视错误, 崩坏, 过曝, 噪点, 水印, 错误排版, 文字溢出, 边框外的元素, 9个格子内容雷同, 9个格子画面一模一样';
const NEGATIVE_PROMPT_EN = 'low quality, blurry, deformed, extra limbs, bad perspective, broken anatomy, overexposed, noise, watermark, layout errors, text overflow, elements outside frames, 9 panels looking identical, 9 panels with the same content';

// ── 将单格分镜数据转换为 panel JSON 字段 ──
function buildPanel(shot: ComicShotInput, panelIndex: number, layout: ComicLayout): {
  id: number;
  panel_position: string;
  prompt: string;          // 关键: 这一格的画面内容 (来自 shot.visual 等)
  camera: string;
  composition: string;
  lighting: string;
  dialogue: string;
} {
  // 1. panel.prompt: 这一格的核心画面内容 (强制基于 visual 字段)
  // 不复用其他分镜内容, 不添加任何 global/scene 描述
  const promptParts: string[] = [];

  // 视觉描述 (必备)
  if (shot.visual) {
    promptParts.push(shot.visual.trim());
  }
  // 景别
  if (shot.sceneType) {
    promptParts.push(`${shot.sceneType} 镜头`);
  }
  // 镜头运动
  if (shot.cameraMove) {
    const cm = shot.cameraMove.trim();
    if (cm && cm !== '固定' && cm !== '固定镜头') {
      promptParts.push(`运镜: ${cm}`);
    }
  }
  // 灯光
  if (shot.lighting) {
    promptParts.push(`灯光: ${shot.lighting.trim()}`);
  }
  // 色彩
  if (shot.colorTone) {
    promptParts.push(`色彩: ${shot.colorTone.trim()}`);
  }
  // 音效 (提示画面动静氛围)
  if (shot.audioNote) {
    promptParts.push(`氛围: ${shot.audioNote.trim()}`);
  }
  // AI 生图 prompt 补充
  if (shot.imagePrompt) {
    promptParts.push(`细节: ${shot.imagePrompt.slice(0, 150).trim()}`);
  }

  // 2. camera 技术参数
  const camera = shot.cameraMove
    ? `${shot.sceneType || '中景'}, ${shot.cameraMove}`
    : (shot.sceneType || '中景镜头');

  // 3. composition 构图 (基于景别推断)
  const compositionMap: Record<string, string> = {
    '特写': 'subject fills frame, tight crop, focus on detail',
    '大特写': 'extreme close-up, macro detail',
    '近景': 'close-up, focus on face/expression',
    '中近景': 'medium close-up, head and shoulders',
    '中景': 'medium shot, waist up, balanced framing',
    '中全景': 'medium wide, full body with environment',
    '全景': 'wide shot, full scene visible',
    '远景': 'wide establishing shot, deep perspective',
    '大远景': 'extreme wide shot, vast landscape',
    '过肩': 'over-the-shoulder shot',
  };
  const composition = compositionMap[shot.sceneType] || 'medium shot, balanced composition';

  // 4. lighting (透传)
  const lighting = shot.lighting || 'cinematic lighting';

  return {
    id: panelIndex + 1,
    panel_position: layoutPosition(layout, panelIndex + 1),
    prompt: promptParts.join(', '),
    camera,
    composition,
    lighting,
    dialogue: shot.dialogue || '',
  };
}

/**
 * v2.5.20: 系统 prompt - 严格 JSON 模板 + 多风格系统
 * 这是发给图像模型 (agnes) 的 system 角色
 */
export function comicGenerationSystemPrompt(
  style: ComicStyle,
  layout: ComicLayout,
  characters: ComicCharacterInput[],
): string {
  const styleDef = STYLE_SYSTEM[style];
  const charAnchor = characters.length > 0
    ? characters.map(c => `【${c.name}】: ${c.description}`).join('\n')
    : '';

  return `你是一个专业的多风格漫画分镜渲染引擎, 任务: 将 1 组分镜数据渲染为 1 张多格漫画页。

【🎨 风格系统 (强制使用)】
本次任务使用风格: ${styleDef.zh}
英文风格标识: ${styleDef.en}

${charAnchor ? `【👤 角色一致性锚定 (跨分格必须保持)】
${charAnchor}

` : ''}【📐 全局规则 - 必须遵守】
${GLOBAL_PROMPT_ZH}
${GLOBAL_PROMPT_EN}

【📐 输出格式 - ${layout.toUpperCase()} 网格 (1:1 方形画布 2048x2048)】
- 整个画面是一个 ${layout} 网格漫画页
- 网格用粗黑边框 (bold black borders) 明确分隔
- 网格之间留有清晰的白色 gutter (白色间距, 不要填色)
- 阅读顺序: 从左到右, 从上到下
- 每个分格独立, 大小可略有不同 (但必须都在 ${layout} 网格内)
- 每个分格内: 完整的独立镜头画面 + 中文对白气泡 (如果该分格有对白)
- 对白气泡使用中文, 位置在分格内的空白处
- 整页风格统一, 不要有水印/签名/边框装饰/分格外的其他元素

【🚫 禁止 (Negative Prompt)】
${NEGATIVE_PROMPT_ZH}
${NEGATIVE_PROMPT_EN}

【🔥 关键: 每格内容必须独立 (这是最重要的规则)】
- 每个分格的画面内容必须严格来自下方 "panels" 数组中对应 id 的 prompt 字段
- 禁止: 将所有分格画成相同或相似的画面
- 禁止: 将第 1 格的内容复用到其他分格
- 必须: 每个分格展现不同的镜头/角度/动作/场景
- 必须: 即使两个分格的 visual 文字相似, 也要通过 camera/composition 区别

现在请接收用户传入的 panels 数组, 直接生成 1 张 ${layout} 网格漫画图, 不要输出任何文字解释。`;
}

/**
 * v2.5.20: 用户 prompt - 严格 JSON 模板, 每个 panel 是一个 JSON 对象
 * 数据源: shot 数组, 每个 panel 对应一个 shot
 * 这是发给图像模型 (agnes) 的 user 角色
 */
export function comicGenerationUserPrompt(input: ComicPageInput): string {
  const { pageNumber, totalPages, episodeTitle, episodeScript, shots, characters, style, layout } = input;
  const styleDef = STYLE_SYSTEM[style];

  // 1. 构建 panels JSON 数组 (核心数据)
  const panels = shots.map((s, i) => buildPanel(s, i, layout));

  // 2. 构建完整 JSON 模板
  const jsonTemplate = {
    meta: {
      title: `《${episodeTitle}》- 漫画分镜 第${pageNumber}/${totalPages}页`,
      layout: layout,
      total_panels: panels.length,
      style: style,
    },
    style_layer: {
      zh: styleDef.zh,
      en: styleDef.en,
    },
    global_prompt: GLOBAL_PROMPT_ZH,
    negative_prompt: NEGATIVE_PROMPT_ZH,
    parameters: {
      aspect_ratio: '1:1',
      resolution: '2048x2048',
    },
    context: {
      episode_title: episodeTitle,
      script_summary: episodeScript.slice(0, 800).trim() + (episodeScript.length > 800 ? '...' : ''),
      characters: characters.map(c => ({ name: c.name, desc: c.description })),
    },
    panels: panels,
  };

  // 3. 文本化输出 (让 agnes 看到清晰结构)
  return `请根据以下 JSON 模板生成 1 张 ${layout} 网格漫画分镜页:

\`\`\`json
${JSON.stringify(jsonTemplate, null, 2)}
\`\`\`

【🔥 再次强调 - 每格独立内容】
- panels[0] 的画面内容来自 shot #${shots[0]?.shotNumber || 1}
- panels[1] 的画面内容来自 shot #${shots[1]?.shotNumber || 2}
- ...
- panels[N-1] 的画面内容来自 shot #${shots[shots.length-1]?.shotNumber || shots.length}

每格的 prompt 字段已经精确描述了该分镜的内容, 严禁将所有分格画成一样.

【生成指令】
请直接生成漫画分格图, 不要输出任何文字或 JSON 解释.`;
}

/**
 * 计算分格位置
 */
function layoutPosition(layout: ComicLayout, n: number): string {
  const [rows, cols] = layout.split('x').map(Number);
  const row = Math.ceil(n / cols);
  const col = ((n - 1) % cols) + 1;
  const rowLabel = row === 1 ? '上排' : row === 2 ? '中排' : '下排';
  const colLabel = col === 1 ? '左' : col === 2 ? '中' : '右';
  return `${rowLabel}${colLabel}`;
}

/**
 * 根据分镜数量计算漫画布局
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
