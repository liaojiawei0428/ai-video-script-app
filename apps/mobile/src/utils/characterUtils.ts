// apps/mobile/src/utils/characterUtils.ts
// v3.0.41 (BUG-105 mobile 端 sync): 角色描述字段工具函数
// 跟 web 端 apps/web/src/lib/characterUtils.ts v2.5.34 1:1 对齐 (除 getRoleLabel/getRoleColor — mobile 端用 theme/character.ts)
// 兼容: 旧版 11 字段 JSON 对象 / 新版自由文本字符串 / 双层 JSON 字符串 (LLM 误返回 JSON 对象转义字符串)
//
// 背景 (BUG-105 S72 batch 7 后置, BUG-097 mobile 漏修 web 同源):
//   - server v3.0.40 重设计角色分析 prompt, description 改为 Markdown 自由文本
//   - web 端 v2.5.34 早已就绪 (S63), 用 characterUtils.ts 4 种格式兼容
//   - mobile 端 v3.0.29 UI redesign 时, 漏了 web 端的兼容逻辑, 硬编码 11 字段 (height/build/face/...)
//   - 结果: mobile 端 GET /characters 收到 JSON 字符串 description, 直接原样显示给用户, 包含 \n 转义符, 完全不可读
//   - 修法: 移植 web 版完整逻辑, 3 个 screen 改用本 utils

/**
 * 从 description 字段提取可读文本
 * 4 种可能:
 * 1. 新格式 (自由文本字符串): 直接返回
 * 2. 旧格式 (11 字段 JSON 对象): 拼成 "- key: value" 列表
 * 3. 旧格式 (11 字段 JSON 字符串): 解析为对象, 拼成列表
 * 4. 双层 JSON 字符串 (LLM 误返回): 递归解析, 直到内层不是 JSON 为止
 */
export function extractDescriptionText(d: any): string {
  if (!d) return '';
  if (typeof d === 'string') {
    return parseStringToText(d);
  }
  if (typeof d === 'object' && d !== null) {
    return objectToText(d);
  }
  return '';
}

/**
 * 递归解析字符串: 一直解析到非 JSON 字符串为止
 */
function parseStringToText(s: string, maxDepth = 3): string {
  if (!s || !s.trim()) return '';
  const trimmed = s.trim();
  // 顶层是 JSON 字符串 (用双引号包裹, 内容是 JSON): 解析一层
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const inner = JSON.parse(trimmed);
      if (typeof inner === 'string') {
        return parseStringToText(inner, maxDepth - 1);
      }
      if (typeof inner === 'object' && inner !== null) {
        return objectToText(inner);
      }
    } catch { /* 不是合法 JSON 字符串, 当作新格式返回 */ }
  }
  // 顶层是 JSON 对象 (用 {} 包裹): 解析为对象
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (typeof obj === 'object' && obj !== null) {
        return objectToText(obj);
      }
    } catch { /* 不是合法 JSON, 当作新格式返回 */ }
  }
  return s;
}

/**
 * 把对象拼成可读文本
 * 排除 name 字段 (通常是角色名, 不必重复显示)
 */
export function objectToText(obj: any): string {
  if (!obj || typeof obj !== 'object') return '';
  return Object.entries(obj)
    .filter(([k, v]) => k !== 'name' && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) return `- ${k}: ${v.join(', ')}`;
      if (typeof v === 'object') return `- ${k}: ${JSON.stringify(v)}`;
      // 字段值也可能是 JSON 字符串, 递归解
      if (typeof v === 'string' && (v.trim().startsWith('{') || (v.trim().startsWith('"') && v.trim().endsWith('"')))) {
        const cleaned = extractDescriptionText(v);
        if (cleaned !== v) return `- ${k}: ${cleaned.split('\n').join(' | ')}`;
      }
      return `- ${k}: ${v}`;
    })
    .join('\n');
}

/**
 * 从长描述中提取前 max 字符作为摘要
 * 跳过 markdown 标题和列表项, 取第一段正文
 */
export function summaryOf(text: string, max = 80): string {
  if (!text) return '';
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#') || t.startsWith('-') || t.startsWith('*') || t.startsWith('>')) continue;
    return t.length > max ? t.slice(0, max) + '...' : t;
  }
  return text.slice(0, max);
}