import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ImageWithLoadingProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /**
   * 占位图 (LQIP) - 低质量缩略图,优先显示 (data: URL 或 1px 透明 PNG)
   */
  placeholder?: string;
  /**
   * 加载失败时显示的 fallback 图标
   */
  fallback?: React.ReactNode;
  /**
   * 容器额外 className (作用于外层 wrapper)
   */
  containerClassName?: string;
  /**
   * 是否保持宽高比 (16/9, 1/1 等), 防止布局跳动
   */
  aspectRatio?: string;
  /**
   * 加载完成回调 (用于预缓存到 MMKV 索引, Stage 2 用)
   */
  onLoaded?: (src: string) => void;
}

/**
 * 图片加载组件 (Web + Mobile 跨端铁律 4++ 同步版)
 *
 * 3 态渲染:
 * - idle/loading: shimmer 骨架屏 (从左到右滑过)
 * - ready: 图片淡入显示 (200ms opacity transition)
 * - error: fallback 图标 + 重试按钮
 *
 * 特性:
 * - aspectRatio 防止布局跳动
 * - placeholder LQIP 立即显示
 * - onLoad 触发 onLoaded 回调 (Stage 2 接入缓存)
 * - 跨端 1:1 API 跟 mobile ImageWithLoading 一致
 */
export function ImageWithLoading({
  src,
  alt,
  placeholder,
  fallback,
  containerClassName,
  aspectRatio,
  onLoaded,
  className,
  ...imgProps
}: ImageWithLoadingProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const loadedRef = useRef(false);

  useEffect(() => {
    // src 变了重置 loading
    setState('loading');
    loadedRef.current = false;
  }, [src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setState('ready');
    onLoaded?.(src);
    imgProps.onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setState('error');
    imgProps.onError?.(e);
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-bg-tertiary/30',
        aspectRatio && 'w-full',
        containerClassName,
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* shimmer 骨架屏 (loading 状态) */}
      {state === 'loading' && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          aria-label="加载中"
        />
      )}

      {/* LQIP 占位图 (立即显示) */}
      {placeholder && state !== 'ready' && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 w-full h-full object-cover blur-md scale-110',
            'transition-opacity duration-300',
          )}
        />
      )}

      {/* 实际图片 (loaded 后淡入) */}
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            state === 'ready' ? 'opacity-100' : 'opacity-0',
            className,
          )}
          {...imgProps}
        />
      )}

      {/* error fallback */}
      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-tertiary">
          {fallback || (
            <>
              <span className="text-3xl">⚠️</span>
              <span className="text-xs">加载失败</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}