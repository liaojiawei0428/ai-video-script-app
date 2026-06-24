// 角色头像组件 (S63 UI redesign)
// 设计: 圆角方形 + 角色类型色 ring + 状态 dot + 自动 fallback (首字 + 渐变)
// 替代旧 avatarBox (RN Ionicons person icon + 56x56) 商业化版本

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ROLE_COLORS, getRoleColor } from '../theme/character';

interface Props {
  // 角色名 (用于 fallback 首字)
  name: string;
  // 角色类型 (决定 ring 颜色 + 渐变)
  roleType?: string;
  // 图片 URL (server imageVariants 里的 imageData 或 url)
  imageUrl?: string | null;
  // 尺寸: sm=48 / md=72 / lg=96 / xl=128
  size?: 'sm' | 'md' | 'lg' | 'xl';
  // 状态 dot 颜色 (可选, 不传不显示)
  statusColor?: string;
  // 状态 dot 脉动动画 (generating 时)
  pulsing?: boolean;
  style?: ViewStyle;
}

const SIZE_MAP = {
  sm: 48,
  md: 72,
  lg: 96,
  xl: 128,
};

const RING_WIDTH = 2.5;
const DOT_SIZE = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
};

export function CharacterAvatar({
  name,
  roleType,
  imageUrl,
  size = 'md',
  statusColor,
  pulsing = false,
  style,
}: Props) {
  const px = SIZE_MAP[size];
  const role = getRoleColor(roleType);
  const dotSize = DOT_SIZE[size];
  const fontSize = px * 0.42; // 首字大小: 跟尺寸成比例

  // 检测图片源 (data: 直接用, 否则 base64 包 svg)
  const renderImage = () => {
    if (!imageUrl) return null;
    // server 返 imageData 是 base64 (无 data: 前缀) 或 url
    const uri = imageUrl.startsWith('data:')
      ? imageUrl
      : imageUrl.startsWith('http')
        ? imageUrl
        : `data:image/png;base64,${imageUrl}`;
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: px, height: px, borderRadius: px * 0.28 }]}
        resizeMode="cover"
      />
    );
  };

  return (
    <View style={[styles.container, { width: px, height: px }, style]}>
      {/* 外层 ring (角色类型色) */}
      <View
        style={[
          styles.ring,
          {
            width: px,
            height: px,
            borderRadius: px * 0.28,
            borderWidth: RING_WIDTH,
            borderColor: role.primary,
          },
        ]}
      />
      {/* 内层: 渐变背景 + 首字 (或图片) */}
      <View
        style={[
          styles.inner,
          {
            width: px - RING_WIDTH * 2 - 2,
            height: px - RING_WIDTH * 2 - 2,
            borderRadius: (px - RING_WIDTH * 2 - 2) * 0.28,
            // 用 2 角色色做渐变 background (RN 不支持 linear gradient, 用半透明叠加)
            backgroundColor: role.primaryAlpha,
          },
        ]}
      >
        {imageUrl ? (
          renderImage()
        ) : (
          <Text style={[styles.initial, { fontSize, color: role.primary }]}>
            {name?.[0] || '?'}
          </Text>
        )}
      </View>

      {/* 状态 dot (右下角) */}
      {statusColor && (
        <View
          style={[
            styles.statusDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: statusColor,
              right: -2,
              bottom: -2,
              borderWidth: 2,
              borderColor: '#0A0A14', // 跟背景色一致, 制造 "浮在 ring 外" 感
            },
            pulsing && styles.pulsing,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  inner: {
    position: 'absolute',
    top: RING_WIDTH + 1,
    left: RING_WIDTH + 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  statusDot: {
    position: 'absolute',
  },
  pulsing: {
    // 静态 fallback (RN 0.73 - 用 style 模拟, 真脉动用 Animated 后续接)
    opacity: 0.85,
  },
});
