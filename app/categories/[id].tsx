import { Colors } from '@/constants/Colors';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <Text>{id}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
