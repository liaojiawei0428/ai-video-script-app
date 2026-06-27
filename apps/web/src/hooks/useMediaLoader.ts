/**
 * useMediaLoader hook (Stage 3 v3.0.43, 跨端铁律 4++)
 *
 * 跨端 1:1 媒体加载抽象 (封装 useCachedMedia + 4 态 state machine + retry)
 *
 * 用法:
 *   const { source, state, error, retry, refresh, onLoaded } = useMediaLoader(url);
 *
 * 4 态 (跨端 1:1):
 *   - 'idle'    URL 为空 (未开始)
 *   - 'loading' 查缓存 / 下载中
 *   - 'ready'   source 可用
 *   - 'error'   失败 (含 retry 函数)
 *
 * 跟 mobile 端 useMediaLoader.ts API 1:1 (跨端铁律 4++)
 */

import { useState, useEffect, useCallback } from 'react';
import { useCachedMedia } from './useCachedMedia';

export type MediaState = 'idle' | 'loading' | 'ready' | 'error';

export interface UseMediaLoaderResult {
  /** 当前显示的 URL (缓存命中 = blob: URL, 未命中 = 原 URL) */
  source: string | undefined;
  /** 当前状态 */
  state: MediaState;
  /** 错误信息 (state === 'error' 时) */
  error: Error | null;
  /** 重试 (state === 'error' 后调用) */
  retry: () => void;
  /** 强制刷新 (删本地 + 重 GET) */
  refresh: () => Promise<void>;
  /** 图片 onLoaded 时调用 (异步缓存) */
  onLoaded: (loadedSrc: string) => void;
  /** 重试计数 (UI 显示用) */
  retryCount: number;
}

const MAX_RETRIES = 3;

export function useMediaLoader(url: string | undefined): UseMediaLoaderResult {
  const [state, setState] = useState<MediaState>(url ? 'loading' : 'idle');
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  const { source, onLoaded: cacheOnLoaded, refresh } = useCachedMedia(url);

  // 监听 source 变化 → 决定 state
  useEffect(() => {
    if (!url) {
      setState('idle');
      setError(null);
      return;
    }

    if (source) {
      setState('ready');
      setError(null);
    } else {
      setState('loading');
    }
  }, [url, source, retryNonce]);

  /**
   * 重试 (state === 'error' 后调用)
   */
  const retry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      setError(new Error(`已重试 ${MAX_RETRIES} 次, 放弃`));
      return;
    }
    setRetryCount((c) => c + 1);
    setError(null);
    setState('loading');
    setRetryNonce((n) => n + 1);
  }, [retryCount]);

  /**
   * onLoaded 包装 (上层 ImageWithLoading 调用)
   */
  const onLoaded = useCallback(
    (loadedSrc: string) => {
      // 调用 useCachedMedia 的 onLoaded (异步缓存到 IndexedDB)
      cacheOnLoaded(loadedSrc);
    },
    [cacheOnLoaded]
  );

  return {
    source,
    state,
    error,
    retry,
    refresh,
    onLoaded,
    retryCount,
  };
}