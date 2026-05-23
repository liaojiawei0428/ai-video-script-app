import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const colors = {
  accent: '#6C5CE7',
  accentEnd: '#A29BFE',
  success: '#00CEC9',
  warning: '#FDCB6E',
  error: '#E17055',

  bg: {
    primary: '#0D0D12',
    secondary: '#1A1A23',
    tertiary: '#252530',
    raised: '#2E2E3A',
  },

  text: {
    primary: '#F0F0F5',
    secondary: '#9B9BB5',
    tertiary: '#636380',
    inverse: '#FFFFFF',
  },

  overlay: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.1)',
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 24, fontWeight: '700' as const, color: colors.text.primary },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary },
  h3: { fontSize: 16, fontWeight: '600' as const, color: colors.text.primary },
  body: { fontSize: 14, fontWeight: '400' as const, color: colors.text.secondary },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.text.tertiary },
  tag: { fontSize: 11, fontWeight: '600' as const },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 16,
  },
};

export const layout = {
  screenPadding: spacing.md,
  cardWidth: (SCREEN_WIDTH - spacing.md * 3) / 2,
  screenWidth: SCREEN_WIDTH,
};
