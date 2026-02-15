import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/swipe/category-picker';
import { SwipeStack } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { CategoryMeta } from '@/constants/categories';
import { categories } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-unified-auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { saveRecentSwipeCategory } from '@/lib/recent-selections';

export default function SwipeScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [selectedCategory, setSelectedCategory] = useState<CategoryMeta | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isCompletionVisible, setIsCompletionVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const iconColor = useThemeColor({}, 'text');
  const { status, user, guestKey } = useAuth();
  const isGuest = status === 'guest' && !user;
  const recentSelectionScope = useMemo(
    () => ({
      userId: status === 'authenticated' ? user?.id : null,
      guestKey: status === 'guest' ? guestKey : null,
    }),
    [guestKey, status, user?.id]
  );

  useEffect(() => {
    if (selectedCategory) return;
    const slug = typeof params.category === 'string' ? params.category : undefined;
    if (!slug) return;
    const found = categories.find((category) => category.slug === slug);
    if (!found) return;
    setSelectedCategory(found);
    void saveRecentSwipeCategory(found, recentSelectionScope);
  }, [params.category, recentSelectionScope, selectedCategory]);

  const handleSelectCategory = useCallback((category: CategoryMeta) => {
    setSelectedCategory(category);
    setIsCompletionVisible(false);
    void saveRecentSwipeCategory(category, recentSelectionScope);
  }, [recentSelectionScope]);

  const handleReset = useCallback(() => {
    if (!selectedCategory) {
      return;
    }
    if (isGuest || isCompletionVisible) {
      setShowResetDialog(false);
      setSelectedCategory(null);
      return;
    }
    setShowResetDialog(true);
  }, [isCompletionVisible, isGuest, selectedCategory]);

  const handleConfirmReset = useCallback(() => {
    setShowResetDialog(false);
    setSelectedCategory(null);
  }, []);

  const topStyle = { paddingTop: insets.top + Spacing.lg };

  if (!selectedCategory) {
    return (
      <ThemedView style={[styles.container, topStyle]}>
        <CategoryPicker onSelect={handleSelectCategory} />
      </ThemedView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <ThemedView style={[styles.container, topStyle]}>
        <View style={styles.selectedHeader}>
          <View style={styles.headerText}>
            <ThemedText type="title">스와이프</ThemedText>
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
            leftIcon={<IconSymbol name="arrow.2.squarepath" size={18} color={iconColor} />}
            textStyle={styles.resetLabel}
          >
            카테고리 변경
          </Button>
        </View>
        <SwipeStack
          key={selectedCategory.slug}
          category={selectedCategory.slug}
          setSelectedCategory={setSelectedCategory}
          onCompletionVisibilityChange={setIsCompletionVisible}
        />
      </ThemedView>
      <AlertDialog
        visible={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        title="카테고리를 변경하시겠어요?"
        description={`${selectedCategory.title} 카테고리에서 진행 중인 점수와 스트릭 등이 초기화돼요.`}
        actions={[
          {
            label: '취소',
            tone: 'outline',
            onPress: () => setShowResetDialog(false),
          },
          {
            label: '변경',
            tone: 'destructive',
            onPress: handleConfirmReset,
          },
        ]}
      />
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
