/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// ========================================
// 브랜드 컬러 보존 (추후 재활성화용)
// ========================================
export const BrandColors = {
  coral600: '#FF6F61',
  coral400: '#FF8F85',
  coral200: '#FFDBD8',
  teal600: '#00C2A8',
  teal400: '#33D4BC',
  teal200: '#B3F0E6',
  yellow600: '#FFD166',
  yellow400: '#FFDB85',
  yellow200: '#FFF0CC',
};

// ========================================
// 뉴트럴 팔레트 (현재 활성)
// ========================================
export const Palette = {
  // Grayscale
  gray950: '#1A1A1A',
  gray900: '#2A2A2A',
  gray700: '#4A4A4A',
  gray600: '#666666',
  gray500: '#707070',
  gray400: '#808080',
  gray300: '#999999',
  gray200: '#B8B8B8',
  gray150: '#CCCCCC',
  gray100: '#E5E5E5',
  gray50: '#F0F0F0',
  gray25: '#F5F5F5',

  // Surface
  white: '#FFFFFF',
  offWhite: '#FAFAFA',
  darkBg: '#121212',
  darkCard: '#1E1E1E',
  darkElevated: '#282828',
};

export const Colors = {
  light: {
    // Text
    text: Palette.gray950,
    textMuted: Palette.gray500,
    textSubtle: Palette.gray300,

    // Background
    background: Palette.offWhite,
    card: Palette.white,
    cardElevated: Palette.gray25,

    // Brand (흑백 전환)
    primary: Palette.gray900,
    primaryForeground: Palette.white,
    secondary: Palette.gray100,
    secondaryForeground: Palette.gray900,
    accent: Palette.gray50,
    accentForeground: Palette.gray950,
    destructive: '#DC2626',
    destructiveForeground: Palette.white,

    // Legacy (for backward compatibility)
    tint: Palette.gray900,

    // UI
    border: Palette.gray100,
    borderStrong: Palette.gray150,
    divider: Palette.gray50,
    icon: Palette.gray500,
    iconSelected: Palette.gray900,

    // Status
    success: Palette.gray400,   // 완료/정상
    warning: '#FFB020',         // 5초 이하 경고 (앰버)
    danger: '#FF6F61',          // 2초 이하 긴급 (코랄)
    error: '#E53935',           // 오류/실패
    info: Palette.gray500,      // 정보

    // Tab
    tabIconDefault: Palette.gray300,
    tabIconSelected: Palette.gray900,
  },
  dark: {
    // Text
    text: Palette.gray25,
    textMuted: Palette.gray200,
    textSubtle: Palette.gray400,

    // Background
    background: Palette.darkBg,
    card: Palette.darkCard,
    cardElevated: Palette.darkElevated,

    // Brand (흑백 전환)
    primary: Palette.gray100,
    primaryForeground: Palette.gray950,
    secondary: Palette.gray300,
    secondaryForeground: Palette.gray950,
    accent: Palette.gray900,
    accentForeground: Palette.gray25,
    destructive: '#EF4444',
    destructiveForeground: Palette.white,

    // Legacy (for backward compatibility)
    tint: Palette.gray100,

    // UI
    border: Palette.gray700,
    borderStrong: '#3D3D3D',
    divider: Palette.gray950,
    icon: Palette.gray200,
    iconSelected: Palette.gray100,

    // Status
    success: Palette.gray500,   // 어두운 배경에서 더 밝게
    warning: '#FFCA28',         // 밝은 앰버 (눈에 잘 띄도록)
    danger: '#FF867C',          // 다크모드용 코랄 톤 (명도 높임)
    error: '#EF5350',           // 다크모드용 레드 (조금 밝은 톤)
    info: Palette.gray300,      // 밝은 회색 (가독성)

    // Tab
    tabIconDefault: Palette.gray400,
    tabIconSelected: Palette.gray100,
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
