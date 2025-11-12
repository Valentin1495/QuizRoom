import React, { Children } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Platform,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  type AccessibilityState,
} from "react-native";

import * as Theme from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// ---------------------------------------------------------------
// shadcn/ui-like Button for React Native (neutral palette aware)
// Variants: default, outline, secondary, destructive (+ ghost optional)
// Sizes: sm (h-9), md (h-10), lg (h-11)
// Rounded: md (rounded-md), lg, full
// Pressed state emulates shadcn hover/active by slight color shift
// ---------------------------------------------------------------

export type ButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "destructive"
  | "ghost"; // optional, closer to shadcn
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps {
  children?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: "md" | "lg" | "full";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}

// --------------------------- Theme adapter --------------------------- //
// Keys expected from theme.ts (per palette):
// primary, primaryForeground, secondary, secondaryForeground,
// border, foreground, destructive, destructiveForeground

type Palette = Record<string, string>;

interface Normalized {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  cardElevated: string;
  border: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
}

const FALLBACK_LIGHT: Normalized = {
  primary: "#2A2A2A",
  primaryForeground: "#FFFFFF",
  secondary: "#F4F4F5", // accent-ish
  secondaryForeground: "#111111",
  cardElevated: "#F5F5F5",
  border: "#E4E4E7",
  accent: "#111827",
  accentForeground: "#FFFFFF",
  destructive: "#DC2626",
  destructiveForeground: "#FFFFFF",
};

const FALLBACK_DARK: Normalized = {
  primary: "#E5E5E5",
  primaryForeground: "#111111",
  secondary: "#262626",
  secondaryForeground: "#F5F5F5",
  cardElevated: "#1F1F1F",
  border: "#27272A",
  accent: "#F5F5F5",
  accentForeground: "#111111",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
};

function getColors() {
  const ColorsBag: any = (Theme as any).Colors ?? Theme;
  const light: Palette = ColorsBag.light ?? {};
  const dark: Palette = ColorsBag.dark ?? {};

  const norm = (p: Palette, fb: Normalized): Normalized => ({
    primary: p.primary ?? fb.primary,
    primaryForeground: p.primaryForeground ?? fb.primaryForeground,
    secondary: p.secondary ?? fb.secondary,
    secondaryForeground: p.secondaryForeground ?? fb.secondaryForeground,
    cardElevated: p.cardElevated ?? fb.cardElevated,
    border: p.border ?? fb.border,
    accent: p.accent ?? fb.accent,
    accentForeground: p.accentForeground ?? fb.accentForeground,
    destructive: p.destructive ?? fb.destructive,
    destructiveForeground: p.destructiveForeground ?? fb.destructiveForeground,
  });

  return { light: norm(light, FALLBACK_LIGHT), dark: norm(dark, FALLBACK_DARK) };
}

// Util: luminance/contrast helpers
function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to(Math.max(0, Math.min(255, r)))}${to(Math.max(0, Math.min(255, g)))}${to(Math.max(0, Math.min(255, b)))}`;
}
function mix(hexA: string, hexB: string, amount = 0.1) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = a.r + (b.r - a.r) * amount, g = a.g + (b.g - a.g) * amount, b2 = a.b + (b.b - a.b) * amount;
  return rgbToHex(r, g, b2);
}
function darken(hex: string, amount = 0.15) {
  return mix(hex, "#000000", amount);
}
function isLight(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const L = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return L > 0.6; // simple threshold
}
function contrastText(bgHex: string, light = "#FFFFFF", dark = "#111111") {
  return isLight(bgHex) ? dark : light;
}

// ------------------------------- Button ------------------------------ //
export function Button({
  children,
  loading,
  disabled,
  variant = "default",
  size = "md",
  rounded = "md",
  leftIcon,
  rightIcon,
  style,
  textStyle,
  contentStyle,
  pressedStyle,
  fullWidth,
  accessibilityLabel,
  accessibilityState,
  onPress,
}: ButtonProps) {
  const scheme = useColorScheme();
  const { light, dark } = getColors();
  const p = scheme === "dark" ? dark : light;

  const isDisabled = disabled || loading;

  // Pressed-state styling to emulate shadcn hover/active
  const pressableStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => {
    const { container } = resolveStyles(variant, p, pressed, scheme === "dark");
    const pressedOverlay = pressed && pressedStyle ? StyleSheet.flatten(pressedStyle) : null;
    const baseStyle: StyleProp<ViewStyle> = [
      baseStyles.base,
      sizeStyles[size],
      roundedStyles[rounded],
      fullWidth ? baseStyles.fullWidth : null,
      container,
      !isDisabled && pressed ? feedbackStyles.pressed : null,
      pressedOverlay,
      (variant === "outline" || variant === "ghost") ? baseStyles.noShadow : null,
      isDisabled ? baseStyles.disabled : null,
    ];
    return StyleSheet.compose(baseStyle, style);
  };
  const { text, spinner, labelColor } = resolveStyles(variant, p, false, scheme === "dark");
  const hasChildren = Children.count(children) > 0;
  const showLeft = loading || !!leftIcon;
  const showRight = !!rightIcon;

  const sizeTextStyle = size === "lg" ? textSizeStyles.lg : undefined;

  return (
    <Pressable
      key={variant}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      disabled={isDisabled}
      style={pressableStyle}
      onPress={(e) => {
        if (isDisabled) return;
        onPress?.(e);
      }}
    >
      <View
        style={StyleSheet.compose(
          [baseStyles.contentRow, fullWidth ? baseStyles.contentRowFull : undefined],
          contentStyle
        )}
      >
        {showLeft ? (
          <View style={[baseStyles.iconSlot, hasChildren && baseStyles.iconSlotStart]}>
            {loading ? <ActivityIndicator size="small" color={spinner} /> : leftIcon}
          </View>
        ) : null}
        {hasChildren ? (
          <Text style={[baseStyles.text, sizeTextStyle, text, labelColor ? { color: labelColor } : null, textStyle]}>{children}</Text>
        ) : null}
        {showRight ? (
          <View
            style={[
              baseStyles.iconSlot,
              hasChildren && baseStyles.iconSlotEnd,
              Platform.OS === "android" ? baseStyles.iconSlotEndAndroid : null,
            ]}
          >
            {rightIcon}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

interface ResolvedStyles {
  container: ViewStyle;
  text: TextStyle;
  spinner: string;
  labelColor?: string;
}

function resolveStyles(
  variant: ButtonVariant,
  p: Normalized,
  pressed: boolean,
  isDark: boolean
): ResolvedStyles {
  switch (variant) {
    case 'outline': {
      const baseBg = 'transparent' as const;
      const mixTarget = isLight(p.accentForeground) ? '#000000' : '#FFFFFF';
      const outlineActive = mix(p.border, mixTarget, 0.18);
      const bg = pressed ? outlineActive : baseBg;
      const borderColor = pressed ? mix(p.border, p.accentForeground, 0.35) : p.border;
      const color = p.accentForeground;
      return {
        container: { backgroundColor: bg, borderWidth: 2, borderColor },
        text: { color },
        spinner: color,
        labelColor: color,
      };
    }
    case 'secondary': {
      const baseBg = isDark ? Theme.Palette.gray900 : Theme.Palette.gray100;
      const toneTarget = isLight(baseBg) ? '#000000' : '#FFFFFF';
      const activeBg = mix(baseBg, toneTarget, isDark ? 0.12 : 0.14);
      const bg = pressed ? activeBg : baseBg;
      const color = p.accentForeground ?? contrastText(bg);
      return {
        container: { backgroundColor: bg },
        text: { color },
        spinner: color,
        labelColor: color,
      };
    }
    case 'destructive': {
      const baseBg = p.destructive;
      const toneTarget = isLight(baseBg) ? '#000000' : '#FFFFFF';
      const activeBg = mix(baseBg, toneTarget, isDark ? 0.16 : 0.18);
      const bg = pressed ? activeBg : baseBg;
      const borderColor = mix(baseBg, toneTarget, 0.22);
      const color = p.destructiveForeground ?? contrastText(bg);
      return {
        container: { backgroundColor: bg, borderWidth: 1, borderColor },
        text: { color, fontWeight: '600' },
        spinner: color,
      };
    }
    case 'ghost': {
      const baseBg = 'transparent' as const;
      const mixTarget = isLight(p.accentForeground) ? '#000000' : '#FFFFFF';
      const ghostActive = mix(p.border, mixTarget, 0.08);
      const bg = pressed ? ghostActive : baseBg;
      const color = p.accentForeground;
      return {
        container: { backgroundColor: bg },
        text: { color },
        spinner: color,
      };
    }
    default: {
      const baseBg = p.primary;
      const bg = pressed ? darken(baseBg, 0.12) : baseBg;
      const color = p.primaryForeground ?? contrastText(baseBg);
      const borderColor = darken(baseBg, isDark ? 0.22 : 0.18);
      return {
        container: { backgroundColor: bg, borderWidth: 1, borderColor },
        text: { color },
        spinner: color,
        labelColor: color,
      };
    }
  }
}

// ------------------------------- Styles ------------------------------ //
const baseStyles = StyleSheet.create({
  base: {
    // inline-flex items-center justify-center whitespace-nowrap
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // disabled:pointer-events-none is approximated via disabled prop
    shadowColor: "rgba(0, 0, 0, 0.12)",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    shadowOpacity: 1,
    elevation: 4,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  contentRowFull: {
    flex: 1,
  },
  text: {
    // text-sm font-medium
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    textAlignVertical: "center",
    flexShrink: 1,
  },
  fullWidth: {
    alignSelf: "stretch",
    width: "100%",
  },
  iconSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconSlotStart: {
    marginRight: 8,
  },
  iconSlotEnd: {
    marginLeft: 8,
  },
  iconSlotEndAndroid: Platform.select({
    android: {
      transform: [{ translateY: 1.5 }],
    },
    default: {},
  }),
  disabled: {
    opacity: 0.4,
    borderWidth: 0,
  },
  noShadow: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});

const feedbackStyles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 12 },
  md: { minHeight: 44, paddingVertical: 8, paddingHorizontal: 16 },
  lg: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 24 },
  icon: Platform.select({
    android: {
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    default: {
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
  }),
});

const textSizeStyles = StyleSheet.create({
  lg: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 24,
  },
});

const roundedStyles = StyleSheet.create({
  // rounded-md ~ 8
  md: { borderRadius: 8 },
  lg: { borderRadius: 12 },
  full: { borderRadius: 9999 },
});

// Named exports
export const ButtonDefault = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="default" {...props} />
);
export const ButtonOutline = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="outline" {...props} />
);
export const ButtonSecondary = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="secondary" {...props} />
);
export const ButtonDestructive = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="destructive" {...props} />
);
export const ButtonGhost = (props: Omit<ButtonProps, "variant">) => (
  <Button variant="ghost" {...props} />
);
