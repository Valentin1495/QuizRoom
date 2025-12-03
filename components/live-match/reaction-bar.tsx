import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { lightHaptic, mediumHaptic } from '@/lib/haptics';

export type ReactionEmoji = 'clap' | 'fire' | 'skull' | 'laugh';

// Emoji type to icon mapping (exported for use in ReactionLayer)
export const EMOJI_MAP: Record<ReactionEmoji, string> = {
  clap: '👏',
  fire: '🔥',
  skull: '💀',
  laugh: '😂',
};

const REACTION_CONFIG: { emoji: ReactionEmoji; icon: string; label: string }[] = [
  { emoji: 'clap', icon: '👏', label: '박수' },
  { emoji: 'fire', icon: '🔥', label: '불꽃' },
  { emoji: 'skull', icon: '💀', label: '해골' },
  { emoji: 'laugh', icon: '😂', label: '웃음' },
];

// Rate limiter for server calls: allows 5 calls per second (200ms interval)
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_CALLS = 5;

export function useReactionRateLimiter() {
  const callTimestamps = useRef<number[]>([]);

  const canSendToServer = useCallback(() => {
    const now = Date.now();
    // Remove timestamps older than the window
    callTimestamps.current = callTimestamps.current.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS
    );

    if (callTimestamps.current.length < RATE_LIMIT_MAX_CALLS) {
      callTimestamps.current.push(now);
      return true;
    }
    return false;
  }, []);

  return { canSendToServer };
}

export type ReactionBarProps = {
  onReaction: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
  cooldownMs?: number;
};

export function ReactionBar({ onReaction, disabled = false, cooldownMs = 1000 }: ReactionBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = Colors[colorScheme ?? 'light'];

  const [cooldowns, setCooldowns] = useState<Record<ReactionEmoji, boolean>>({
    clap: false,
    fire: false,
    skull: false,
    laugh: false,
  });

  const handlePress = useCallback(
    (emoji: ReactionEmoji) => {
      if (disabled || cooldowns[emoji]) return;

      lightHaptic();
      onReaction(emoji);

      // 쿨다운 시작
      setCooldowns((prev) => ({ ...prev, [emoji]: true }));
      setTimeout(() => {
        setCooldowns((prev) => ({ ...prev, [emoji]: false }));
      }, cooldownMs);
    },
    [cooldowns, cooldownMs, disabled, onReaction]
  );

  return (
    <View style={styles.container}>
      {REACTION_CONFIG.map(({ emoji, icon, label }) => {
        const isOnCooldown = cooldowns[emoji];
        const isDisabled = disabled || isOnCooldown;

        return (
          <Pressable
            key={emoji}
            onPress={() => handlePress(emoji)}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.1)'
                  : 'rgba(0,0,0,0.05)',
              },
              pressed && styles.buttonPressed,
              isDisabled && styles.buttonDisabled,
            ]}
          >
            <ThemedText style={[styles.emoji, isDisabled && styles.emojiDisabled]}>
              {icon}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// Short cooldown to prevent accidental double-taps while allowing rapid tapping
const COMPACT_BUTTON_COOLDOWN_MS = 120;

// 컴팩트 버전 (게임 화면용)
export function CompactReactionBar({ onReaction, disabled }: ReactionBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [cooldowns, setCooldowns] = useState<Record<ReactionEmoji, boolean>>({
    clap: false,
    fire: false,
    skull: false,
    laugh: false,
  });

  const handlePress = useCallback(
    (emoji: ReactionEmoji) => {
      if (disabled || cooldowns[emoji]) return;

      mediumHaptic();
      onReaction(emoji);

      // Short cooldown to prevent accidental double-taps
      setCooldowns((prev) => ({ ...prev, [emoji]: true }));
      setTimeout(() => {
        setCooldowns((prev) => ({ ...prev, [emoji]: false }));
      }, COMPACT_BUTTON_COOLDOWN_MS);
    },
    [cooldowns, disabled, onReaction]
  );

  return (
    <View
      style={[
        styles.compactContainer,
        {
          backgroundColor: isDark
            ? 'rgba(30, 30, 40, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          shadowColor: isDark ? '#000' : '#00000040',
        },
      ]}
    >
      {REACTION_CONFIG.map(({ emoji, icon }) => {
        const isOnCooldown = cooldowns[emoji];
        // Only visually disable if explicitly disabled, not for brief cooldown
        const isVisuallyDisabled = disabled;

        return (
          <Pressable
            key={emoji}
            onPress={() => handlePress(emoji)}
            disabled={disabled || isOnCooldown}
            style={({ pressed }) => [
              styles.compactButton,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.06)',
              },
              pressed && styles.compactButtonPressed,
              isVisuallyDisabled && styles.buttonDisabled,
            ]}
          >
            <ThemedText style={[styles.compactEmoji, isVisuallyDisabled && styles.emojiDisabled]}>
              {icon}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  emoji: {
    fontSize: 28,
  },
  emojiDisabled: {
    opacity: 0.5,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  compactButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactButtonPressed: {
    transform: [{ scale: 0.88 }],
  },
  buttonCooldown: {
    opacity: 0.5,
  },
  compactEmoji: {
    fontSize: 24,
    lineHeight: 32,
  },
});

