import { useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { lightHaptic, mediumHaptic } from '@/lib/haptics';

export type ReactionEmoji = 'clap' | 'fire' | 'laugh' | 'hundred' | 'party';

// Emoji type to icon mapping (exported for use in ReactionLayer)
export const EMOJI_MAP: Record<ReactionEmoji, string> = {
  clap: '👏',
  fire: '🔥',
  laugh: '😂',
  hundred: '💯',
  party: '🎉',
};

const REACTION_CONFIG: { emoji: ReactionEmoji; icon: string; label: string }[] = [
  { emoji: 'clap', icon: '👏', label: '박수' },
  { emoji: 'fire', icon: '🔥', label: '불꽃' },
  { emoji: 'laugh', icon: '😂', label: '웃음' },
  { emoji: 'hundred', icon: '💯', label: '완벽' },
  { emoji: 'party', icon: '🎉', label: '축하' },
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

  const [cooldowns, setCooldowns] = useState<Record<ReactionEmoji, boolean>>({
    clap: false,
    fire: false,
    hundred: false,
    party: false,
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
      {REACTION_CONFIG.map(({ emoji, icon }) => {
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
    hundred: false,
    party: false,
    laugh: false,
  });

  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const open = useCallback(() => {
    mediumHaptic();
    setExpanded(true);
    expandAnim.setValue(0);
    Animated.timing(expandAnim, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [expandAnim]);

  const close = useCallback(() => {
    lightHaptic();
    Animated.timing(expandAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setExpanded(false);
      }
    });
  }, [expandAnim]);

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

  const panelBg = isDark ? 'rgba(20, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)';
  const panelBorderColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)';
  const buttonBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const shadowColor = isDark ? '#000' : '#00000040';
  const rippleColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="리액션 펼치기"
        android_ripple={{ color: rippleColor, borderless: true }}
        onPress={() => {
          open();
        }}
        style={({ pressed }) => [
          styles.toggleButton,
          { backgroundColor: panelBg, shadowColor, borderColor: panelBorderColor },
          pressed && styles.toggleButtonPressed,
          disabled && styles.buttonDisabled,
        ]}
      >
        <View pointerEvents="none">
          <ThemedText style={styles.toggleEmoji}>{REACTION_CONFIG[0].icon}</ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={[
        styles.expandedContainer,
        { backgroundColor: panelBg, shadowColor, borderColor: panelBorderColor },
        {
          opacity: expandAnim,
          transform: [
            {
              translateX: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        },
      ]}
    >
      {REACTION_CONFIG.map(({ emoji, icon }) => {
        const isOnCooldown = cooldowns[emoji];
        const isVisuallyDisabled = disabled;

        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`${emoji} 리액션`}
            onPress={() => handlePress(emoji)}
            disabled={disabled || isOnCooldown}
            style={({ pressed }) => [
              styles.compactButton,
              { backgroundColor: buttonBg },
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="리액션 접기"
        onPress={() => {
          close();
        }}
        style={({ pressed }) => [
          styles.compactButton,
          { backgroundColor: buttonBg },
          pressed && styles.compactButtonPressed,
          disabled && styles.buttonDisabled,
        ]}
      >
        <ThemedText style={[styles.compactEmoji, disabled && styles.emojiDisabled]}>›</ThemedText>
      </Pressable>
    </Animated.View>
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
  toggleButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  toggleButtonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
  toggleEmoji: {
    fontSize: 24,
    lineHeight: 32,
  },
  expandedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
});
