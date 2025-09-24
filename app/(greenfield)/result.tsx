import { Colors } from '@/constants/Colors';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as RNShare from 'react-native';
import { Pressable, Text, View } from 'react-native';

export default function ResultScreen() {
  const router = useRouter();
  const { score } = useLocalSearchParams<{ score?: string }>();

  async function handleShare() {
    try {
      // Use native share sheet
      // @ts-expect-error Share exists on react-native default export
      await RNShare.Share.share({ message: `내 점수: ${score ?? '0'}점! #QZY` });
    } catch {}
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Stack.Screen options={{ headerShown: true, title: '결과' }} />
      <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.light.text }}>점수</Text>
      <Text style={{ fontSize: 40, fontWeight: '900', marginTop: 8 }}>{score ?? '0'}</Text>
      <Pressable
        onPress={handleShare}
        style={{
          marginTop: 16,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: Colors.light.secondary,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>공유</Text>
      </Pressable>
      <Pressable
        onPress={() => router.replace('/(greenfield)')}
        style={{
          marginTop: 12,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: Colors.light.tint,
        }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>홈으로</Text>
      </Pressable>
    </View>
  );
}
