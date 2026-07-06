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
export declare const SUPPORTED_RATIOS: Record<string, [number, number]>;
/**
 * v3.0.0.17: 把 aspectRatio 字符串 (支持 '16:9' / '4K' / '8K' / '1152x768' / '1280*720') 解析为 [w, h]
 *   - 失败返回 null
 *   - 是 SUPPORTED_RATIOS 的 key → 查表
 *   - 是 WxH / W*H / W×H 格式 → 解析数字
 *   - 是 'auto' / 空 / null → 返回 null (调用方用 default)
 */
export declare function parseAspectToDims(ratio: string | null | undefined): [number, number] | null;
/**
 * 解析文本中的比例/尺寸关键词
 * 返回 agens image API 支持的 WxH 字符串 (如 "1152x768"), 找不到返回 null
 *
 * v3.0.0.7 fix: 按 message 边界分割 (默认 \n), **从最后一条反向搜索**,
 * 保证用户最新指令优先 (chat 1 说 "8K超细节" 不影响 chat 2 说 "比例换成1280x720")
 */
export declare function parseAspectRatioFromText(text: string): string | null;
