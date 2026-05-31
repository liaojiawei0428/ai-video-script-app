import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// v4.0 明亮活力配色 - 渐变质感、现代前卫
export const colors = {
  // 主色系：渐变紫蓝（活力、年轻）
  primary: '#6366F1',
  primaryLight: '#A78BFA',
  primaryDark: '#4F46E5',
  accent: '#6366F1',          // 兼容旧代码
  accentEnd: '#A78BFA',       // 兼容旧代码

  // 强调色：暖琥珀（热情、活力）
  warning: '#F59E0B',
  accentOrange: '#F59E0B',

  // 状态色
  success: '#10B981',
  error: '#F43F5E',
  info: '#06B6D4',

  // VIP金色
  gold: '#F59E0B',
  goldDark: '#D97706',

  // 背景色（明亮深色主题，带暖色底调）
  bg: {
    primary: '#0A0A14',
    secondary: '#151525',
    tertiary: '#1E1E35',
    elevated: '#2A2A45',
    card: '#181830',
  },

  // 文字色
  text: {
    primary: '#F8FAFC',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    inverse: '#0A0A14',
    accent: '#A78BFA',
  },

  // 边框
  overlay: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  borderAccent: 'rgba(99,102,241,0.3)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 26, fontWeight: '800' as const, color: colors.text.primary, letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text.primary },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text.primary },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.text.secondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.text.tertiary },
  tag: { fontSize: 11, fontWeight: '600' as const },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  accent: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const layout = {
  screenPadding: spacing.md,
  cardWidth: (SCREEN_WIDTH - spacing.md * 3) / 2,
  screenWidth: SCREEN_WIDTH,
};
