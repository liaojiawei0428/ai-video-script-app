/**
 * useCachedMedia hook (Stage 2 v3.0.43, 跨端铁律 4++)
 *
 * web 端用浏览器原生 Cache API + IndexedDB (跟 mobile mediaCache.ts 同 API 1:1)
 *
 * 用法:
 *   const { source, onLoaded, refresh } = useCachedMedia(url);
 *   <ImageWithLoading src={source} onLoaded={onLoaded} ... />
 *
 * 原理:
 * - mount 时查 IndexedDB → 命中立即用 blob: URL
 * - 未命中 → 用原 URL 渲染 + 触发 fetch 缓存到 IndexedDB
 */

import { useEffect, useState, useCallback } from 'react';

const DB_NAME = 'media-cache-v3';
const STORE_NAME = 'files';
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

// 单例 IndexedDB 句柄
let dbPromise: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/**
 * 简单 hash (32 chars hex, 跟 mobile cache 风格一致)
 */
function hashUrl(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const reverse = hex.split('').reverse().join('');
  return `${hex}${reverse}`.padStart(16, '0');
}

/**
 * 查本地缓存
 */
async function getCached(url: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) {
          resolve(null);
          return;
        }
        // 检查大小 (LRU 触发)
        enforceLRU().catch(() => {});
        resolve(URL.createObjectURL(entry.blob));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 存到本地缓存
 */
async function cacheFromUrl(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ url, blob, size: blob.size, hash: hashUrl(url), cachedAt: Date.now(), lastAccessed: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/**
 * LRU 淘汰 (简版, 按 cachedAt 删最旧)
 */
async function enforceLRU(): Promise<void> {
  try {
    const db = await openDB();
    const all: any[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const totalBytes = all.reduce((s, e) => s + (e.size || 0), 0);
    if (totalBytes <= MAX_SIZE && all.length <= 1000) return;
    all.sort((a, b) => a.cachedAt - b.cachedAt);
    const toDelete = all.slice(0, Math.max(1, Math.floor(all.length * 0.1)));
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const e of toDelete) store.delete(e.url);
  } catch {
    // ignore
  }
}

export function useCachedMedia(url: string | undefined) {
  const [source, setSource] = useState<string | undefined>(url);

  useEffect(() => {
    if (!url) {
      setSource(undefined);
      return;
    }

    let mounted = true;
    let blobUrl: string | null = null;

    getCached(url).then(local => {
      if (!mounted) {
        if (local) URL.revokeObjectURL(local);
        return;
      }
      if (local) {
        blobUrl = local;
        setSource(local);
      } else {
        setSource(url);
      }
    }).catch(() => {
      if (mounted) setSource(url);
    });

    return () => {
      mounted = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  const onLoaded = useCallback(async (_loadedSrc: string) => {
    if (!url) return;
    await cacheFromUrl(url);
  }, [url]);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const db = await openDB();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(url);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      await cacheFromUrl(url);
    } catch {
      // ignore
    }
    setSource(url);
  }, [url]);

  return { source, onLoaded, refresh };
}