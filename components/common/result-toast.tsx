import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type ToastKind = 'success' | 'error' | 'neutral';

export type ResultToastProps = {
  visible: boolean;
  message: string;
  scoreDelta?: number;
  streak?: number;
  kind?: ToastKind;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function ResultToast({
  visible,
  message,
  scoreDelta,
  streak,
  kind = 'neutral',
}: ResultToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity, {
        toValue: visible ? 1 : 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }),
      Animated.spring(translateY, {
        toValue: visible ? 0 : 16,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }),
    ]).start();
  }, [opacity, translateY, visible]);

  const accent = useThemeColor({}, 'tint');

  const backgroundColor = useMemo(() => {
    switch (kind) {
      case 'success':
        return Palette.success;
      case 'error':
        return Palette.danger;
      default:
        return accent;
    }
  }, [accent, kind]);

  return (
    <AnimatedView
      pointerEvents="none"
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
          backgroundColor,
        },
      ]}
    >
      <ThemedText style={styles.message} lightColor="#fff" darkColor="#fff">
        {message}
      </ThemedText>
      {scoreDelta !== undefined ? (
        <ThemedText
          style={styles.meta}
          lightColor="#fff"
          darkColor="#fff"
        >
          {scoreDelta > 0 ? '+' : ''}
          {scoreDelta} pts
        </ThemedText>
      ) : null}
      {streak !== undefined ? (
        <ThemedText
          style={styles.meta}
          lightColor="#fff"
          darkColor="#fff"
        >
          Streak {streak}
        </ThemedText>
      ) : null}
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#00000040',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  message: {
    fontWeight: '700',
  },
  meta: {
    fontWeight: '600',
    opacity: 0.85,
  },
});
