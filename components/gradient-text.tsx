import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';

interface GradientTextProps {
  text: string;
  style?: any;
  colors?: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export default function GradientText({
  text,
  style,
  colors = ['#ec4899', '#a855f7', '#6366f1'],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
}: GradientTextProps) {
  return (
    <MaskedView
      maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{text}</Text>}
    >
      <LinearGradient
        colors={colors as string[]}
        start={start}
        end={end}
      >
        <Text style={[style, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
