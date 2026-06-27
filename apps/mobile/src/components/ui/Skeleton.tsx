/**
 * 通用 Skeleton 骨架屏组件 (跨端铁律 4++ 跟 web 端 components/ui/skeleton.tsx 1:1)
 *
 * 用法:
 *   <Skeleton width={120} height={16} />
 *   <Skeleton width="100%" height={192} borderRadius={12} />
 *
 * 特性:
 * - 自动应用 opacity pulse 动画 (0.3 ~ 1, 600ms 循环)
 * - 通过 width / height / borderRadius / style 完全定制
 * - 跟 web 端 Skeleton API 1:1 (跨端铁律 4++)
 */
import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';
import { colors, radii } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
          backgroundColor: colors.bg.tertiary + '99', // +60% 透明度
        },
        style,
      ]}
    />
  );
}

/**
 * 卡片骨架屏 (图片 + 标题 + 副标题), 跟 web 端 SkeletonCard 1:1
 */
export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View style={[{
      borderRadius: radii.lg,
      overflow: 'hidden',
      backgroundColor: colors.bg.secondary,
      marginBottom: 14,
    }, style]}>
      <Skeleton height={100} borderRadius={radii.lg} />
      <Animated.View style={{ padding: 12 }}>
        <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={11} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * 图片骨架屏 (保持宽高比, 防止布局跳动)
 *
 * 用法:
 *   <SkeletonImage width={300} height={200} />
 *   <SkeletonImage width={300} height={300} rounded />
 */
export function SkeletonImage({
  width,
  height,
  rounded = true,
  style,
}: {
  width: number;
  height: number;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={rounded ? radii.lg : 0}
      style={style}
    />
  );
}

/**
 * 文本骨架屏 (1-3 行)
 */
export function SkeletonText({ lines = 1 }: { lines?: number }) {
  return (
    <Animated.View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 && lines > 1 ? '66%' : '100%'}
          style={{ marginBottom: i === lines - 1 ? 0 : 8 }}
        />
      ))}
    </Animated.View>
  );
}