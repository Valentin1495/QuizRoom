import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../theme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { api } from '../convex/_generated/api';
import GameRulesModal from '@/components/GameRulesModal';

const CATEGORIES = [
  { id: 'general', name: '🧠 일반상식', color: '#FF9AE8' },
  { id: 'korean', name: '📚 국어', color: '#FFD1A3' },
  { id: 'math', name: '🔢 수학', color: '#9C7FFF' },
  { id: 'science', name: '🔬 과학', color: '#5CC8FF' },
];

export default function CategoryScreen() {
  const router = useRouter();
  const startSession = useAction(api.sessions.startSession);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setIsModalVisible(true);
  };

  const handleStartQuiz = async () => {
    if (!selectedCategory) return;

    setIsModalVisible(false);
    setIsLoading(true);
    try {
      const { sessionId } = await startSession({ category: selectedCategory });
      router.push(`/quiz/${sessionId}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      // TODO: Show an error message to the user
    } finally {
      setIsLoading(false);
      setSelectedCategory(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>세션 준비 중...</Text>
        </View>
      )}
      <Text style={styles.title}>카테고리 선택</Text>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.categoryButton, { backgroundColor: item.color }]}
            onPress={() => handleCategoryPress(item.id)}
            disabled={isLoading}
          >
            <Text style={styles.categoryText}>{item.name}</Text>
          </Pressable>
        )}
        contentContainerStyle={styles.listContainer}
      />
      <GameRulesModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onStart={handleStartQuiz}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  listContainer: {
    gap: Spacing.md,
  },
  categoryButton: {
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80, // 버튼 높이 고정
  },
  categoryText: {
    ...Typography.button,
    color: Colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.text,
    marginTop: Spacing.md,
  },
});
