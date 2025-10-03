import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../../theme/tokens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';

export default function HomeScreen() {
  const inventory = useQuery(api.inventories.getInventory);
  const claimAdReward = useAction(api.rewards.claimAdReward);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaimReward = async () => {
    setIsClaiming(true);
    try {
      const result = await claimAdReward();
      if (result.success) {
        Alert.alert("보상 획득!", `코인 ${result.newCoinBalance - (inventory?.coins ?? 0)}개를 받아 총 ${result.newCoinBalance}개가 되었습니다.`);
      }
    } catch (error) {
      console.error("Failed to claim ad reward", error);
      Alert.alert("오류", "보상을 받는 중 문제가 발생했습니다.");
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.coinContainer}>
          <FontAwesome5 name="coins" size={20} color={Colors.accent} />
          <Text style={styles.coinText}>{inventory?.coins ?? '...'}</Text>
        </View>
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
        <Pressable style={[styles.menuButton, styles.adButton]} onPress={handleClaimReward} disabled={isClaiming}>
          {isClaiming ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.menuButtonText}>💎 광고 보고 코인 얻기</Text>
          )}
        </Pressable>
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
    position: 'relative',
    width: '100%',
  },
  coinContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
  },
  coinText: {
    color: Colors.text,
    fontWeight: 'bold',
    marginLeft: Spacing.sm,
    fontSize: 16,
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
  adButton: {
    backgroundColor: '#3498db',
  },
  menuButtonText: {
    ...Typography.button,
    color: Colors.background,
  },
});
