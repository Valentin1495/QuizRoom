import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../theme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { api } from '../convex/_generated/api';

const CATEGORIES = [
  { id: 'general', name: '🧠 일반상식', color: '#FF9AE8' },
  { id: 'korean', name: '📚 국어', color: '#FFD1A3' },
  { id: 'math', name: '🔢 수학', color: '#9C7FFF' },
  { id: 'science', name: '🔬 과학', color: '#5CC8FF' },
];

export default function CategoryScreen() {
  const router = useRouter();
  const startSession = useAction(api.sessions.startSession);
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);

  const handleCategorySelect = async (categoryId: string) => {
    setLoadingCategory(categoryId);
    try {
      const { sessionId } = await startSession({ category: categoryId });
      router.push(`/quiz/${sessionId}`);
    } catch (error) {
      console.error('Failed to start session:', error);
      // TODO: Show an error message to the user
    } finally {
      setLoadingCategory(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>카테고리 선택</Text>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.categoryButton, { backgroundColor: item.color }]}
            onPress={() => handleCategorySelect(item.id)}
            disabled={!!loadingCategory}
          >
            {loadingCategory === item.id ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.categoryText}>{item.name}</Text>
            )}
          </Pressable>
        )}
        contentContainerStyle={styles.listContainer}
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
});
