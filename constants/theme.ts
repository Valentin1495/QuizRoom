/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Palette = {
  purple600: '#5B2EFF',
  purple400: '#8B66FF',
  purple200: '#E8E1FF',
  pink500: '#FF5DA2',
  pink200: '#FFD2EA',
  slate900: '#120D24',
  slate500: '#5A5680',
  slate200: '#D9D8E8',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F6FB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

export const Colors = {
  light: {
    text: Palette.slate900,
    textMuted: Palette.slate500,
    background: Palette.surfaceMuted,
    card: Palette.surface,
    tint: Palette.purple600,
    accent: Palette.pink500,
    border: Palette.slate200,
    icon: Palette.slate500,
    tabIconDefault: Palette.slate500,
    tabIconSelected: Palette.purple600,
  },
  dark: {
    text: '#F5F4FF',
    textMuted: '#B6B3D6',
    background: '#0B0718',
    card: '#181131',
    tint: Palette.purple400,
    accent: Palette.pink500,
    border: '#2D2550',
    icon: '#928EC7',
    tabIconDefault: '#6F6A9F',
    tabIconSelected: Palette.purple400,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
};

export const Elevation = {
  xs: {
    shadowColor: '#2F288033',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sm: {
    shadowColor: '#2F288040',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
