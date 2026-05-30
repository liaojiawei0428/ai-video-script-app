import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// v2.0 全新配色体系 - 更专业、更有品牌感
export const colors = {
  // 主色系：科技蓝紫
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  accent: '#4F46E5',        // 兼容旧代码
  accentEnd: '#818CF8',     // 兼容旧代码

  // 强调色：活力橙
  warning: '#F59E0B',
  accentOrange: '#F59E0B',

  // 状态色
  success: '#10B981',
  error: '#EF4444',
  info: '#3B82F6',

  // VIP金色
  gold: '#FFD700',
  goldDark: '#DAA520',

  // 背景色（深色主题）
  bg: {
    primary: '#0B0B10',
    secondary: '#141420',
    tertiary: '#1E1E2E',
    elevated: '#252536',
    card: '#1A1A28',
  },

  // 文字色
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0B8',
    tertiary: '#6B6B80',
    inverse: '#0B0B10',
    accent: '#818CF8',
  },

  // 边框
  overlay: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.1)',
  borderAccent: 'rgba(79,70,229,0.3)',
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
