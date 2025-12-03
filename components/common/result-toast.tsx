import { StyleSheet, View } from 'react-native';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ToastKind = 'success' | 'error' | 'neutral' | 'combo' | 'combo_hot' | 'combo_fire';

export type ResultToastOptions = {
  message: string;
  kind?: ToastKind;
  scoreDelta?: number;
  streak?: number;
  ctaLabel?: string;
  onPressCta?: () => void;
};

type ResultToastComponentProps = ToastConfigParams<{
  kind: ToastKind;
  scoreDelta?: number;
  streak?: number;
  ctaLabel?: string;
  onPressCta?: () => void;
}>;

const TOAST_TYPE = 'result-toast';

type ToastTone = {
  background: string;
  text: string;
  meta: string;
  ctaBackground: string;
  ctaText: string;
};

const TOAST_COLORS: Record<ToastKind, { light: ToastTone; dark: ToastTone }> = {
  success: {
    light: {
      background: 'rgba(230, 245, 236, 0.92)',
      text: '#0B5133',
      meta: '#137C4B',
      ctaBackground: 'rgba(11, 81, 51, 0.12)',
      ctaText: '#0B5133',
    },
    dark: {
      background: 'rgba(16, 86, 53, 0.9)',
      text: '#DFFAE5',
      meta: '#9FE4AE',
      ctaBackground: 'rgba(28, 122, 61, 0.85)',
      ctaText: '#DFFAE5',
    },
  },
  error: {
    light: {
      background: 'rgba(253, 231, 228, 0.92)',
      text: '#8A1E13',
      meta: '#C23C2D',
      ctaBackground: 'rgba(138, 30, 19, 0.12)',
      ctaText: '#8A1E13',
    },
    dark: {
      background: 'rgba(138, 30, 19, 0.9)',
      text: '#FFE2DE',
      meta: '#FFB8AE',
      ctaBackground: 'rgba(194, 60, 45, 0.85)',
      ctaText: '#FFE2DE',
    },
  },
  neutral: {
    light: {
      background: 'rgba(232, 237, 255, 0.92)',
      text: '#2C3A7A',
      meta: '#5460B4',
      ctaBackground: 'rgba(44, 58, 122, 0.12)',
      ctaText: '#2C3A7A',
    },
    dark: {
      background: 'rgba(44, 58, 122, 0.9)',
      text: '#E5EBFF',
      meta: '#C8D0FF',
      ctaBackground: 'rgba(62, 75, 168, 0.85)',
      ctaText: '#E5EBFF',
    },
  },
  // 콤보용 색상 (3-4콤보: 주황)
  combo: {
    light: {
      background: 'rgba(255, 237, 219, 0.92)',
      text: '#8B4513',
      meta: '#D2691E',
      ctaBackground: 'rgba(210, 105, 30, 0.12)',
      ctaText: '#8B4513',
    },
    dark: {
      background: 'rgba(180, 100, 30, 0.9)',
      text: '#FFECD2',
      meta: '#FFD4A8',
      ctaBackground: 'rgba(210, 130, 50, 0.85)',
      ctaText: '#FFECD2',
    },
  },
  // 콤보용 색상 (5-6콤보: 핫핑크)
  combo_hot: {
    light: {
      background: 'rgba(255, 224, 240, 0.92)',
      text: '#9B1B5A',
      meta: '#DB2777',
      ctaBackground: 'rgba(219, 39, 119, 0.12)',
      ctaText: '#9B1B5A',
    },
    dark: {
      background: 'rgba(157, 40, 100, 0.9)',
      text: '#FFE4F0',
      meta: '#FFB8D9',
      ctaBackground: 'rgba(200, 60, 130, 0.85)',
      ctaText: '#FFE4F0',
    },
  },
  // 콤보용 색상 (7+콤보: 레드/골드)
  combo_fire: {
    light: {
      background: 'rgba(255, 220, 200, 0.92)',
      text: '#B22222',
      meta: '#FF4500',
      ctaBackground: 'rgba(255, 69, 0, 0.12)',
      ctaText: '#B22222',
    },
    dark: {
      background: 'rgba(180, 50, 30, 0.9)',
      text: '#FFE4D4',
      meta: '#FFA07A',
      ctaBackground: 'rgba(220, 80, 50, 0.85)',
      ctaText: '#FFE4D4',
    },
  },
};

function ResultToastContent({ text1, props }: ResultToastComponentProps) {
  const kind = props.kind ?? 'neutral';
  const scoreDelta = props.scoreDelta;
  const streak = props.streak;
  const ctaLabel = props.ctaLabel;
  const onPressCta = props.onPressCta;
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const tone = TOAST_COLORS[kind][mode];

  return (
    <View
      pointerEvents={onPressCta ? 'auto' : 'none'}
      style={[styles.container, { backgroundColor: tone.background }]}
    >
      {text1 ? (
        <ThemedText style={[styles.message, { color: tone.text }]}>
          {text1}
        </ThemedText>
      ) : null}
      {scoreDelta !== undefined ? (
        <ThemedText style={[styles.meta, { color: tone.meta }]}>
          {scoreDelta > 0 ? '+' : ''}
          {scoreDelta}점
        </ThemedText>
      ) : null}
      {streak !== undefined ? (
        <ThemedText style={[styles.meta, { color: tone.meta }]}>
          {streak}연속 정답! 🔥
        </ThemedText>
      ) : null}
      {ctaLabel && onPressCta ? (
        <View style={[styles.ctaContainer, { backgroundColor: tone.ctaBackground }]}>
          <ThemedText onPress={onPressCta} style={[styles.ctaLabel, { color: tone.ctaText }]}>
            {ctaLabel}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export const resultToastConfig: ToastConfig = {
  [TOAST_TYPE]: (toastProps: ResultToastComponentProps) => (
    <ResultToastContent {...toastProps} />
  ),
};

export function showResultToast({
  message,
  kind = 'neutral',
  scoreDelta,
  streak,
  ctaLabel,
  onPressCta,
}: ResultToastOptions) {
  Toast.show({
    type: TOAST_TYPE,
    position: 'top',
    text1: message,
    props: { kind, scoreDelta, streak, ctaLabel, onPressCta },
    autoHide: !ctaLabel || !onPressCta,
    visibilityTime: ctaLabel && onPressCta ? 5000 : 2500,
    topOffset: 80,
  });
}

export function hideResultToast() {
  Toast.hide();
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
    maxWidth: '90%',
    flexWrap: 'wrap',
    shadowColor: '#00000040',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  message: {
    fontWeight: '700',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  meta: {
    fontWeight: '600',
    opacity: 0.85,
    flexShrink: 1,
  },
  ctaContainer: {
    marginLeft: Spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
  },
  ctaLabel: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
