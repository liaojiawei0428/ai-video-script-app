// 空态组件 (S63 UI redesign)
// 设计: 大圆形 + 渐变 icon + 标题 + 副标题 + 可选 CTA
// 替代旧"人 icon + 几行字"扁平空态

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { surface, text, gradient } from '../theme/character';
import { LinearGradientView as LinearGradient } from './LinearGradient';

interface Props {
  icon: string; // Ionicons name
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaIcon?: string;
  onCta?: () => void;
  loading?: boolean;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaIcon,
  onCta,
  loading,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      {/* 大圆形 icon 容器 + 渐变 */}
      <View style={styles.iconWrap}>
        <LinearGradient
          colors={gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBg}
        >
          <Ionicons name={icon as any} size={48} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {ctaLabel && onCta && (
        <TouchableOpacity
          onPress={onCta}
          disabled={loading}
          style={[styles.cta, loading && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {loading ? (
              <ActivityIndicatorFallback color="#fff" />
            ) : (
              <>
                {ctaIcon && <Ionicons name={ctaIcon as any} size={16} color="#fff" />}
                <Text style={styles.ctaLabel}>{ctaLabel}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// 内置小 loading fallback (避免空态 CTA 拉 import 链路)
function ActivityIndicatorFallback({ color }: { color: string }) {
  const { ActivityIndicator } = require('react-native');
  return <ActivityIndicator size="small" color={color} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  iconBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: text.primary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: text.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  cta: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
