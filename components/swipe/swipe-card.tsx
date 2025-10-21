import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { difficultyToDots } from '@/lib/elo';
import type { SwipeFeedQuestion } from '@/lib/feed';

import { AnswerSheet } from './answer-sheet';

export type SwipeFeedback =
  | {
    status: 'optimistic';
    isCorrect: boolean;
    correctChoiceId: string;
    correctChoiceIndex: number | null;
  }
  | {
    status: 'confirmed';
    isCorrect: boolean;
    correctChoiceId: string;
    correctChoiceIndex: number | null;
    explanation: string | null;
    scoreDelta: number;
    streak: number;
  };

export type SwipeCardProps = {
  card: SwipeFeedQuestion;
  index: number;
  isActive: boolean;
  selectedIndex: number | null;
  feedback: SwipeFeedback | null;
  onSelectChoice: (index: number) => void;
  onSwipeNext: () => void;
  onOpenActions?: () => void;
  onSwipeBlocked?: () => void;
};

const SWIPE_NEXT_THRESHOLD = 120;
const ACTION_THRESHOLD = -110;

const AnimatedView = Animated.createAnimatedComponent(View);

export function SwipeCard({
  card,
  index,
  isActive,
  selectedIndex,
  feedback,
  onSelectChoice,
  onSwipeNext,
  onOpenActions,
  onSwipeBlocked,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');
  const textMuted = useThemeColor({}, 'textMuted');

  const difficultyDots = difficultyToDots(card.difficulty);

  const gesture = Gesture.Pan()
    .enabled(isActive)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onChange((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.2;
    })
    .onFinalize((event) => {
      const { translationX } = event;
      if (feedback && translationX >= SWIPE_NEXT_THRESHOLD) {
        scheduleOnRN(onSwipeNext);
        translateX.value = 0;
        translateY.value = 0;
        return;
      }
      if (!feedback && translationX >= SWIPE_NEXT_THRESHOLD) {
        if (onSwipeBlocked) {
          scheduleOnRN(onSwipeBlocked);
        }
        translateY.value = withSpring(0);
        translateX.value = withSpring(0, undefined, (finished) => {
          if (!finished) return;
          shakeX.value = withSequence(
            withTiming(-14, { duration: 70 }),
            withTiming(14, { duration: 70 }),
            withTiming(-8, { duration: 60 }),
            withTiming(0, { duration: 60 })
          );
        });
        return;
      }

      if (translationX <= ACTION_THRESHOLD && onOpenActions) {
        scheduleOnRN(onOpenActions);
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const offset = index * 12;
    const scale = isActive ? 1 : 1 - Math.min(index, 2) * 0.05;
    const translateXWithShake = translateX.value + shakeX.value;
    return {
      transform: [
        { translateX: translateXWithShake },
        { translateY: translateY.value + offset },
        { rotate: `${translateX.value / 25}deg` },
        { scale },
      ],
      zIndex: 100 - index,
    };
  }, [index, isActive]);

  const statusBorderColor = feedback
    ? feedback.isCorrect
      ? Palette.success
      : Palette.danger
    : borderColor;

  return (
    <GestureDetector gesture={gesture}>
      <AnimatedView
        style={[
          styles.card,
          animatedStyle,
          {
            backgroundColor: cardColor,
            borderColor: statusBorderColor,
          },
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={[styles.difficulty, { color: textMuted }]}>
            {'●'.repeat(difficultyDots) + '○'.repeat(3 - difficultyDots)}
          </ThemedText>
        </View>

        <ThemedText style={styles.prompt} type="subtitle">
          {card.prompt}
        </ThemedText>

        {card.mediaUrl ? (
          <Image source={{ uri: card.mediaUrl }} style={styles.media} resizeMode="cover" />
        ) : null}

        <AnswerSheet
          choices={card.choices}
          onSelect={onSelectChoice}
          selectedIndex={selectedIndex}
          disabled={!isActive || Boolean(feedback)}
          correctIndex={
            feedback && feedback.correctChoiceIndex != null
              ? feedback.correctChoiceIndex
              : undefined
          }
        />

      </AnimatedView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
    shadowColor: '#2F288040',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  difficulty: {
    fontSize: 14,
    fontWeight: '600',
  },
  prompt: {
    marginBottom: Spacing.md,
  },
  media: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
});
