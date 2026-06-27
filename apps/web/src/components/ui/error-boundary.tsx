/**
 * ErrorBoundary (跨端铁律 4++, BUG-112 角色库白屏修法, 跟 mobile 1:1 镜像)
 *
 * 设计动机 (BUG-112):
 *   shipin-APP v3.0.43 Stage 2 引入 IndexedDB 做本地缓存, mobile 端 SQLite native module
 *   在某些 Android 设备上 release build 抛错 → React 整 component tree unmount → 完全白屏
 *   web 端用 ErrorBoundary 兜底, 跟 mobile 1:1 镜像防御
 *
 * 修法 (跨端铁律 4++ 跟 mobile 1:1 镜像):
 *   - React 16+ class component 必含 static getDerivedStateFromError + componentDidCatch
 *   - 用户视角: 显示友好错误 + "重试" 按钮, 不再空白
 *   - dev 环境 console.error 详情, prod 环境只显示友好文案
 *   - 跨端 1:1 跟 mobile 端 components/ErrorBoundary.tsx API 完全一致
 *
 * 用法:
 *   <ErrorBoundary onReset={() => navigate('/')}>
 *     <CharacterDetailPage />
 *   </ErrorBoundary>
 *
 *   或全局 wrap (推荐, App.tsx):
 *   <ErrorBoundary onReset={() => window.location.reload()}>
 *     <App />
 *   </ErrorBoundary>
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /**
   * 重置回调 (用户点 "重试" 时调), 默认是 window.location.reload
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
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] caught error:', error);
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] component stack:', info.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#0A0A14',
            color: '#F8FAFC',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0' }}>出错了</h1>
          <p
            style={{
              fontSize: 14,
              color: '#94A3B8',
              textAlign: 'center',
              maxWidth: 480,
              lineHeight: 1.6,
              margin: '0 0 24px 0',
            }}
          >
            {import.meta.env.DEV && this.state.error
              ? this.state.error.message
              : '页面加载失败, 请重试或返回'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: '#6366F1',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}