import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EMOJI_MAP: Record<string, string> = {
  clap: '👏',
  fire: '🔥',
  skull: '💀',
  laugh: '😂',
};

export type ReactionCounterProps = {
  counts: Record<string, number>;
  showZero?: boolean;
  compact?: boolean;
};

export function ReactionCounter({ counts, showZero = false, compact = false }: ReactionCounterProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];

  const entries = Object.entries(counts)
    .filter(([, count]) => showZero || count > 0)
    .sort((a, b) => b[1] - a[1]); // 카운트 높은 순

  if (entries.length === 0) return null;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {entries.map(([emoji, count]) => (
        <CounterBadge
          key={emoji}
          emoji={emoji}
          count={count}
          compact={compact}
          isDark={isDark}
        />
      ))}
    </View>
  );
}

function CounterBadge({
  emoji,
  count,
  compact,
  isDark,
}: {
  emoji: string;
  count: number;
  compact: boolean;
  isDark: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(count);

  // 카운트 증가 시 펄스 애니메이션
  useEffect(() => {
    if (count > prevCount.current) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevCount.current = count;
  }, [count, scaleAnim]);

  const icon = EMOJI_MAP[emoji] ?? '👏';

  return (
    <Animated.View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.05)',
        },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <ThemedText style={[styles.emoji, compact && styles.emojiCompact]}>
        {icon}
      </ThemedText>
      <ThemedText style={[styles.count, compact && styles.countCompact]}>
        {count > 99 ? '99+' : count}
      </ThemedText>
    </Animated.View>
  );
}

// 간단한 총 리액션 수 표시
export function TotalReactionCount({ counts }: { counts: Record<string, number> }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];
  
  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
  
  if (total === 0) return null;

  return (
    <View
      style={[
        styles.totalBadge,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
      ]}
    >
      <ThemedText style={styles.totalText}>
        ❤️ {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  containerCompact: {
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  badgeCompact: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  emoji: {
    fontSize: 16,
  },
  emojiCompact: {
    fontSize: 12,
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
  },
  countCompact: {
    fontSize: 11,
  },
  totalBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

