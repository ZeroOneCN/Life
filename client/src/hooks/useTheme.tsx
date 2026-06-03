import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

const THEME_KEY = 'lifeos_theme';
type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): ThemeMode {
  try {
    const domTheme = document.documentElement.getAttribute('data-theme');
    if (domTheme === 'dark' || domTheme === 'light') {
      return domTheme;
    }

    const storedTheme = window.localStorage.getItem(THEME_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => resolveInitialTheme() === 'dark');

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((previous) => !previous);
  }, []);

  const value = useMemo(
    () => ({
      isDark,
      toggleTheme,
    }),
    [isDark, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
