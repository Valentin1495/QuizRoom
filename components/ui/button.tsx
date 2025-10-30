import React, { Children } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";

import * as Theme from "@/constants/theme";

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
export type ButtonSize = "sm" | "md" | "lg";

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
  fullWidth?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
}

// --------------------------- Theme adapter --------------------------- //
// Keys expected from theme.ts (per palette):
// primary, primaryForeground, secondary, secondaryForeground,
// border, foreground, destructive, destructiveForeground

type Palette = Record<string, string>;

interface Normalized {
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  border: string;
  foreground: string;
  destructive: string;
  onDestructive: string;
}

const FALLBACK_LIGHT: Normalized = {
  primary: "#2A2A2A",
  onPrimary: "#FFFFFF",
  secondary: "#F4F4F5", // accent-ish
  onSecondary: "#111111",
  border: "#E4E4E7",
  foreground: "#111827",
  destructive: "#DC2626",
  onDestructive: "#FFFFFF",
};

const FALLBACK_DARK: Normalized = {
  primary: "#E5E5E5",
  onPrimary: "#111111",
  secondary: "#262626",
  onSecondary: "#F5F5F5",
  border: "#27272A",
  foreground: "#F5F5F5",
  destructive: "#EF4444",
  onDestructive: "#111111",
};

function getColors() {
  const ColorsBag: any = (Theme as any).Colors ?? Theme;
  const light: Palette = ColorsBag.light ?? {};
  const dark: Palette = ColorsBag.dark ?? {};

  const norm = (p: Palette, fb: Normalized): Normalized => ({
    primary: p.primary ?? fb.primary,
    onPrimary: p.primaryForeground ?? fb.onPrimary,
    secondary: p.secondary ?? fb.secondary,
    onSecondary: p.secondaryForeground ?? fb.onSecondary,
    border: p.border ?? fb.border,
    foreground: p.foreground ?? fb.foreground,
    destructive: p.destructive ?? fb.destructive,
    onDestructive: p.destructiveForeground ?? fb.onDestructive,
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
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(Math.max(0, Math.min(255, r)))}${to(Math.max(0, Math.min(255, g)))}${to(Math.max(0, Math.min(255, b)))}`;
}
function mix(hexA: string, hexB: string, amount = 0.1) {
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = a.r + (b.r - a.r) * amount, g = a.g + (b.g - a.g) * amount, b2 = a.b + (b.b - a.b) * amount;
  return rgbToHex(r, g, b2);
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
  fullWidth,
  accessibilityLabel,
  onPress,
}: ButtonProps) {
  const scheme = useColorScheme();
  const { light, dark } = getColors();
  const p = scheme === "dark" ? dark : light;

  const isDisabled = disabled || loading;

  const baseContainer = [baseStyles.base, sizeStyles[size], roundedStyles[rounded]] as ViewStyle[];
  if (fullWidth) {
    baseContainer.push(baseStyles.fullWidth);
  }

  // Pressed-state styling to emulate shadcn hover/active
  const pressableStyle = ({ pressed }: { pressed: boolean }) => {
    const { container } = resolveStyles(variant, p, pressed);
    return [
      ...baseContainer,
      container,
      variant === "outline" && baseStyles.noShadow,
      isDisabled && baseStyles.disabled,
      style,
    ];
  };

  const { text, spinner } = resolveStyles(variant, p, false);
  const hasChildren = Children.count(children) > 0;
  const showLeft = loading || !!leftIcon;
  const showRight = !!rightIcon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={isDisabled}
      style={pressableStyle}
      onPress={(e) => {
        if (isDisabled) return;
        onPress?.(e);
      }}
      android_ripple={{ color: mix(p.foreground, p.border, 0.85) }}
    >
      <View style={[baseStyles.contentRow, fullWidth && baseStyles.contentRowFull]}>
        {showLeft ? (
          <View style={[baseStyles.iconSlot, hasChildren && baseStyles.iconSlotStart]}>
            {loading ? <ActivityIndicator size="small" color={spinner} /> : leftIcon}
          </View>
        ) : null}
        {hasChildren ? (
          <Text style={[baseStyles.text, text, textStyle]}>{children}</Text>
        ) : null}
        {showRight ? (
          <View style={[baseStyles.iconSlot, hasChildren && baseStyles.iconSlotEnd]}>{rightIcon}</View>
        ) : null}
      </View>
    </Pressable>
  );
}

function resolveStyles(
  variant: ButtonVariant,
  p: Normalized,
  pressed: boolean
): { container: ViewStyle; text: any; spinner: string } {
  switch (variant) {
    case "outline": {
      const baseBg = "transparent" as const;
      const bg = pressed ? mix(p.secondary, p.border, 0.5) : baseBg; // hover-like
      const color = p.foreground;
      return {
        container: { backgroundColor: bg, borderWidth: 1, borderColor: p.border },
        text: { color },
        spinner: color,
      };
    }
    case "secondary": {
      const baseBg = p.secondary;
      const bg = pressed ? mix(baseBg, isLight(baseBg) ? "#000000" : "#FFFFFF", 0.07) : baseBg;
      const color = p.onSecondary ?? contrastText(baseBg);
      return { container: { backgroundColor: bg }, text: { color }, spinner: color };
    }
    case "destructive": {
      const baseBg = p.destructive;
      const bg = pressed ? mix(baseBg, "#000000", 0.08) : baseBg;
      const color = p.onDestructive ?? contrastText(baseBg);
      return { container: { backgroundColor: bg }, text: { color }, spinner: color };
    }
    case "ghost": {
      const baseBg = "transparent" as const;
      const bg = pressed ? mix(p.secondary, p.border, 0.35) : baseBg;
      const color = p.foreground;
      return { container: { backgroundColor: bg }, text: { color }, spinner: color };
    }
    default: {
      const baseBg = p.primary;
      const bg = pressed ? mix(baseBg, "#000000", 0.07) : baseBg; // subtle darken
      const color = p.onPrimary ?? contrastText(baseBg);
      return { container: { backgroundColor: bg }, text: { color }, spinner: color };
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
    paddingHorizontal: 16, // px-4
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
  disabled: {
    opacity: 0.5,
  },
  noShadow: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingVertical: 6 },
  md: { minHeight: 44, paddingVertical: 8 },
  lg: { minHeight: 52, paddingVertical: 12 },
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
