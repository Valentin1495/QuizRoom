import { StyleSheet, View } from 'react-native';
import Toast, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';

export type ToastKind = 'success' | 'error' | 'neutral';

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

function ResultToastContent({ text1, props }: ResultToastComponentProps) {
  const kind = props.kind ?? 'neutral';
  const scoreDelta = props.scoreDelta;
  const streak = props.streak;
  const ctaLabel = props.ctaLabel;
  const onPressCta = props.onPressCta;

  const backgroundColor =
    kind === 'success'
      ? Palette.coral600
      : kind === 'error'
        ? Palette.neutral
        : Palette.yellow600;

  return (
    <View
      pointerEvents={onPressCta ? 'auto' : 'none'}
      style={[styles.container, { backgroundColor }]}
    >
      {text1 ? (
        <ThemedText style={styles.message} lightColor="#fff" darkColor="#fff">
          {text1}
        </ThemedText>
      ) : null}
      {scoreDelta !== undefined ? (
        <ThemedText style={styles.meta} lightColor="#fff" darkColor="#fff">
          {scoreDelta > 0 ? '+' : ''}
          {scoreDelta}점
        </ThemedText>
      ) : null}
      {streak !== undefined ? (
        <ThemedText style={styles.meta} lightColor="#fff" darkColor="#fff">
          {streak}연속 정답! 🔥
        </ThemedText>
      ) : null}
      {ctaLabel && onPressCta ? (
        <View style={styles.ctaContainer}>
          <ThemedText
            onPress={onPressCta}
            style={styles.ctaLabel}
            lightColor="#fff"
            darkColor="#fff"
          >
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
  ctaContainer: {
    marginLeft: Spacing.sm,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: '#FFFFFF22',
  },
  ctaLabel: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
