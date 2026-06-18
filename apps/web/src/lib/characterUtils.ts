// apps/web/src/lib/characterUtils.ts
// v2.5.34: 角色描述字段工具函数
// 兼容: 旧版 11 字段 JSON 对象 / 新版自由文本字符串 / 双层 JSON 字符串 (LLM 误返回 JSON 对象转义字符串)

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

/**
 * 角色类型 → 中文标签 + 颜色
 */
export function getRoleLabel(role?: string): string {
  return role === 'protagonist' ? '主角'
    : role === 'antagonist' ? '反派'
    : role === 'supporting' ? '配角'
    : role === 'minor' ? '次要'
    : role || '';
}

export function getRoleColor(role?: string): string {
  if (role === 'protagonist') return 'bg-pink-500/20 text-pink-300';
  if (role === 'antagonist') return 'bg-red-500/20 text-red-300';
  if (role === 'supporting') return 'bg-blue-500/20 text-blue-300';
  return 'bg-gray-500/20 text-gray-300';
}
