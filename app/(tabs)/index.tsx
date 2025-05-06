import Category from '@/components/category';
import { Colors } from '@/constants/Colors';
import { api } from '@/convex/_generated/api';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const currentUser = useQuery(api.users.getCurrentUserByClerkId);
  const categories = useQuery(api.categories.getCategories);

  if (!currentUser) return null;
  const { fullName, coins } = currentUser;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>안녕, {fullName}!</Text>

        <View style={styles.coinContainer}>
          <Text style={styles.coinText}>{coins}</Text>
          <View style={styles.coinImageContainer}>
            <Image
              source={require('@/assets/images/coins5.png')}
              style={{ width: 24, height: 24 }}
            />
          </View>
        </View>
      </View>

      <Text style={styles.question}>오늘은 어떤 퀴즈를 풀어볼까요?</Text>

      <View>
        {categories?.map((category) => (
          <Category
            key={category._id}
            id={category._id}
            en={category.engName}
            kr={category.korName}
            icon={category.iconName}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingVertical: 52,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: Colors.light.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  coinContainer: {
    width: 68,
    height: 34,
    backgroundColor: Colors.light.tint,
    borderRadius: 200,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  coinText: {
    fontWeight: '700',
    fontSize: 12,
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  coinImageContainer: {
    width: 30,
    height: 30,
    borderRadius: 200,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  question: {
    fontWeight: '600',
    fontSize: 22,
    lineHeight: 30,
    color: Colors.light.primary,
    marginVertical: 24,
  },
});
