/**
 * Dialog 组件 v1.0 (v3.0.24 S60 重构)
 *
 * 替代 React Native 内置 Modal 跟 Alert.alert
 * 优势: 100% 主题可控, 渐入动画, 跨平台一致
 *
 * 用法:
 *   <Dialog visible={show} onClose={...} title="..." message="..." />
 *   <Dialog visible={show} onClose={...} type="confirm" onConfirm={...} onCancel={...} />
 *   <Dialog visible={show} onClose={...} type="custom">{children}</Dialog>
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  ScrollView,
  ViewStyle,
} from 'react-native';
import { colors, spacing, radii, typography, shadows } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export type DialogType = 'alert' | 'confirm' | 'custom';
export type DialogVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  type?: DialogType;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  children?: React.ReactNode;
  dismissable?: boolean; // 点击背景关闭, default true
  contentStyle?: ViewStyle;
}

const VARIANT_COLORS: Record<DialogVariant, { accent: string; icon: string }> = {
  default: { accent: colors.primary, icon: '✦' },
  success: { accent: colors.success, icon: '✓' },
  error: { accent: colors.error, icon: '✕' },
  warning: { accent: colors.warning, icon: '⚠' },
  info: { accent: colors.info, icon: 'ℹ' },
};

export function Dialog({
  visible,
  onClose,
  title,
  message,
  type = 'alert',
  variant = 'default',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  children,
  dismissable = true,
  contentStyle,
}: DialogProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  const v = VARIANT_COLORS[variant];
  const showCancel = type === 'confirm' || (type === 'custom' && onCancel);
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };
  const handleBackdrop = () => {
    if (dismissable) onClose();
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* 背景遮罩 */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdrop} />
      </Animated.View>

      {/* 居中卡片 */}
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            contentStyle,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* variant 图标 */}
          {variant !== 'default' && (
            <View style={[styles.iconWrap, { backgroundColor: v.accent + '20' }]}>
              <Text style={[styles.icon, { color: v.accent }]}>{v.icon}</Text>
            </View>
          )}

          {/* 标题 */}
          {title && <Text style={styles.title}>{title}</Text>}

          {/* 内容 */}
          {type === 'custom' ? (
            <ScrollView
              style={styles.customBody}
              contentContainerStyle={styles.customBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            message && (
              <Text style={styles.message}>
                {message.split('\n').map((line, i, arr) => (
                  <Text key={i}>
                    {line}
                    {i < arr.length - 1 ? '\n' : ''}
                  </Text>
                ))}
              </Text>
            )
          )}

          {/* 按钮组 */}
          {type !== 'custom' || onConfirm || onCancel ? (
            <View style={styles.btnRow}>
              {showCancel && (
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnCancelText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              {type !== 'custom' || onConfirm ? (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnConfirm,
                    { backgroundColor: v.accent },
                    showCancel && { marginLeft: spacing.sm },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnConfirmText}>{confirmText}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg.elevated,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.text.secondary,
  },
  customBody: {
    maxHeight: SCREEN_H * 0.6,
    marginBottom: spacing.md,
  },
  customBodyContent: {
    paddingBottom: spacing.sm,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  btnCancelText: {
    ...typography.h3,
    color: colors.text.secondary,
  },
  btnConfirm: {
    // backgroundColor 动态
  },
  btnConfirmText: {
    ...typography.h3,
    color: colors.text.inverse,
  },
});
