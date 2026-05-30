import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// v3.0 商业化配色方案 - 现代、专业、有活力
export const colors = {
  // 主色系：深蓝（专业、可信赖）
  primary: '#2563EB',
  primaryLight: '#60A5FA',
  primaryDark: '#1D4ED8',
  accent: '#2563EB',        // 兼容旧代码
  accentEnd: '#60A5FA',     // 兼容旧代码

  // 强调色：橙色（活力、温暖）
  warning: '#F97316',
  accentOrange: '#F97316',

  // 状态色
  success: '#22C55E',
  error: '#EF4444',
  info: '#3B82F6',

  // VIP金色
  gold: '#EAB308',
  goldDark: '#CA8A04',

  // 背景色（深蓝灰主题，更专业）
  bg: {
    primary: '#0F172A',
    secondary: '#1E293B',
    tertiary: '#334155',
    elevated: '#475569',
    card: '#1E293B',
  },

  // 文字色
  text: {
    primary: '#F8FAFC',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    inverse: '#0F172A',
    accent: '#60A5FA',
  },

  // 边框
  overlay: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  borderAccent: 'rgba(37,99,235,0.3)',
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
