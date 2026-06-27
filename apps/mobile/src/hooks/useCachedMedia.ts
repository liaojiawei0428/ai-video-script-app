/**
 * useCachedMedia hook (Stage 2 v3.0.43, 跨端铁律 4++)
 *
 * 解决 5Mbps 带宽 + 图片/视频加载慢 (10-20 秒)
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
import * as mediaCache from '../utils/mediaCache';

export function useCachedMedia(url: string | undefined) {
  const [source, setSource] = useState<string | undefined>(url);

  useEffect(() => {
    if (!url) {
      setSource(undefined);
      return;
    }

    let mounted = true;

    // 1. 查本地缓存
    mediaCache.getCached(url).then(localPath => {
      if (mounted && localPath) {
        setSource(localPath);
      } else {
        // 2. 未命中 → 用原 URL
        setSource(url);
      }
    }).catch(() => {
      // 查询失败 → 用原 URL
      setSource(url);
    });

    return () => {
      mounted = false;
    };
  }, [url]);

  /**
   * 图片加载完成后调用 → 异步下载到本地 (下次直接命中)
   */
  const onLoaded = useCallback(async (_loadedSrc: string) => {
    if (!url) return;
    try {
      await mediaCache.cacheFromUrl(url);
    } catch {
      // 下载失败忽略 (下次重新尝试)
    }
  }, [url]);

  /**
   * 强制刷新 (用户长按 → 删本地 → 重 GET)
   */
  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const fresh = await mediaCache.refresh(url);
      setSource(fresh);
    } catch {
      setSource(url);
    }
  }, [url]);

  return { source, onLoaded, refresh };
}