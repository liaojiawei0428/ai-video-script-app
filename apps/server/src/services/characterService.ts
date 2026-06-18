// 角色一致性服务 v2.0
// 三阶段流程: 描述生成 (文字) → 用户确认 → 多角度变体图生成
// 扣费: 描述生成免费 (复用 deepseekPool), 变体图按张扣费

import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../models/db';
import { characterModel } from '../models/character';
import { novelModel } from '../models/novel';
import { userModel } from '../models/user';
import { websocketService } from './websocket';
import { deepseekPool } from './deepseekPool';
import { generateThreeVariants } from './imageProvider';
import { logger } from '../utils/logger';
import {
  Character,
  CharacterDescription,
  StylePresetId,
  ImageVariant,
  ImageGenStatus,
} from '../shared/types';

// 变体图扣费单价
const IMAGE_VARIANT_PRICE = 0.1; // ¥0.1/张 (GLM-Image)

/**
 * v3.0.0.30 (S50 v2): 中文 roleType 标签 → 旧英文 union 映射
 * 解决: Character.roleType TS type 限定为 'protagonist' | 'antagonist' | 'supporting' | 'minor',
 *       但 LLM (S50 v2 prompt) 输出中文 (主角/重要配角/次要配角/跑龙套/路人甲乙丙丁)
 * 写库前用此函数映射, 保持 DB column 后向兼容.
 *
 * 注意: alignment 字段 (正派/反派/中立) 在 response 保留中文, DB 不存 alignment (无 column).
 */
function mapRoleTypeToLegacy(cnRoleType: string | undefined): 'protagonist' | 'antagonist' | 'supporting' | 'minor' {
  if (!cnRoleType) return 'supporting';
  const t = String(cnRoleType).trim();
  if (t === '主角') return 'protagonist';
  if (t === '重要配角') return 'supporting';
  if (t === '次要配角') return 'supporting';
  if (t === '跑龙套') return 'minor';
  if (t === '路人甲乙丙丁') return 'minor';
  // 兼容旧英文字段 (novelService.parseCharactersFromReport 仍可能产生)
  if (t === 'protagonist' || t === 'antagonist' || t === 'supporting' || t === 'minor') return t;
  return 'supporting';
}

/**
 * v2.5.13: 从分析报告中提取时代背景上下文
 * 解决: 古风小说 + realistic 画风 → 角色穿现代服装的问题
 *
 * 分析报告格式:
 *   📖 类型：言情/穿越/宫廷/架空历史
 *   🎨 风格：古风言情...
 *   💭 基调：...
 *
 * 返回时代指令, 注入角色描述 prompt, 让 LLM 知道角色应该穿什么时代的衣服
 */
function extractEraContext(analysisReport: string): string {
  if (!analysisReport) return '';

  const text = analysisReport.toLowerCase();

  // 检测时代关键词
  const ancientKeywords = ['古风', '古代', '宫廷', '架空历史', '穿越', '仙侠', '武侠', '修仙', '玄幻', '言情/穿越', '架空', '皇城', '帝王', '后宫', '江湖', '王朝', '公主', '太子', '王妃', '世子', '将军'];
  const modernKeywords = ['都市', '现代', '职场', '校园', '豪门', '娱乐圈', '商战', '都市言情', '甜宠', '追妻'];
  const scifiKeywords = ['科幻', '未来', '赛博', '末日', '机甲', '星际', '太空'];

  const isAncient = ancientKeywords.some(kw => text.includes(kw));
  const isModern = modernKeywords.some(kw => text.includes(kw));
  const isScifi = scifiKeywords.some(kw => text.includes(kw));

  if (isAncient && !isModern) {
    return `\n## ⚠️ 时代背景约束 (从分析报告提取)
本小说为古风/宫廷/架空历史题材。角色服装、发型、配饰、妆容必须符合古代设定:
- 服装: 汉服/唐装/明制/宫廷服饰/侠客服/仙袍, 禁止出现西装/衬衫/牛仔裤/T恤/高跟鞋等现代服饰
- 发型: 古代发髻/束发/盘发/飞仙髻/百合髻, 禁止出现马尾/短发/染发(除非设定明确)
- 配饰: 发簪/玉佩/香囊/步摇/璎珞/团扇, 禁止出现手机/手表/眼镜等现代物品
- 鞋履: 绣花鞋/布靴/云头履, 禁止出现高跟鞋/运动鞋/皮鞋
- 材质: 丝绸/绢帛/棉麻/织锦/纱罗, 禁止出现化纤/尼龙/皮革(除非设定明确)
`;
  }
  if (isScifi) {
    return `\n## ⚠️ 时代背景约束 (从分析报告提取)
本小说为科幻/未来题材。角色服装、配饰必须符合未来设定:
- 服装: 未来风格制服/机甲/纳米材料/全息服饰
- 配饰: 神经接口/义体/全息眼镜/数据手套
- 材质: 金属/纳米纤维/发光材质/全息投影
`;
  }
  if (isModern) {
    return `\n## ⚠️ 时代背景约束 (从分析报告提取)
本小说为现代都市题材。角色服装应为现代都市风格。
`;
  }
  return '';
}

// 防并发：同角色不能同时发起多个生图请求（5分钟自动过期）
const inProgressGenerations = new Map<string, ReturnType<typeof setTimeout>>();

function lockGeneration(characterId: string): boolean {
  if (inProgressGenerations.has(characterId)) return false;
  const timer = setTimeout(() => {
    inProgressGenerations.delete(characterId);
    logger.warn('generateImageVariants: lock auto-expired', { characterId });
  }, 5 * 60 * 1000);
  inProgressGenerations.set(characterId, timer);
  return true;
}

function unlockGeneration(characterId: string): void {
  const timer = inProgressGenerations.get(characterId);
  if (timer) clearTimeout(timer);
  inProgressGenerations.delete(characterId);
}

function isGenerationLocked(characterId: string): boolean {
  return inProgressGenerations.has(characterId);
}

// ════════════════════════════════════════════════════════════
//  1. 描述生成 (仅文字, 免费, 复用 deepseekPool)
// ════════════════════════════════════════════════════════════

export interface CharacterDescriptionGenResult {
  total: number;
  succeeded: number;
  failed: number;
  characters: Array<{ id: string; name: string; roleType?: string; description: CharacterDescription; extraDescription: CharacterDescription }>;
}

/**
 * 基于全文摘要, 为小说中所有未确认的角色生成 15 维度结构化描述
 * 仅生成文字, 不生图, 不扣费
 */
export async function extractDescriptions(
  novelId: string,
  fullSummary?: string,
  novelTitle?: string,
  styleId: StylePresetId = 'realistic',
): Promise<CharacterDescriptionGenResult> {
  // 拉取小说所有角色
  const characters = await characterModel.findByNovelId(novelId);
  if (characters.length === 0) {
    logger.warn('extractDescriptions: 小说无角色', { novelId });
    return { total: 0, succeeded: 0, failed: 0, characters: [] };
  }

  // 总是拉取 novel 用于获取 styleBible
  const novel = await novelModel.findById(novelId);
  styleId = ((novel?.styleId as StylePresetId) || styleId);

  // 如果没传 fullSummary, 从 db 读（优先 full_summary，其次 analysis_report）
  if (!fullSummary) {
    fullSummary = novel?.fullSummary || novel?.analysisReport || '';
    novelTitle = novelTitle || novel?.title || '未命名';
  }
  if (!fullSummary) {
    logger.warn('extractDescriptions: 全文摘要和分析报告均为空, 跳过', { novelId });
    return { total: 0, succeeded: 0, failed: 0, characters: [] };
  }

  // 推送状态
  websocketService.broadcastProgress(novelId, 0, 'character_extracting', {
    total: characters.length,
  });
  websocketService.broadcastChunkProgress(novelId, {
    phase: 'character_extracting',
    current: 0,
    total: characters.length,
    unitLabel: '角色',
    detail: `正在提取 ${characters.length} 个角色的详细描述...`,
    chunkStates: [],
  });

  const { CHARACTER_DESCRIPTION_SYSTEM_PROMPT, buildCharacterDescriptionUserPrompt } = await import('../prompts/characterDescription');

  // v2.5.34: 简化版 prompt, 不再需要 styleBibleBlock / eraContext
  // 新版只关心: 角色在小说中**实际描写了什么**, 自由文本输出
  const userPrompt = buildCharacterDescriptionUserPrompt(
    fullSummary,
    characters.map(c => c.name),
    novelTitle || '未命名',
    (novel as any)?.novelExcerpts || undefined,  // 原文片段
  );

  let parsedDescriptions: Array<{ name: string; roleType: string; description: string; extraDescription: string }> = [];
  try {
    const llmResult = await deepseekPool.chatCompletionWithRetry(
      CHARACTER_DESCRIPTION_SYSTEM_PROMPT,
      userPrompt,
      0.5,
      2,
    );

    // 解析 JSON（容错）
    const jsonText = extractJsonArray(llmResult.content);
    parsedDescriptions = JSON.parse(jsonText);

    // v2.5.35: LLM 经常误返回旧 11 字段格式 (description 是 JSON 字符串)
    // 智能归一化: 如果 matched.description 是 JSON 字符串, 自动转成 markdown 文本
    parsedDescriptions = parsedDescriptions.map((d: any) => {
      if (typeof d.description === 'string') {
        const trimmed = d.description.trim();
        if (trimmed.startsWith('{') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          // 尝试解析 + 拼装
          d.description = normalizeOldDescriptionFormat(d.description);
        }
      }
      if (typeof d.extraDescription === 'string') {
        const trimmed = d.extraDescription.trim();
        if (trimmed.startsWith('{') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          d.extraDescription = normalizeOldDescriptionFormat(d.extraDescription);
        }
      }
      // v3.0.0.30 (S50 v2): 规范化 roleType, 兜底用 characters 现有 roleType
      if (typeof d.roleType !== 'string' || !d.roleType.trim()) {
        const matched = characters.find(c => c.name === d.name);
        d.roleType = matched?.roleType || '次要配角';
      }
      return d;
    });
  } catch (err) {
    logger.error('extractDescriptions: LLM 解析失败', { novelId, error: err });
    // 失败时回退到空描述
    parsedDescriptions = characters.map(c => ({
      name: c.name,
      roleType: c.roleType || '次要配角',
      description: `【未能自动提取, 请手动填写】\n\n角色名: ${c.name}\n身份: ${c.roleType || '未知'}\n请基于小说内容为该角色编写描述.`,
      extraDescription: '',
    }));
  }

  // 按 name 匹配并写库 (v2.5.34: 自由文本格式)
  const result: CharacterDescriptionGenResult['characters'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const char of characters) {
    const matched = parsedDescriptions.find(
      p => p.name === char.name || (char.aliases || []).includes(p.name),
    );
    if (matched) {
      try {
        // v2.5.34: 简化存储, 只存 description + extraDescription 自由文本
        // v3.0.0.30 (S50 v2): 同时写 role_type (LLM 标签分类结果, 中文→英文后向兼容)
        const description = typeof matched.description === 'string' ? matched.description : '';
        const extraDescription = typeof matched.extraDescription === 'string' ? matched.extraDescription : '';
        const newRoleType = mapRoleTypeToLegacy((matched as any).roleType || char.roleType);
        await execute(
          `UPDATE characters SET description = ?, extra_description = ?, role_type = ?, style_id = ?, confirmed = 0, image_gen_status = 'none' WHERE id = ?`,
          [
            description,
            extraDescription,
            newRoleType,
            styleId,
            char.id,
          ],
        );
        result.push({
          id: char.id,
          name: char.name,
          roleType: newRoleType,
          description: { name: char.name, description, extraDescription } as any,
          extraDescription: { name: char.name, description: '', extraDescription } as any,
        });
        succeeded++;
      } catch (err) {
        logger.error('extractDescriptions: 写库失败', { characterId: char.id, error: err });
        failed++;
      }
    } else {
      // 未匹配的角色用兜底描述
      try {
        const fallbackDesc = `【未匹配到 LLM 输出, 请手动填写】\n\n角色名: ${char.name}\n身份: ${char.roleType || '未知'}\n请基于小说内容为该角色编写描述.`;
        const fallbackExtra = '';
        const fallbackRoleType = mapRoleTypeToLegacy(char.roleType);
        await execute(
          `UPDATE characters SET description = ?, extra_description = ?, role_type = ?, style_id = ?, confirmed = 0, image_gen_status = 'none' WHERE id = ?`,
          [fallbackDesc, fallbackExtra, fallbackRoleType, styleId, char.id],
        );
        result.push({
          id: char.id,
          name: char.name,
          roleType: fallbackRoleType,
          description: { name: char.name, description: fallbackDesc, extraDescription: '' } as any,
          extraDescription: { name: char.name, description: '', extraDescription: '' } as any,
        });
        succeeded++;
      } catch (err) {
        failed++;
      }
    }
  }

  // 写小说 style_id
  await execute(`UPDATE novels SET style_id = ? WHERE id = ?`, [styleId, novelId]);

  // 自动确认所有成功提取的角色（用户可在详情页手动调整）
  const confirmedIds = result.filter(r => r.description && Object.keys(r.description).length > 3).map(r => r.id);
  if (confirmedIds.length > 0) {
    await execute(
      `UPDATE characters SET confirmed = 1, confirmed_at = ? WHERE id IN (${confirmedIds.map(() => '?').join(',')})`,
      [Date.now(), ...confirmedIds],
    );
    logger.info('extractDescriptions: auto-confirmed', { novelId, count: confirmedIds.length });
  }

  // 推送状态
  websocketService.broadcastProgress(novelId, 100, 'character_extracting', {
    total: characters.length,
    succeeded,
    failed,
  });
  websocketService.broadcastChunkProgress(novelId, {
    phase: 'character_extracting',
    current: characters.length,
    total: characters.length,
    unitLabel: '角色',
    detail: `角色提取完成：${succeeded}/${characters.length} 成功`,
    chunkStates: [],
  });

  logger.info('extractDescriptions: 完成', { novelId, total: characters.length, succeeded, failed });
  return { total: characters.length, succeeded, failed, characters: result };
}

/** 提取严格 JSON 数组文本 (处理 ```json``` 包裹等) */
function extractJsonArray(text: string): string {
  let s = text.trim();
  // 去掉 markdown 围栏
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // 找第一个 [ 和最后一个 ]
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return s.substring(start, end + 1);
  }
  return s;
}

/**
 * v2.5.35: 把 LLM 误返回的旧 11 字段 JSON (字符串或对象) 归一化为 markdown 文本
 * 输入可能是:
 *   - 字符串: "{\"name\":\"X\",\"age\":\"18\",...}"  (双层转义)
 *   - 对象: {name: "X", age: "18", ...}
 *   - 字符串: {"name":"X",...}  (普通 JSON 字符串)
 * 输出: markdown 文本 "# 基本信息\n- name: X\n- age: 18\n..." 格式
 */
export function normalizeOldDescriptionFormat(s: string): string {
  if (!s || typeof s !== 'string') return s;
  // 递归解析: 一直解到非 JSON 字符串为止
  let current: any = s.trim();
  let depth = 0;
  while (depth < 5 && typeof current === 'string') {
    const trimmed = current.trim();
    if (!trimmed) break;
    if (trimmed.startsWith('{') || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        current = JSON.parse(trimmed);
      } catch {
        break;
      }
    } else {
      break;
    }
    depth++;
  }
  if (typeof current !== 'object' || current === null) {
    // 不是 JSON 对象, 可能是已转换的 markdown 文本 (含英文 key)
    // 尝试替换英文 key 为中文标签
    return relabelEnglishKeys(s);
  }

  // 转成 markdown 文本
  const obj = current as Record<string, any>;
  const lines: string[] = [];

  // 按字段类别分组 (粗略分类, 让输出更结构化)
  const infoKeys = ['name', 'age', 'gender', 'height', 'build', 'skin', 'makeup', 'role_type'];
  const faceKeys = ['face', 'eyes', 'eyebrows', 'nose', 'lips', 'ears', 'makeup'];
  const hairKeys = ['hair_color', 'hair_style', 'hair_length', 'hair_texture', 'hair_accessories'];
  const clothKeys = ['clothing_top', 'clothing_bottom', 'clothing_outer', 'clothing_shoes', 'clothing_underwear', 'clothing_socks'];
  const accKeys = ['accessories_neck', 'accessories_ears', 'accessories_hands', 'accessories_waist', 'accessories_other'];
  const featKeys = ['props', 'distinctive_features', 'default_expression', 'emotional_range', 'body_language', 'personality_visual', 'social_class_visual', 'personality'];
  const safeKeys = ['prompt_safe_description'];
  const relationKeys = ['relationships', '_relationships'];
  const skipKeys = new Set(['name', 'negative_prompt_suggestion', 'color_palette', 'do_not_change']);

  // v2.5.35: 英文字段 key → 中文标签
  const KEY_LABEL: Record<string, string> = {
    name: '姓名', role_type: '角色类型', gender: '性别', age: '年龄',
    height: '身高', build: '体型', skin: '肤色', makeup: '妆容',
    face: '脸型', eyes: '眼睛', eyebrows: '眉毛', nose: '鼻子', lips: '嘴唇', ears: '耳朵',
    hair_color: '发色', hair_style: '发型', hair_length: '发长', hair_texture: '发质', hair_accessories: '发饰',
    clothing_top: '上衣', clothing_bottom: '下装', clothing_outer: '外套', clothing_shoes: '鞋', clothing_underwear: '内衣', clothing_socks: '袜',
    accessories_neck: '颈部配饰', accessories_ears: '耳饰', accessories_hands: '手部配饰', accessories_waist: '腰饰', accessories_other: '其他配饰',
    props: '道具', distinctive_features: '显著特征', default_expression: '默认表情',
    emotional_range: '情绪范围', body_language: '肢体语言', personality_visual: '性格(视觉)',
    social_class_visual: '社会阶层(视觉)', personality: '性格',
    prompt_safe_description: '生图提示词', relationships: '关系', _relationships: '关系',
    'role type': '角色类型', 'hair color': '发色', 'hair style': '发型',
    'clothing top': '上衣', 'accessories neck': '颈部配饰',
  };

  const renderGroup = (title: string, keys: string[]) => {
    const present = keys.filter(k => obj[k] && !skipKeys.has(k));
    if (present.length === 0) return;
    lines.push(`# ${title}`);
    for (const k of present) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) {
        const label = KEY_LABEL[k] || k.replace(/_/g, ' ');
        lines.push(`- ${label}: ${v}`);
      }
    }
    lines.push('');
  };

  renderGroup('基本信息', infoKeys);
  renderGroup('五官面容', faceKeys);
  renderGroup('发型发色', hairKeys);
  renderGroup('服装', clothKeys);
  renderGroup('配饰', accKeys);
  renderGroup('性格与特征', featKeys);
  renderGroup('其他', [...safeKeys, ...relationKeys]);

  // 其他未分类字段
  const categorized = new Set([
    ...infoKeys, ...faceKeys, ...hairKeys, ...clothKeys, ...accKeys, ...featKeys, ...safeKeys, ...relationKeys
  ]);
  const uncategorized = Object.keys(obj).filter(k => !categorized.has(k) && !skipKeys.has(k) && obj[k]);
  if (uncategorized.length > 0) {
    lines.push('# 其他');
    for (const k of uncategorized) {
      const v = obj[k];
      if (typeof v === 'string' && v.trim()) {
        lines.push(`- ${KEY_LABEL[k] || k.replace(/_/g, ' ')}: ${v}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim() || s;
}

function makeFallbackDescription(c: Character): string {
  return `【未匹配到 LLM 输出, 请手动填写】\n\n角色名: ${c.name}\n身份: ${c.roleType || '未知'}\n请基于小说内容为该角色编写描述.`;
}

/**
 * v2.5.34: 从自由文本中提取"显著特征"段落
 * 匹配 "标志性特征", "显著特征", "胎记", "疤痕", "特殊习惯" 等关键词所在段落
 * 提取出的内容会作为 distinctive_features 注入三视图 prompt
 */
function extractDistinctiveFeatures(text: string): string {
  if (!text) return '';
  // 找包含关键词的段落 (## 标题 或 - 列表项)
  const patterns = [
    /#+\s*标志[性]?特征[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\n\n|$)/i,
    /#+\s*显著特征[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\n\n|$)/i,
    /#+\s*外貌[与和]?服装[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\n\n|$)/i,
    /[-*]\s*[^：:]*[胎疤痕][^：:]*[：:][^\n]+/g,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return m[1].trim().slice(0, 800);  // v3.0.0.30 (S50): 300 -> 800 字符上限, 更多特征
    }
  }
  return '';
}

// ════════════════════════════════════════════════════════════
//  2. 用户确认 (无扣费)
// ════════════════════════════════════════════════════════════

/**
 * 用户确认/编辑角色描述
 * @param userEdits 用户编辑的 15 维度 (含 name 必须匹配)
 */
export async function confirmDescription(
  characterId: string,
  userEdits: { description: CharacterDescription; extraDescription: CharacterDescription },
): Promise<{ success: boolean; confirmedAt: number }> {
  const char = await characterModel.findByNovelId(await getNovelIdByCharacterId(characterId));
  const target = char.find(c => c.id === characterId);
  if (!target) throw new Error(`角色不存在: ${characterId}`);

  await execute(
    `UPDATE characters SET confirmed = 1, confirmed_at = ? WHERE id = ?`,
    [Date.now(), characterId],
  );

  logger.info('confirmDescription: 已确认', { characterId, name: target.name });
  return { success: true, confirmedAt: Date.now() };
}

async function getNovelIdByCharacterId(characterId: string): Promise<string> {
  const row = await queryOne<{ novel_id: string }>('SELECT novel_id FROM characters WHERE id = ?', [characterId]);
  if (!row) throw new Error(`角色不存在: ${characterId}`);
  return row.novel_id;
}

// ════════════════════════════════════════════════════════════
//  3. 变体图生成 (按张扣费 ¥0.3)
// ════════════════════════════════════════════════════════════

export interface ImageGenBatchResult {
  characterId: string;
  characterName: string;
  totalRequested: number;
  totalSucceeded: number;
  totalFailed: number;
  charged: number; // 实际扣费金额
  variants: ImageVariant[];
}

/**
 * 为单个角色生成 3 张变体图 (正面半身/侧面半身/全身)
 * 按张扣费 (成功才扣, 失败不扣)
 */
export async function generateImageVariants(
  characterId: string,
  userId: string,
  options: { onlyAngles?: Array<'front_bust' | 'side_bust' | 'full_body'> } = {},
): Promise<ImageGenBatchResult> {
  // 防止并发重复调用
  if (isGenerationLocked(characterId)) {
    throw new Error('该角色正在生成形象图中，请稍后再试');
  }

  const char = await findCharacterById(characterId);
  if (!char) throw new Error(`角色不存在: ${characterId}`);
  if (!char.confirmed) {
    throw new Error(`请先确认角色描述: ${char.name}`);
  }
  if (!char.description) {
    throw new Error(`角色描述为空: ${char.name}`);
  }

  lockGeneration(characterId);
  try {

  const styleId = (char.styleId as StylePresetId) || 'realistic';

  // ========== 构造三视图提示词 ==========
  // v2.5.34: 自由文本格式, description / extraDescription 是字符串 (可能为旧 JSON, 兼容)
  const rawDesc = typeof char.description === 'string' ? char.description : '';
  const rawExtra = typeof char.extraDescription === 'string' ? char.extraDescription : '';
  // 兼容旧数据: 旧数据是 11 字段 JSON, 提取 prompt_safe_description 和 gender
  const oldDescObj = (() => {
    if (!rawDesc || rawDesc[0] !== '{') return null;
    try { return JSON.parse(rawDesc); } catch { return null; }
  })();
  const oldExtraObj = (() => {
    if (!rawExtra || rawExtra[0] !== '{') return null;
    try { return JSON.parse(rawExtra); } catch { return null; }
  })();

  // 视觉描述: 优先用旧 prompt_safe_description, 退化到整个 description
  const visualText = oldDescObj?.prompt_safe_description || oldExtraObj?.prompt_safe_description || rawDesc || '';

  const { buildCharacterSheetPrompt } = await import('./characterSheetPrompt');
  const { buildStyleAnchorPrefix, buildStyleNegativePrompt, buildStyleBibleJsonBlock } = await import('./styleBible');
  // v3.0.0.29 (S49): 翻译中文描述到英文 (保留 trigger 词), 给 agens image model 用
  // v3.0.0.30 (S50): 去掉 slice(0, 1500) 硬截断, DB description 字段 TEXT 够长, 整段翻译保留更多丰度
  const { translateCharacterDescriptionToEnglish } = await import('./promptTranslator');
  const translatedVisualText = await translateCharacterDescriptionToEnglish(visualText);

  // v2.5.9: 获取 styleBible 并注入
  const novelWithBible = await queryOne<any>('SELECT style_bible FROM novels WHERE id = ?', [char.novelId]);
  const styleBible = novelWithBible?.style_bible ? (typeof novelWithBible.style_bible === 'string' ? JSON.parse(novelWithBible.style_bible) : novelWithBible.style_bible) : null;

  // v2.5.34: 简化 sheetData, 不再按 37 字段切, 直接传整个 description 文本
  // v3.0.0.29 (S49): prompt_safe_description 用翻译后版本, 让 agens image model 收到 EN trigger 词
  const sheetData: Record<string, any> = {
    name: char.name,
    styleId,
    // 主要视觉描述: 中文→英文 翻译后, 给 agens 用 (v3.0.0.30 S50 去硬截断)
    prompt_safe_description: translatedVisualText || visualText,
    // 兜底字段 (从旧格式/字段中提取)
    gender: char.gender || oldDescObj?.gender || '',
    // 显著特征: 从 description 文本中找"特征/标志/胎记"段落
    distinctive_features: extractDistinctiveFeatures(rawDesc) || oldDescObj?.distinctive_features || oldDescObj?.signature || '',
  };

  logger.info('character sheet prompt translated', {
    characterId,
    originalLen: visualText.length,  // v3.0.0.30 (S50): 去 slice 硬截断, 报原始 len
    translatedLen: translatedVisualText.length,
    hasTriggerWords: /photorealistic|85mm|bokeh|cinematic|8k uhd/.test(translatedVisualText),
  });

  const sheetPrompt = buildCharacterSheetPrompt(sheetData as any, styleBible);
  const finalPrompt = sheetPrompt;

  logger.info('generateImageVariants: character sheet prompt', {
    characterId, name: char.name, promptLen: finalPrompt.length,
    hasEyes: !!sheetData.eyes, hasFace: !!sheetData.face, hasClothing: !!sheetData.clothing_top,
    hasStyleBible: !!styleBible, styleId: styleBible?.styleId,
  });

  // 设置状态: generating
  await execute(`UPDATE characters SET image_gen_status = 'generating' WHERE id = ?`, [characterId]);
  websocketService.broadcastProgress(char.novelId, 0, 'image_generating', {
    characterId, characterName: char.name, total: 1,
  });

  // 预检余额（单张）
  const user = await userModel.findById(userId);
  if (!user) throw new Error('用户不存在');
  const totalCost = IMAGE_VARIANT_PRICE;
  if ((user.balance || 0) < totalCost) {
    await execute(`UPDATE characters SET image_gen_status = 'failed' WHERE id = ?`, [characterId]);
    throw new Error(`余额不足, 需要 ¥${totalCost.toFixed(2)}, 余额 ¥${(user.balance || 0).toFixed(2)}`);
  }

  // ========== 单次调用生成三视图角色卡 ==========
  const { getDefaultImageProvider } = await import('./imageProvider');
  const provider = getDefaultImageProvider();
  let sheetUrl = '';
  let totalSucceeded = 0;
  let totalFailed = 1;

  try {
    const result = await provider.generate({
      prompt: finalPrompt,
      styleId,
      angle: 'sheet',
    });
    sheetUrl = result.url;
    totalSucceeded = 1;
    totalFailed = 0;
    logger.info('generateImageVariants: sheet done', {
      characterId, name: char.name, durationMs: result.durationMs,
      urlPrefix: result.url.slice(0, 80),
    });
  } catch (err: any) {
    logger.error('generateImageVariants: sheet failed', {
      characterId, name: char.name, error: err?.message || String(err),
    });
  }

  const variants: ImageVariant[] = [];
  if (sheetUrl) {
    variants.push({
      angle: 'sheet',
      url: sheetUrl,
      prompt: finalPrompt,
      createdAt: Date.now(),
    });
  }

  // 扣费 (按成功张数)
  if (totalSucceeded > 0) {
    const chargedAmount = totalSucceeded * IMAGE_VARIANT_PRICE;
    const balanceAfter = Math.round(((user.balance || 0) - chargedAmount) * 100) / 100;
    await userModel.updateBalance(userId, -chargedAmount);
    await execute(
      `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
       VALUES (?, ?, 'consumption', ?, ?, ?, ?, 0, ?)`,
      [uuidv4(), userId, chargedAmount, balanceAfter, char.novelId, `角色图片生成(${totalSucceeded}张) - ${char.name}`, Date.now()],
    );
    websocketService.broadcastBalanceUpdate(char.novelId, balanceAfter);
  }

  // 合并到已有 variants (累加, 不覆盖)
  const existingRow = await queryOne<{ image_variants: any }>(
    'SELECT image_variants FROM characters WHERE id = ?',
    [characterId],
  );
  const existingVariants: ImageVariant[] = existingRow?.image_variants
    ? (typeof existingRow.image_variants === 'string' ? JSON.parse(existingRow.image_variants) : existingRow.image_variants)
    : [];
  const mergedMap = new Map<string, ImageVariant>();
  for (const v of existingVariants) mergedMap.set(v.angle, v);
  for (const v of variants) if (v.url) mergedMap.set(v.angle, v);
  const merged = Array.from(mergedMap.values());

  // 写库（三视图只要 1 张就算完成）
  const finalStatus: ImageGenStatus =
    totalSucceeded >= 1 ? 'completed' : 'failed';
  await execute(
    `UPDATE characters SET image_variants = ?, image_gen_status = ?, image_generated_at = ? WHERE id = ?`,
    [JSON.stringify(merged), finalStatus, Date.now(), characterId],
  );

  // 推送完成
  websocketService.broadcastProgress(char.novelId, 100, 'image_generating', {
    characterId,
    characterName: char.name,
    succeeded: totalSucceeded,
    failed: totalFailed,
    total: 1,
  });

  logger.info('generateImageVariants: 完成', {
    characterId,
    name: char.name,
    succeeded: totalSucceeded,
    failed: totalFailed,
    charged: totalSucceeded * IMAGE_VARIANT_PRICE,
   });


  return {
    characterId,
    characterName: char.name,
    totalRequested: 1,
    totalSucceeded,
    totalFailed,
    charged: totalSucceeded * IMAGE_VARIANT_PRICE,
    variants: merged,
  };
  } finally {
    unlockGeneration(characterId);
  }
}

// ════════════════════════════════════════════════════════════
//  4. 镜头级生图
// ════════════════════════════════════════════════════════════

export interface ShotImageGenResult {
  shotId: string;
  imageUrl: string;
  charged: number;
}

/**
 * 为单个镜头生成参考图
 * 选前 2 角色 + 镜头描述合成 prompt
 */
export async function generateImageForShot(
  shotId: string,
  userId: string,
): Promise<ShotImageGenResult> {
  const shot = await queryOne<any>('SELECT * FROM shots WHERE id = ?', [shotId]);
  if (!shot) throw new Error('镜头不存在');

  // 解析 characterIds
  let characterIds: string[] = [];
  if (shot.character_ids) {
    characterIds = typeof shot.character_ids === 'string'
      ? JSON.parse(shot.character_ids)
      : shot.character_ids;
  }

  // 拉取小说画风
  const novel = await novelModel.findById(shot.episode_id ? (await getNovelIdByEpisodeId(shot.episode_id)) : '');
  const styleId = ((novel?.styleId as StylePresetId) || 'realistic');

  // 选前 2 角色
  const characters = characterIds.length > 0
    ? await queryAll<any>('SELECT * FROM characters WHERE id IN (?)', [characterIds.slice(0, 2)])
    : [];

  // 合成 prompt (v2.5.13: 优先用 prompt_safe_description)
  const charDesc = characters.map((c: any) => {
    const desc = c.description ? (typeof c.description === 'string' ? JSON.parse(c.description) : c.description) : null;
    if (!desc) return c.name;
    // 优先用 prompt_safe_description (LLM 按风格生成的完整描述)
    if (desc.prompt_safe_description) return desc.prompt_safe_description;
    // fallback: 用详细字段拼接
    const clothing = [desc.clothing_top, desc.clothing_bottom, desc.clothing_outer].filter(Boolean).join(', ');
    return `${desc.name || c.name}, ${desc.build || ''} build, ${clothing || desc.clothes || ''}`;
  }).filter(Boolean).join(' with ');

  // 注入风格圣经
  const { buildStyleAnchorPrefix: buildAnchor } = await import('./styleBible');
  const styleBible = novel?.styleBible ? (typeof novel.styleBible === 'string' ? JSON.parse(novel.styleBible) : novel.styleBible) : null;
  const styleAnchor = styleBible ? buildAnchor(styleBible, 'en') : '';

  const prompt = [
    styleAnchor,
    charDesc,
    `${shot.scene_type || ''} ${shot.location || ''}`,
    shot.time_of_day ? `at ${shot.time_of_day}` : '',
    shot.description || '',
    shot.camera_angle ? `${shot.camera_angle} shot` : '',
    shot.lighting ? `${shot.lighting} lighting` : '',
  ].filter(Boolean).join(', ');

  // 余额检查
  const user = await userModel.findById(userId);
  if (!user) throw new Error('用户不存在');
  if ((user.balance || 0) < IMAGE_VARIANT_PRICE) {
    throw new Error(`余额不足, 需要 ¥${IMAGE_VARIANT_PRICE.toFixed(2)}`);
  }

  // 生成
  const provider = await import('./imageProvider');
  const result = await provider.getDefaultImageProvider().generate({
    prompt,
    styleId,
    angle: 'full_body',
  });

  // 扣费
  const balanceAfter = Math.round(((user.balance || 0) - IMAGE_VARIANT_PRICE) * 100) / 100;
  await userModel.updateBalance(userId, -IMAGE_VARIANT_PRICE);
  await execute(
    `INSERT INTO billing_logs (id, user_id, type, amount, balance_after, novel_id, description, word_count, created_at)
     VALUES (?, ?, 'consumption', ?, ?, ?, ?, 0, ?)`,
    [uuidv4(), userId, IMAGE_VARIANT_PRICE, balanceAfter, novel?.id || '', `镜头图片生成 - ${shotId}`, Date.now()],
  );

  // 写库
  await execute(
    `UPDATE shots SET image_url = ?, image_prompt = ?, image_generated_at = ?, style_id = ?, character_ids = ? WHERE id = ?`,
    [result.url, prompt, Date.now(), styleId, JSON.stringify(characterIds.slice(0, 2)), shotId],
  );

  if (novel?.id) {
    websocketService.broadcastBalanceUpdate(novel.id, balanceAfter);
  }

  logger.info('generateImageForShot: 完成', { shotId, charged: IMAGE_VARIANT_PRICE });

  return { shotId, imageUrl: result.url, charged: IMAGE_VARIANT_PRICE };
}

async function getNovelIdByEpisodeId(episodeId: string): Promise<string> {
  const row = await queryOne<{ novel_id: string }>('SELECT novel_id FROM episodes WHERE id = ?', [episodeId]);
  return row?.novel_id || '';
}

// ════════════════════════════════════════════════════════════
//  5. 角色查询
// ════════════════════════════════════════════════════════════

export async function findCharacterById(characterId: string): Promise<Character | null> {
  const row = await queryOne<any>('SELECT * FROM characters WHERE id = ?', [characterId]);
  if (!row) return null;
  return mapRowToCharacterV2(row);
}

/**
 * v2.5.35: 替换 markdown 文本中的英文 key 为中文标签
 * 例: "- age: 18岁" → "- 年龄: 18岁"
 * 适用于: 已转换的新格式 description
 */
function relabelEnglishKeys(text: string): string {
  if (!text) return text;
  const KEY_LABEL: Record<string, string> = {
    age: '年龄', gender: '性别', height: '身高', build: '体型', skin: '肤色', makeup: '妆容',
    face: '脸型', eyes: '眼睛', eyebrows: '眉毛', nose: '鼻子', lips: '嘴唇', ears: '耳朵',
    hair_color: '发色', hair_style: '发型', hair_length: '发长', hair_texture: '发质', hair_accessories: '发饰',
    clothing_top: '上衣', clothing_bottom: '下装', clothing_outer: '外套', clothing_shoes: '鞋', clothing_underwear: '内衣', clothing_socks: '袜',
    acessories_neck: '颈部配饰', accessories_neck: '颈部配饰', acessórios_ears: '耳饰', accessories_ears: '耳饰', accessories_hands: '手部配饰', accessories_waist: '腰饰', accessories_other: '其他配饰',
    props: '道具', distinctive_features: '显著特征', default_expression: '默认表情',
    emotional_range: '情绪范围', body_language: '肢体语言', personality_visual: '性格(视觉)',
    social_class_visual: '社会阶层(视觉)', personality: '性格',
    prompt_safe_description: '生图提示词', relationships: '关系', _relationships: '关系',
    role_type: '角色类型', 'role type': '角色类型', name: '姓名',
    // 空格分隔的 key 别名 (旧 normalize 输出用空格)
    'hair color': '发色', 'hair style': '发型', 'hair length': '发长',
    'hair texture': '发质', 'hair accessories': '发饰',
    'clothing top': '上衣', 'clothing bottom': '下装', 'clothing outer': '外套',
    'clothing shoes': '鞋', 'clothing underwear': '内衣', 'clothing socks': '袜',
    'accessories neck': '颈部配饰', 'accessories ears': '耳饰',
    'accessories hands': '手部配饰', 'accessories waist': '腰饰', 'accessories other': '其他配饰',
    'distinctive features': '显著特征', 'default expression': '默认表情',
    'emotional range': '情绪范围', 'body language': '肢体语言',
    'personality visual': '性格(视觉)', 'social class visual': '社会阶层(视觉)',
  };
  // 匹配 "- key: value" 模式, 替换 key
  return text.replace(/^(\s*-\s*)([a-z_][a-z0-9_ ]*)(:)/gim, (m, prefix, key, colon) => {
    const label = KEY_LABEL[key] || key.replace(/_/g, ' ');
    return prefix + label + colon;
  });
}

export async function listCharactersByNovel(novelId: string): Promise<Character[]> {
  const rows = await queryAll<any>('SELECT * FROM characters WHERE novel_id = ? ORDER BY role_type, created_at', [novelId]);
  return rows.map(mapRowToCharacterV2);
}

function mapRowToCharacterV2(row: any): Character {
  const base: Character = {
    id: row.id,
    novelId: row.novel_id,
    name: row.name,
    aliases: typeof row.aliases === 'string' ? JSON.parse(row.aliases || '[]') : (row.aliases || []),
    appearance: row.appearance,
    personality: row.personality,
    roleType: row.role_type,
    relationships: typeof row.relationships === 'string' ? JSON.parse(row.relationships || '[]') : (row.relationships || []),
    referenceImage: row.reference_image,
    createdAt: row.created_at,
  };
  // v2.0 扩展字段
  // v2.5.34: description / extra_description 改为自由文本字符串, 不再 JSON.parse
  if (row.description) {
    (base as any).description = typeof row.description === 'string' ? row.description : JSON.stringify(row.description);
  }
  if (row.extra_description) {
    (base as any).extraDescription = typeof row.extra_description === 'string' ? row.extra_description : JSON.stringify(row.extra_description);
  }
  if (row.style_id) (base as any).styleId = row.style_id;
  if (row.confirmed !== undefined) (base as any).confirmed = !!row.confirmed;
  if (row.image_variants) {
    (base as any).imageVariants = typeof row.image_variants === 'string' ? JSON.parse(row.image_variants) : row.image_variants;
  }
  if (row.image_gen_status) (base as any).imageGenStatus = row.image_gen_status;
  if (row.confirmed_at) (base as any).confirmedAt = row.confirmed_at;
  if (row.image_generated_at) (base as any).imageGeneratedAt = row.image_generated_at;
  return base;
}
