import { Colors } from '@/constants/Colors';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <View style={styles.container}></View>;
  if (isSignedIn) return <Redirect href='/(tabs)' />;
  return <Redirect href='/(auth)/welcome-screen' />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
});
