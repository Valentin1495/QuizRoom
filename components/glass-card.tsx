import { View, StyleSheet } from 'react-native';
import { ReactNode } from 'react';
import { BlurView } from 'expo-blur';

export function GlassCard({ children }: { children: ReactNode }) {
  return (
    <BlurView intensity={50} style={styles.container}>
      <View style={styles.innerContainer}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  innerContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});
