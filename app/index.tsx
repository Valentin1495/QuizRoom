import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/theme/tokens';

/**
 * This component is the default entry point of the app.
 * It just shows a loading indicator. The actual routing is handled
 * by the root layout component `app/_layout.tsx`.
 */
export default function AppEntry() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
      }}
    >
      <ActivityIndicator color={Colors.accent} size="large" />
    </View>
  );
}
