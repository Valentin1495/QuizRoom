/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#6f1d1b';
const tintColorDark = '#fff';
const gradientColors = ['#ff9a9e', '#fad0c4', '#fadadd'] as const;

export const Colors = {
  light: {
    primary: '#6f1d1b',
    secondary: '#1e1e2f',
    text: '#2E2E2E',
    background: '#FCFCFE',
    tint: tintColorLight,
    icon: '#8B7DB8',
    tabIconDefault: '#999999',
    tabIconSelected: tintColorLight,
    gradientColors,
  },
  dark: {
    primary: '#46557B',
    text: '#2E2E2E',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    gradientColors,
  },
};
