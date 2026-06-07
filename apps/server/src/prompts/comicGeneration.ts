// apps/server/src/prompts/comicGeneration.ts
// v2.5.19: 漫画生成 prompt
// 数据源: 仅使用已经生成的分镜数据 (shotNumber, sceneType, cameraMove, visual, dialogue, lighting, colorTone)
// 不允许硬写入任何参考内容, 严格按 shot 数据生成对应漫画画面

export type ComicLayout = '2x2' | '3x2' | '3x3';

export interface ComicShotInput {
  shotNumber: number;
  sceneType: string;       // 中景/特写/全景 etc.
  cameraMove: string;      // 固定/推/拉/摇
  visual: string;          // 画面描述
  dialogue: string;        // 对白
  lighting: string;        // 灯光
  colorTone: string;       // 色彩
  audioNote: string;       // 音效
  imagePrompt: string;     // 镜头AI生图 prompt (可选)
}

export interface ComicCharacterInput {
  name: string;
  description: string;    // 角色描述
}

export interface ComicPageInput {
  pageNumber: number;
  totalPages: number;
  episodeTitle: string;
  episodeScript: string;   // 完整剧本 (供 LLM 理解上下文)
  shots: ComicShotInput[]; // 本页要画的分镜
  characters: ComicCharacterInput[];
  styleBibleBlock: string; // 风格圣经 (国漫/3D/古风 etc.)
  voiceAndTone: string;    // 语气 (可选)
  layout: ComicLayout;
}

/**
 * 漫画生成系统 prompt
 * 强制 1 张图 = 1 页漫画, 1 页 = N 个分格 (根据 layout)
 * 数据源仅来自 shots[] 数组, 禁止编造
 */
export function comicGenerationSystemPrompt(
  styleBibleBlock: string,
  voiceAndTone: string,
  layout: ComicLayout,
): string {
  return `你是一个专业的漫画分镜构图师 + 视觉导演, 任务是将多个分镜头描述整合到一张漫画分格图中。

【核心规则】
1. **数据源唯一性**: 漫画分格内容必须 100% 来自下方"分镜数据"数组, 禁止自行添加、修改或编造任何场景/角色/动作/对白
2. **同风格一致性**: 所有分格必须使用同一艺术风格, 不得在不同分格混用风格
3. **同角色一致性**: 同一个角色在不同分格中必须保持外观、服饰、发型完全一致
4. **同光照一致性**: 所有分格共享同一光线/色温, 形成统一的视觉氛围
5. **漫画语言**: 必须使用专业漫画分格表达 (景别变换、视角切换、构图、留白)

【输出格式 - ${layout.toUpperCase()} 网格 (1:1 方形画布)】
- 整个画面是一个 ${layout} 网格漫画页
- 网格用粗黑边框 (bold black borders) 明确分隔
- 网格之间留有清晰的白色 gutter (白色间距)
- 阅读顺序: 从左到右, 从上到下
- 每个分格内: 完整的镜头画面 + 必要的中文对白气泡
- 整页风格统一, 不要有水印/签名/边框装饰/分格外的其他元素

【禁止】
- 禁止在画面中添加水印、logo、签名
- 禁止添加边框外的内容 (如"第X页"等装饰)
- 禁止使用不一致的光线/色调
- 禁止捏造分镜数据中不存在的角色、场景、动作

${styleBibleBlock ? `【风格圣经 - 必须严格遵守】\n${styleBibleBlock}\n` : ''}
${voiceAndTone ? `【语气基调】\n${voiceAndTone}\n` : ''}
请直接生成漫画分格图, 不要输出任何文字解释。`;
}

/**
 * 漫画生成用户 prompt
 * 注入分镜数据 + 布局指令
 */
export function comicGenerationUserPrompt(input: ComicPageInput): string {
  const { pageNumber, totalPages, episodeTitle, episodeScript, shots, characters, layout } = input;

  const charList = characters
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  const shotBlocks = shots.map((s, i) => {
    const position = layoutPosition(layout, i + 1);
    const lines: string[] = [];
    lines.push(`【分格 ${i + 1} (${position})】镜头 ${s.shotNumber}`);
    if (s.sceneType) lines.push(`  景别: ${s.sceneType}`);
    if (s.cameraMove) lines.push(`  运镜: ${s.cameraMove}`);
    if (s.visual) lines.push(`  画面: ${s.visual}`);
    if (s.lighting) lines.push(`  灯光: ${s.lighting}`);
    if (s.colorTone) lines.push(`  色彩: ${s.colorTone}`);
    if (s.dialogue) lines.push(`  对白: ${s.dialogue}`);
    if (s.audioNote) lines.push(`  音效: ${s.audioNote}`);
    if (s.imagePrompt) lines.push(`  参考生图prompt: ${s.imagePrompt.slice(0, 200)}`);
    return lines.join('\n');
  }).join('\n\n');

  const pageNote = totalPages > 1 ? `\n(第 ${pageNumber}/${totalPages} 页, 共 ${shots.length} 个分格)` : `\n(共 ${shots.length} 个分格)`;

  return `【剧集标题】${episodeTitle}

【剧本概要 (供上下文理解)】
${episodeScript.slice(0, 2000)}${episodeScript.length > 2000 ? '\n...(后续省略)' : ''}

${characters.length > 0 ? `【角色档案 (角色一致性参考)】
${charList}

` : ''}【分镜数据 ${pageNumber}/${totalPages} - 这是漫画分格的唯一数据源】${pageNote}

${shotBlocks}

【构图要求】
- 整个画面 = ${layout} 漫画页 (1:1 方形, 整页是一张图)
- 阅读顺序: 从左到右, 从上到下
- 每个分格对应上方的"分镜数据 N", 共 ${shots.length} 个分格
- 网格之间用粗黑边框 + 白色 gutter 清晰分隔
- 所有分格共享同一艺术风格、同一角色外观、同一光线/色调
- 中文对白气泡放在对应分格内 (使用分镜数据中的对白原文)
- 不要在画布边缘添加任何水印、logo、签名、"第N页"等装饰文字

请生成漫画分格图。`;
}

/**
 * 计算分格位置 (用于 prompt 描述)
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
 * ≤4 → 2x2
 * 5-6 → 3x2
 * 7-9 → 3x3
 * >9 → 3x3 (多页, 每页9个)
 */
export function calculateComicLayout(shotCount: number): {
  layout: ComicLayout;
  shotsPerPage: number;
  totalPages: number;
} {
  if (shotCount <= 0) return { layout: '3x3', shotsPerPage: 9, totalPages: 0 };
  if (shotCount <= 4) return { layout: '2x2', shotsPerPage: 4, totalPages: 1 };
  if (shotCount <= 6) return { layout: '3x2', shotsPerPage: 6, totalPages: 1 };
  // 7+ 都用 3x3, 多页
  const totalPages = Math.ceil(shotCount / 9);
  return { layout: '3x3', shotsPerPage: 9, totalPages };
}
