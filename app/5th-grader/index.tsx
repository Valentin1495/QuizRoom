import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeStack, type SwipeChallengeSummary } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FIFTH_GRADER_CHALLENGE } from '@/constants/challenges';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const GRADE_STEPS = [1, 2, 3, 4, 5, 6];
const QUESTIONS_PER_GRADE: Record<number, number> = {
  1: 2,
  2: 2,
  3: 3,
  4: 3,
  5: 4,
  6: 4,
};
const SUBJECT_OPTIONS = [
  { key: 'korean', label: '국어' },
  { key: 'math', label: '수학' },
  { key: 'science', label: '과학' },
  { key: 'social', label: '사회' },
  { key: 'english', label: '영어' },
  { key: 'life', label: '생활' },
];

export default function FifthGraderChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [gradeIndex, setGradeIndex] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [shieldUsed, setShieldUsed] = useState(false);

  const currentGrade = GRADE_STEPS[Math.min(gradeIndex, GRADE_STEPS.length - 1)];
  const isFinalGrade = gradeIndex >= GRADE_STEPS.length - 1;
  const totalQuestions = QUESTIONS_PER_GRADE[currentGrade] ?? FIFTH_GRADER_CHALLENGE.totalQuestions;
  const isBossGrade = currentGrade === 6;
  const allowedMisses = !isBossGrade && !shieldUsed ? 1 : 0;
  const selectedSubjectLabel =
    SUBJECT_OPTIONS.find((subject) => subject.key === selectedSubject)?.label ?? '대표 주제 선택';
  const stageSubtitle = selectedSubject
    ? `${selectedSubjectLabel} · ${currentGrade}학년`
    : '대표 주제를 고르면 1~6학년까지 이어집니다';

  const handleAdvance = useCallback(() => {
    if (isFinalGrade) {
      router.back();
      return;
    }
    setGradeIndex((prev) => Math.min(prev + 1, GRADE_STEPS.length - 1));
    setIsRunning(true);
  }, [isFinalGrade, router]);

  const handleStart = useCallback(() => {
    if (!selectedSubject) return;
    setIsRunning(true);
  }, [selectedSubject]);

  const handleChallengeComplete = useCallback(
    (summary: SwipeChallengeSummary) => {
      if (currentGrade >= 6) return;
      if (!shieldUsed && summary.missCount > 0) {
        setShieldUsed(true);
      }
    },
    [currentGrade, shieldUsed]
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Button
          variant="ghost"
          size="sm"
          rounded="full"
          onPress={() => router.back()}
          leftIcon={<IconSymbol name="arrow.left" size={16} color={palette.text} />}
          textStyle={styles.backLabel}
        >
          뒤로
        </Button>
        <View style={styles.headerText}>
          <ThemedText type="title">{FIFTH_GRADER_CHALLENGE.title}</ThemedText>
          <ThemedText style={[styles.headerTagline, { color: palette.textMuted }]}>
            {stageSubtitle}
          </ThemedText>
        </View>
        <View style={[styles.headerBadge, { borderColor: palette.borderStrong, backgroundColor: palette.card }]}>
          <ThemedText style={styles.headerBadgeLabel}>시즌 챌린지</ThemedText>
        </View>
      </View>
      <View style={styles.stackContainer}>
        {isRunning ? (
          <SwipeStack
            category={FIFTH_GRADER_CHALLENGE.category}
            tags={FIFTH_GRADER_CHALLENGE.tags}
            deckSlug={FIFTH_GRADER_CHALLENGE.deckSlug}
            grade={currentGrade}
            subject={selectedSubject ?? undefined}
            challenge={{
              totalQuestions,
              allowedMisses,
              scorePerCorrect: FIFTH_GRADER_CHALLENGE.scorePerCorrect,
            }}
            onExit={() => router.back()}
            onChallengeAdvance={handleAdvance}
            challengeAdvanceLabel={isFinalGrade ? '완주! 홈으로' : '다음 학년'}
            onChallengeComplete={handleChallengeComplete}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.selectionContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stageHeader}>
              <ThemedText type="title">대표 주제 선택</ThemedText>
              <ThemedText style={[styles.stageSubtitle, { color: palette.textMuted }]}>
                선택한 주제로 1학년부터 6학년까지 쭉 진행합니다
              </ThemedText>
            </View>
            <View style={styles.gradeStepper}>
              {GRADE_STEPS.map((grade, index) => {
                const isActive = index === 0;
                return (
                  <View
                    key={`grade-${grade}`}
                    style={[
                      styles.gradeStep,
                      {
                        backgroundColor: isActive ? palette.text : palette.cardElevated,
                        borderColor: isActive ? palette.text : palette.borderStrong,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.gradeStepLabel,
                        { color: isActive ? palette.background : palette.text },
                      ]}
                    >
                      {grade}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
            <View style={styles.subjectGrid}>
              {SUBJECT_OPTIONS.map((subject) => {
                const isSelected = subject.key === selectedSubject;
                return (
                  <Pressable
                    key={subject.key}
                    onPress={() => setSelectedSubject(subject.key)}
                    style={({ pressed }) => [
                      styles.subjectTile,
                      {
                        borderColor: isSelected ? palette.text : palette.borderStrong,
                        backgroundColor: isSelected ? palette.cardElevated : palette.card,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.subjectLabel,
                        { color: isSelected ? palette.text : palette.textMuted },
                      ]}
                    >
                      {subject.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <Button
              size="lg"
              fullWidth
              onPress={handleStart}
              disabled={!selectedSubject}
              style={styles.startButton}
            >
              {selectedSubject ? '1학년 시작하기' : '대표 주제를 선택하세요'}
            </Button>
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    gap: 2,
  },
  headerTagline: {
    fontSize: 14,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  stackContainer: {
    flex: 1,
  },
  selectionContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  stageHeader: {
    gap: Spacing.xs,
  },
  stageSubtitle: {
    fontSize: 14,
  },
  gradeStepper: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  gradeStep: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeStepLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  subjectTile: {
    flexBasis: '48%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  startButton: {
    marginTop: Spacing.sm,
  },
});
