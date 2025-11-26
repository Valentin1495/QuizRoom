import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  calculateLevel,
  getLevelBackgroundColor,
  getLevelColor,
  getLevelTitle,
  type LevelInfo,
} from '@/lib/level';

export type LevelBadgeProps = {
  xp?: number;
  level?: number;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  showTitle?: boolean;
  compact?: boolean;
};

export function LevelBadge({
  xp,
  level: levelProp,
  size = 'md',
  showProgress = false,
  showTitle = false,
  compact = false,
}: LevelBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];

  // xp 또는 level prop에서 레벨 정보 계산
  const levelInfo: LevelInfo = xp !== undefined
    ? calculateLevel(xp)
    : { level: levelProp ?? 1, current: 0, next: 100, progress: 0, totalXpForLevel: 0 };

  const levelColor = getLevelColor(levelInfo.level, isDark);
  const levelBgColor = getLevelBackgroundColor(levelInfo.level, isDark);
  const levelTitle = getLevelTitle(levelInfo.level);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevLevel = useRef(levelInfo.level);

  // 레벨업 시 애니메이션
  useEffect(() => {
    if (levelInfo.level > prevLevel.current) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevLevel.current = levelInfo.level;
  }, [levelInfo.level, scaleAnim]);

  const sizeStyles = {
    sm: {
      badge: styles.badgeSm,
      text: styles.textSm,
      title: styles.titleSm,
      progressHeight: 3,
    },
    md: {
      badge: styles.badgeMd,
      text: styles.textMd,
      title: styles.titleMd,
      progressHeight: 4,
    },
    lg: {
      badge: styles.badgeLg,
      text: styles.textLg,
      title: styles.titleLg,
      progressHeight: 6,
    },
  }[size];

  if (compact) {
    return (
      <Animated.View
        style={[
          styles.compactBadge,
          { backgroundColor: levelBgColor, borderColor: levelColor },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <ThemedText style={[styles.compactText, { color: levelColor }]}>
          Lv.{levelInfo.level}
        </ThemedText>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.badge,
          sizeStyles.badge,
          { backgroundColor: levelBgColor, borderColor: levelColor },
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <ThemedText style={[sizeStyles.text, { color: levelColor }]}>
          Lv.{levelInfo.level}
        </ThemedText>
        {showTitle && (
          <ThemedText style={[sizeStyles.title, { color: levelColor }]}>
            {levelTitle}
          </ThemedText>
        )}
      </Animated.View>

      {showProgress && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressTrack,
              { height: sizeStyles.progressHeight },
              { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: levelColor,
                  width: `${levelInfo.progress}%`,
                  height: sizeStyles.progressHeight,
                },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: palette.textMuted }]}>
            {levelInfo.current}/{levelInfo.next} XP
          </ThemedText>
        </View>
      )}
    </View>
  );
}

// 인라인 레벨 표시 (참가자 카드용)
export function InlineLevelBadge({ level, size = 'sm' }: { level: number; size?: 'sm' | 'md' }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const levelColor = getLevelColor(level, isDark);

  return (
    <View style={[styles.inlineBadge, { backgroundColor: getLevelBackgroundColor(level, isDark) }]}>
      <ThemedText
        style={[
          styles.inlineText,
          size === 'md' && styles.inlineTextMd,
          { color: levelColor },
        ]}
      >
        Lv.{level}
      </ThemedText>
    </View>
  );
}

// XP 진행 바 컴포넌트
export function XpProgressBar({
  xp,
  height = 4,
  showLabel = true,
}: {
  xp: number;
  height?: number;
  showLabel?: boolean;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];
  const levelInfo = calculateLevel(xp);
  const levelColor = getLevelColor(levelInfo.level, isDark);

  return (
    <View style={styles.xpBarContainer}>
      <View
        style={[
          styles.xpBarTrack,
          { height },
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
        ]}
      >
        <Animated.View
          style={[
            styles.xpBarFill,
            { backgroundColor: levelColor, width: `${levelInfo.progress}%`, height },
          ]}
        />
      </View>
      {showLabel && (
        <View style={styles.xpBarLabelRow}>
          <ThemedText style={[styles.xpBarLabel, { color: palette.textMuted }]}>
            {levelInfo.current} / {levelInfo.next} XP
          </ThemedText>
          <ThemedText style={[styles.xpBarLabel, { color: levelColor }]}>
            {levelInfo.progress}%
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  badgeLg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  textSm: {
    fontSize: 12,
    fontWeight: '700',
  },
  textMd: {
    fontSize: 14,
    fontWeight: '700',
  },
  textLg: {
    fontSize: 18,
    fontWeight: '700',
  },
  titleSm: {
    fontSize: 10,
    fontWeight: '600',
  },
  titleMd: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleLg: {
    fontSize: 14,
    fontWeight: '600',
  },
  compactBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  progressContainer: {
    gap: 2,
  },
  progressTrack: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    textAlign: 'center',
  },
  inlineBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: Radius.sm,
  },
  inlineText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inlineTextMd: {
    fontSize: 12,
  },
  xpBarContainer: {
    gap: Spacing.xs,
  },
  xpBarTrack: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpBarFill: {
    borderRadius: 2,
  },
  xpBarLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpBarLabel: {
    fontSize: 11,
  },
});

