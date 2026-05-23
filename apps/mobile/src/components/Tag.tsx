import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, typography } from '../theme';

interface Props {
  text: string;
  color?: string;
  style?: ViewStyle;
}

export function Tag({ text, color = colors.accent, style }: Props) {
  return (
    <View style={[styles.tag, { backgroundColor: color + '33' }, style]}>
      <Text style={[typography.tag, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
