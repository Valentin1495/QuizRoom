import KnowledgeCategorySelector from '@/components/knowledge-category-selector';
import { Colors } from '@/constants/Colors';
import { QuizType } from '@/context/quiz-setup-context';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CategoryScreen() {
  const { quizType } = useLocalSearchParams();
  const knowledgeCategoryOptions = useQuery(
    api.categories.getKnowledgeCategories,
    {
      quizType: quizType as QuizType,
    }
  );

  return (
    <SafeAreaView style={styles.container}>
      {quizType === 'knowledge' && knowledgeCategoryOptions && (
        <KnowledgeCategorySelector
          knowledgeCategoryOptions={knowledgeCategoryOptions}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
