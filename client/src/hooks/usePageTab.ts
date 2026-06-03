import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function usePageTab<T extends string>(
  defaultValue: T,
  validValues: readonly T[],
  paramName = 'tab',
) {
  const [searchParams, setSearchParams] = useSearchParams();

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
    setSearchParams(nextParams, { replace: true });
  };

  return [value, setValue] as const;
}
