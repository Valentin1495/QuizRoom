import type { PropsWithChildren } from 'react';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

type ColorScheme = 'light' | 'dark';

type ColorSchemeContextValue = {
  colorScheme: ColorScheme;
  isReady: boolean;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
};

const STORAGE_KEY = 'quizroom:color-scheme';
const DEFAULT_SCHEME: ColorScheme = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

const noop = () => {};
const fallbackContextValue: ColorSchemeContextValue = {
  colorScheme: DEFAULT_SCHEME,
  isReady: true,
  setColorScheme: noop,
  toggleColorScheme: noop,
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

/**
 * Provides light/dark mode preference with persistence.
 */
export function ColorSchemeProvider({ children }: PropsWithChildren) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(DEFAULT_SCHEME);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydratePreference = async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setColorSchemeState(stored);
        }
      } catch {
        // no-op: prefer system default when storage is unavailable
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    void hydratePreference();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistPreference = useCallback((next: ColorScheme) => {
    setColorSchemeState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next).catch(noop);
  }, []);

  const handleSetColorScheme = useCallback(
    (scheme: ColorScheme) => {
      persistPreference(scheme);
      setIsReady(true);
    },
    [persistPreference]
  );

  const handleToggleColorScheme = useCallback(() => {
    setColorSchemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      void SecureStore.setItemAsync(STORAGE_KEY, next).catch(noop);
      return next;
    });
    setIsReady(true);
  }, []);

  const contextValue = useMemo<ColorSchemeContextValue>(
    () => ({
      colorScheme,
      isReady,
      setColorScheme: handleSetColorScheme,
      toggleColorScheme: handleToggleColorScheme,
    }),
    [colorScheme, handleSetColorScheme, handleToggleColorScheme, isReady]
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
