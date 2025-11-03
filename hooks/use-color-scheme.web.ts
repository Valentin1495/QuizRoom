import type { PropsWithChildren } from 'react';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ColorScheme = 'light' | 'dark';

type ColorSchemeContextValue = {
  colorScheme: ColorScheme;
  isReady: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
};

const STORAGE_KEY = 'quizroom:color-scheme';

const noop = () => {};

const getSystemPreference = (): ColorScheme => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const fallbackContextValue: ColorSchemeContextValue = {
  colorScheme: getSystemPreference(),
  isReady: true,
  setColorScheme: noop,
  toggleColorScheme: noop,
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

export function ColorSchemeProvider({ children }: PropsWithChildren) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(getSystemPreference);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let storedValue: string | null = null;

    try {
      storedValue = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      storedValue = null;
    }

    if (storedValue === 'light' || storedValue === 'dark') {
      setColorSchemeState(storedValue);
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;

    const handleChange = (event: MediaQueryListEvent) => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          return;
        }
      } catch {
        // ignore storage errors
      }

      setColorSchemeState(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const persistPreference = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      // ignore storage errors
    }
    setIsReady(true);
  }, []);

  const handleToggleColorScheme = useCallback(() => {
    setColorSchemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
    setIsReady(true);
  }, []);

  const contextValue = useMemo<ColorSchemeContextValue>(
    () => ({
      colorScheme,
      isReady,
      setColorScheme: persistPreference,
      toggleColorScheme: handleToggleColorScheme,
    }),
    [colorScheme, handleToggleColorScheme, isReady, persistPreference]
  );

  return createElement(ColorSchemeContext.Provider, { value: contextValue }, children);
}

function useColorSchemeContext(): ColorSchemeContextValue {
  return useContext(ColorSchemeContext) ?? fallbackContextValue;
}

export function useColorScheme(): ColorScheme {
  return useColorSchemeContext().colorScheme;
}

export function useColorSchemeManager(): ColorSchemeContextValue {
  return useColorSchemeContext();
}

export function useToggleColorScheme(): () => void {
  return useColorSchemeContext().toggleColorScheme;
}
