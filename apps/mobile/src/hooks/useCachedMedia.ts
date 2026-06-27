/**
 * useCachedMedia hook (Stage 2 v3.0.43, 跨端铁律 4++)
 *
 * 解决 5Mbps 带宽 + 图片/视频加载慢 (10-20 秒)
 *
 * v3.0.44 BUG-112 防御加固 (跨端铁律 4++ 跟 web 1:1):
 *   - SQLite native module 在某些 Android 设备 release build 抛错 → React unmount 白屏
 *   - 三层防御: safeImport mediaCache / safeSetSource / outer try-catch
 *   - 任何 throw 都 fallback 原 URL,绝不冒泡到 React componentDidCatch
 *
 * 用法:
 *   const { source, onLoaded, refresh } = useCachedMedia(url);
 *   <ImageWithLoading src={source} onLoaded={onLoaded} ... />
 *
 * 原理:
 * - mount 时查本地缓存 → 命中立即用本地 file:// 路径 (省 10s 网络)
 * - 未命中 → 用原 URL 渲染 (走网络, onLoaded 后异步下载到本地)
 * - 下次 mount 自动命中缓存
 *
 * 跟 web 端 useCachedMedia.ts API 1:1 (跨端铁律 4++)
 */

import { useEffect, useState, useCallback } from 'react';
import type * as MediaCacheType from '../utils/mediaCache';

// BUG-112 防御: 动态 import mediaCache, 任何 throw 都不会让 hook 初始化失败
let mediaCache: typeof MediaCacheType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mediaCache = require('../utils/mediaCache') as typeof MediaCacheType;
} catch (err) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[useCachedMedia] mediaCache import failed, fallback to URL only:', err);
  }
  mediaCache = null;
}

export function useCachedMedia(url: string | undefined) {
  const [source, setSource] = useState<string | undefined>(url);

  // BUG-112 防御: safeSetSource 包一层, 任何 throw 不冒泡
  const safeSetSource = useCallback((next: string | undefined) => {
    try {
      setSource(next);
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useCachedMedia] setSource throw:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!url) {
      safeSetSource(undefined);
      return;
    }

    let mounted = true;

    // BUG-112 防御: mediaCache import 失败时 (例如 SQLite native module 缺失)
    //   立即 setSource(url) fallback, 不进 async 链路
    if (!mediaCache) {
      safeSetSource(url);
      return;
    }

    // 1. 查本地缓存
    mediaCache.getCached(url).then(localPath => {
      try {
        if (!mounted) return;
        if (localPath) {
          safeSetSource(localPath);
        } else {
          // 2. 未命中 → 用原 URL
          safeSetSource(url);
        }
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[useCachedMedia] getCached then callback throw:', err);
        }
        if (mounted) safeSetSource(url);
      }
    }).catch(err => {
      // 查询失败 → 用原 URL
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useCachedMedia] getCached throw:', err);
      }
      if (mounted) safeSetSource(url);
    });

    return () => {
      mounted = false;
    };
  }, [url, safeSetSource]);

  /**
   * 图片加载完成后调用 → 异步下载到本地 (下次直接命中)
   */
  const onLoaded = useCallback(async (_loadedSrc: string) => {
    if (!url || !mediaCache) return;
    try {
      await mediaCache.cacheFromUrl(url);
    } catch (err) {
      // 下载失败忽略 (下次重新尝试)
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useCachedMedia] cacheFromUrl throw:', err);
      }
    }
  }, [url]);

  /**
   * 强制刷新 (用户长按 → 删本地 → 重 GET)
   */
  const refresh = useCallback(async () => {
    if (!url || !mediaCache) {
      safeSetSource(url);
      return;
    }
    try {
      const fresh = await mediaCache.refresh(url);
      safeSetSource(fresh);
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useCachedMedia] refresh throw:', err);
      }
      safeSetSource(url);
    }
  }, [url, safeSetSource]);

  return { source, onLoaded, refresh };
}