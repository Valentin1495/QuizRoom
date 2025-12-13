import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  calculateLevel,
  getLevelColor,
  getLevelTitle,
  getNextTierInfo,
  getTotalXpForLevel,
} from '@/lib/level';
import { LevelBadge } from './level-badge';

const LEVEL_TIERS = [
  { title: '챌린저', from: 60, emoji: '👑', desc: '퀴즈계의 전설' },
  { title: '그랜드 마스터', from: 50, emoji: '🎖️', desc: '정상급 실력자' },
  { title: '마스터', from: 40, emoji: '💠', desc: '퀴즈 달인' },
  { title: '다이아몬드', from: 30, emoji: '💎', desc: '상위권 도전자' },
  { title: '플래티넘', from: 20, emoji: '✨', desc: '숙련된 플레이어' },
  { title: '골드', from: 15, emoji: '🥇', desc: '중급 플레이어' },
  { title: '실버', from: 10, emoji: '🥈', desc: '성장 중인 플레이어' },
  { title: '브론즈', from: 5, emoji: '🥉', desc: '입문자' },
  { title: '아이언', from: 1, emoji: '🪙', desc: '시작하는 단계' },
];

const XP_SOURCES = [
  { action: '데일리 정답', xp: '+10', icon: '🎯' },
  { action: '데일리 완료', xp: '+50', icon: '📅' },
  { action: '데일리 퍼펙트', xp: '+30', icon: '💯' },
  { action: '스와이프 정답', xp: '+15', icon: '✅' },
  { action: '스와이프 완주', xp: '+30', icon: '⭐' },
  { action: '스와이프 퍼펙트', xp: '+50', icon: '🎉' },
  { action: '라이브 매치 참여', xp: '+30', icon: '🥊' },
  { action: '라이브 매치 3위', xp: '+30', icon: '🥉' },
  { action: '라이브 매치 준우승', xp: '+50', icon: '🥈' },
  { action: '라이브 매치 우승', xp: '+100', icon: '🥇' },
];

const STREAK_BONUSES = [
  { days: '2일 연속', multiplier: '×1.1', level: 2 },
  { days: '3일 연속', multiplier: '×1.25', level: 3 },
  { days: '4일 연속', multiplier: '×1.4', level: 4 },
  { days: '5일 연속', multiplier: '×1.6', level: 5 },
  { days: '6일 연속', multiplier: '×1.8', level: 6 },
  { days: '7일+ 연속', multiplier: '×2.0', level: 7 },
];

type LevelInfoSheetProps = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  currentLevel: number;
  currentXp: number;
  variant?: 'full' | 'compact';
  onClose: () => void;
};

export function LevelInfoSheet({
  sheetRef,
  currentLevel,
  currentXp,
  variant = 'full',
  onClose,
}: LevelInfoSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themeColors = Colors[colorScheme ?? 'light'];
  const mutedColor = useThemeColor({}, 'textMuted');
  const insets = useSafeAreaInsets();
  const currentTitle = getLevelTitle(currentLevel);
  const levelInfo = calculateLevel(currentXp);
  const nextTier = getNextTierInfo(currentLevel);

  // 다음 티어까지의 진행률 계산
  const currentTierStart = LEVEL_TIERS.find((t) => t.title === currentTitle)?.from ?? 1;
  const currentTierStartXp = getTotalXpForLevel(currentTierStart);
  const nextTierStartXp = nextTier?.xpNeeded ?? currentTierStartXp;
  const tierXpSpan = Math.max(1, nextTierStartXp - currentTierStartXp);
  const tierXpProgress = Math.min(
    100,
    Math.max(0, Math.round(((currentXp - currentTierStartXp) / tierXpSpan) * 100))
  );
  const tierXpCurrent = Math.max(0, currentXp - currentTierStartXp);
  const tierXpTarget = tierXpSpan;

  const xpToNextTier = nextTier ? Math.max(0, nextTier.xpNeeded - currentXp) : 0;
  const showExtended = variant === 'full';

  // 노치를 침범하지 않는 최대 높이 계산
  const screenHeight = Dimensions.get('window').height;
  const maxSheetHeight = screenHeight - insets.top - 8; // 노치 + 여유 8px
  const snapPoints = useMemo(() => ['60%', maxSheetHeight], [maxSheetHeight]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      topInset={insets.top + 8}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      handleIndicatorStyle={{ backgroundColor: themeColors.border }}
      onDismiss={onClose}
      enablePanDownToClose
    >
      <BottomSheetScrollView contentContainerStyle={styles.levelSheetContent}>
        {/* 헤더 */}
        <View style={styles.levelSheetHeader}>
          <ThemedText type="subtitle">레벨 시스템</ThemedText>
          <Button variant="ghost" size="sm" onPress={onClose}>
            닫기
          </Button>
        </View>

        {/* 현재 상태 카드 */}
        <View
          style={[
            styles.currentStatusCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: getLevelColor(currentLevel, isDark),
            },
          ]}
        >
          <View style={styles.currentStatusTop}>
            <LevelBadge level={currentLevel} size="lg" showTitle />
            <ThemedText type="defaultSemiBold" style={[styles.xpText]}>
              총 {currentXp.toLocaleString()} XP
            </ThemedText>
          </View>

          {/* 다음 레벨 진행률 */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <ThemedText style={[styles.progressLabel, { color: mutedColor }]}>
                {levelInfo.current.toLocaleString()} / {levelInfo.next.toLocaleString()} XP ({levelInfo.progress}%)
              </ThemedText>
              <ThemedText style={[styles.progressLabel, { color: mutedColor }]}>
                Lv.{levelInfo.level + 1}
              </ThemedText>
            </View>
            <View style={[styles.progressBar, { backgroundColor: themeColors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${levelInfo.progress}%`,
                    backgroundColor: getLevelColor(currentLevel, isDark),
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* 다음 티어 목표 카드 */}
        {nextTier && (
          <View
            style={[
              styles.nextTierCard,
              {
                backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.05)',
                borderColor: isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.2)',
              },
            ]}
          >
            <View style={styles.nextTierHeader}>
              <ThemedText style={styles.nextTierEmoji}>🏁</ThemedText>
              <ThemedText type="defaultSemiBold">다음 목표 티어</ThemedText>
            </View>
            <View style={styles.nextTierContent}>
              <View style={styles.nextTierBadgeWrap}>
                <LevelBadge level={nextTier.fromLevel} size="md" />
              </View>
              <View style={styles.nextTierInfo}>
                <ThemedText type="defaultSemiBold" style={{ color: getLevelColor(nextTier.fromLevel, isDark) }}>
                  {nextTier.title}
                </ThemedText>
                <ThemedText style={[styles.nextTierDesc, { color: mutedColor }]}>
                  승급까지 {nextTier.fromLevel - currentLevel}레벨
                </ThemedText>
              </View>
              <View style={styles.nextTierXp}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                  {xpToNextTier.toLocaleString()}
                </ThemedText>
                <ThemedText style={[styles.xpLabel, { color: mutedColor }]}>XP 필요</ThemedText>
              </View>
            </View>
            {/* 티어 진행률 */}
            <View style={[styles.tierProgressBar, { backgroundColor: themeColors.border }]}>
              <View
                style={[
                  styles.tierProgressFill,
                  {
                    width: `${tierXpProgress}%`,
                    backgroundColor: '#A855F7',
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.tierProgressText, { color: mutedColor }]}>
              {tierXpProgress}% ({tierXpCurrent.toLocaleString()}/
              {tierXpTarget.toLocaleString()} XP)
            </ThemedText>
          </View>
        )}

        {showExtended ? (
          <>
            {/* XP 획득 방법 */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                💡 XP 획득 방법
              </ThemedText>
              <View style={[styles.xpSourcesCard, { backgroundColor: themeColors.cardElevated }]}>
                {XP_SOURCES.map((source, index) => (
                  <View
                    key={source.action}
                    style={[
                      styles.xpSourceRow,
                      index < XP_SOURCES.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: themeColors.border,
                      },
                    ]}
                  >
                    <ThemedText style={styles.xpSourceIcon}>{source.icon}</ThemedText>
                    <ThemedText style={styles.xpSourceAction}>{source.action}</ThemedText>
                    <ThemedText
                      style={[
                        styles.xpSourceXp,
                        { color: themeColors.primary },
                      ]}
                    >
                      {source.xp}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            {/* 스트릭 보너스 */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                🔥 스트릭 보너스
              </ThemedText>
              <ThemedText style={[styles.sectionDesc, { color: mutedColor }]}>
                연속으로 플레이하면 XP 보너스! (스와이프/라이브 매치)
              </ThemedText>
              <View style={[styles.streakCard, { backgroundColor: themeColors.cardElevated }]}>
                {STREAK_BONUSES.map((bonus, index) => {
                  const intensity = bonus.level / 7; // 0.28 ~ 1.0
                  return (
                    <View
                      key={bonus.days}
                      style={[
                        styles.streakRow,
                        index < STREAK_BONUSES.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: themeColors.border,
                        },
                      ]}
                    >
                      <View style={styles.streakContentRow}>
                        {Array.from({ length: bonus.level }).map((_, i) => (
                          <ThemedText
                            key={i}
                            style={[
                              styles.streakIcon,
                              { opacity: 0.5 + (i / bonus.level) * 0.5 },
                            ]}
                          >
                            🔥
                          </ThemedText>
                        ))}
                        <ThemedText style={[styles.streakDaysText, { color: mutedColor }]}>
                          {bonus.days}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.streakMultiplierChip,
                          { backgroundColor: `rgba(34, 197, 94, ${0.08 + intensity * 0.12})` },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.streakMultiplierText,
                            { opacity: 0.7 + intensity * 0.3 },
                          ]}
                        >
                          {bonus.multiplier}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 티어 목록 */}
            <View style={styles.section}>
              <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
                🏆 티어 목록
              </ThemedText>
              <ThemedText style={[styles.sectionDesc, { color: mutedColor }]}>
                레벨이 올라갈수록 필요 XP가 늘어나요
              </ThemedText>
              <View style={styles.levelList}>
                {LEVEL_TIERS.map((tier, index) => {
                  const nextHigher = LEVEL_TIERS[index - 1]?.from ?? Infinity;
                  const isActive = currentLevel >= tier.from && currentLevel < nextHigher;
                  const requiredXp = getTotalXpForLevel(tier.from);

                  return (
                    <View
                      key={tier.title}
                      style={[
                        styles.levelRow,
                        {
                          borderColor: isActive ? getLevelColor(tier.from, isDark) : themeColors.border,
                          backgroundColor: isActive
                            ? isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.04)'
                            : themeColors.cardElevated,
                          borderWidth: isActive ? 2 : StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <View style={styles.levelRowLeft}>
                        <LevelBadge level={tier.from} size="sm" />
                        <View style={styles.levelRowText}>
                          <View style={styles.levelTitleRow}>
                            <ThemedText style={styles.levelTileTitle}>{tier.emoji}</ThemedText>
                            <ThemedText
                              style={[
                                styles.levelTileTitle,
                                { color: getLevelColor(tier.from, isDark) },
                              ]}
                            >
                              {tier.title}
                            </ThemedText>
                            {isActive && (
                              <View style={[styles.activeBadge, { backgroundColor: getLevelColor(tier.from, isDark) }]}>
                                <ThemedText style={styles.activeBadgeText}>진행 중</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={[styles.levelTileDesc, { color: mutedColor }]}>
                            {tier.desc}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.levelRowRight}>
                        <ThemedText style={[styles.levelTileRange, { color: mutedColor }]}>
                          Lv.{tier.from}+
                        </ThemedText>
                        <ThemedText style={[styles.levelTileXp, { color: mutedColor }]}>
                          {requiredXp.toLocaleString()} XP
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 하단 여백 */}
            <View style={{ height: 40 }} />
          </>
        ) : (
          <View style={{ height: 12 }} />
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  levelSheetContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  levelSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentStatusCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  currentStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  xpText: {
    fontSize: 16,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  nextTierCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  nextTierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  nextTierEmoji: {
    fontSize: 16,
  },
  nextTierContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  nextTierBadgeWrap: {
    alignItems: 'center',
  },
  nextTierInfo: {
    flex: 1,
    gap: 2,
  },
  nextTierDesc: {
    fontSize: 12,
  },
  nextTierXp: {
    alignItems: 'flex-end',
  },
  xpLabel: {
    fontSize: 11,
  },
  tierProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  tierProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tierProgressText: {
    fontSize: 11,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: -Spacing.xs,
  },
  xpSourcesCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  xpSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  xpSourceIcon: {
    fontSize: 16,
    width: 24,
  },
  xpSourceAction: {
    flex: 1,
    fontSize: 14,
  },
  xpSourceXp: {
    fontSize: 14,
    fontWeight: '600',
  },
  streakCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  streakContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  streakIcon: {
    fontSize: 14,
    marginRight: -2,
  },
  streakDaysText: {
    fontSize: 13,
    marginLeft: Spacing.sm,
  },
  streakMultiplierChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    minWidth: 52,
    alignItems: 'center',
  },
  streakMultiplierText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 13,
  },
  levelList: {
    gap: Spacing.sm,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  levelRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  levelRowText: {
    flex: 1,
    gap: 2,
  },
  levelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  levelTileTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  levelTileDesc: {
    fontSize: 11,
  },
  levelRowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  levelTileRange: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelTileXp: {
    fontSize: 11,
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
