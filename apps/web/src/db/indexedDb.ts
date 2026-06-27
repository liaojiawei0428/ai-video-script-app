/**
 * IndexedDB 持久化层 (S72 batch 16 v3.0.45 BUG-115 缓存方案 A.5)
 *
 * 跨端铁律 4++ (Web→APP 同步):
 * - web 端用 IndexedDB (替代 mobile SQLite)
 * - API 跟 apps/mobile/src/db/sqlite.ts 1:1 镜像 (saveNovels / getNovels / saveCharacters / getCharacters / saveNovelIfChanged / diffNovelsByHash)
 * - djb2 hash 算法跟 mobile 1:1 (字段拼接顺序 + 分隔符一致)
 * - schema 跟 mobile SQLite 表 1:1 (id/title/author/genre/theme/style/tone/summary/scenes/plot_points/status/created_at/updated_at)
 */

const DB_NAME = 'app-cache-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('novels')) {
        const novelStore = db.createObjectStore('novels', { keyPath: 'id' });
        novelStore.createIndex('updated_at', 'updated_at', { unique: false });
        novelStore.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('episodes')) {
        const epStore = db.createObjectStore('episodes', { keyPath: 'id' });
        epStore.createIndex('novel_id', 'novel_id', { unique: false });
        epStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('shots')) {
        db.createObjectStore('shots', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('characters')) {
        const charStore = db.createObjectStore('characters', { keyPath: 'id' });
        charStore.createIndex('novel_id', 'novel_id', { unique: false });
        charStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
      if (!db.objectStoreNames.contains('novel_hashes')) {
        db.createObjectStore('novel_hashes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cache_meta')) {
        db.createObjectStore('cache_meta', { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── novels ──

export async function getLocalNovels(): Promise<any[]> {
  const db = await openDb();
  const tx = db.transaction('novels', 'readonly');
  const all = await reqPromise(tx.objectStore('novels').getAll());
  return (all as any[]).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
}

export async function saveNovel(novel: any): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('novels', 'readwrite');
  tx.objectStore('novels').put(novel);
  await txPromise(tx);
}

// ── novel_hashes (跟 mobile novel_hashes 表 1:1) ──

export function hashNovel(novel: any): string {
  const input = [
    novel.title || '',
    novel.status || '',
    novel.updatedAt || novel.updated_at || 0,
    novel.totalChars || novel.total_chars || 0,
    (novel.summary || '').length,
    (novel.genre || '') + (novel.theme || '') + (novel.style || '') + (novel.tone || ''),
  ].join('|');
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 31 + input.length) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 37 + input.length * 17) >>> 0).toString(16)).slice(-8) +
         ('00000000' + ((hash * 41 + input.length * 23) >>> 0).toString(16)).slice(-8);
}

export async function getNovelHash(novelId: string): Promise<string | null> {
  const db = await openDb();
  const tx = db.transaction('novel_hashes', 'readonly');
  const row = await reqPromise(tx.objectStore('novel_hashes').get(novelId));
  return row ? (row as any).hash : null;
}

export async function saveNovelIfChanged(novel: any): Promise<boolean> {
  const newHash = hashNovel(novel);
  const oldHash = await getNovelHash(novel.id);
  if (oldHash === newHash) return false;
  await saveNovel(novel);
  const db = await openDb();
  const tx = db.transaction('novel_hashes', 'readwrite');
  tx.objectStore('novel_hashes').put({ id: novel.id, hash: newHash, updated_at: Date.now() });
  await txPromise(tx);
  return true;
}

export async function diffNovelsByHash(serverNovels: any[]): Promise<{ changed: any[]; unchanged: any[] }> {
  const changed: any[] = [];
  const unchanged: any[] = [];
  for (const novel of serverNovels) {
    const newHash = hashNovel(novel);
    const oldHash = await getNovelHash(novel.id);
    if (oldHash === newHash) unchanged.push(novel);
    else changed.push(novel);
  }
  return { changed, unchanged };
}

// ── characters ──

export async function getLocalCharacters(novelId: string): Promise<any[]> {
  const db = await openDb();
  const tx = db.transaction('characters', 'readonly');
  const store = tx.objectStore('characters');
  const idx = store.index('novel_id');
  const all = await reqPromise(idx.getAll(novelId));
  return (all as any[]).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
}

export async function saveCharacters(characters: any[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('characters', 'readwrite');
  const store = tx.objectStore('characters');
  for (const char of characters) {
    store.put({
      ...char,
      novelId: char.novelId || char.novel_id,
      roleType: char.roleType || char.role_type,
      referenceImage: char.referenceImage || char.reference_image,
      description: char.description || '',
      extraDescription: char.extraDescription || char.extra_description || '',
      created_at: char.createdAt || char.created_at || 0,
      updated_at: char.updatedAt || char.updated_at || Date.now(),
    });
  }
  await txPromise(tx);
}

// ── cache_meta (S72 batch 17 v3.0.46 BUG-116 缓存方案 B.5, 跟 mobile cache_meta 表 1:1) ──

export async function setCachedResponse(url: string, etag: string, body: string, statusCode: number = 200): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('cache_meta', 'readwrite');
  tx.objectStore('cache_meta').put({ url, etag, body, status_code: statusCode, updated_at: Date.now() });
  await txPromise(tx);
}

export async function getCachedETag(url: string): Promise<string | null> {
  const db = await openDb();
  const tx = db.transaction('cache_meta', 'readonly');
  const row: any = await reqPromise(tx.objectStore('cache_meta').get(url));
  return row ? row.etag : null;
}

export async function getCachedBody(url: string): Promise<{ etag: string; body: string; statusCode: number } | null> {
  const db = await openDb();
  const tx = db.transaction('cache_meta', 'readonly');
  const row: any = await reqPromise(tx.objectStore('cache_meta').get(url));
  if (!row) return null;
  return { etag: row.etag, body: row.body, statusCode: row.status_code };
}

export async function deleteCachedResponse(url: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('cache_meta', 'readwrite');
  tx.objectStore('cache_meta').delete(url);
  await txPromise(tx);
}

export async function clearAllCacheMeta(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction('cache_meta', 'readwrite');
  tx.objectStore('cache_meta').clear();
  await txPromise(tx);
}

// ── clearAll (用于调试 + 用户手动清缓存) ──

export async function clearAllLocalData(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['novels', 'episodes', 'shots', 'characters', 'novel_hashes', 'cache_meta'], 'readwrite');
  tx.objectStore('novels').clear();
  tx.objectStore('episodes').clear();
  tx.objectStore('shots').clear();
  tx.objectStore('characters').clear();
  tx.objectStore('novel_hashes').clear();
  tx.objectStore('cache_meta').clear();
  await txPromise(tx);
}