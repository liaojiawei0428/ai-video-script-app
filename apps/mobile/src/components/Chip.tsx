// 角色 Chip 组件 (S63 UI redesign)
// 设计: 小圆角 + 角色色填充 (18% alpha) + 文字同色 + Ionicons 替代 emoji
// 替代旧 Tag (alpha 33% 太弱) + roleChip (emoji + 12.5% alpha 看不见)

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { STATUS_COLORS, ROLE_COLORS, getRoleColor } from '../theme/character';

interface ChipProps {
  label: string;
  color: string; // 主色 (文字 + icon)
  bg: string; // 背景色
  icon?: string; // Ionicons name
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Chip({ label, color, bg, icon, size = 'sm', style }: ChipProps) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg, borderColor: color + '40' },
        size === 'md' && styles.chipMd,
        style,
      ]}
    >
      {icon && <Ionicons name={icon as any} size={size === 'md' ? 13 : 11} color={color} />}
      <Text style={[styles.label, { color, fontSize: size === 'md' ? 12 : 11 }]}>
        {label}
      </Text>
    </View>
  );
}

// 便捷: 角色类型 chip
export function RoleChip({ roleType, size }: { roleType?: string; size?: 'sm' | 'md' }) {
  const role = getRoleColor(roleType);
  const label = roleType === 'protagonist' ? '主角' :
                roleType === 'antagonist' ? '反派' :
                roleType === 'supporting' ? '配角' :
                roleType === 'minor' ? '次要' : roleType || '配角';
  return <Chip label={label} color={role.primary} bg={role.primaryAlpha} icon={role.icon} size={size} />;
}

// 便捷: 状态 chip (5 态)
export function StatusChip({ statusKey, size }: { statusKey: keyof typeof STATUS_COLORS; size?: 'sm' | 'md' }) {
  const s = STATUS_COLORS[statusKey];
  return <Chip label={s.label} color={s.color} bg={s.bg} icon={s.icon} size={size} />;
}

// 便捷: 画风 chip
export function StyleChip({ styleId }: { styleId?: string }) {
  if (!styleId) return null;
  const map: Record<string, { label: string; color: string; icon: string }> = {
    realistic: { label: '写实', color: '#06B6D4', icon: 'videocam-outline' },
    ancient: { label: '古风', color: '#F59E0B', icon: 'flower-outline' },
    cyber: { label: '赛博', color: '#A855F7', icon: 'rocket-outline' },
    anime: { label: '动漫', color: '#EC4899', icon: 'heart-outline' },
    '3d': { label: '3D', color: '#10B981', icon: 'cube-outline' },
  };
  const m = map[styleId] || { label: styleId, color: '#94A3B8', icon: 'color-palette-outline' };
  return <Chip label={m.label} color={m.color} bg={m.color + '20'} icon={m.icon} size="sm" />;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999, // 胶囊
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
