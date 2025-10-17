import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { difficultyToDots } from '@/lib/elo';
import type { SwipeFeedQuestion } from '@/lib/feed';

import { AnswerSheet } from './answer-sheet';

export type SwipeFeedback = {
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
  onSkip: () => void;
  onOpenActions?: () => void;
};

const SWIPE_NEXT_THRESHOLD = 120;
const SKIP_THRESHOLD = -100;
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
  onSkip,
  onOpenActions,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');
  const textMuted = useThemeColor({}, 'textMuted');

  const tags = useMemo(() => card.tags.slice(0, 2), [card.tags]);
  const difficultyDots = difficultyToDots(card.difficulty);
  const explanation = feedback?.explanation ?? null;

  const gesture = Gesture.Pan()
    .enabled(isActive)
    .onChange((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onFinalize((event) => {
      const { translationX, translationY } = event;
      if (feedback && translationX > SWIPE_NEXT_THRESHOLD) {
        runOnJS(onSwipeNext)();
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      if (translationY < SKIP_THRESHOLD) {
        runOnJS(onSkip)();
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      if (translationX < ACTION_THRESHOLD && onOpenActions) {
        runOnJS(onOpenActions)();
      }

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const offset = index * 12;
    const scale = isActive ? 1 : 1 - Math.min(index, 2) * 0.05;
    return {
      transform: [
        { translateX: translateX.value },
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
          <View style={styles.tagRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <ThemedText style={styles.tagText} lightColor="#fff" darkColor="#fff">
                  {tag}
                </ThemedText>
              </View>
            ))}
          </View>
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

        {explanation && feedback && !feedback.isCorrect ? (
          <View style={styles.explanationBox}>
            <ThemedText style={styles.explanationTitle}>해설</ThemedText>
            <ThemedText style={styles.explanationText}>{explanation}</ThemedText>
          </View>
        ) : null}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Palette.purple600,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
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
  explanationBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Palette.pink200,
  },
  explanationTitle: {
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  explanationText: {
    fontSize: 14,
  },
});
