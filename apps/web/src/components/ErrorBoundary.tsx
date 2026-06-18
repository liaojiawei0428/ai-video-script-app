/**
 * ErrorBoundary — v3.0.0.2 全局错误兜底
 *
 * 之前 React 组件抛错 (state corruption / undefined props) 会导致整个 React 树 unmount
 * → 页面只剩 body 背景 (#0A0E1A 几乎全黑) → 用户看到"黑屏卡住"
 * 现在任何渲染错误都被这个 boundary 捕获, 显示友好错误页 + 刷新按钮
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
    // 可选: 后续接入 sentry / server 错误上报
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary p-8">
          <div className="max-w-md w-full text-center space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error/15">
              <AlertCircle className="text-error" size={32} />
            </div>
            <div>
              <h1 className="text-xl font-semibold mb-2">页面出错了</h1>
              <p className="text-sm text-text-secondary">
                组件渲染时遇到异常, 不用担心, 数据没丢。刷新一下就好。
              </p>
            </div>
            {this.state.error && (
              <div className="text-left bg-bg-secondary rounded-lg p-3 text-xs font-mono text-text-tertiary max-h-60 overflow-auto">
                <div className="text-red-400 mb-1">{this.state.error.name}: {this.state.error.message}</div>
                {this.state.errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap text-[10px] opacity-70">
                    {this.state.errorInfo.componentStack.substring(0, 1500)}
                  </pre>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={this.handleReload} className="btn-primary flex items-center gap-2">
                <RefreshCw size={14} />
                刷新页面
              </button>
              <button onClick={this.handleReset} className="btn-ghost text-sm">
                重试
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
