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
  CharacterExtraDescription,
  StylePresetId,
  ImageVariant,
  ImageGenStatus,
} from '../shared/types';

// 变体图扣费单价
const IMAGE_VARIANT_PRICE = 0.1; // ¥0.1/张 (GLM-Image)

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
  characters: Array<{ id: string; name: string; description: CharacterDescription; extraDescription: CharacterExtraDescription }>;
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
  const { buildStyleAnchorPrefix } = await import('./styleBible');
  const styleBibleBlock = (novel && (novel as any).styleBible) ? buildStyleAnchorPrefix((novel as any).styleBible, 'zh') : undefined;

  // v2.5.13: 从分析报告中提取时代背景, 注入角色描述 prompt
  // 解决: 古风小说 + realistic 画风 → 角色穿现代服装的问题
  const eraContext = extractEraContext(novel?.analysisReport || '');

  const userPrompt = buildCharacterDescriptionUserPrompt(
    fullSummary,
    characters.map(c => c.name),
    novelTitle || '未命名',
    styleBibleBlock,
    eraContext,
  );

  let parsedDescriptions: Array<Record<string, any>> = [];
  try {
    const llmResult = await deepseekPool.chatCompletionWithRetry(
      CHARACTER_DESCRIPTION_SYSTEM_PROMPT(styleBibleBlock),
      userPrompt,
      0.5,
      2,
    );

    // 解析 JSON（容错）
    const jsonText = extractJsonArray(llmResult.content);
    parsedDescriptions = JSON.parse(jsonText);
  } catch (err) {
    logger.error('extractDescriptions: LLM 解析失败', { novelId, error: err });
    // 失败时回退到 name 兜底
    parsedDescriptions = characters.map(c => ({
      ...makeFallbackDescription(c),
      ...makeFallbackExtraDescription(c),
    } as any));
  }

  // 按 name 匹配并写库
  const result: CharacterDescriptionGenResult['characters'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const char of characters) {
    const matched = parsedDescriptions.find(
      p => p.name === char.name || (char.aliases || []).includes(p.name),
    );
    if (matched) {
      try {
        // 存储完整描述对象（包含所有详细字段）
        const fullDescription = { ...matched };
        // 额外字段单独存储（用于快速访问）
        const extraDescription: any = {
          prompt_safe_description: matched.prompt_safe_description || '',
          negative_prompt_suggestion: matched.negative_prompt_suggestion || '',
          color_palette: matched.color_palette || [],
          do_not_change: matched.do_not_change || [],
          clothing_top: matched.clothing_top || '',
          clothing_bottom: matched.clothing_bottom || '',
          clothing_outer: matched.clothing_outer || '',
          clothing_shoes: matched.clothing_shoes || '',
          accessories_neck: matched.accessories_neck || '',
          accessories_ears: matched.accessories_ears || '',
          accessories_hands: matched.accessories_hands || '',
          accessories_waist: matched.accessories_waist || '',
          accessories_other: matched.accessories_other || '',
          props: matched.props || '',
          makeup: matched.makeup || '',
          default_expression: matched.default_expression || '',
          emotional_range: matched.emotional_range || '',
          body_language: matched.body_language || '',
        };
        await execute(
          `UPDATE characters SET description = ?, extra_description = ?, style_id = ?, confirmed = 0, image_gen_status = 'none' WHERE id = ?`,
          [
            JSON.stringify(fullDescription),
            JSON.stringify(extraDescription),
            styleId,
            char.id,
          ],
        );
        result.push({
          id: char.id,
          name: char.name,
          description: fullDescription as any,
          extraDescription,
        });
        succeeded++;
      } catch (err) {
        logger.error('extractDescriptions: 写库失败', { characterId: char.id, error: err });
        failed++;
      }
    } else {
      // 未匹配的角色用兜底描述
      try {
        const fallbackDesc = makeFallbackDescription(char);
        const fallbackExtra = makeFallbackExtraDescription(char);
        await execute(
          `UPDATE characters SET description = ?, extra_description = ?, style_id = ?, confirmed = 0, image_gen_status = 'none' WHERE id = ?`,
          [JSON.stringify(fallbackDesc), JSON.stringify(fallbackExtra), styleId, char.id],
        );
        result.push({
          id: char.id,
          name: char.name,
          description: fallbackDesc,
          extraDescription: fallbackExtra,
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

function makeFallbackDescription(c: Character): CharacterDescription {
  return {
    name: c.name,
    age: '未知',
    height: '未知',
    build: '未知',
    face: '未知',
    features: '未知',
    hair: '未知',
    signature: '未知',
    clothes: '未知',
    personality: c.personality || '未知',
    aliases: c.aliases || [],
  };
}

function makeFallbackExtraDescription(c: Character): CharacterExtraDescription {
  const rels = (c.relationships || [])
    .map(r => `${r.target}的${r.relation}`)
    .join(', ');
  return {
    relationshipsText: rels || '未知',
    emotionRange: '未知',
    actionHabits: '未知',
    signatureLines: '未知',
  };
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
  userEdits: { description: CharacterDescription; extraDescription: CharacterExtraDescription },
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
  const desc = (typeof char.description === 'string' ? JSON.parse(char.description || '{}') : (char.description || {})) as any;
  const extraDesc = (typeof char.extraDescription === 'string' ? JSON.parse(char.extraDescription || '{}') : (char.extraDescription || {})) as any;

  const { buildCharacterSheetPrompt } = await import('./characterSheetPrompt');
  const { buildStyleAnchorPrefix, buildStyleNegativePrompt, buildStyleBibleJsonBlock } = await import('./styleBible');

  // v2.5.9: 获取 styleBible 并注入
  const novelWithBible = await queryOne<any>('SELECT style_bible FROM novels WHERE id = ?', [char.novelId]);
  const styleBible = novelWithBible?.style_bible ? (typeof novelWithBible.style_bible === 'string' ? JSON.parse(novelWithBible.style_bible) : novelWithBible.style_bible) : null;

  // 构造详细角色数据（兼容新旧格式）
  const sheetData: Record<string, any> = {
    name: char.name,
    styleId,
  };

  // 从 description 提取所有详细字段（新格式：所有字段在顶层）
  const descFields = [
    'gender', 'age', 'height', 'build', 'face', 'skin',
    'eyes', 'eyebrows', 'nose', 'lips', 'ears',
    'hair_color', 'hair_style', 'hair_length', 'hair_texture', 'hair_accessories',
    'clothing_top', 'clothing_bottom', 'clothing_outer', 'clothing_shoes', 'clothing_underwear', 'clothing_socks',
    'accessories_neck', 'accessories_ears', 'accessories_hands', 'accessories_waist', 'accessories_other',
    'props', 'distinctive_features', 'makeup',
    'default_expression', 'emotional_range', 'body_language',
    'personality_visual', 'social_class_visual',
    'prompt_safe_description', 'negative_prompt_suggestion',
  ];
  for (const key of descFields) {
    if (desc[key]) sheetData[key] = desc[key];
  }

  // 兼容旧格式（从 extraDesc 补充）
  if (!sheetData.clothing_top && extraDesc.clothing_top) sheetData.clothing_top = extraDesc.clothing_top;
  if (!sheetData.clothing_bottom && extraDesc.clothing_bottom) sheetData.clothing_bottom = extraDesc.clothing_bottom;
  if (!sheetData.clothing_outer && extraDesc.clothing_outer) sheetData.clothing_outer = extraDesc.clothing_outer;
  if (!sheetData.clothing_shoes && extraDesc.clothing_shoes) sheetData.clothing_shoes = extraDesc.clothing_shoes;
  if (!sheetData.accessories_neck && extraDesc.accessories_neck) sheetData.accessories_neck = extraDesc.accessories_neck;
  if (!sheetData.accessories_ears && extraDesc.accessories_ears) sheetData.accessories_ears = extraDesc.accessories_ears;
  if (!sheetData.accessories_hands && extraDesc.accessories_hands) sheetData.accessories_hands = extraDesc.accessories_hands;
  if (!sheetData.props && extraDesc.props) sheetData.props = extraDesc.props;
  if (!sheetData.makeup && extraDesc.makeup) sheetData.makeup = extraDesc.makeup;
  if (!sheetData.default_expression && extraDesc.default_expression) sheetData.default_expression = extraDesc.default_expression;
  if (!sheetData.prompt_safe_description && extraDesc.prompt_safe_description) sheetData.prompt_safe_description = extraDesc.prompt_safe_description;

  // 兜底：从旧格式字段补充
  if (!sheetData.gender) sheetData.gender = char.gender || '';
  if (!sheetData.clothing_top && desc.clothes) sheetData.clothing_top = desc.clothes;
  if (!sheetData.distinctive_features && desc.signature) sheetData.distinctive_features = desc.signature;
  if (!sheetData.eyes && desc.features) sheetData.eyes = desc.features;

  const sheetPrompt = buildCharacterSheetPrompt(sheetData as any, styleBible);
  // v2.5.13: styleBible 已注入到 buildCharacterSheetPrompt 内部, 不再需要外层拼接
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
  if (row.description) {
    (base as any).description = typeof row.description === 'string' ? JSON.parse(row.description) : row.description;
  }
  if (row.extra_description) {
    (base as any).extraDescription = typeof row.extra_description === 'string' ? JSON.parse(row.extra_description) : row.extra_description;
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
