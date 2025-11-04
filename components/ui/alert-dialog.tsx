import { ReactNode, useCallback, useEffect } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type AlertDialogAction = {
  /**
   * 버튼에 표시할 레이블
   */
  label: string;
  /**
   * 버튼 스타일 톤 (기본값은 'default')
   */
  tone?: ButtonVariant | 'default' | 'secondary' | 'destructive';
  /**
   * 클릭 시 호출할 핸들러
   */
  onPress?: () => void;
  /**
   * 버튼 비활성화 여부
   */
  disabled?: boolean;
};

export type AlertDialogProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string | ReactNode;
  actions?: AlertDialogAction[];
  /**
   * 바깥 영역을 눌러 닫을 수 있는지 여부 (기본 true)
   */
  dismissable?: boolean;
  /**
   * 컨텐츠가 길어질 경우 스크롤 가능한지 여부 (기본 false)
   */
  scrollable?: boolean;
  /**
   * 추가 컨텐츠 렌더링 (예: 커스텀 입력)
   */
  children?: ReactNode;
};

export function AlertDialog({
  visible,
  onClose,
  title,
  description,
  actions = [
    {
      label: '확인',
      tone: 'default',
    },
  ],
  dismissable = true,
  scrollable = false,
  children,
}: AlertDialogProps) {
  const scheme = useColorScheme();
  const palette = Colors[scheme ?? 'light'];
  const overlayOpacity = useSharedValue(0);
  const scale = useSharedValue(0.92);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 220 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.92, { duration: 160 });
    }
  }, [overlayOpacity, scale, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    backgroundColor:
      scheme === 'dark'
        ? `rgba(12, 12, 12, ${0.65 * overlayOpacity.value})`
        : `rgba(10, 10, 10, ${0.45 * overlayOpacity.value})`,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: overlayOpacity.value,
  }));

  const handleClose = useCallback(() => {
    if (!dismissable) return;
    onClose();
  }, [dismissable, onClose]);

  const renderAction = useCallback(
    (action: AlertDialogAction, index: number) => {
      const { label: actionLabel, tone = 'default', onPress, disabled } = action;
      const handlePress = () => {
        onPress?.();
        onClose();
      };

      return (
        <Button
          key={`${actionLabel}-${index}`}
          onPress={handlePress}
          variant={tone === 'default' ? 'default' : (tone as ButtonVariant)}
          disabled={disabled}
          style={styles.actionButton}
        >
          {actionLabel}
        </Button>
      );
    },
    [onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlayContainer} onPress={handleClose}>
        <Animated.View style={[styles.overlay, overlayStyle]} />
      </Pressable>
      <Animated.View style={[styles.cardContainer, cardStyle]} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              backgroundColor: scheme === 'dark' ? palette.card : Palette.white,
              borderColor: scheme === 'dark' ? palette.borderStrong ?? palette.border : Palette.gray150,
            },
          ]}
        >
          <View style={styles.content}>
            {title ? (
              <ThemedText style={styles.title} type="subtitle">
                {title}
              </ThemedText>
            ) : null}
            {typeof description === 'string' ? (
              <ThemedText style={[styles.description, { color: palette.textMuted }]}>
                {description}
              </ThemedText>
            ) : (
              description
            )}
            {children}
          </View>
          <View style={[styles.actions, scrollable ? styles.actionsScrollable : null]}>
            {actions.map(renderAction)}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
  },
  cardContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    shadowColor: '#00000040',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  content: {
    gap: Spacing.sm,
  },
  title: {
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionsScrollable: {
    maxHeight: 240,
  },
  actionButton: {
    flex: 1,
  },
});
