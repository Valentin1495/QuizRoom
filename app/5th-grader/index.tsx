import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeStack } from '@/components/swipe/swipe-stack';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FIFTH_GRADER_CHALLENGE } from '@/constants/challenges';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function FifthGraderChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Button
          variant="ghost"
          size="sm"
          rounded="full"
          onPress={() => router.back()}
          leftIcon={<IconSymbol name="arrow.left" size={16} color={palette.text} />}
          textStyle={styles.backLabel}
        >
          뒤로
        </Button>
        <View style={styles.headerText}>
          <ThemedText type="title">{FIFTH_GRADER_CHALLENGE.title}</ThemedText>
          <ThemedText style={[styles.headerTagline, { color: palette.textMuted }]}>
            {FIFTH_GRADER_CHALLENGE.tagline}
          </ThemedText>
        </View>
        <View style={[styles.headerBadge, { borderColor: palette.borderStrong, backgroundColor: palette.card }]}>
          <ThemedText style={styles.headerBadgeLabel}>시즌 챌린지</ThemedText>
        </View>
      </View>
      <View style={styles.stackContainer}>
        <SwipeStack
          category={FIFTH_GRADER_CHALLENGE.category}
          tags={FIFTH_GRADER_CHALLENGE.tags}
          deckSlug={FIFTH_GRADER_CHALLENGE.deckSlug}
          challenge={{
            totalQuestions: FIFTH_GRADER_CHALLENGE.totalQuestions,
            allowedMisses: FIFTH_GRADER_CHALLENGE.allowedMisses,
            scorePerCorrect: FIFTH_GRADER_CHALLENGE.scorePerCorrect,
          }}
          onExit={() => router.back()}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    gap: 2,
  },
  headerTagline: {
    fontSize: 14,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  headerBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  stackContainer: {
    flex: 1,
  },
});
