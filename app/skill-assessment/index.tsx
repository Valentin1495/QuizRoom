import { usePreventRemove } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeStack, type SwipeChallengeSummary } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SKILL_ASSESSMENT_CHALLENGE } from '@/constants/challenges';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SUBJECT_OPTIONS = [
  { key: 'korean', label: '국어' },
  { key: 'english', label: '영어' },
  { key: 'science', label: '과학' },
  { key: 'social', label: '사회' },
  { key: 'logic', label: '논리' },
];

const EDU_LEVEL_STEPS = [
  { key: 'elem_low', label: '초등 저학년', shortLabel: '초저' },
  { key: 'elem_high', label: '초등 고학년', shortLabel: '초고' },
  { key: 'middle', label: '중등', shortLabel: '중' },
  { key: 'high', label: '고등', shortLabel: '고' },
  { key: 'college_basic', label: '대학(교양)', shortLabel: '대' },
  { key: 'college_plus', label: '대학+', shortLabel: '대+' },
] as const;

const QUESTIONS_PER_LEVEL: Record<(typeof EDU_LEVEL_STEPS)[number]['key'], number> = {
  elem_low: 2,
  elem_high: 2,
  middle: 3,
  high: 3,
  college_basic: 3,
  college_plus: 3,
};

const ALLOWED_MISSES_PER_LEVEL: Record<(typeof EDU_LEVEL_STEPS)[number]['key'], number> = {
  elem_low: 1,
  elem_high: 1,
  middle: 1,
  high: 1,
  college_basic: 0,
  college_plus: 0,
};

export default function SkillAssessmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const [levelIndex, setLevelIndex] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cumulativeAnswered, setCumulativeAnswered] = useState(0);
  const [cumulativeCorrect, setCumulativeCorrect] = useState(0);
  const [completionTotals, setCompletionTotals] = useState<{ answered: number; correct: number } | null>(null);
  const [stageBaseAnswered, setStageBaseAnswered] = useState(0);
  const [stageBaseCorrect, setStageBaseCorrect] = useState(0);
  const lastLevelIndexRef = useRef<number | null>(null);
  const lastCompletionSigRef = useRef<string | null>(null);
  const lastCompletionSessionIdRef = useRef<string | null>(null);
  const cumulativeAnsweredRef = useRef(0);
  const cumulativeCorrectRef = useRef(0);
  const stageBaseAnsweredRef = useRef(0);
  const stageBaseCorrectRef = useRef(0);
  const completionTotalsRef = useRef<{ answered: number; correct: number } | null>(null);
  const [excludedQuestionIds, setExcludedQuestionIds] = useState<string[]>([]);
  const [isBlockedBackDialogVisible, setIsBlockedBackDialogVisible] = useState(false);
  const [isExitConfirmDialogVisible, setIsExitConfirmDialogVisible] = useState(false);

  const currentLevel = EDU_LEVEL_STEPS[Math.min(levelIndex, EDU_LEVEL_STEPS.length - 1)];
  const isFinalLevel = levelIndex >= EDU_LEVEL_STEPS.length - 1;
  const previousLevel =
    EDU_LEVEL_STEPS[Math.max(0, Math.min(levelIndex - 1, EDU_LEVEL_STEPS.length - 1))];
  const totalQuestions = QUESTIONS_PER_LEVEL[currentLevel.key] ?? SKILL_ASSESSMENT_CHALLENGE.totalQuestions;
  const allowedMisses = ALLOWED_MISSES_PER_LEVEL[currentLevel.key] ?? 1;
  const levelProgressRatio = levelIndex / Math.max(1, EDU_LEVEL_STEPS.length - 1);
  const lifelinesDisabled =
    currentLevel.key === 'college_basic' || currentLevel.key === 'college_plus';

  const selectedSubjectLabel =
    SUBJECT_OPTIONS.find((subject) => subject.key === selectedSubject)?.label ?? '과목 선택';
  const stageSubtitle = selectedSubject
    ? `${selectedSubjectLabel} · ${currentLevel.label}`
    : '과목을 고르면 단계별로 난이도가 올라갑니다';

  const isElemLevel = currentLevel.key === 'elem_low' || currentLevel.key === 'elem_high';

  const handleStart = useCallback(() => {
    if (!selectedSubject) return;
    setCumulativeAnswered(0);
    setCumulativeCorrect(0);
    setCompletionTotals(null);
    completionTotalsRef.current = null;
    cumulativeAnsweredRef.current = 0;
    cumulativeCorrectRef.current = 0;
    setStageBaseAnswered(0);
    setStageBaseCorrect(0);
    lastLevelIndexRef.current = null;
    lastCompletionSigRef.current = null;
    lastCompletionSessionIdRef.current = null;
    setExcludedQuestionIds([]);
    setIsRunning(true);
  }, [selectedSubject]);

  const handleAdvance = useCallback(() => {
    if (isFinalLevel) {
      setIsRunning(false);
      return;
    }
    setLevelIndex((prev) => Math.min(prev + 1, EDU_LEVEL_STEPS.length - 1));
    setIsRunning(true);
  }, [isFinalLevel, router]);

  const handleChallengeReset = useCallback(() => {
    setLevelIndex(0);
    setCumulativeAnswered(0);
    setCumulativeCorrect(0);
    setCompletionTotals(null);
    completionTotalsRef.current = null;
    cumulativeAnsweredRef.current = 0;
    cumulativeCorrectRef.current = 0;
    setStageBaseAnswered(0);
    setStageBaseCorrect(0);
    lastLevelIndexRef.current = null;
    lastCompletionSigRef.current = null;
    lastCompletionSessionIdRef.current = null;
    setExcludedQuestionIds([]);
    setIsRunning(true);
  }, []);

  const handleExitToSelection = useCallback(() => {
    setIsRunning(false);
    setLevelIndex(0);
    setCompletionTotals(null);
    completionTotalsRef.current = null;
    cumulativeAnsweredRef.current = 0;
    cumulativeCorrectRef.current = 0;
    setStageBaseAnswered(0);
    setStageBaseCorrect(0);
    lastLevelIndexRef.current = null;
    lastCompletionSigRef.current = null;
    lastCompletionSessionIdRef.current = null;
    setExcludedQuestionIds([]);
  }, []);

  const handleOpenExitConfirmDialog = useCallback(() => {
    if (!isRunning) return;
    setIsExitConfirmDialogVisible(true);
  }, [isRunning]);

  const handleCloseExitConfirmDialog = useCallback(() => {
    setIsExitConfirmDialogVisible(false);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setIsExitConfirmDialogVisible(false);
    handleExitToSelection();
  }, [handleExitToSelection]);

  useEffect(() => {
    cumulativeAnsweredRef.current = cumulativeAnswered;
  }, [cumulativeAnswered]);

  useEffect(() => {
    cumulativeCorrectRef.current = cumulativeCorrect;
  }, [cumulativeCorrect]);

  const handleChallengeComplete = useCallback((summary: SwipeChallengeSummary) => {
    if (summary.sessionId && lastCompletionSessionIdRef.current === summary.sessionId) {
      return;
    }
    if (summary.sessionId) {
      lastCompletionSessionIdRef.current = summary.sessionId;
    }
    const completionSig = `${levelIndex}:${summary.answered}:${summary.correct}:${summary.failed}`;
    if (lastCompletionSigRef.current === completionSig) {
      return;
    }
    lastCompletionSigRef.current = completionSig;
    const nextAnswered = stageBaseAnsweredRef.current + summary.answered;
    const nextCorrect = stageBaseCorrectRef.current + summary.correct;
    if (__DEV__) {
      console.log('[SkillAssessment] challenge complete', {
        levelIndex,
        summaryAnswered: summary.answered,
        summaryCorrect: summary.correct,
        baseAnswered: stageBaseAnsweredRef.current,
        baseCorrect: stageBaseCorrectRef.current,
        nextAnswered,
        nextCorrect,
      });
    }
    completionTotalsRef.current = { answered: nextAnswered, correct: nextCorrect };
    setCumulativeAnswered(nextAnswered);
    setCumulativeCorrect(nextCorrect);
    setCompletionTotals({ answered: nextAnswered, correct: nextCorrect });
    if (!summary.failed && summary.questionIds?.length) {
      setExcludedQuestionIds((prev) => {
        const merged = new Set(prev);
        summary.questionIds.forEach((id) => merged.add(id));
        return Array.from(merged);
      });
    }
  }, [levelIndex]);

  const failedLevelLabel =
    levelIndex === 0 ? '기초 다지기 필요' : previousLevel.label;

  useEffect(() => {
    if (!isRunning) return;
    if (lastLevelIndexRef.current === levelIndex) return;
    lastLevelIndexRef.current = levelIndex;
    const baseTotals = completionTotalsRef.current ?? {
      answered: cumulativeAnsweredRef.current,
      correct: cumulativeCorrectRef.current,
    };
    stageBaseAnsweredRef.current = baseTotals.answered;
    stageBaseCorrectRef.current = baseTotals.correct;
    if (__DEV__) {
      console.log('[SkillAssessment] stage base set', {
        levelIndex,
        baseAnswered: stageBaseAnsweredRef.current,
        baseCorrect: stageBaseCorrectRef.current,
      });
    }
    setStageBaseAnswered(stageBaseAnsweredRef.current);
    setStageBaseCorrect(stageBaseCorrectRef.current);
    setCompletionTotals(null);
  }, [cumulativeAnswered, cumulativeCorrect, isRunning, levelIndex]);

  usePreventRemove(isRunning, () => {
    setIsBlockedBackDialogVisible(true);
  });

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.headerTopRow}>
          <ThemedText type="title">{SKILL_ASSESSMENT_CHALLENGE.title}</ThemedText>
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              rounded="full"
              onPress={handleOpenExitConfirmDialog}
              textStyle={styles.exitButtonLabel}
            >
              종료
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              rounded="full"
              onPress={() => router.back()}
              leftIcon={<IconSymbol name="arrow.left" size={22} color={palette.text} />}
              accessibilityLabel="뒤로가기"
            />
          )}
        </View>
        <ThemedText style={[styles.headerTagline, { color: palette.textMuted }]}>
          {SKILL_ASSESSMENT_CHALLENGE.tagline}
        </ThemedText>
        <ThemedText style={[styles.headerDescription, { color: palette.textMuted }]}>
          {SKILL_ASSESSMENT_CHALLENGE.description}
        </ThemedText>
        {lifelinesDisabled ? (
          <ThemedText style={[styles.headerNotice, { color: palette.danger }]}>
            대학 단계는 치트 불가 · 오답 즉시 종료
          </ThemedText>
        ) : null}
        {isRunning ? (
          <View style={styles.levelProgress}>
            <View style={[styles.levelProgressLine, { backgroundColor: palette.borderStrong }]} />
            <View
              style={[
                styles.levelProgressLineActive,
                {
                  width: `${Math.max(0, Math.min(1, levelProgressRatio)) * 100}%`,
                  backgroundColor: palette.text,
                },
              ]}
            />
            <View style={styles.levelProgressRow}>
              {EDU_LEVEL_STEPS.map((level, index) => {
                const isCurrent = index === levelIndex;
                const isCompleted = index < levelIndex;
                const size = isCurrent ? 32 : 28;
                return (
                  <View
                    key={`level-node-${level.key}`}
                    style={[
                      styles.levelNode,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: isCurrent ? palette.text : palette.cardElevated,
                        borderColor: isCurrent ? palette.text : palette.borderStrong,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.levelNodeText,
                        { color: isCurrent ? palette.background : (isCompleted ? palette.text : palette.textMuted) },
                      ]}
                    >
                      {level.shortLabel}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.stackContainer}>
        {isRunning ? (
          <SwipeStack
            category={SKILL_ASSESSMENT_CHALLENGE.category}
            deckSlug={isElemLevel ? undefined : SKILL_ASSESSMENT_CHALLENGE.deckSlug}
            subject={selectedSubject ?? undefined}
            eduLevel={currentLevel.key}
            challengeLevelLabel={currentLevel.label}
            challengeLevelFailedLabel={failedLevelLabel}
            excludeIds={excludedQuestionIds}
            completionTotals={completionTotals}
            cumulativeAnswered={stageBaseAnswered}
            cumulativeCorrect={stageBaseCorrect}
            isFinalStage={isFinalLevel}
            challenge={{
              totalQuestions,
              allowedMisses,
              scorePerCorrect: SKILL_ASSESSMENT_CHALLENGE.scorePerCorrect,
            }}
            onExit={handleExitToSelection}
            onChallengeAdvance={isFinalLevel ? undefined : handleAdvance}
            onChallengeReset={handleChallengeReset}
            onChallengeComplete={handleChallengeComplete}
            challengeAdvanceLabel={isFinalLevel ? '과목 선택으로' : '다음 단계로'}
            challengeCompletionLabel={isFinalLevel ? '챌린지 성공!' : '단계 통과'}
            challengeProgressLabel={`${currentLevel.label} · ${levelIndex + 1}/${EDU_LEVEL_STEPS.length}`}
            challengeSubjectLabel={selectedSubjectLabel}
            lifelinesDisabled={lifelinesDisabled}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.selectionContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.selectionHero, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <View style={styles.heroTitleRow}>
                <IconSymbol
                  name="brain"
                  size={32}
                  color={palette.text}
                  style={Platform.OS === 'android' ? { transform: [{ translateY: 3 }] } : undefined}
                />
                <ThemedText type="title">측정 과목 선택</ThemedText>
              </View>
              <ThemedText style={[styles.stageSubtitle, { color: palette.textMuted }]}>
                {stageSubtitle}
              </ThemedText>
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
                      <View style={styles.subjectTileContent}>
                        <ThemedText
                          style={[
                            styles.subjectLabel,
                            { color: isSelected ? palette.text : palette.textMuted },
                          ]}
                        >
                          {subject.label}
                        </ThemedText>
                        {isSelected ? (
                          <IconSymbol name="checkmark.circle.fill" size={18} color={palette.text} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Button
              size="lg"
              fullWidth
              onPress={handleStart}
              disabled={!selectedSubject}
              style={styles.startButton}
            >
              {selectedSubject ? '측정 시작' : '과목을 선택하세요'}
            </Button>
          </ScrollView>
        )}
      </View>
      <AlertDialog
        visible={isBlockedBackDialogVisible}
        onClose={() => setIsBlockedBackDialogVisible(false)}
        title="실력 측정 진행 중"
        description={`뒤로가기는 사용할 수 없어요.\n상단의 종료 버튼을 눌러 측정을 끝내주세요.`}
        actions={[
          {
            label: '확인',
            tone: 'default',
            onPress: () => setIsBlockedBackDialogVisible(false),
          },
        ]}
      />
      <AlertDialog
        visible={isExitConfirmDialogVisible}
        onClose={handleCloseExitConfirmDialog}
        title="실력 측정을 종료할까요?"
        description="현재 단계 진행은 취소되고 과목 선택 화면으로 돌아가요."
        actions={[
          {
            label: '계속 진행',
            tone: 'outline',
            onPress: handleCloseExitConfirmDialog,
          },
          {
            label: '종료',
            tone: 'destructive',
            onPress: handleConfirmExit,
          },
        ]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exitButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerTagline: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  headerNotice: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelProgress: {
    position: 'relative',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  levelProgressLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    borderRadius: Radius.pill,
  },
  levelProgressLineActive: {
    position: 'absolute',
    left: 0,
    top: '50%',
    height: 2,
    borderRadius: Radius.pill,
  },
  levelProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelNode: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNodeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stackContainer: {
    flex: 1,
  },
  selectionContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  selectionHero: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stageSubtitle: {
    fontSize: 14,
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
  subjectTileContent: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  startButton: {
    marginTop: Spacing.sm,
  },
});
