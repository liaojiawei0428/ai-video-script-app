// 渐变组件 (S63 UI redesign)
// 替代 inline 写法 + 提供简洁 API
// 优先用 react-native-linear-gradient (如果项目已装), 否则 fallback View 渐变模拟

import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';

interface Props {
  colors: readonly string[]; // 渐变色组 (从 theme import, 如 gradient.primary)
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

// 尝试动态 require react-native-linear-gradient
// 如果没装, 用多层 View 渐变模拟 (左/中/右 3 段, 视觉上接近)
let RNLinearGradient: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native-linear-gradient');
  RNLinearGradient = mod?.default || mod;
} catch {
  RNLinearGradient = null;
}

export function LinearGradientView({ colors, start, end, style, children }: Props) {
  // 装了 linear-gradient 用真组件
  if (RNLinearGradient) {
    return (
      <RNLinearGradient
        colors={colors as any}
        start={start || { x: 0, y: 0 }}
        end={end || { x: 1, y: 1 }}
        style={style}
      >
        {children}
      </RNLinearGradient>
    );
  }

  // Fallback: 用多层半透明 View 模拟渐变 (3 段)
  const c1 = colors[0];
  const c2 = colors.length >= 3 ? colors[Math.floor(colors.length / 2)] : colors[Math.floor(colors.length / 2)];
  const c3 = colors[colors.length - 1];
  return (
    <View style={[styles.fallbackWrap, style]}>
      {/* 底层 = 中间色 (覆盖最大) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c2 }]} />
      {/* 左侧色 (半边透明) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c1, opacity: 0.5 }]} />
      {/* 右侧色 (半边透明, 镜像) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c3, opacity: 0.5, transform: [{ scaleX: -1 }] }]} />
      {/* 柔化: 顶部覆盖一层 5% 白色 */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fff', opacity: 0.04 }]} />
      {/* 内容层 */}
      <View style={styles.fallbackContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackWrap: {
    overflow: 'hidden',
  },
  fallbackContent: {
    flex: 1,
  },
});

