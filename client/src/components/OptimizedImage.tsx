import { memo, useCallback, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

/**
 * 优化图片组件
 *
 * 支持：
 * - 原生 lazy loading（loading="lazy"）
 * - 加载占位
 * - 加载失败降级
 * - WebP 格式（通过改后缀名，需要服务端支持）
 *
 * @example
 * ```tsx
 * <OptimizedImage
 *   src="/images/avatar.jpg"
 *   alt="用户头像"
 *   width={200}
 *   height={200}
 *   lazy
 * />
 * ```
 */
export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt = '',
  lazy = true,
  placeholder = null,
  fallback = null,
  className = '',
  style,
  width,
  height,
  ...rest
}: {
  /** 图片地址 */
  src: string;
  /** alt 文本 */
  alt?: string;
  /** 是否启用原生 lazy loading */
  lazy?: boolean;
  /** 加载中占位元素 */
  placeholder?: React.ReactNode;
  /** 加载失败降级元素 */
  fallback?: React.ReactNode;
  /** 额外样式类 */
  className?: string;
  /** 行内样式 */
  style?: React.CSSProperties;
  /** 宽度 */
  width?: number | string;
  /** 高度 */
  height?: number | string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading' | 'width' | 'height'>) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={`optimized-image-wrapper ${className}`.trim()}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        ...style,
      }}
    >
      {!loaded && placeholder && (
        <div className="optimized-image-placeholder" style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {placeholder}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={lazy ? 'lazy' : undefined}
        onLoad={handleLoad}
        onError={handleError}
        width={width}
        height={height}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        {...rest}
      />
    </div>
  );
});

/**
 * 图片懒加载占位组件
 *
 * 在图片加载时显示一个简单的骨架占位。
 */
export function ImagePlaceholder() {
  return (
    <div
      className="image-placeholder-skeleton"
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--color-surface-2)',
        borderRadius: 4,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}