import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Animated, Text, StyleSheet, View,
} from 'react-native';
import { colors, radii, spacing, shadows } from '../theme';

interface ToastItem {
  id: number;
  message: string;
  icon?: string;
}

interface ToastContextType {
  show: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, icon?: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map(t => (
          <ToastItemView key={t.id} item={t} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItemView({ item }: { item: ToastItem }) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.toast, { transform: [{ translateY }], opacity }]}>
      {item.icon ? <Text style={styles.icon}>{item.icon}</Text> : null}
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.raised,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  icon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  text: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
