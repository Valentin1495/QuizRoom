import { Colors } from '@/constants/Colors';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  return <View style={styles.container}></View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
