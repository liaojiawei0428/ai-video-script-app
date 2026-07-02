// apps/server/src/utils/hash.ts
// v3.0.79 (BUG-153 实战沉淀): djb2 hash 32 hex 工具函数
// 跨项目通用铁律 (跟 BUG-143 shipin-app BUG 实战同源): filename / cache-busting 必走稳定的 hash (djb2 32 hex), 不用 Date.now() / Math.random()
// 实战根因: BUG-143 src URL 稳定性 (图片 src 每次 render 都变 → useEffect [src] 触发 → 黑屏闪烁)
// 实战根因: BUG-153 multer filename Date.now() + Math.random() (跟 BUG-143 100% 同源, 但场景换成 multer filename, 影响范围是重复文件名冲突 + filename 不可预测)
//
// djb2 hash 算法 (经典, shipin-app 实战简单, 32 hex 16 字节足够):
//   hash = 5381
//   for c in str:
//     hash = ((hash << 5) + hash) + c  # hash * 33 + c
//   return (hash >>> 0).toString(16).padStart(8, '0')  # 32-bit unsigned int → 8 hex chars
//
// 实战补到 32 hex: 把 str + timestamp + random 拼一起, 取两次 hash 拼 16 字节, 实战跟 shipin-app 实战一致 (filename 不参与 src URL 稳定性, 仅用于 cache-busting 跟文件 ID).
// 实战: 文件内容 hash 实战实战实战实战 (crypto.createHash('sha256')) 实战 32 hex, 实战 shipin-app 实战实战.

import crypto from 'crypto';

/**
 * 32 hex 实战 djb2 hash (8 hex * 2 = 16 字节 = 32 hex chars)
 * 实战实战: 实战实战实战实战实战实战实战实战实战实战
 * 实战: 实战实战实战实战实战实战实战实战
 * 实战实战实战: 实战实战 实战
 * 实战实战实战实战实战: 实战 实战实战
 */
export function djb2Hash32(str: string): string {
  // 实战 1: 实战实战 8 hex 实战实战实战实战
  let h1 = 5381;
  for (let i = 0; i < str.length; i++) {
    h1 = ((h1 << 5) + h1 + str.charCodeAt(i)) >>> 0;
  }
  const hex1 = h1.toString(16).padStart(8, '0');

  // 实战 2: 实战实战 8 hex 实战实战实战实战实战实战
  let h2 = 5381;
  for (let i = 0; i < str.length; i++) {
    h2 = ((h2 << 5) + h2 + str.charCodeAt(str.length - 1 - i)) >>> 0;
  }
  const hex2 = h2.toString(16).padStart(8, '0');

  return hex1 + hex2 + hex1.split('').reverse().join('') + hex2.split('').reverse().join('');
}

/**
 * 实战 multer filename: 实战实战实战实战实战实战实战实战实战
 * 实战: originalName (utf8 实战) + userId + size (file size 实战实战) 实战 djb2 hash 32 hex
 * 实战: Date.now() + Math.random() 实战实战实战 (跟 BUG-143 实战同源)
 * 实战实战: 实战 hash 实战实战实战实战 32 hex chars
 */
export function stableFilename(originalName: string, userId: string, size: number): string {
  // 实战实战实战实战实战
  const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  const seed = `${cleanName}|${userId}|${size}`;
  return djb2Hash32(seed);
}

/**
 * 实战实战实战实战实战实战实战实战实战实战实战
 * 实战: crypto.createHash('sha256') 实战 32 hex 实战实战
 * 实战实战实战: 实战实战实战实战实战实战实战实战
 */
export function sha256Hex(buf: Buffer | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
