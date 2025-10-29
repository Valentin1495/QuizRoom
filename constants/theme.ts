/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Palette = {
  // Primary (CTA, 정답)
  coral600: '#FF6F61',
  coral400: '#FF8F85',
  coral200: '#FFDBD8',

  // Secondary (진행, 타이머)
  teal600: '#00C2A8',
  teal400: '#33D4BC',
  teal200: '#B3F0E6',

  // Accent (보상, 배지)
  yellow600: '#FFD166',
  yellow400: '#FFDB85',
  yellow200: '#FFF0CC',

  // Neutral
  slate900: '#1A1A1A',
  slate500: '#707070',
  slate200: '#D9D8E8',

  // Surface
  surface: '#FDFCFD',
  surfaceMuted: '#F5F6FB',
  surfaceDark: '#1E1E1E',

  // Status
  success: '#FF6F61',  // 정답 (코랄)
  neutral: '#707070',  // 오답 (그레이)
  warning: '#FF6F61',  // 긴급 (코랄)
  info: '#00C2A8',     // 안내 (틸)
  danger: '#EF4444',   // 오류 (기존 유지)
};

export const Colors = {
  light: {
    // Text
    text: Palette.slate900,
    textMuted: Palette.slate500,

    // Background
    background: Palette.surface,
    card: Palette.surfaceMuted,

    // Brand
    primary: Palette.coral600,
    primaryForeground: '#FFFFFF',
    secondary: Palette.teal600,
    secondaryForeground: '#FFFFFF',
    accent: Palette.yellow600,
    accentForeground: Palette.slate900,

    // Legacy (for backward compatibility)
    tint: Palette.teal600,

    // UI
    border: Palette.slate200,
    icon: Palette.slate500,

    // Tab
    tabIconDefault: Palette.slate500,
    tabIconSelected: Palette.teal600,
  },
  dark: {
    // Text
    text: '#F5F4FF',
    textMuted: '#B6B3D6',

    // Background
    background: Palette.surfaceDark,
    card: '#2A2A2A',

    // Brand (채도 -10%)
    primary: '#E65D50',        // 코랄 darker
    primaryForeground: '#FFFFFF',
    secondary: '#00A890',      // 틸 darker
    secondaryForeground: '#FFFFFF',
    accent: '#E6B84D',         // 옐로우 darker
    accentForeground: '#1E1E1E',

    // Legacy (for backward compatibility)
    tint: '#00A890',

    // UI
    border: '#3A3A3A',
    icon: '#8A8A8A',

    // Tab
    tabIconDefault: '#6F6A9F',
    tabIconSelected: '#00C2A8',
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
  lg: 16,  // 기존 20 → 16 (카드 통일)
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
