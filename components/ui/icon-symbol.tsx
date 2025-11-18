// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'lock': 'lock',
  'hourglass': 'hourglass-top',
  'party.popper': 'celebration',
  // Navigation Icons
  'arrow.left': 'arrow-back',
  'arrow.right': 'arrow-forward',
  // Theme Icons
  'sun.max.fill': 'light-mode',
  'moon.fill': 'dark-mode',
  // Feedback Icons
  'checkmark.circle.fill': 'check-circle',
  'xmark.circle.fill': 'cancel',
  'exclamationmark.triangle.fill': 'warning',
  'face.frown': 'sentiment-dissatisfied',
  'crown.fill': 'workspace-premium',
  'arrow.triangle.2.circlepath': 'sync',
  'pause.circle.fill': 'pause-circle',
  'checkmark.shield': 'how-to-reg',
  // Tab Bar Icons
  'sparkles': 'auto-awesome',
  'square.stack.3d.up.fill': 'layers',
  'person.3.fill': 'people',
  'person.crop.circle': 'account-circle',
  // Category Icons
  'music.note': 'music-note',
  'tv': 'tv',
  'film': 'movie',
  'trophy.fill': 'emoji-events',
  'trophy': 'emoji-events',
  'desktopcomputer': 'desktop-mac',
  'bag': 'shopping-bag',
  'newspaper': 'newspaper',
  'lightbulb': 'lightbulb',
  // Deck Icons
  'paintpalette': 'palette',
  'brain.head.profile': 'psychology',
  'mic': 'theater-comedy',
  'die.face.5': 'casino',
  'flame': 'trending-up',
  'star': 'star',
  'questionmark.square': 'quiz',
  // Onboarding Icons
  'hand.draw.fill': 'swipe',
  'checkmark.seal.fill': 'verified',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * A list of SF Symbols that appear visually smaller as Material Icons
 * and require a size adjustment on Android/web to match their iOS appearance.
 */
const SIZE_ADJUSTMENT_LIST: IconSymbolName[] = ['arrow.left', 'arrow.right', 'sun.max.fill', 'moon.fill'];

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Some icons like chevrons need to be larger on Android/web to visually match iOS.
  const adjustedSize = SIZE_ADJUSTMENT_LIST.includes(name) ? size + 4 : size;
  return <MaterialIcons color={color} size={adjustedSize} name={MAPPING[name]} style={style} />;
}