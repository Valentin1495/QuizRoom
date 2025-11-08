import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { categories, type CategoryMeta } from '@/constants/categories';
import { Radius, Spacing } from '@/constants/theme';
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
  const iconColor = useThemeColor({}, 'text');

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: cardColor, borderColor },
      ]}
    >
      <View style={styles.cardHeader}>
        <IconSymbol name={item.icon} size={28} color={iconColor} />
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
    </Pressable>
  );
}

function CategoryPickerComponent({ onSelect }: CategoryPickerProps) {
  return (
    <FlatList
      data={categories}
      keyExtractor={(item) => item.slug}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ThemedText type="title">스와이프</ThemedText>
          </View>
          <ThemedText style={styles.subtitle}>
            즐기고 싶은 메인 카테고리를 선택해주세요
          </ThemedText>
        </View>
      }
      renderItem={({ item }) => (
        <CategoryItem item={item} onPress={() => onSelect(item)} />
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

export const CategoryPicker = memo(CategoryPickerComponent);
CategoryPicker.displayName = 'CategoryPicker';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    marginVertical: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
});
