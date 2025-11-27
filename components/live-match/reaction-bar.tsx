import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { lightHaptic, mediumHaptic } from '@/lib/haptics';

export type ReactionEmoji = 'clap' | 'fire' | 'skull' | 'laugh';

const REACTION_CONFIG: { emoji: ReactionEmoji; icon: string; label: string }[] = [
  { emoji: 'clap', icon: '👏', label: '박수' },
  { emoji: 'fire', icon: '🔥', label: '불꽃' },
  { emoji: 'skull', icon: '💀', label: '해골' },
  { emoji: 'laugh', icon: '😂', label: '웃음' },
];

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

// 컴팩트 버전 (작은 화면용)
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

      setCooldowns((prev) => ({ ...prev, [emoji]: true }));
      setTimeout(() => {
        setCooldowns((prev) => ({ ...prev, [emoji]: false }));
      }, 1000);
    },
    [cooldowns, disabled, onReaction]
  );

  return (
    <View style={styles.compactContainer}>
      {REACTION_CONFIG.map(({ emoji, icon }) => {
        const isOnCooldown = cooldowns[emoji];
        const isDisabled = disabled || isOnCooldown;

        return (
          <Pressable
            key={emoji}
            onPress={() => handlePress(emoji)}
            disabled={isDisabled}
            style={({ pressed }) => [
              styles.compactButton,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.04)',
              },
              pressed && styles.compactButtonPressed,
              isDisabled && styles.buttonDisabled,
            ]}
          >
            <ThemedText style={[styles.compactEmoji, isDisabled && styles.emojiDisabled]}>
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
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactButtonPressed: {
    transform: [{ scale: 0.85 }],
  },
  compactEmoji: {
    fontSize: 20,
  },
});

