import { View } from 'react-native';

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 8,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: '#EAEAEA' }} />;
}

export function SkeletonTextLine({ width = '80%' }: { width?: number | string }) {
  return <SkeletonBlock width={width} height={14} radius={6} />;
}
