import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../../theme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>QZY</Text>
        <Text style={styles.subtitle}>매일 더 똑똑해지는 즐거움.</Text>
      </View>

      <View style={styles.menuContainer}>
        <Link href="/category" asChild>
          <Pressable style={styles.menuButton}>
            <Text style={styles.menuButtonText}>🚀 빠른 런 시작</Text>
          </Pressable>
        </Link>
        <Link href="/daily" asChild>
          <Pressable style={[styles.menuButton, styles.dailyButton]}>
            <Text style={styles.menuButtonText}>📅 데일리 퀴즈</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...Typography.h1,
    color: Colors.text,
    fontSize: 64,
    fontWeight: 'bold',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.subtext,
    marginTop: Spacing.sm,
  },
  menuContainer: {
    justifyContent: 'center',
    gap: Spacing.md,
  },
  menuButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  dailyButton: {
    backgroundColor: Colors.accent,
  },
  menuButtonText: {
    ...Typography.button,
    color: Colors.background,
  },
});
