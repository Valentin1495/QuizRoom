import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect, useState, useMemo, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/tokens';
import QuestionCard from '@/components/QuestionCard';
import RadialTimer from '@/components/RadialTimer';
import type { Id, Doc } from '@/convex/_generated/dataModel';
import type { Question } from '@/types/question';
import { Feather } from '@expo/vector-icons';
import StageClearModal from '@/components/StageClearModal';
import DoubleDownModal from '@/components/DoubleDownModal';
import { BoostsContainer } from '@/components/Boosts';

const QUESTION_TIME_MS = 20000;

export default function QuizScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const timeLeftRef = useRef(QUESTION_TIME_MS);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [isStageClearModalVisible, setIsStageClearModalVisible] = useState(false);
  const [isDoubleDownModalVisible, setIsDoubleDownModalVisible] = useState(false);
  const [doubleDownQuestion, setDoubleDownQuestion] = useState<Doc<'questions'> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const hasSubmittedRef = useRef(false);

  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip'
  );
  const submitAnswer = useMutation(api.sessions.submitAnswer);
  const requestDoubleDown = useAction(api.sessions.requestDoubleDownQuestion);
  const submitDoubleDown = useAction(api.sessions.submitDoubleDownAnswer);
  const useBoost = useAction(api.boosts.useBoost);

  const inventory = useQuery(api.inventories.getInventory);

  const [removedChoices, setRemovedChoices] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);


  const currentQuestion = session?.questions[currentQuestionIndex];
  const activeQuestion = doubleDownQuestion || currentQuestion;

  const { totalStages, currentStage, currentStageName } = useMemo(() => {
    if (!session?.difficultyCurve) {
      return { totalStages: 0, currentStage: 0, currentStageName: '' };
    }
    const uniqueStages = [...new Set(session.difficultyCurve)];
    const total = uniqueStages.length;
    const currentGradeBand = session.difficultyCurve[currentQuestionIndex];
    const current = uniqueStages.indexOf(currentGradeBand) + 1;

    const stageNames: Record<string, string> = {
      kinder: '유치원',
      elem_low: '초등 저학년',
      elem_high: '초등 고학년',
      middle: '중학교',
      high: '고등학교',
      college: '대학교',
    };

    return { totalStages: total, currentStage: current, currentStageName: stageNames[currentGradeBand] };
  }, [session?.difficultyCurve, currentQuestionIndex]);

  useEffect(() => {
    if (hasSubmittedRef.current || selectedChoice !== null || isCorrect === false || session?.status === 'ended') {
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev <= 100 ? 0 : prev - 100;
        timeLeftRef.current = next;
        if (next === 0) {
          clearInterval(timerId);
          handleSelectAnswer(null);
        }
        return next;
      });
    }, 100);

    return () => clearInterval(timerId);
  }, [currentQuestionIndex, selectedChoice, isCorrect, session?.status]);

  const handleSelectAnswer = async (choiceIndex: number | null) => {
    if (hasSubmittedRef.current || !activeQuestion) return;

    hasSubmittedRef.current = true;
    const resolvedChoice = choiceIndex ?? -1;
    setSelectedChoice(resolvedChoice);
    setTimeLeft(0);

    if (resolvedChoice === -1) {
      setIsCorrect(false);
    }

    try {
      if (doubleDownQuestion) {
        // Handle Double Down Submission
        setIsLoading(true);
        const result = await submitDoubleDown({
          sessionId: sessionId! as Id<'sessions'>,
          choiceIndex: resolvedChoice,
          ms: QUESTION_TIME_MS - timeLeftRef.current,
        });
        setIsCorrect(result.correct);
        // Navigate to results immediately after double down
        router.replace(
          `/result/${sessionId}?outcome=${result.correct ? 'doubledown_success' : 'doubledown_fail'}`
        );
      } else {
        // Handle Regular Submission
        const result = await submitAnswer({
          sessionId: sessionId! as Id<'sessions'>,
          qid: activeQuestion._id,
          choiceIndex: resolvedChoice,
          ms: QUESTION_TIME_MS - timeLeftRef.current,
        });

        if (resolvedChoice !== -1) {
          setIsCorrect(result.correct);
        }
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      router.replace(`/result/${sessionId}?outcome=fail`);
    }
  };

  const handleContinue = () => {
    // Check if it's the last question of the regular quiz
    const isLastRegularQuestion = currentQuestionIndex === (session?.questions.length ?? 0) - 1;

    if (isCorrect) {
      if (isLastRegularQuestion) {
        setIsDoubleDownModalVisible(true);
        return;
      }

      const currentGradeBand: string | undefined = session?.difficultyCurve[currentQuestionIndex];
      const nextGradeBand: string | undefined = session?.difficultyCurve[currentQuestionIndex + 1];

      if (currentGradeBand !== nextGradeBand && nextGradeBand !== undefined) {
        setIsStageClearModalVisible(true);
      } else {
        handleNextQuestion();
      }
    } else {
      router.replace(`/result/${sessionId}?outcome=fail`);
    }
  };

  const handleNextQuestion = () => {
    if (session && currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setIsCorrect(null);
      setTimeLeft(QUESTION_TIME_MS);
      timeLeftRef.current = QUESTION_TIME_MS;
      hasSubmittedRef.current = false;
      setIsStageClearModalVisible(false); // Close modal when moving to next question
    } else {
      // This case should now be handled by handleContinue showing the double down modal
      setIsDoubleDownModalVisible(true);
    }
  };

  const handleDeclineDoubleDown = () => {
    setIsDoubleDownModalVisible(false);
    router.replace(`/result/${sessionId}?outcome=success`);
  };

  const handleConfirmDoubleDown = async () => {
    setIsDoubleDownModalVisible(false);
    setIsLoading(true);
    try {
      const question: Doc<'questions'> | null = await requestDoubleDown({ sessionId: sessionId! as Id<'sessions'> });
      setDoubleDownQuestion(question);
      // Reset quiz state for the new question
      setSelectedChoice(null);
      setIsCorrect(null);
      setTimeLeft(QUESTION_TIME_MS);
      timeLeftRef.current = QUESTION_TIME_MS;
      hasSubmittedRef.current = false;
    } catch (error) {
      console.error('Failed to get double down question', error);
      // Fallback to regular success if DD question fails
      router.replace(`/result/${sessionId}?outcome=success`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseBoost = async (boostType: 'fifty' | 'hint' | 'skip') => {
    if (!activeQuestion || !sessionId || hasSubmittedRef.current) return;

    try {
      const result = await useBoost({
        sessionId: sessionId as Id<'sessions'>,
        questionId: activeQuestion._id,
        boostType,
      });

      if (result.success) {
        if (boostType === 'fifty' && 'toRemove' in result) {
          setRemovedChoices(result.toRemove);
        }
        if (boostType === 'hint' && 'hint' in result) {
          setHint(result.hint);
          // Simple alert for now, can be a modal later
          Alert.alert(`힌트: ${result.hint}`);
        }
        if (boostType === 'skip' && 'skipped' in result) {
          // Move to the next question automatically
          handleNextQuestion();
        }
      }
    } catch (error) {
      console.error(`Failed to use ${boostType} boost:`, error);
      Alert.alert('부스트 사용에 실패했습니다.');
    }
  };


  let correctIndexToShow: number | null = null;
  if (isCorrect) {
    correctIndexToShow = selectedChoice;
  } else if (isCorrect === false && activeQuestion) {
    correctIndexToShow = activeQuestion.answerIndex;
  }

  if (!session || !activeQuestion || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{isLoading ? '더블다운 문제 준비 중...' : '퀴즈 로딩 중...'}</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#1D1D27', Colors.background]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.progressText}>
              점수: {session?.score ?? 0}
            </Text>
            <Text style={styles.stageText}>
              {doubleDownQuestion ? '더블다운!' : `${currentStageName} 단계`}
            </Text>
          </View>
          <View style={styles.timerContainer}>
            <RadialTimer msTotal={QUESTION_TIME_MS} msLeft={timeLeft} />
            <Text style={styles.timerText}>
              {Math.ceil(timeLeft / 1000)}
            </Text>
          </View>
        </View>

        <QuestionCard
          question={{
            ...activeQuestion,
            id: activeQuestion._id,
            gradeBand: activeQuestion.gradeBand as Question['gradeBand'],
            difficulty: activeQuestion.difficulty as Question['difficulty'],
          }}
          onSelect={handleSelectAnswer}
          onContinue={handleContinue}
          selectedIndex={selectedChoice}
          isCorrect={isCorrect}
          removedChoices={removedChoices}
        />

        <BoostsContainer
          boosts={inventory?.boosts ?? { fifty: 0, hint: 0, skip: 0 }}
          onUseBoost={handleUseBoost}
          disabled={selectedChoice !== null}
        />
      </SafeAreaView>
      <StageClearModal
        visible={isStageClearModalVisible}
        stageName={currentStageName}
        currentScore={session?.score ?? 0}
        onNextStage={handleNextQuestion}
      />
      <DoubleDownModal
        visible={isDoubleDownModalVisible}
        currentScore={session?.score ?? 0}
        onConfirm={handleConfirmDoubleDown}
        onDecline={handleDeclineDoubleDown}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text,
    marginTop: 10,
    fontSize: 16,
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  stageText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  timerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerText: {
    position: 'absolute',
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
});
