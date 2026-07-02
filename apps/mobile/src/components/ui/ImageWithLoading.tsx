/**
 * 图片加载组件 (跨端铁律 4++ 跟 web 端 components/ui/image-with-loading.tsx 1:1)
 *
 * 3 态渲染:
 * - loading: shimmer 骨架屏 (opacity 0.3 ~ 1 pulse, 跟 SkeletonLoader 风格一致)
 * - ready: 图片淡入显示 (200ms opacity transition)
 * - error: fallback 图标 + 重试按钮
 *
 * 用法:
 *   <ImageWithLoading
 *     src="https://example.com/img.jpg"
 *     alt="角色封面"
 *     width={300}
 *     height={200}
 *     onLoaded={(src) => console.log('loaded:', src)}
 *   />
 *
 * 特性:
 * - aspectRatio (width / height) 防止布局跳动
 * - placeholder LQIP 立即显示 (可选)
 * - onLoad 触发 onLoaded 回调 (Stage 2 接入本地缓存)
 * - fallback 自定义错误显示
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  ImageStyle,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing } from '../../theme';
import { Skeleton } from './Skeleton';

interface ImageWithLoadingProps {
  src: string;
  alt?: string;
  width: number | string;
  height: number;
  /**
   * 占位图 (LQIP) - 低质量缩略图 data URL
   */
  placeholder?: string;
  /**
   * 加载失败时显示的 fallback
   */
  fallback?: React.ReactNode;
  /**
   * 容器额外样式 (作用于外层 wrapper)
   */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * 图片样式
   */
  style?: StyleProp<ImageStyle>;
  /**
   * 加载完成回调 (Stage 2 接入本地缓存)
   */
  onLoaded?: (src: string) => void;
  /**
   * 重试回调 (用户点 fallback 重试按钮)
   */
  onRetry?: () => void;
}

/**
 * v3.0.74 (BUG-143 修): 从 src URL 抽出 path 部分 (不含 query string / hash)
 *   - 用于判断"是否同一张图": path 相同 → 同一张图 (即使 token/query 变化也不重置 loading)
 *   - 跨项目通用铁律: "图片 src path 部分" = 图片内容身份, 跟 query string (token/缓存戳) 解耦
 */
function getSrcPath(src: string): string {
  if (!src) return '';
  const qIdx = src.indexOf('?');
  const hIdx = src.indexOf('#');
  let endIdx = src.length;
  if (qIdx !== -1) endIdx = Math.min(endIdx, qIdx);
  if (hIdx !== -1) endIdx = Math.min(endIdx, hIdx);
  return src.slice(0, endIdx);
}

export function ImageWithLoading({
  src,
  alt = '',
  width,
  height,
  placeholder,
  fallback,
  containerStyle,
  style,
  onLoaded,
  onRetry,
}: ImageWithLoadingProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const loadedRef = useRef(false);
  const opacity = useRef(new Animated.Value(0)).current;
  // v3.0.74 (BUG-143 修): prevSrcRef 追踪上一次 src, 只在 src 字符串真的有变化时才重置 loading
  //   兜底防御: 防止调用方传不稳定的 src (如 buildImageUrl 带 Date.now()) 触发频繁 reload + 黑屏闪烁
  //   即使 src 字符串整体变了, 但 path 部分没变 (仅 query string token/hash 变), 也认为"同一张图", 不重置
  const prevSrcRef = useRef(src);
  // v3.0.74 (BUG-143 修): srcPathRef 抽出 src 的 path 部分 (无 query string), 用于判断"是否同一张图"
  const srcPathRef = useRef(getSrcPath(src));

  useEffect(() => {
    // v3.0.74 (BUG-143 修): 防御兜底 — 只在 src path 部分真的有变化时才重置 loading
    //   - src 整体字符串变 (如 token 刷新) 但 path 不变 → 不重置 (同一张图, 浏览器复用缓存)
    //   - src path 变了 → 重置 loading + retryCount++
    //   - 这是兜底防御, 跟 buildImageUrl 用 djb2 hash 稳定 filename 是双保险
    const newPath = getSrcPath(src);
    if (newPath === srcPathRef.current && src !== prevSrcRef.current) {
      // src 字符串微变 (如 token 刷新) 但 path 不变, 不重置 loading
      prevSrcRef.current = src;
      return;
    }
    if (newPath === srcPathRef.current && src === prevSrcRef.current) {
      // src 完全没变 (依赖检查冗余), 不重置
      return;
    }
    // src path 真变了, 重置 loading
    prevSrcRef.current = src;
    srcPathRef.current = newPath;
    setState('loading');
    setRetryCount(c => c + 1);
    loadedRef.current = false;
    opacity.setValue(0);
  }, [src, opacity]);

  const handleLoad = () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setState('ready');
    onLoaded?.(src);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setState('error');
  };

  const handleRetry = () => {
    setState('loading');
    loadedRef.current = false;
    opacity.setValue(0);
    onRetry?.();
  };

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: colors.bg.tertiary + '4D', // +30% 透明度
          borderRadius: radii.md,
          overflow: 'hidden',
          position: 'relative',
        },
        containerStyle,
      ]}
    >
      {/* shimmer 骨架屏 (loading 状态) */}
      {state === 'loading' && (
        <View style={{ position: 'absolute', inset: 0 } as any}>
          <Skeleton width="100%" height={height} borderRadius={0} />
        </View>
      )}

      {/* LQIP 占位图 (立即显示, blur 效果 RN 用 opacity 模拟) */}
      {placeholder && state !== 'ready' && (
        <Image
          source={{ uri: placeholder }}
          style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.4 } as any}
          resizeMode="cover"
        />
      )}

      {/* 实际图片 (loaded 后淡入) */}
      {src && (
        <Animated.Image
          source={{ uri: src }}
          onLoad={handleLoad}
          onError={handleError}
          resizeMode="cover"
          style={[
            { width: '100%', height: '100%', opacity },
            style,
          ]}
          accessibilityLabel={alt}
          // 用 retryCount 触发重新加载 (error 后点重试)
          key={`${src}-${retryCount}`}
        />
      )}

      {/* error fallback */}
      {state === 'error' && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleRetry}
          style={{
            position: 'absolute',
            inset: 0,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.bg.tertiary + '80',
          } as any}
        >
          {fallback || (
            <>
              <Text style={{ fontSize: 28 }}>⚠️</Text>
              <Text style={{ color: colors.text.tertiary, fontSize: 12, marginTop: spacing.xs }}>
                加载失败 · 点击重试
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}