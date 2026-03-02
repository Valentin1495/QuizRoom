import { forwardRef, useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/hooks/use-unified-auth';

export type LoginSheetProps = {
  /** 시트 닫힘 후 호출되는 콜백 */
  onDismiss?: () => void;
  /** 로그인 성공 후 호출되는 콜백 */
  onLoginSuccess?: () => void;
};

export const LoginSheet = forwardRef<BottomSheetModal, LoginSheetProps>(
  function LoginSheet({ onDismiss, onLoginSuccess }, ref) {
    const { signInWithGoogle, signInWithApple } = useAuth();
    const colorScheme = useColorScheme();
    const palette = Colors[colorScheme ?? 'light'];

    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);

    const handleGoogleLogin = useCallback(async () => {
      setIsGoogleLoading(true);
      try {
        const success = await signInWithGoogle();
        if (success) {
          (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
          onLoginSuccess?.();
        }
      } catch (error) {
        Alert.alert(
          '로그인에 실패했어요',
          error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'
        );
      } finally {
        setIsGoogleLoading(false);
      }
    }, [ref, signInWithGoogle, onLoginSuccess]);

    const handleAppleLogin = useCallback(async () => {
      setIsAppleLoading(true);
      try {
        const success = await signInWithApple();
        if (success) {
          (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
          onLoginSuccess?.();
        }
      } catch (error) {
        Alert.alert(
          '로그인에 실패했어요',
          error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.'
        );
      } finally {
        setIsAppleLoading(false);
      }
    }, [ref, signInWithApple, onLoginSuccess]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      []
    );

    const isAnyLoading = isGoogleLoading || isAppleLoading;

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        enablePanDownToClose
        enableOverDrag={false}
        backdropComponent={renderBackdrop}
        onDismiss={onDismiss}
        backgroundStyle={[
          styles.background,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
        handleIndicatorStyle={{ backgroundColor: palette.border }}
      >
        <BottomSheetView style={styles.content}>
          <ThemedText type="subtitle" style={styles.title}>
            로그인
          </ThemedText>
          <View style={styles.buttons}>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onPress={() => void handleGoogleLogin()}
              loading={isGoogleLoading}
              disabled={isAnyLoading}
            >
              {isGoogleLoading ? '로그인 중...' : 'Google 로그인'}
            </Button>
            {Platform.OS === 'ios' ? (
              <Button
                variant="outline"
                size="lg"
                fullWidth
                onPress={() => void handleAppleLogin()}
                loading={isAppleLoading}
                disabled={isAnyLoading}
              >
                {isAppleLoading ? '로그인 중...' : 'Apple 로그인'}
              </Button>
            ) : null}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  title: {
    fontWeight: '700',
  },
  buttons: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
