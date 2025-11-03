import { Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
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
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  onCardLayout?: (height: number) => void;
};

const SWIPE_NEXT_THRESHOLD = 120;
const ACTION_THRESHOLD = -110;

const AnimatedView = Animated.createAnimatedComponent(View);

type DifficultyLevel = 'easy' | 'medium' | 'hard';

type DifficultyModeToken = {
  background: string;
  foreground: string;
  muted: string;
  border: string;
};

const DIFFICULTY_TOKENS: Record<
  DifficultyLevel,
  {
    label: string;
    light: DifficultyModeToken;
    dark: DifficultyModeToken;
  }
> = {
  easy: {
    label: '초급',
    light: {
      background: '#E6F5EC',
      foreground: '#1C7A3D',
      muted: '#9ACDAF',
      border: '#B7E2C5',
    },
    dark: {
      background: 'rgba(76, 175, 80, 0.22)',
      foreground: '#9FE4AE',
      muted: 'rgba(159, 228, 174, 0.6)',
      border: 'rgba(159, 228, 174, 0.5)',
    },
  },
  medium: {
    label: '중급',
    light: {
      background: '#FFF3E0',
      foreground: '#B36602',
      muted: '#F2C28A',
      border: '#FAD7AA',
    },
    dark: {
      background: 'rgba(255, 193, 7, 0.2)',
      foreground: '#FFD475',
      muted: 'rgba(255, 212, 117, 0.65)',
      border: 'rgba(255, 212, 117, 0.5)',
    },
  },
  hard: {
    label: '고급',
    light: {
      background: '#FDE7E4',
      foreground: '#C23C2D',
      muted: '#F1A19B',
      border: '#F6C1BC',
    },
    dark: {
      background: 'rgba(244, 67, 54, 0.2)',
      foreground: '#FF9E92',
      muted: 'rgba(255, 158, 146, 0.65)',
      border: 'rgba(255, 158, 146, 0.5)',
    },
  },
};

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
  onCardLayout,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const cardColor = useThemeColor({}, 'card');

  const difficultyDots = difficultyToDots(card.difficulty);
  const difficultyLevel: DifficultyLevel =
    difficultyDots <= 1 ? 'easy' : difficultyDots === 2 ? 'medium' : 'hard';
  const difficultyMode = colorScheme === 'dark' ? 'dark' : 'light';
  const difficultyToken = DIFFICULTY_TOKENS[difficultyLevel][difficultyMode];
  const inactiveDotsCount = Math.max(0, 3 - difficultyDots);

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
      ? palette.success
      : Palette.gray500
    : Palette.gray400;

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
        onLayout={
          isActive && onCardLayout
            ? (event: LayoutChangeEvent) => {
              onCardLayout(event.nativeEvent.layout.height);
            }
            : undefined
        }
      >
        <View style={styles.header}>
          <View
            style={[
              styles.difficultyBadge,
              {
                backgroundColor: difficultyToken.background,
                borderColor: difficultyToken.border,
              },
            ]}
          >
            <ThemedText
              style={styles.difficultyLabel}
              lightColor={difficultyToken.foreground}
              darkColor={difficultyToken.foreground}
            >
              {DIFFICULTY_TOKENS[difficultyLevel].label}
            </ThemedText>
            <View style={styles.difficultyDotGroup}>
              <ThemedText
                style={styles.difficultyDots}
                lightColor={difficultyToken.foreground}
                darkColor={difficultyToken.foreground}
              >
                {'●'.repeat(difficultyDots)}
              </ThemedText>
              {inactiveDotsCount > 0 ? (
                <ThemedText
                  style={styles.difficultyDots}
                  lightColor={difficultyToken.muted}
                  darkColor={difficultyToken.muted}
                >
                  {'●'.repeat(inactiveDotsCount)}
                </ThemedText>
              ) : null}
            </View>
          </View>
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
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  difficultyLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  difficultyDotGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  difficultyDots: {
    fontSize: Platform.select({ android: 18, default: 10 }),
    fontWeight: '700',
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
