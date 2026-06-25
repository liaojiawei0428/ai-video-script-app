// apps/server/src/utils/errorUtils.ts
// v3.0.32 (BUG-082 S71 后置): 错误消息统一提取工具
// 真实 BUG: video agent 写 messages JSON 时, part.message 被存为对象 {code, message}
//   根因: agnes API 返 {error: {code, message}}, server 没解包就存进 messages
//   结果: web 端 React 渲染 {part.message} (object) → React error #31 "object with keys {code, message}"
//
// 用法: const msg = extractErrorMessage(errorObj);  // 必返 string, 不会返 object
//   - string  → 原样返
//   - { code, message }  → message || code || '未知错误'
//   - Error  → error.message
//   - 其他对象 (含 {msg, error, ...})  → JSON.stringify 或 fallback
//   - null/undefined  → '' (空字符串, 调用方决定 fallback)
//   - number/boolean  → String()
export function extractErrorMessage(err: unknown, fallback: string = '未知错误'): string {
  if (err == null) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // 优先级 1: 标准 { code, message } 格式 (AppError / agnes / OpenAI 兼容)
    if (typeof obj.message === 'string' && obj.message.trim()) {
      // 如果 code 是 4xx 客户端错, 拼 code 给前端
      if (typeof obj.code === 'string' && obj.code && obj.code !== 'INTERNAL_ERROR') {
        return `${obj.message} (${obj.code})`;
      }
      return obj.message;
    }
    // 优先级 2: { msg } / { error: string } / { msg: string }
    if (typeof obj.msg === 'string' && obj.msg.trim()) return obj.msg;
    if (typeof obj.error === 'string' && obj.error.trim()) return obj.error;
    if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail;
    // 优先级 3: 嵌套 { error: { code, message } } (axios 风格)
    if (typeof obj.error === 'object' && obj.error !== null) {
      const nested = extractErrorMessage(obj.error, '');
      if (nested) return nested;
    }
    // 兜底: JSON.stringify (避免 React #31 渲染对象)
    try {
      const json = JSON.stringify(err);
      // 截断避免 UI 爆炸
      return json.length > 200 ? json.slice(0, 200) + '...' : json;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
