import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, Typography, Radius } from '../../theme/tokens';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Particles } from '@/components/Particles';
import { useMemo } from 'react';

type Outcome = 'success' | 'fail' | 'doubledown_success' | 'doubledown_fail';

type OutcomeConfig = {
  title: string;
  subtitle: string;
  showParticles: boolean;
  showLeaderboardButton: boolean;
  showRetryButton: boolean;
};

const OUTCOME_CONFIG: Record<Outcome, OutcomeConfig> = {
  success: {
    title: '미션 클리어!',
    subtitle: '모든 단계를 통과했습니다!',
    showParticles: true,
    showLeaderboardButton: true,
    showRetryButton: false,
  },
  fail: {
    title: '아쉽네요!',
    subtitle: '여기까지 도전했습니다.',
    showParticles: false,
    showLeaderboardButton: false,
    showRetryButton: true,
  },
  doubledown_success: {
    title: '더블다운 성공!',
    subtitle: '점수가 2배로 상승했습니다!',
    showParticles: true,
    showLeaderboardButton: true,
    showRetryButton: false,
  },
  doubledown_fail: {
    title: '더블다운 실패!',
    subtitle: '점수가 절반으로 감소했습니다.',
    showParticles: false,
    showLeaderboardButton: false,
    showRetryButton: true,
  },
};

export default function ResultScreen() {
  const { sessionId, outcome } = useLocalSearchParams<{ sessionId: string; outcome: Outcome }>();
  const router = useRouter();

  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip'
  );

  const { totalStages, failedStageName } = useMemo(() => {
    if (!session?.difficultyCurve) {
      return { totalStages: 0, failedStageName: '' };
    }
    const stageNames: Record<string, string> = {
      kinder: '유치원',
      elem_low: '초등 저학년',
      elem_high: '초등 고학년',
      middle: '중학교',
      high: '고등학교',
      college: '대학교',
      double_down: '더블다운',
    };
    const uniqueStages = [...new Set(session.difficultyCurve)];
    const total = uniqueStages.length;

    const lastAnsweredIndex = session.answers.length - 1;
    const failedGradeBand = session.difficultyCurve[lastAnsweredIndex];

    return { totalStages: total, failedStageName: stageNames[failedGradeBand] ?? '' };
  }, [session]);

  const handlePressHome = () => {
    router.replace('/(tabs)/home');
  };

  const handlePressLeaderboard = () => {
    router.replace('/(tabs)/leaderboard');
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const resolvedOutcome: Outcome = OUTCOME_CONFIG[outcome as Outcome] ? outcome as Outcome : 'success';
  const config = OUTCOME_CONFIG[resolvedOutcome];

  const correctCount = session.answers.filter((a) => a.correct).length;

  return (
    <SafeAreaView style={styles.container}>
      {config.showParticles && <Particles count={100} />}
      <View style={styles.content}>
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>
        {resolvedOutcome === 'fail' && failedStageName && (
          <Text style={styles.infoText}>{failedStageName} 단계에서 실패했습니다.</Text>
        )}
        {resolvedOutcome !== 'doubledown_fail' && (
          <Text style={styles.infoText}>총 {correctCount}개의 문제를 맞혔습니다.</Text>
        )}
        <Text style={styles.scoreLabel}>최종 점수</Text>
        <Text style={styles.scoreValue}>{session.score}</Text>
      </View>
      <View style={styles.footer}>
        {config.showLeaderboardButton && (
          <Pressable style={styles.button} onPress={handlePressLeaderboard}>
            <Text style={styles.buttonText}>랭킹 보기</Text>
          </Pressable>
        )}
        <Pressable
          style={config.showLeaderboardButton ? [styles.button, styles.secondaryButton] : styles.button}
          onPress={handlePressHome}
        >
          <Text
            style={config.showLeaderboardButton ? [styles.buttonText, styles.secondaryButtonText] : styles.buttonText}
          >
            {config.showRetryButton ? '다시 도전하기' : '홈으로'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.h2,
    fontSize: 20,
    color: Colors.subtext,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  infoText: {
    ...Typography.body,
    color: Colors.text,
    fontSize: 18,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  scoreLabel: {
    ...Typography.body,
    color: Colors.subtext,
    fontSize: 20,
  },
  scoreValue: {
    ...Typography.h1,
    color: Colors.accent,
    fontSize: 80,
    fontWeight: 'bold',
    marginBottom: Spacing.xl,
  },
  footer: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonText: {
    ...Typography.button,
    color: Colors.text,
  },
  secondaryButtonText: {
    color: Colors.primary,
  },
});