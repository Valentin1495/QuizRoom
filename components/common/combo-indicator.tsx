import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ComboIndicatorProps = {
  streak: number;
  multiplier?: number;
  showGauge?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

// 콤보 배수 계산 (백엔드와 동일한 로직)
export function getComboMultiplier(streak: number): number {
  if (streak >= 10) return 3.0;
  if (streak >= 7) return 2.5;
  if (streak >= 5) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

// 다음 콤보 배수까지 남은 정답 수
export function getNextComboThreshold(streak: number): { next: number; remaining: number } | null {
  if (streak >= 10) return null; // 최대 콤보
  if (streak >= 7) return { next: 10, remaining: 10 - streak };
  if (streak >= 5) return { next: 7, remaining: 7 - streak };
  if (streak >= 3) return { next: 5, remaining: 5 - streak };
  return { next: 3, remaining: 3 - streak };
}

// 콤보 게이지 진행률 (0-1)
function getComboProgress(streak: number): number {
  if (streak >= 10) return 1;
  if (streak >= 7) return (streak - 7) / 3; // 7-10: 0.0-1.0
  if (streak >= 5) return (streak - 5) / 2; // 5-7: 0.0-1.0
  if (streak >= 3) return (streak - 3) / 2; // 3-5: 0.0-1.0
  return streak / 3; // 0-3: 0.0-1.0
}

// 콤보 단계별 색상
function getComboColor(streak: number, isDark: boolean): string {
  if (streak >= 10) return '#FF6B6B'; // 최대 콤보 - 빨강
  if (streak >= 7) return '#FFD93D'; // 황금
  if (streak >= 5) return '#6BCB77'; // 초록
  if (streak >= 3) return '#4D96FF'; // 파랑
  return isDark ? '#666666' : '#CCCCCC'; // 기본
}

export function ComboIndicator({ streak, multiplier, showGauge = false, size = 'md' }: ComboIndicatorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const prevStreak = useRef(streak);

  const actualMultiplier = multiplier ?? getComboMultiplier(streak);
  const comboColor = getComboColor(streak, isDark);
  const progress = getComboProgress(streak);
  const nextThreshold = getNextComboThreshold(streak);

  // 콤보 증가 시 애니메이션
  useEffect(() => {
    if (streak > prevStreak.current && streak >= 3) {
      // 펄스 애니메이션
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // 글로우 애니메이션
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start();
    }
    prevStreak.current = streak;
  }, [glowAnim, scaleAnim, streak]);

  // 콤보가 없으면 렌더링하지 않음
  if (streak < 1) return null;

  const sizeStyles = {
    sm: { badge: styles.badgeSm, icon: 14, text: styles.textSm },
    md: { badge: styles.badgeMd, icon: 18, text: styles.textMd },
    lg: { badge: styles.badgeLg, icon: 24, text: styles.textLg },
  }[size];

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.badge,
          sizeStyles.badge,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderColor: comboColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* 글로우 효과 */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: comboColor,
              opacity: glowOpacity,
            },
          ]}
        />
        
        {/* 불꽃 아이콘 */}
        <IconSymbol name="flame.fill" size={sizeStyles.icon} color={comboColor} />
        
        {/* 연속 정답 수 */}
        <ThemedText style={[sizeStyles.text, { color: comboColor }]}>
          {streak}
        </ThemedText>
        
        {/* 배수 표시 (3연속 이상) */}
        {actualMultiplier > 1 && (
          <View style={[styles.multiplierBadge, { backgroundColor: comboColor }]}>
            <ThemedText style={styles.multiplierText}>
              x{actualMultiplier.toFixed(1)}
            </ThemedText>
          </View>
        )}
      </Animated.View>

      {/* 콤보 게이지 바 */}
      {showGauge && streak >= 1 && (
        <View style={styles.gaugeContainer}>
          <View style={[styles.gaugeTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <Animated.View
              style={[
                styles.gaugeFill,
                {
                  backgroundColor: comboColor,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
          {nextThreshold && (
            <ThemedText style={[styles.gaugeLabel, { color: palette.textMuted }]}>
              다음: {nextThreshold.remaining}문제
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

// 간단한 콤보 배지 (인라인용)
export function ComboBadge({ streak, size = 'sm' }: { streak: number; size?: 'sm' | 'md' }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const comboColor = getComboColor(streak, isDark);

  if (streak < 3) return null;

  const multiplier = getComboMultiplier(streak);

  return (
    <View style={[styles.inlineBadge, { backgroundColor: comboColor }]}>
      <IconSymbol name="flame.fill" size={size === 'sm' ? 12 : 14} color="#FFFFFF" />
      <ThemedText style={[styles.inlineBadgeText, size === 'md' && styles.inlineBadgeTextMd]}>
        x{multiplier.toFixed(1)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 2,
    overflow: 'hidden',
  },
  badgeSm: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  badgeMd: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  badgeLg: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.pill,
  },
  textSm: {
    fontSize: 14,
    fontWeight: '700',
  },
  textMd: {
    fontSize: 18,
    fontWeight: '700',
  },
  textLg: {
    fontSize: 24,
    fontWeight: '700',
  },
  multiplierBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginLeft: Spacing.xs,
  },
  multiplierText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gaugeContainer: {
    width: '100%',
    maxWidth: 120,
    gap: 2,
  },
  gaugeTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2,
  },
  gaugeLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  inlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  inlineBadgeTextMd: {
    fontSize: 12,
  },
});

