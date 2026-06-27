/**
 * ErrorBoundary (跨端铁律 4++, BUG-112 角色库白屏修法)
 *
 * 设计动机 (BUG-112):
 *   shipin-APP v3.0.43 Stage 2 引入 react-native-sqlite-storage 做本地缓存,
 *   但 SQLite native module 在某些 Android 设备上 release build 抛错
 *   → CharacterDetailScreen render 时 SQLite.openDatabase throw → 整 component tree unmount → 完全白屏
 *
 * 修法 (跨端铁律 4++ 跟 web 1:1 镜像):
 *   - React 16+ class component 必含 static getDerivedStateFromError + componentDidCatch
 *   - 用户视角: 显示友好错误 + "重试" 按钮, 不再空白
 *   - dev 环境 console.error 详情, prod 环境只显示友好文案
 *   - 跨端 1:1 跟 web 端 components/ui/error-boundary.tsx API 完全一致
 *
 * 用法:
 *   <ErrorBoundary onReset={() => navigation.goBack()}>
 *     <CharacterDetailScreen />
 *   </ErrorBoundary>
 *
 *   或全局 wrap (推荐, App.tsx):
 *   <ErrorBoundary onReset={() => navigationRef.reset(...)}>
 *     <App />
 *   </ErrorBoundary>
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '../theme';

interface Props {
  children: React.ReactNode;
  /**
   * 重置回调 (用户点 "重试" 时调), 默认是强制刷新当前页
   */
  onReset?: () => void;
  /**
   * 自定义 fallback (可选), 不传走默认友好文案
   */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // 渲染 fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // dev 环境 console.error 详情 (RN 0.73 Hermes console.error = adb logcat 输出)
    if (__DEV__) {
      console.error('[ErrorBoundary] caught error:', error);
      console.error('[ErrorBoundary] component stack:', info.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>出错了</Text>
          <Text style={styles.message}>
            {__DEV__ && this.state.error
              ? this.state.error.message
              : '页面加载失败, 请重试或返回'}
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>重试</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
    paddingHorizontal: spacing.lg,
  },
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});