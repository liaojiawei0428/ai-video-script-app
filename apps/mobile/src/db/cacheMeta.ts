/**
 * Cache Meta 表 (S72 batch 17 v3.0.46 BUG-116 缓存方案 B.2)
 *
 * 跨端铁律 4++ (跟 web IndexedDB cache_meta 1:1 镜像):
 * - 持久化 URL → etag + body 映射
 * - 用于 axios interceptor 处理 304 Not Modified (从 cache_meta 返 body)
 *
 * 背景: 阶段 B ETag/304 机制:
 *   1. server etagMiddleware 算 ETag + If-None-Match 命中 → 304 不传 body
 *   2. axios 拦截器收到 304 → 不能直接 return (body 是空)
 *   3. 必须从 cache_meta 表读上次存的 body 返给调用方
 *
 * 跟 SQLite schema 1:1:
 *   CREATE TABLE cache_meta (url TEXT PRIMARY KEY, etag TEXT, body TEXT, status_code INTEGER, updated_at INTEGER)
 *   CREATE INDEX idx_cache_meta_updated_at ON cache_meta(updated_at)
 *
 * 跟 novel_hashes 表 (阶段 A.3) 区别:
 *   - novel_hashes: 客户端 hash 比对 (轻量级, 标题/状态等拼字符串)
 *   - cache_meta: server ETag 缓存 (重, 存完整 body)
 */

import { initDatabase } from './sqlite';

type DBType = Awaited<ReturnType<typeof import('react-native-sqlite-storage').openDatabase>>;

/**
 * 确保 cache_meta 表存在 (跟 novel_hashes 一样在 sqlite.ts 主 createTables 里建, 这里只是兜底)
 */
async function ensureTable(): Promise<DBType> {
  const db = await initDatabase();
  try {
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS cache_meta (
        url TEXT PRIMARY KEY,
        etag TEXT NOT NULL,
        body TEXT NOT NULL,
        status_code INTEGER DEFAULT 200,
        updated_at INTEGER NOT NULL
      )
    `);
    try { await db.executeSql('CREATE INDEX IF NOT EXISTS idx_cache_meta_updated_at ON cache_meta(updated_at)'); } catch { /* index may already exist */ }
  } catch (e) {
    console.warn('[cacheMeta] ensureTable failed', e);
  }
  return db;
}

/**
 * 存 ETag + body (server 返 200 时调)
 */
export async function setCachedResponse(url: string, etag: string, body: string, statusCode: number = 200): Promise<void> {
  const db = await ensureTable();
  await db.executeSql(
    `INSERT OR REPLACE INTO cache_meta (url, etag, body, status_code, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [url, etag, body, statusCode, Date.now()]
  );
}

/**
 * 取缓存的 ETag (请求时带 If-None-Match)
 */
export async function getCachedETag(url: string): Promise<string | null> {
  const db = await ensureTable();
  const [results] = await db.executeSql('SELECT etag FROM cache_meta WHERE url = ?', [url]);
  return results.rows.length > 0 ? results.rows.item(0).etag : null;
}

/**
 * 取缓存的 body (收到 304 时返)
 */
export async function getCachedBody(url: string): Promise<{ etag: string; body: string; statusCode: number } | null> {
  const db = await ensureTable();
  const [results] = await db.executeSql(
    'SELECT etag, body, status_code FROM cache_meta WHERE url = ?',
    [url]
  );
  if (results.rows.length === 0) return null;
  const row = results.rows.item(0);
  return { etag: row.etag, body: row.body, statusCode: row.status_code };
}

/**
 * 删除缓存 (DELETE 调用或 force refresh)
 */
export async function deleteCachedResponse(url: string): Promise<void> {
  const db = await ensureTable();
  await db.executeSql('DELETE FROM cache_meta WHERE url = ?', [url]);
}

/**
 * 清所有 cache_meta (用户手动清缓存, 跟 sqlite.ts clearAllLocalData 配套)
 */
export async function clearAllCacheMeta(): Promise<void> {
  const db = await ensureTable();
  await db.executeSql('DELETE FROM cache_meta');
}

/**
 * LRU 淘汰: 保留最新 500 条, 删老记录 (跟 mediaCache LRU 500MB 概念一致, 这里按条数)
 */
const MAX_CACHE_META_ENTRIES = 500;
export async function trimCacheMeta(): Promise<number> {
  const db = await ensureTable();
  const [countResults] = await db.executeSql('SELECT COUNT(*) as c FROM cache_meta');
  const count = countResults.rows.item(0).c;
  if (count <= MAX_CACHE_META_ENTRIES) return 0;
  const toDelete = count - MAX_CACHE_META_ENTRIES;
  await db.executeSql(
    `DELETE FROM cache_meta WHERE url IN (SELECT url FROM cache_meta ORDER BY updated_at ASC LIMIT ?)`,
    [toDelete]
  );
  return toDelete;
}

/**
 * 获取 cache_meta 统计 (debug 用)
 */
export async function getCacheMetaStats(): Promise<{ count: number; totalSizeBytes: number }> {
  const db = await ensureTable();
  const [countResults] = await db.executeSql('SELECT COUNT(*) as c FROM cache_meta');
  const [sizeResults] = await db.executeSql('SELECT SUM(LENGTH(body)) as s FROM cache_meta');
  return {
    count: countResults.rows.item(0).c,
    totalSizeBytes: sizeResults.rows.item(0).s || 0,
  };
}