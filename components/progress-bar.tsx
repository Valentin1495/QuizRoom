import { View } from 'react-native';

type Props = {
  value: number; // 0..1
  height?: number;
  trackColor?: string;
  fillColor?: string;
};

export default function ProgressBar({
  value,
  height = 8,
  trackColor = '#eee',
  fillColor = '#6f1d1b',
}: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={{
        width: '100%',
        height,
        backgroundColor: trackColor,
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: `${clamped * 100}%`, height: '100%', backgroundColor: fillColor }} />
    </View>
  );
}
