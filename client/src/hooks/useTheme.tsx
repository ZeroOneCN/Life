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
const THEME_MODE_KEY = 'lifeos_theme_mode';

type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveInitialMode(): ThemeMode {
  try {
    const storedMode = window.localStorage.getItem(THEME_MODE_KEY);
    if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'auto') {
      return storedMode;
    }
    return 'auto';
  } catch {
    return 'auto';
  }
}

function resolveThemeFromMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'auto') {
    return getSystemTheme();
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => resolveInitialMode());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const isDark = useMemo(() => {
    return resolveThemeFromMode(mode) === 'dark';
  }, [mode, systemTheme]);

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
    window.localStorage.setItem(THEME_MODE_KEY, mode);
  }, [isDark, mode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    if (mode === 'auto') {
      setModeState(isDark ? 'light' : 'dark');
    } else {
      setModeState(mode === 'dark' ? 'light' : 'dark');
    }
  }, [mode, isDark]);

  const value = useMemo(
    () => ({
      isDark,
      mode,
      setMode,
      toggleTheme,
    }),
    [isDark, mode, setMode, toggleTheme],
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
