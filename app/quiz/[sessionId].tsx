import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/theme/tokens';
import QuestionCard from '@/components/QuestionCard';
import RadialTimer from '@/components/RadialTimer';
import type { Id } from '@/convex/_generated/dataModel';
import type { Question } from '@/types/question';

const QUESTION_TIME_MS = 20000;

export default function QuizScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId: sessionId as Id<'sessions'> } : 'skip'
  );
  const submitAnswer = useMutation(api.sessions.submitAnswer);

  const currentQuestion = session?.questions[currentQuestionIndex];

  useEffect(() => {
    if (selectedChoice !== null) return; // Stop timer when an answer is selected

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 100) {
          // Auto-submit as incorrect when time is up
          handleSelectAnswer(null);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, selectedChoice]);

  const handleSelectAnswer = async (choiceIndex: number | null) => {
    if (selectedChoice !== null || !currentQuestion) return;

    setSelectedChoice(choiceIndex);

    const result = await submitAnswer({
      sessionId: sessionId! as Id<'sessions'>,
      qid: currentQuestion._id,
      choiceIndex: choiceIndex ?? -1, // Use -1 for timeout
      ms: QUESTION_TIME_MS - timeLeft,
    });

    setIsCorrect(result.correct);

    setTimeout(() => {
      handleNextQuestion();
    }, 1500); // Wait a bit to show feedback
  };

  const handleNextQuestion = () => {
    if (session && currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedChoice(null);
      setIsCorrect(null);
      setTimeLeft(QUESTION_TIME_MS);
    } else {
      router.replace(`/result/${sessionId}`);
    }
  };

  let correctIndexToShow: number | null = null;
  if (isCorrect) {
    correctIndexToShow = selectedChoice;
  } else if (isCorrect === false && currentQuestion) {
    correctIndexToShow = currentQuestion.answerIndex;
  }

  if (!session || !currentQuestion) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Quiz...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#1D1D27', Colors.background]} style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.progressText}>
            {currentQuestionIndex + 1} / {session.questions.length}
          </Text>
          <RadialTimer msTotal={QUESTION_TIME_MS} msLeft={timeLeft} />
        </View>

        <QuestionCard
          question={{
            ...currentQuestion,
            id: currentQuestion._id,
            gradeBand: currentQuestion.gradeBand as Question['gradeBand'],
            difficulty: currentQuestion.difficulty as Question['difficulty'],
          }}
          onSelect={handleSelectAnswer}
          selectedIndex={selectedChoice}
          correctIndex={correctIndexToShow}
        />
      </SafeAreaView>
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
});
