import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义降级 UI；fallback 留空则使用内置错误卡片 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 全局错误边界（React 18 class component）
 * 捕获子树渲染/生命周期错误，展示降级 UI 并允许重试
 * - 默认降级：简洁错误卡片（带 token 化样式）
 * - 自定义：通过 fallback prop 注入
 * - 上报：开发态 console.error，生产态可扩展 Sentry/Custom Hook
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary] caught error', error, info);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.reset);
      }
      return <DefaultErrorFallback error={error} reset={this.reset} />;
    }

    return children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function DefaultErrorFallback({ error, reset }: DefaultErrorFallbackProps) {
  return (
    <div className="error-boundary-fallback" role="alert" aria-live="assertive">
      <div className="error-boundary-card">
        <div className="error-boundary-icon" aria-hidden="true">!</div>
        <h2 className="error-boundary-title">页面出错了</h2>
        <p className="error-boundary-desc">
          本次访问遇到意外错误，你可以重试或返回首页继续操作。
        </p>
        <pre className="error-boundary-message">{error.message || '未知错误'}</pre>
        <div className="error-boundary-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>
            重试
          </button>
          <a href="/" className="btn btn-ghost">
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}
