import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';

interface Props {
  progress: number;
  height?: number;
  color?: string;
  animated?: boolean;
}

export function ProgressBar({ progress, height = 4, color = colors.accent, animated = true }: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: Math.min(progress, 100),
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(Math.min(progress, 100));
    }
  }, [progress]);

  const pct = animated ? widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  }) : `${Math.min(progress, 100)}%`;

  return (
    <View style={[styles.bg, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          { width: pct as any, height, backgroundColor: color },
        ]}
      />
    </View>
  );
}

export function PulseProgressBar({ height = 4 }: { height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={[styles.bg, { height }]}>
      <Animated.View
        style={[
          styles.fill,
          { width: '30%', height, backgroundColor: colors.accent, opacity },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radii.sm,
  },
});
