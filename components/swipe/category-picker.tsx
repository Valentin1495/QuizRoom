import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { categories, type CategoryMeta } from '@/constants/categories';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type CategoryPickerProps = {
  onSelect: (category: CategoryMeta) => void;
};

function CategoryItem({
  item,
  onPress,
}: {
  item: CategoryMeta;
  onPress: () => void;
}) {
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'textMuted');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: cardColor, borderColor },
      ]}
    >
      <View style={styles.cardHeader}>
        <ThemedText style={styles.emoji}>{item.emoji}</ThemedText>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          {item.title}
        </ThemedText>
      </View>
      <ThemedText
        style={[styles.cardDescription, { color: muted }]}
        numberOfLines={2}
      >
        {item.description}
      </ThemedText>
      <View style={styles.tagRow}>
        {item.sampleTags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tagChip}>
            <ThemedText style={styles.tagText} lightColor="#fff" darkColor="#fff">
              #{tag}
            </ThemedText>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function CategoryPickerComponent({ onSelect }: CategoryPickerProps) {
  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item.slug}
      contentContainerStyle={styles.container}
      numColumns={2}
      ListHeaderComponent={
        <View style={styles.header}>
          <ThemedText type="title">스와이프 스택</ThemedText>
          <ThemedText style={styles.subtitle}>
            즐기고 싶은 메인 카테고리를 선택해주세요.
          </ThemedText>
        </View>
      }
      columnWrapperStyle={styles.column}
      renderItem={({ item }) => (
        <CategoryItem item={item} onPress={() => onSelect(item)} />
      )}
    />
  );
}

export const CategoryPicker = memo(CategoryPickerComponent);
CategoryPicker.displayName = 'CategoryPicker';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  column: {
    gap: Spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    justifyContent: 'space-between',
    minHeight: 156,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 24,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  tagChip: {
    backgroundColor: Palette.gray600,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
