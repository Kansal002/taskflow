import { useCallback, useState } from 'react';
import { readString, writeString } from './storage';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'taskflow:theme';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === 'undefined' ? ((readString(STORAGE_KEY) as Theme | null) ?? 'light') : currentTheme(),
  );

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
    writeString(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'), [setTheme]);

  return { theme, setTheme, toggleTheme };
}
