/**
 * GeneratingLoader 组件 (Stage 3 v3.0.43, 跨端铁律 4++)
 *
 * AI 生成中动画 (Animated spinner fallback)
 *
 * 跟 web 端 GeneratingLoader.tsx 1:1 镜像 (跨端铁律 4++)
 *
 * 用法:
 *   <GeneratingLoader size="md" label="AI 生成中..." />
 *
 * 原理 (跨端 1:1):
 * - 默认走 Animated spinner (跟 web CSS spinner 节奏一致 1s)
 * - lottieUrl 参数保留, 但 Stage 3.5 接入 (避免 lottie-react-native NDK build 风险)
 * - size: sm (32px) / md (48px) / lg (64px)
 */

import { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';

type Size = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<Size, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

interface GeneratingLoaderProps {
  /** Lottie JSON URL (保留, Stage 3.5 接入, 当前走 fallback 避免 NDK 风险) */
  lottieUrl?: string;
  /** 文字 (默认 "AI 生成中...") */
  label?: string;
  /** 尺寸: sm (32) / md (48) / lg (64) */
  size?: Size;
  /** 自定义 style */
  style?: any;
}

/**
 * Animated spinner (跨端 1:1 风格 — 跟 web 端 CSS spinner 节奏一致 1s 周期)
 */
function AnimatedSpinner({ size, label }: { size: number; label?: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View
        style={{
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* 轨道 */}
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: 'rgba(59, 130, 246, 0.2)',
          }}
        />
        {/* 主旋转环 (border-top 高亮) */}
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: 'transparent',
            borderTopColor: '#3b82f6',
            transform: [{ rotate }],
          }}
        />
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

export function GeneratingLoader({
  lottieUrl, // 保留, 暂不渲染 (Stage 3.5 接入)
  label = 'AI 生成中...',
  size = 'md',
  style,
}: GeneratingLoaderProps) {
  const px = SIZE_MAP[size];

  return (
    <View style={[styles.wrapper, style]}>
      <AnimatedSpinner size={px} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
});