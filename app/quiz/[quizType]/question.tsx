import Questions from '@/components/questions';
import { useQuizSetup } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from 'react-native/Libraries/NewAppScreen';

export default function QuestionScreen() {
  const { setup } = useQuizSetup();
  const questions = useQuery(api.quizzes.getQuestionsByQuizType, {
    category: setup.category!,
    quizType: setup.quizType,
    questionFormat: setup.type!,
    difficulty: setup.difficulty!,
  });

  if (questions === undefined || questions.length === 0)
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size='large' />
      </SafeAreaView>
    );

  return <Questions questions={questions} questionFormat={setup.type} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
