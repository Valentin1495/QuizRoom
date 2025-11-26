import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const EMOJI_MAP: Record<string, string> = {
  clap: '👏',
  fire: '🔥',
  skull: '💀',
  laugh: '😂',
};

type FloatingEmoji = {
  id: string;
  emoji: string;
  x: number;
  anim: Animated.Value;
};

// Bandwidth optimization: removed participantId from reaction payload
export type FloatingReactionsProps = {
  reactions: { emoji: string; createdAt: number }[];
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const ANIMATION_DURATION = 3000;
const MAX_VISIBLE = 15;

export function FloatingReactions({ reactions }: FloatingReactionsProps) {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const lastProcessedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 새로운 리액션만 처리 (using emoji + createdAt as unique key after bandwidth optimization)
    const newReactions = reactions.filter((r) => {
      const key = `${r.emoji}-${r.createdAt}`;
      if (lastProcessedRef.current.has(key)) return false;
      lastProcessedRef.current.add(key);
      return true;
    });

    if (newReactions.length === 0) return;

    // 오래된 키 정리 (메모리 누수 방지)
    const cutoff = Date.now() - 10000;
    const keysToKeep = reactions
      .filter((r) => r.createdAt > cutoff)
      .map((r) => `${r.emoji}-${r.createdAt}`);
    lastProcessedRef.current = new Set(keysToKeep);

    // 새 이모지 추가
    const newEmojis: FloatingEmoji[] = newReactions.map((r, idx) => ({
      id: `${r.emoji}-${r.createdAt}-${idx}`,
      emoji: EMOJI_MAP[r.emoji] ?? '👏',
      x: Math.random() * (SCREEN_WIDTH - 60) + 30, // 화면 가장자리 여백
      anim: new Animated.Value(0),
    }));

    setFloatingEmojis((prev) => {
      const combined = [...prev, ...newEmojis];
      // 최대 개수 제한
      return combined.slice(-MAX_VISIBLE);
    });

    // 애니메이션 시작
    newEmojis.forEach((emoji) => {
      Animated.timing(emoji.anim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start(() => {
        // 애니메이션 완료 후 제거
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      });
    });
  }, [reactions]);

  return (
    <View style={styles.container} pointerEvents="none">
      {floatingEmojis.map((emoji) => {
        const translateY = emoji.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -SCREEN_HEIGHT * 0.6],
        });
        const opacity = emoji.anim.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });
        const scale = emoji.anim.interpolate({
          inputRange: [0, 0.2, 0.8, 1],
          outputRange: [0.5, 1.2, 1, 0.8],
        });
        const rotate = emoji.anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${(Math.random() - 0.5) * 30}deg`],
        });

        return (
          <Animated.View
            key={emoji.id}
            style={[
              styles.emoji,
              {
                left: emoji.x,
                transform: [{ translateY }, { scale }, { rotate }],
                opacity,
              },
            ]}
          >
            <ThemedText style={styles.emojiText}>{emoji.emoji}</ThemedText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  emoji: {
    position: 'absolute',
    bottom: 100,
  },
  emojiText: {
    fontSize: 32,
  },
});

