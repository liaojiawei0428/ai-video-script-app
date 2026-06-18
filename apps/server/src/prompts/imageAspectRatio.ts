/**
 * imageAspectRatio.ts — v3.0.0.7 比例尺寸解析器
 *
 * 用户常用各种方式表达比例:
 *   - "16:9" / "9:16" / "4:3" / "3:4" / "1:1" / "2:3" / "3:2"
 *   - "2048x2048" / "1280*720" / "1024 × 768"
 *   - "4K" / "2K" / "8K"
 *
 * LLM 经常漏掉这个字段 (因为 aspectRatio 不在 plan_fields 10 字段里),
 * server 端主动 parse user message 提取, 不依赖 LLM
 */

export const SUPPORTED_RATIOS: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '2:3': [768, 1152],
  '3:2': [1152, 768],
  '3:4': [768, 1024],
  '4:3': [1024, 768],
  '9:16': [768, 1152],
  '16:9': [1152, 768],
  '2K': [1280, 1280],       // 1440x1440 实际 2K
  '4K': [2048, 2048],       // 3840x2160 4K 简化
  '8K': [2048, 2048],       // agens 限制 2048 max
};

/**
 * v3.0.0.17: 把 aspectRatio 字符串 (支持 '16:9' / '4K' / '8K' / '1152x768' / '1280*720') 解析为 [w, h]
 *   - 失败返回 null
 *   - 是 SUPPORTED_RATIOS 的 key → 查表
 *   - 是 WxH / W*H / W×H 格式 → 解析数字
 *   - 是 'auto' / 空 / null → 返回 null (调用方用 default)
 */
export function parseAspectToDims(ratio: string | null | undefined): [number, number] | null {
  if (!ratio) return null;
  const r = ratio.trim();
  if (!r || r === 'auto') return null;

  // 1) WxH / W*H / W×H 数字
  const dimMatch = r.match(/^(\d{3,4})\s*[x*×]\s*(\d{3,4})$/);
  if (dimMatch) {
    const w = parseInt(dimMatch[1]);
    const h = parseInt(dimMatch[2]);
    if (w >= 256 && w <= 4096 && h >= 256 && h <= 4096) {
      return [w, h];
    }
  }

  // 2) SUPPORTED_RATIOS map (4K/8K/16:9/2:3 等)
  const dims = SUPPORTED_RATIOS[r];
  if (dims) return dims;

  // 3) 模糊匹配 (大小写不敏感, '4k' == '4K')
  for (const [key, val] of Object.entries(SUPPORTED_RATIOS)) {
    if (key.toLowerCase() === r.toLowerCase()) return val;
  }

  return null;
}

/**
 * 解析文本中的比例/尺寸关键词
 * 返回 agens image API 支持的 WxH 字符串 (如 "1152x768"), 找不到返回 null
 *
 * v3.0.0.7 fix: 按 message 边界分割 (默认 \n), **从最后一条反向搜索**,
 * 保证用户最新指令优先 (chat 1 说 "8K超细节" 不影响 chat 2 说 "比例换成1280x720")
 */
export function parseAspectRatioFromText(text: string): string | null {
  if (!text) return null;

  // 按 message 边界分割 (processTurn 用 \n join 所有 user messages)
  const messages = text.split(/\n+/).map(m => m.trim()).filter(Boolean);
  if (messages.length === 0) return null;

  // 1. 从最后一条 message 反向搜索
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];

    // 1a. 优先匹配具体尺寸 (更精确, "1280x720" 比 "16:9" 优先级高)
    const dimMatch = m.match(/(?<![a-zA-Z0-9])(\d{3,4})\s*[x*×]\s*(\d{3,4})(?![a-zA-Z0-9])/);
    if (dimMatch) {
      const w = parseInt(dimMatch[1]);
      const h = parseInt(dimMatch[2]);
      if (w >= 512 && w <= 2048 && h >= 512 && h <= 2048) {
        return `${w}x${h}`;
      }
    }

    // 1b. 匹配关键词 (16:9 / 4K / 2K 等)
    for (const [key, [w, h]] of Object.entries(SUPPORTED_RATIOS)) {
      const escapedKey = key.replace(':', '[:：]');
      const re = new RegExp(`(?<![a-zA-Z0-9])${escapedKey}(?![a-zA-Z0-9])`, 'i');
      if (re.test(m)) {
        return `${w}x${h}`;
      }
    }
  }

  return null;
}