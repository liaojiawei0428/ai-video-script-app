/**
 * Sheet 组件 v1.0 (v3.0.24 S60 重构)
 *
 * 替代 React Native 内置 Modal 的 sheet 类型 (animationType="slide")
 * 底部滑出, 圆角顶部, 可拖动关闭
 *
 * 用法:
 *   <Sheet visible={show} onClose={...} title="...">{children}</Sheet>
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Easing,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, radii, typography, shadows } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_H * 0.85;

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  dismissable?: boolean;
  height?: number | string; // 数字=px, 字符串="50%"等
  showHandle?: boolean; // 顶部小条
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  dismissable = true,
  height = 'auto',
  showHandle = true,
}: SheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: SCREEN_H,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  if (!visible && (slideAnim as any)._value === SCREEN_H) return null;

  const heightStyle =
    typeof height === 'number'
      ? { height }
      : height === 'auto'
      ? { maxHeight: SHEET_MAX_HEIGHT }
      : { height: height as any };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          heightStyle,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {showHandle && <View style={styles.handle} />}

        {title && (
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.h3,
    color: colors.text.tertiary,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: spacing.lg,
  },
});
