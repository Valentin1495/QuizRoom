import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { useSeedUpload } from '@/utils/seed-upload';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export default function GreenfieldHome() {
  const router = useRouter();
  const { upload } = useSeedUpload();
  const resetDailySets = useMutation(api.daily.resetDailySets);
  const ensureTodaySet = useMutation(api.daily.ensureTodaySet);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.light.text }}>
        Greenfield Home
      </Text>
      <Text style={{ marginTop: 8, color: Colors.light.secondary }}>Dark-launch build active</Text>
      <Pressable
        onPress={() => router.push('/(greenfield)/play')}
        style={{
          marginTop: 24,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: Colors.light.tint,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>데일리 시작</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(greenfield)/leaderboard')}
        style={{
          marginTop: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: '#4a5568',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>리더보드</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          try {
            await upload();
            alert('Seed uploaded');
          } catch (e) {
            alert('Seed upload failed');
          }
        }}
        style={{
          marginTop: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: Colors.light.secondary,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>Dev: Seed 업로드</Text>
      </Pressable>
      <Pressable
        onPress={async () => {
          try {
            const r = await resetDailySets({});
            await ensureTodaySet({ locale: 'ko' });
            alert(`DailySets reset (${r.deleted}) and regenerated`);
          } catch (e) {
            alert('Reset failed');
          }
        }}
        style={{
          marginTop: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: '#666',
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>Dev: DailySet 리셋/재생성</Text>
      </Pressable>
    </View>
  );
}
