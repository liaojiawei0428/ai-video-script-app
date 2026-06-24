// 角色库专用 theme (S63 UI redesign)
// 跟全局 theme 共用色系 (紫蓝/琥珀), 不破坏其他 screen
// 增强项: role 配色 / gradient 渐变 / status dot 配色 / surface 层级
// 设计目标: WCAG 4.5:1+ 对比度, 商业化 dark UI (Notion/Linear 风格)

import { colors as globalColors } from './index';

// 5 角色类型配色 (跟 web getRoleColor 1:1, 但用更现代的色阶)
export const ROLE_COLORS = {
  protagonist: {
    // 主角: 紫红渐变, 醒目
    primary: '#EF4444',
    primaryAlpha: 'rgba(239, 68, 68, 0.18)',
    primarySoft: 'rgba(239, 68, 68, 0.32)',
    gradient: ['#EF4444', '#F472B6'] as const, // 渐变到粉
    icon: 'flame' as const,
  },
  antagonist: {
    // 反派: 紫色, 神秘
    primary: '#A855F7',
    primaryAlpha: 'rgba(168, 85, 247, 0.18)',
    primarySoft: 'rgba(168, 85, 247, 0.32)',
    gradient: ['#A855F7', '#6366F1'] as const,
    icon: 'skull' as const,
  },
  supporting: {
    // 配角: 蓝色, 稳重
    primary: '#3B82F6',
    primaryAlpha: 'rgba(59, 130, 246, 0.18)',
    primarySoft: 'rgba(59, 130, 246, 0.32)',
    gradient: ['#3B82F6', '#06B6D4'] as const,
    icon: 'shield' as const,
  },
  minor: {
    // 次要: 灰色, 不抢眼
    primary: '#94A3B8',
    primaryAlpha: 'rgba(148, 163, 184, 0.18)',
    primarySoft: 'rgba(148, 163, 184, 0.32)',
    gradient: ['#94A3B8', '#64748B'] as const,
    icon: 'person' as const,
  },
} as const;

// 角色类型中文标签 (跟 web getRoleLabel 一致)
export const ROLE_LABELS: Record<keyof typeof ROLE_COLORS, string> = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
  minor: '次要',
};

// 5 态徽章配色 (描述状态, 跟 web statusBadge 1:1)
export const STATUS_COLORS = {
  pending_description: {
    label: '待生成描述',
    color: '#94A3B8', // 灰
    bg: 'rgba(148, 163, 184, 0.15)',
    icon: 'hourglass-outline' as const,
  },
  pending_confirm: {
    label: '待确认',
    color: '#F59E0B', // 琥珀
    bg: 'rgba(245, 158, 11, 0.18)',
    icon: 'create-outline' as const,
  },
  generating: {
    label: '生图中',
    color: '#3B82F6', // 蓝
    bg: 'rgba(59, 130, 246, 0.18)',
    icon: 'sync' as const,
    animated: true,
  },
  confirmed: {
    label: '描述已确认',
    color: '#10B981', // 绿
    bg: 'rgba(16, 185, 129, 0.18)',
    icon: 'image-outline' as const,
  },
  sheet_ready: {
    label: '已生图',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.18)',
    icon: 'checkmark-circle' as const,
  },
} as const;

// 5 画风配色 (跟 web 1:1, 卡片左下角小 chip)
export const STYLE_COLORS = {
  realistic: { label: '写实电影风', color: '#06B6D4', icon: 'videocam-outline' as const },
  ancient: { label: '古风水墨', color: '#F59E0B', icon: 'flower-outline' as const },
  cyber: { label: '赛博朋克', color: '#A855F7', icon: 'rocket-outline' as const },
  anime: { label: '动漫风', color: '#EC4899', icon: 'heart-outline' as const },
  '3d': { label: '3D 渲染', color: '#10B981', icon: 'cube-outline' as const },
} as const;

// 角色库 surface 配色 (3 层卡片层级, 跟 Linear 风格一致)
export const surface = {
  // 顶层卡片 (角色卡片主体) - 跟背景略深, 立体感
  card: '#1A1A2E',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  // 二级卡片 (section 容器) - 跟背景同色, 边线分割
  section: 'rgba(255, 255, 255, 0.03)',
  sectionBorder: 'rgba(255, 255, 255, 0.06)',
  // hover/active 反馈
  cardHover: 'rgba(255, 255, 255, 0.04)',
  cardActive: 'rgba(99, 102, 241, 0.08)',
  // 输入框
  input: 'rgba(255, 255, 255, 0.05)',
  inputBorder: 'rgba(255, 255, 255, 0.10)',
  inputFocus: 'rgba(99, 102, 241, 0.4)',
};

// 增强文字层级 (解决 S63 反馈"文字太黑看不见")
// 关键: 替代 colors.text.tertiary 用于角色库, 对比度 ≥ 4.5:1
export const text = {
  // 标题: 纯白, 12.6:1
  primary: '#F8FAFC',
  // 正文: 亮灰, 11.6:1 (替代原 secondary, 用于 description 等)
  body: '#E2E8F0',
  // 辅助: 中亮灰, 7.4:1 (替代原 tertiary 在 bg.secondary 上的 4.36:1)
  muted: '#CBD5E1',
  // 弱化 (placeholder): 4.5:1
  subtle: '#94A3B8',
  // inverse
  inverse: '#0A0A14',
};

// Primary gradient (按钮 / hero 强调)
export const gradient = {
  primary: ['#6366F1', '#A78BFA'] as const, // 紫蓝
  primarySoft: ['#4F46E5', '#7C3AED'] as const, // 深紫
  success: ['#10B981', '#34D399'] as const, // 绿
  warning: ['#F59E0B', '#FBBF24'] as const, // 琥珀
  danger: ['#EF4444', '#F87171'] as const, // 红
  // 角色库 hero 渐变背景
  hero: ['#1E1B4B', '#0F172A'] as const, // 深空紫
  heroAccent: ['#6366F1', '#EC4899'] as const, // 紫粉
};

// 阴影 (加深, 商业化 card 立体感)
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHover: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  button: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};

// 公开 helper: 角色名生成头像背景渐变 (跟角色类型色一致, 无角色类型 fallback 到 brand)
export function getRoleColor(roleType?: string) {
  return ROLE_COLORS[(roleType as keyof typeof ROLE_COLORS)] || ROLE_COLORS.minor;
}

export function getRoleLabel(roleType?: string): string {
  return ROLE_LABELS[(roleType as keyof typeof ROLE_LABELS) as keyof typeof ROLE_LABELS] || '配角';
}

// 状态判定 (跟 web getCharacterStatus 1:1, 5 态)
type StatusInfo = {
  key: keyof typeof STATUS_COLORS;
  label: string;
  color: string;
  bg: string;
  icon: string;
  animated?: boolean;
};
export function getStatusInfo(c: {
  description?: any;
  confirmed?: boolean;
  imageGenStatus?: string;
  imageVariants?: any[];
}): StatusInfo {
  const desc = typeof c.description === 'string' ? c.description : '';
  if (!desc) return { key: 'pending_description', ...STATUS_COLORS.pending_description };
  if (!c.confirmed) return { key: 'pending_confirm', ...STATUS_COLORS.pending_confirm };
  if (c.imageGenStatus === 'generating') return { key: 'generating', ...STATUS_COLORS.generating };
  const hasSheet = (c.imageVariants || []).some((v: any) => v.angle === 'sheet');
  if (!hasSheet) return { key: 'confirmed', ...STATUS_COLORS.confirmed };
  return { key: 'sheet_ready', ...STATUS_COLORS.sheet_ready };
}

// re-export 跟全局保持兼容
export { globalColors };
