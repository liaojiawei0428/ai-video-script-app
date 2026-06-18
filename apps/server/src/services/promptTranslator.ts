// apps/server/src/services/promptTranslator.ts
// v3.0.0.29 (S49): 中文角色描述 → 英文 prompt 翻译 (保留摄影/绘画 trigger 词)
//
// 设计: UI 给 user 看中文, agens image model 收到 EN (跟训练分布一致)
// 调用: translateCharacterDescriptionToEnglish(zhText) 替换 buildCharacterSheetPrompt 输入的 prompt_safe_description
// 失败 fallback: catch err, logger.warn, return zhText 原样 + ' photographic' 兜底 trigger

import { logger } from '../utils/logger';
import { agnesTextProvider } from './agnesTextProvider';

const TRANSLATOR_SYSTEM_PROMPT = [
  '你是摄影/绘画专业术语翻译专家. 把以下中文角色描述翻译成专业英文 prompt.',
  '要求:',
  '1) 保留摄影/绘画 trigger 词 (photorealistic, 85mm, bokeh, cinematic, 8k uhd, studio soft light, three-point lighting, character turnaround, masterpiece, best quality, ultra detailed, highly detailed 等)',
  '2) 保留结构化关键词 (task/style/composition/identity/face details/do_not_change/expression 等)',
  '3) 中文量词/形容词对应英文: 瓜子脸=oval face, 杏眼=almond eyes, 柳叶眉=arched eyebrows, 樱桃小嘴=cherry lips, 鹅蛋脸=egg-shaped face, 丹凤眼=phoenix eyes (upturned eyes), 柳眉=arched brows, 樱桃小口=small cherry lips, 挺鼻=straight nose, 高鼻梁=high nose bridge, 飘逸长发=flowing long hair',
  '4) 输出纯英文, 不要解释, 不要 markdown, 不要前缀 (直接给英文 prompt)',
  '5) 描述人物外观特征, 保持客观, 不要加入色情/暴力/歧视内容',
].join(' ');

/**
 * 把中文角色视觉描述翻译成专业英文 prompt (给 agens image model 用)
 * @param zhText 中文角色描述 (来自 UI prompt_safe_description 或 LLM generate 的中文)
 * @returns 英文 prompt 字符串 (保留 trigger 词)
 */
export async function translateCharacterDescriptionToEnglish(zhText: string): Promise<string> {
  const trimmed = (zhText || '').trim();
  if (!trimmed) return '';

  // 已经是英文就不翻译 (含 ASCII > 80% 视为英文)
  const asciiCount = (trimmed.match(/[\x20-\x7E]/g) || []).length;
  if (asciiCount / trimmed.length > 0.8) {
    logger.info('promptTranslator: skip, already english', { len: trimmed.length });
    return trimmed;
  }

  try {
    const result = await agnesTextProvider.chatCompletion({
      messages: [
        { role: 'system', content: TRANSLATOR_SYSTEM_PROMPT },
        { role: 'user', content: trimmed },
      ],
      temperature: 0.3,
      maxTokens: 1024,
      enableThinking: false,  // 翻译任务不需要 thinking, 关掉提速
    });
    const translated = (result.content || '').trim();
    if (!translated) {
      throw new Error('translator 返回空字符串');
    }
    logger.info('promptTranslator: translated', {
      originalLen: trimmed.length,
      translatedLen: translated.length,
      hasTriggerWords: /photorealistic|85mm|bokeh|cinematic|8k uhd/.test(translated),
    });
    return translated;
  } catch (err: any) {
    // 失败 fallback: 原文 + 'photographic' 兜底 trigger, 不让 sheet gen 崩
    logger.warn('promptTranslator: failed, using fallback (original + photographic)', {
      originalLen: trimmed.length,
      error: err?.message || String(err),
    });
    return `${trimmed} photographic`;
  }
}
