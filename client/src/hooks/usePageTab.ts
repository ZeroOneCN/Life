import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * usePageTab 的导航模式。
 * - `replace`（默认）：替换当前历史记录，浏览器后退不会在 TAB 间切换。
 * - `push`：新增历史记录，浏览器后退可以在 TAB 间切换。
 */
export type UsePageTabMode = 'replace' | 'push';

export interface UsePageTabOptions {
  /** 导航模式，默认 replace。关键页面（如状态筛选切换）可用 push。 */
  mode?: UsePageTabMode;
}

export function usePageTab<T extends string>(
  defaultValue: T,
  validValues: readonly T[],
  paramName = 'tab',
  options?: UsePageTabOptions,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = options?.mode ?? 'replace';

  const value = useMemo(() => {
    const current = searchParams.get(paramName) as T | null;

    if (current && validValues.includes(current)) {
      return current;
    }

    return defaultValue;
  }, [defaultValue, paramName, searchParams, validValues]);

  const setValue = (next: T) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(paramName, next);
    setSearchParams(nextParams, { replace: mode === 'replace' });
  };

  return [value, setValue] as const;
}
