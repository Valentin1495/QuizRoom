import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

type Particle = {
  animation: Animated.Value;
  x: number;
  y: number;
};

type Props = {
  count?: number;
  duration?: number;
  size?: number;
};

export function Particles({ count = 20, duration = 1000, size = 10 }: Props) {
  const particles = useRef<Particle[]>([]).current;

  if (particles.length === 0) {
    for (let i = 0; i < count; i++) {
      particles.push({
        animation: new Animated.Value(0),
        x: Math.random(),
        y: Math.random(),
      });
    }
  }

  useEffect(() => {
    const animations = particles.map(p => {
      return Animated.timing(p.animation, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    });
    Animated.stagger(100, animations).start();
  }, []);

  return (
    <View style={styles.container}>
      {particles.map((p, i) => {
        const translateX = p.animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (p.x - 0.5) * 200],
        });
        const translateY = p.animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, (p.y - 0.5) * 200],
        });
        const opacity = p.animation.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                width: size,
                height: size,
                transform: [{ translateX }, { translateY }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#64FBD2', // Accent(Neon)
    borderRadius: 10,
  },
});
