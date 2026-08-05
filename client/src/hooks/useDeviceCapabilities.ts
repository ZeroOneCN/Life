import { useEffect, useState } from 'react';

/**
 * 设备能力感知类型
 */
export interface DeviceCapabilities {
  /** 视口宽度（px） */
  width: number;
  /** 当前断点档位 */
  breakpoint: 'mobile' | 'tablet' | 'desktop-compact' | 'desktop-full';
  /** 指针类型：fine=鼠标，coarse=触屏 */
  pointer: 'fine' | 'coarse';
  /** 是否支持 hover */
  hover: 'hover' | 'none';
  /** 用户偏好密度 */
  density: 'compact' | 'cozy' | 'comfortable';
  /** 是否支持 Split View（桌面端） */
  canSplit: boolean;
  /** 是否启用减少动画偏好 */
  prefersReducedMotion: boolean;
  /** 系统颜色方案偏好 */
  prefersColorScheme: 'light' | 'dark';
}

/**
 * 根据视口宽度计算断点档位
 * @param width - 视口宽度
 * @returns 断点档位
 */
function resolveBreakpoint(width: number): DeviceCapabilities['breakpoint'] {
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop-compact';
  return 'desktop-full';
}

/**
 * 获取初始设备能力快照（SSR 安全，仅在客户端运行）
 * @returns 初始 DeviceCapabilities
 */
function getInitialCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      breakpoint: 'desktop-compact',
      pointer: 'fine',
      hover: 'hover',
      density: 'cozy',
      canSplit: true,
      prefersReducedMotion: false,
      prefersColorScheme: 'light',
    };
  }

  const width = window.innerWidth;
  const breakpoint = resolveBreakpoint(width);
  const storedDensity = (localStorage.getItem('lifeos-density') as DeviceCapabilities['density']) || 'cozy';

  return {
    width,
    breakpoint,
    pointer: window.matchMedia('(pointer: fine)').matches ? 'fine' : 'coarse',
    hover: window.matchMedia('(hover: hover)').matches ? 'hover' : 'none',
    density: storedDensity,
    canSplit: width >= 1024,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    prefersColorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  };
}

/**
 * 设备能力感知 Hook
 *
 * 监听视口尺寸、指针类型、hover 支持、密度偏好、动画偏好、颜色方案，
 * 返回统一的 DeviceCapabilities 对象供组件决定渲染模式。
 *
 * - 触屏自动放大触摸区、关闭 hover 交互
 * - 桌面端启用 Split View
 * - 移动端禁用复杂交互
 *
 * @returns 当前设备能力对象
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(getInitialCapabilities);

  useEffect(() => {
    const updateWidth = () => {
      const width = window.innerWidth;
      setCapabilities((prev) => ({
        ...prev,
        width,
        breakpoint: resolveBreakpoint(width),
        canSplit: width >= 1024,
      }));
    };

    const updatePointer = (e: MediaQueryListEvent) => {
      setCapabilities((prev) => ({ ...prev, pointer: e.matches ? 'fine' : 'coarse' }));
    };

    const updateHover = (e: MediaQueryListEvent) => {
      setCapabilities((prev) => ({ ...prev, hover: e.matches ? 'hover' : 'none' }));
    };

    const updateReducedMotion = (e: MediaQueryListEvent) => {
      setCapabilities((prev) => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    const updateColorScheme = (e: MediaQueryListEvent) => {
      setCapabilities((prev) => ({ ...prev, prefersColorScheme: e.matches ? 'dark' : 'light' }));
    };

    const pointerMql = window.matchMedia('(pointer: fine)');
    const hoverMql = window.matchMedia('(hover: hover)');
    const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colorSchemeMql = window.matchMedia('(prefers-color-scheme: dark)');

    window.addEventListener('resize', updateWidth);
    pointerMql.addEventListener('change', updatePointer);
    hoverMql.addEventListener('change', updateHover);
    reducedMotionMql.addEventListener('change', updateReducedMotion);
    colorSchemeMql.addEventListener('change', updateColorScheme);

    return () => {
      window.removeEventListener('resize', updateWidth);
      pointerMql.removeEventListener('change', updatePointer);
      hoverMql.removeEventListener('change', updateHover);
      reducedMotionMql.removeEventListener('change', updateReducedMotion);
      colorSchemeMql.removeEventListener('change', updateColorScheme);
    };
  }, []);

  return capabilities;
}

/**
 * 设置密度偏好（持久化到 localStorage 并同步到 <html data-density>）
 * @param density - 密度档位
 */
export function setDensity(density: DeviceCapabilities['density']): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('lifeos-density', density);
  document.documentElement.setAttribute('data-density', density);
}

/**
 * 初始化密度：从 localStorage 读取并应用到 <html data-density>
 * 应在应用启动时调用一次
 */
export function initDensity(): void {
  if (typeof window === 'undefined') return;
  const stored = (localStorage.getItem('lifeos-density') as DeviceCapabilities['density']) || 'cozy';
  document.documentElement.setAttribute('data-density', stored);
}
