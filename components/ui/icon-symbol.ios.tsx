import { SymbolView, SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

import type { IconSymbolName } from './icon-symbol';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const tintColor = typeof color === 'string' ? color : undefined;
  return (
    <SymbolView
      weight={weight}
      tintColor={tintColor}
      resizeMode="scaleAspectFit"
      name={name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
