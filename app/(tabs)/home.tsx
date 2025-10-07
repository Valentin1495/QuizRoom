import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type TrendingDeck = {
  id: string;
  title: string;
  tag: string;
  plays: number;
};

const TRENDING_DECKS: TrendingDeck[] = [
  { id: 'kpop2024', title: '컴백 캘린더 챌린지', tag: '#KPOP', plays: 15820 },
  { id: 'dramamaster', title: '응답하라 드라마 밈', tag: '#드라마', plays: 12104 },
  { id: 'lckfinal', title: 'LCK 결승 하이라이트', tag: '#e스포츠', plays: 9342 },
];

function formatTimeLeft(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [timeLeft, setTimeLeft] = useState(() => {
    const nextReset = new Date();
    nextReset.setHours(24, 0, 0, 0);
    return formatTimeLeft(nextReset);
  });
  const [partyCode, setPartyCode] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      setTimeLeft(formatTimeLeft(tomorrow));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const palette = Colors[colorScheme ?? 'light'];
  const cardBackground = palette.card;
  const borderColor = palette.border;
  const muted = useThemeColor({}, 'textMuted');

  const isCodeValid = useMemo(() => partyCode.trim().length === 5, [partyCode]);

  const handleJoinParty = useCallback(() => {
    if (!isCodeValid) return;
    router.push(`/room/${partyCode.trim().toUpperCase()}`);
  }, [isCodeValid, partyCode, router]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <ThemedText type="title">Blinko</ThemedText>
            <ThemedText style={[styles.subtitle, { color: muted }]}>60초 안에 즐기는 오늘의 퀴즈</ThemedText>
          </View>
          <Link href="/create" asChild>
            <Pressable style={styles.createButton}>
              <ThemedText style={styles.createButtonLabel} lightColor="#fff" darkColor="#fff">
                퀴즈 만들기
              </ThemedText>
            </Pressable>
          </Link>
        </View>

        <View style={styles.section}>
          <View style={[styles.dailyCard, { backgroundColor: Palette.purple600 }]}
            >
            <ThemedText type="subtitle" style={styles.dailyTitle} lightColor="#ffffff" darkColor="#ffffff">
              데일리 블링크
            </ThemedText>
            <ThemedText style={styles.dailyHeadline} lightColor="#ffffff" darkColor="#ffffff">
              오늘의 5문제, 스트릭을 이어가세요!
            </ThemedText>
            <View style={styles.timerPill}>
              <ThemedText style={styles.timerLabel} lightColor={Palette.purple600} darkColor={Palette.purple600}>
                {timeLeft} 남음
              </ThemedText>
            </View>
            <Link href="/(tabs)/swipe" asChild>
              <Pressable style={styles.primaryButton}>
                <ThemedText style={styles.primaryButtonLabel} lightColor="#ffffff" darkColor="#ffffff">
                  오늘의 퀴즈 시작
                </ThemedText>
              </Pressable>
            </Link>
          </View>
          <View style={[styles.statsRow, { backgroundColor: cardBackground, borderColor }]}
            >
            <StatsPill label="스트릭" value="3일" />
            <StatsPill label="XP" value="1,280" />
            <StatsPill label="오늘 정답률" value="82%" />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="트렌딩 덱" tagline="요즘 가장 뜨거운 밈 컷" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {TRENDING_DECKS.map((deck) => (
              <View key={deck.id} style={[styles.deckCard, { backgroundColor: cardBackground, borderColor }]}
                >
                <ThemedText style={styles.deckTag} lightColor={Palette.pink500} darkColor={Palette.pink200}>
                  {deck.tag}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.deckTitle}>
                  {deck.title}
                </ThemedText>
                <ThemedText style={[styles.deckMeta, { color: muted }]}>플레이 {deck.plays.toLocaleString()}회</ThemedText>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="파티 라이브" tagline="친구들과 붙어보기" />
          <View style={[styles.partyCard, { backgroundColor: cardBackground, borderColor }]}
            >
            <ThemedText style={styles.partyLabel}>초대 코드</ThemedText>
            <TextInput
              value={partyCode}
              onChangeText={(value) => setPartyCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="ABCDE"
              autoCapitalize="characters"
              maxLength={5}
              style={[styles.partyInput, { borderColor }]}
              placeholderTextColor={muted}
            />
            <Pressable
              onPress={handleJoinParty}
              disabled={!isCodeValid}
              style={[styles.joinButton, !isCodeValid && styles.joinButtonDisabled]}
            >
              <ThemedText
                style={styles.joinButtonLabel}
                lightColor={!isCodeValid ? Palette.slate500 : '#ffffff'}
                darkColor={!isCodeValid ? Palette.slate500 : '#ffffff'}
              >
                파티 참여
              </ThemedText>
            </Pressable>
            <Link href="/(tabs)/party" asChild>
              <Pressable style={styles.secondaryLink}>
                <ThemedText style={styles.secondaryLinkLabel} lightColor={Palette.purple600} darkColor={Palette.purple200}>
                  새 파티 만들기 →
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SectionHeader({ title, tagline }: { title: string; tagline: string }) {
  const muted = useThemeColor({}, 'textMuted');
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <ThemedText style={[styles.sectionTagline, { color: muted }]}>{tagline}</ThemedText>
    </View>
  );
}

function StatsPill({ label, value }: { label: string; value: string }) {
  const muted = useThemeColor({}, 'textMuted');
  return (
    <View style={styles.statsPill}>
      <ThemedText style={[styles.statsLabel, { color: muted }]}>{label}</ThemedText>
      <ThemedText style={styles.statsValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: 20,
    gap: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
  },
  createButton: {
    backgroundColor: Palette.pink500,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
  },
  createButtonLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    gap: Spacing.lg,
  },
  dailyCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  dailyTitle: {
    letterSpacing: 1,
  },
  dailyHeadline: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  timerPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  timerLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Palette.pink500,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: Spacing.lg,
    justifyContent: 'space-between',
  },
  statsPill: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statsLabel: {
    fontSize: 13,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTagline: {
    fontSize: 14,
  },
  horizontalList: {
    gap: Spacing.lg,
    paddingRight: 8,
  },
  deckCard: {
    width: 220,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  deckTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  deckTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  deckMeta: {
    fontSize: 14,
  },
  partyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  partyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  partyInput: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 18,
    letterSpacing: 4,
  },
  joinButton: {
    backgroundColor: Palette.purple600,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: Palette.purple200,
  },
  joinButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryLink: {
    paddingVertical: 4,
  },
  secondaryLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
