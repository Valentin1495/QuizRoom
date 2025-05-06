import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';

interface GradientTextProps {
  text: string;
  style?: any;
}

export default function GradientText({ text, style }: GradientTextProps) {
  return (
    <MaskedView
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]}>{text}</Text>
      }
    >
      <LinearGradient
        colors={['#ec4899', '#a855f7', '#6366f1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
