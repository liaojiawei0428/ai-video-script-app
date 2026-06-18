/**
 * Toast 组件 v1.0 (v3.0.24 S60 重构)
 *
 * 替代 Alert.alert 跟 ToastAndroid
 * 顶部滑入提示, 自动消失
 *
 * 用法:
 *   toast.show('保存成功', 'success')
 *   toast.show('失败', 'error', '描述详情')
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, radii, typography, shadows } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const TOAST_TOP = 50;
const TOAST_DEFAULT_DURATION = 2500;

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastConfig {
  message: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onPress: () => void };
}

const VARIANT_COLORS: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  default: { bg: colors.bg.elevated, border: colors.borderLight, icon: '✦' },
  success: { bg: colors.success + '20', border: colors.success + '60', icon: '✓' },
  error: { bg: colors.error + '20', border: colors.error + '60', icon: '✕' },
  warning: { bg: colors.warning + '20', border: colors.warning + '60', icon: '⚠' },
  info: { bg: colors.info + '20', border: colors.info + '60', icon: 'ℹ' },
};

export const toast = {
  show: (config: ToastConfig | string) => {
    if (typeof config === 'string') {
      config = { message: config };
    }
    // 通过全局事件总线推送到 ToastHost
    ToastEmitter.emit(config);
  },
  success: (message: string, description?: string) =>
    toast.show({ message, description, variant: 'success' }),
  error: (message: string, description?: string) =>
    toast.show({ message, description, variant: 'error' }),
  warning: (message: string, description?: string) =>
    toast.show({ message, description, variant: 'warning' }),
  info: (message: string, description?: string) =>
    toast.show({ message, description, variant: 'info' }),
};

/**
 * 向后兼容的 ToastProvider (什么都不做, 真实 toast 走 ToastHost + ToastEmitter)
 * 老代码用 <ToastProvider><App/></ToastProvider> 也能跑
 */
export const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * 向后兼容的 useToast hook
 */
export function useToast() {
  return {
    show: (message: string, variant?: ToastVariant) => toast.show({ message, variant }),
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    warning: (message: string) => toast.warning(message),
    info: (message: string) => toast.info(message),
  };
}

/**
 * 模块级 showToast (兼容老的 import { showToast } from '../components')
 */
export const showToast = toast.show;

// 简单事件订阅
type ToastListener = (config: ToastConfig) => void;
class ToastEventEmitter {
  private listeners: ToastListener[] = [];
  on(fn: ToastListener) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
  emit(config: ToastConfig) { this.listeners.forEach(l => l(config)); }
}
export const ToastEmitter = new ToastEventEmitter();

export function ToastHost() {
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [config, setConfig] = React.useState<ToastConfig | null>(null);
  const timerRef = useRef<any>(null);

  const show = useCallback(
    (c: ToastConfig) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfig(c);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: -200,
            duration: 240,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => setConfig(null));
      }, c.duration ?? TOAST_DEFAULT_DURATION);
    },
    [slideAnim, fadeAnim],
  );

  useEffect(() => {
    const unsub = ToastEmitter.on(show);
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show]);

  if (!config) return null;
  const v = VARIANT_COLORS[config.variant || 'default'];

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.iconWrap, { borderColor: v.border }]}>
        <Text style={styles.icon}>{v.icon}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.message} numberOfLines={2}>
          {config.message}
        </Text>
        {config.description && (
          <Text style={styles.description} numberOfLines={3}>
            {config.description}
          </Text>
        )}
      </View>
      {config.action && (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            config.action?.onPress();
            if (timerRef.current) clearTimeout(timerRef.current);
            setConfig(null);
          }}
        >
          <Text style={styles.actionText}>{config.action.label}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: TOAST_TOP,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    ...shadows.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  body: {
    flex: 1,
  },
  message: {
    ...typography.h3,
    fontSize: 14,
  },
  description: {
    ...typography.caption,
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
  },
  actionText: {
    ...typography.h3,
    fontSize: 13,
    color: colors.primary,
  },
});
