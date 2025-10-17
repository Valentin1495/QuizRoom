import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryPicker } from '@/components/swipe/category-picker';
import { SwipeStack } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { CategoryMeta } from '@/constants/categories';
import { Palette, Radius, Spacing } from '@/constants/theme';

export default function SwipeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);

  const handleReset = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  if (!selectedCategory) {
    return (
      <ThemedView style={styles.container}>
        <CategoryPicker onSelect={setSelectedCategory} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.selectedHeader}>
        <View style={styles.headerText}>
          <ThemedText type="title">스와이프</ThemedText>
          <ThemedText style={styles.subtitle}>
            {selectedCategory.emoji} {selectedCategory.title} 카테고리에서 시작합니다.
          </ThemedText>
        </View>
        <Pressable style={styles.resetButton} onPress={handleReset}>
          <ThemedText style={styles.resetLabel} lightColor="#fff" darkColor="#fff">
            카테고리 변경
          </ThemedText>
        </Pressable>
      </View>
      <SwipeStack
        category={selectedCategory.slug}
        tags={selectedCategory.sampleTags}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  selectedHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: Palette.purple600,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  resetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
