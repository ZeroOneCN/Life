import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: false });

/**
 * ThemeProvider - 锁定亮色模式
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => ({ isDark: false }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme - 始终返回亮色模式
 * @returns { isDark: false }
 */
export function useTheme() {
  return useContext(ThemeContext);
}
