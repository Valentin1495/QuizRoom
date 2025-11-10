import { useEffect, useState } from 'react';
import { Dimensions, Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
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
  cardNumber?: number;
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
const SCREEN_WIDTH = Dimensions.get('window').width;

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
  cardNumber,
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
  const opacity = useSharedValue(1);
  const isDismissing = useSharedValue(false);
  const colorScheme = useColorScheme();
  const normalizedScheme = (colorScheme ?? 'light') as 'light' | 'dark';
  const palette = Colors[normalizedScheme];
  const cardColor = useThemeColor({}, 'card');

  const animatedOffset = useSharedValue(index * 12);
  const animatedScale = useSharedValue(1 - Math.min(index, 2) * 0.05);

  useEffect(() => {
    const newOffset = index * 12;
    animatedOffset.value = withSpring(newOffset);
  }, [index, animatedOffset]);

  useEffect(() => {
    const newScale = isActive ? 1 : 1 - Math.min(index, 2) * 0.05;
    animatedScale.value = withSpring(newScale);
  }, [index, isActive, animatedScale]);

  const difficultyDots = difficultyToDots(card.difficulty);
  const difficultyLevel: DifficultyLevel =
    difficultyDots <= 1 ? 'easy' : difficultyDots === 2 ? 'medium' : 'hard';
  const difficultyMode = colorScheme === 'dark' ? 'dark' : 'light';
  const difficultyToken = DIFFICULTY_TOKENS[difficultyLevel][difficultyMode];
  const inactiveDotsCount = Math.max(0, 3 - difficultyDots);
  const [displayCardNumber] = useState(cardNumber ?? index + 1);

  const gesture = Gesture.Pan()
    .enabled(isActive)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onChange((event) => {
      if (isDismissing.value) {
        return;
      }
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.2;

      // 틴더 스타일: 이동 거리에 비례한 투명도 감소
      const distance = Math.abs(event.translationX);
      const maxDistance = SCREEN_WIDTH * 0.7;
      opacity.value = Math.max(0.3, 1 - (distance / maxDistance) * 0.7);
    })
    .onFinalize((event) => {
      if (isDismissing.value) {
        return;
      }
      const { translationX } = event;

      // 오른쪽 스와이프 - 다음으로 넘어가기
      if (feedback && translationX >= SWIPE_NEXT_THRESHOLD) {
        // 틴더 스타일: 카드가 날아가며 사라지는 애니메이션
        isDismissing.value = true;
        const currentY = translateY.value;
        // 카드가 완전히 화면 밖으로 나가도록 충분한 거리
        translateX.value = withTiming(SCREEN_WIDTH * 1.8, { duration: 280 });
        translateY.value = withTiming(currentY - 50, { duration: 280 });
        opacity.value = withTiming(0, { duration: 280 }, (finished) => {
          if (finished) {
            scheduleOnRN(onSwipeNext);
          }
        });
        return;
      }

      // 오른쪽 스와이프했지만 아직 문제를 풀지 않음
      if (!feedback && translationX >= SWIPE_NEXT_THRESHOLD) {
        if (onSwipeBlocked) {
          scheduleOnRN(onSwipeBlocked);
        }
        opacity.value = withSpring(1);
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

      // 왼쪽 스와이프 - 액션 메뉴
      if (translationX <= ACTION_THRESHOLD && onOpenActions) {
        scheduleOnRN(onOpenActions);
      }

      // 카드 복귀 - 탄성 애니메이션
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      opacity.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => {
    // 날아가는 중이면 index 변경 무시
    if (isDismissing.value) {
      const translateXWithShake = translateX.value + shakeX.value;
      const maxRotation = 15;
      const rotationProgress = Math.min(Math.abs(translateXWithShake) / (SCREEN_WIDTH * 0.4), 1);
      const rotation = (translateXWithShake / Math.abs(translateXWithShake || 1)) * rotationProgress * maxRotation;

      return {
        transform: [
          { translateX: translateXWithShake },
          { translateY: translateY.value },
          { rotate: `${rotation}deg` },
          { scale: 1 },
        ],
        zIndex: 999, // 최상위로
        opacity: opacity.value,
      };
    }

    const translateXWithShake = translateX.value + shakeX.value;

    // 틴더 스타일: ±15도 범위로 자연스러운 회전
    const maxRotation = 15;
    const rotationProgress = Math.min(Math.abs(translateXWithShake) / (SCREEN_WIDTH * 0.4), 1);
    const rotation = (translateXWithShake / Math.abs(translateXWithShake || 1)) * rotationProgress * maxRotation;

    return {
      transform: [
        { translateX: translateXWithShake },
        { translateY: translateY.value + animatedOffset.value },
        { rotate: `${rotation}deg` },
        { scale: animatedScale.value },
      ],
      zIndex: 100 - index,
      opacity: isActive ? opacity.value : 1,
    };
  }, [index, isActive]);

  // 틴더 스타일: 방향별 컬러 피드백 오버레이
  const overlayAnimatedStyle = useAnimatedStyle(() => {
    const distance = translateX.value;
    const isRight = distance > 0;
    const isLeft = distance < 0;
    const progress = Math.min(Math.abs(distance) / 120, 1);

    let backgroundColor = 'rgba(0,0,0,0)';
    if (isRight && feedback) {
      // 오른쪽: 연한 민트그린 (정답 완료 시)
      backgroundColor = `rgba(100, 255, 180, ${progress * 0.12})`;
    } else if (isLeft) {
      // 왼쪽: 살짝 오렌지빛 베이지 (액션 메뉴)
      backgroundColor = `rgba(255, 200, 130, ${progress * 0.12})`;
    }

    return {
      backgroundColor,
      opacity: (isActive || isDismissing.value) ? 1 : 0,
    };
  }, [feedback, isActive]);

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
        pointerEvents={isActive ? 'auto' : 'none'}
        onLayout={
          isActive && onCardLayout
            ? (event: LayoutChangeEvent) => {
              onCardLayout(event.nativeEvent.layout.height);
            }
            : undefined
        }
      >
        {/* 틴더 스타일: 방향별 컬러 피드백 오버레이 */}
        <AnimatedView style={[styles.overlay, overlayAnimatedStyle]} pointerEvents="none" />

        <View style={styles.header}>
          <View
            style={[
              styles.cardPositionBadge,
              {
                borderColor: palette.borderStrong,
                backgroundColor: palette.card,
              },
            ]}
          >
            <ThemedText style={[styles.cardPositionText, { color: palette.text }]}>
              Q{displayCardNumber}
            </ThemedText>
          </View>
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
    borderWidth: 1.5,
    shadowColor: '#2F288040',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cardPositionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  cardPositionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
