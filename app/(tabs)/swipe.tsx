import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/swipe/category-picker';
import { SwipeStack } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { CategoryMeta } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function SwipeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');

  const handleReset = useCallback(() => {
    if (!selectedCategory) {
      return;
    }
    Alert.alert(
      '카테고리를 변경하시겠어요?',
      `${selectedCategory.title} 카테고리에서 진행 중인 점수와 스트릭이 초기화돼요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '변경',
          style: 'destructive',
          onPress: () => setSelectedCategory(null),
        },
      ]
    );
  }, [selectedCategory]);

  const topStyle = { paddingTop: insets.top + Spacing.lg };

  if (!selectedCategory) {
    return (
      <ThemedView style={[styles.container, topStyle]}>
        <CategoryPicker onSelect={setSelectedCategory} />
      </ThemedView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <ThemedView style={[styles.container, topStyle]}>
        <View style={styles.selectedHeader}>
          <View style={styles.headerText}>
            <ThemedText type="title">스와이프 퀴즈</ThemedText>
            <View style={styles.subtitleRow}>
              <IconSymbol name={selectedCategory.icon} size={18} color={iconColor} />
              <ThemedText style={styles.subtitle}>{selectedCategory.title}</ThemedText>
            </View>
          </View>
          <Button
            variant="secondary"
            size="sm"
            rounded="full"
            onPress={handleReset}
            textStyle={styles.resetLabel}
          >
            카테고리 변경
          </Button>
        </View>
        <SwipeStack
          category={selectedCategory.slug}
          tags={selectedCategory.sampleTags}
          setSelectedCategory={setSelectedCategory}
        />
      </ThemedView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: Spacing.xl,
  },
  selectedHeader: {
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
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  resetLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
