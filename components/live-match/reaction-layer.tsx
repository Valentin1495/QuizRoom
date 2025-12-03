import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { FloatingReaction } from './floating-reaction';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MAX_VISIBLE = 30;
const MIN_DURATION = 700;
const MAX_DURATION = 1200;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;
const MIN_WIGGLE = 5;
const MAX_WIGGLE = 20;

// Spawn area: right side of screen, with some padding
const SPAWN_X_MIN = SCREEN_WIDTH - 120;
const SPAWN_X_MAX = SCREEN_WIDTH - 40;

type ReactionItem = {
  id: string;
  emoji: string;
  x: number;
  duration: number;
  scale: number;
  wiggle: number;
};

export type ReactionLayerRef = {
  triggerReaction: (emoji: string) => void;
};

export const ReactionLayer = forwardRef<ReactionLayerRef, object>(function ReactionLayer(
  _props,
  ref
) {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  const handleComplete = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const triggerReaction = useCallback(
    (emoji: string) => {
      setReactions((prev) => {
        // Limit max visible reactions
        if (prev.length >= MAX_VISIBLE) {
          // Remove oldest to make room
          const trimmed = prev.slice(1);
          return [
            ...trimmed,
            createReaction(emoji),
          ];
        }
        return [...prev, createReaction(emoji)];
      });
    },
    []
  );

  useImperativeHandle(ref, () => ({ triggerReaction }), [triggerReaction]);

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((reaction) => (
        <FloatingReaction
          key={reaction.id}
          id={reaction.id}
          emoji={reaction.emoji}
          x={reaction.x}
          duration={reaction.duration}
          scale={reaction.scale}
          wiggle={reaction.wiggle}
          onComplete={handleComplete}
        />
      ))}
    </View>
  );
});

function createReaction(emoji: string): ReactionItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    emoji,
    x: SPAWN_X_MIN + Math.random() * (SPAWN_X_MAX - SPAWN_X_MIN),
    duration: MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION),
    scale: MIN_SCALE + Math.random() * (MAX_SCALE - MIN_SCALE),
    wiggle: MIN_WIGGLE + Math.random() * (MAX_WIGGLE - MIN_WIGGLE),
  };
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});
