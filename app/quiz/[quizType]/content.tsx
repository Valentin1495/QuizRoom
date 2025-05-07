import QuizContentScreen from '@/components/quiz-content';
import { useQuizSetup } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from 'react-native/Libraries/NewAppScreen';

export default function ContentScreen() {
  const { setup } = useQuizSetup();
  const quizzes = useQuery(api.quizzes.getQuizzesByQuizType, {
    quizType: setup.quizType,
    type: setup.type!,
    difficulty: setup.difficulty!,
  });

  if (!quizzes) return null;

  return (
    <SafeAreaView style={styles.container}>
      <QuizContentScreen questions={quizzes} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
