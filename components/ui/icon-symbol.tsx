// Fallback for using Phosphor Icons on Android and web.

import { SymbolWeight } from 'expo-symbols';
import type { Icon, IconWeight } from 'phosphor-react-native';
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowsLeftRightIcon,
  ArrowUpRightIcon,
  BrainIcon,
  BroadcastIcon,
  CardsThreeIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ConfettiIcon,
  CopyIcon,
  CrownIcon,
  DesktopIcon,
  DiceFiveIcon,
  FilmSlateIcon,
  FlagIcon,
  FlameIcon,
  HandSwipeLeftIcon,
  HandSwipeRightIcon,
  HourglassMediumIcon,
  HouseLineIcon,
  LightbulbIcon,
  LockIcon,
  MicrophoneStageIcon,
  MoonIcon,
  MusicNoteIcon,
  NewspaperIcon,
  PaletteIcon,
  PasswordIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  RankingIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  ShootingStarIcon,
  ShoppingBagOpenIcon,
  ShuffleIcon,
  SkipForwardIcon,
  SmileySadIcon,
  SparkleIcon,
  SquaresFourIcon,
  StackIcon,
  StarIcon,
  SunIcon,
  TelevisionIcon,
  TrophyIcon,
  UserCircleIcon,
  UserIcon,
  UsersThreeIcon,
  WarningIcon,
  XCircleIcon
} from 'phosphor-react-native';
import { OpaqueColorValue, type StyleProp, type ViewStyle } from 'react-native';

type IconMapping = {
  component: Icon;
  defaultWeight?: IconWeight;
};

/**
 * Add your SF Symbols to Phosphor Icons mappings here.
 * - see Phosphor icons at https://phosphoricons.com
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const ICON_MAP = {
  'lock': { component: LockIcon },
  'hourglass': { component: HourglassMediumIcon, defaultWeight: 'fill' },
  'party.popper': { component: ConfettiIcon },
  'rectangle.grid.2x2': { component: SquaresFourIcon },
  'sparkles': { component: SparkleIcon },
  'arrow.2.squarepath': { component: ArrowsLeftRightIcon },
  'rectangle.stack': { component: CardsThreeIcon },
  'numbers.rectangle': { component: PasswordIcon },
  'document.on.document': { component: CopyIcon },
  'person': { component: UserIcon },
  'medal': { component: RankingIcon },
  'dot.radiowaves.left.and.right': { component: BroadcastIcon },
  // Navigation Icons
  'arrow.left': { component: ArrowLeftIcon },
  'arrow.up.forward': { component: ArrowUpRightIcon },
  'chevron.right': { component: CaretRightIcon },
  'forward.end': { component: SkipForwardIcon },
  'flag': { component: FlagIcon },
  // Theme Icons
  'sun.max': { component: SunIcon },
  'moon': { component: MoonIcon },
  // Feedback Icons
  'checkmark.circle.fill': { component: CheckCircleIcon, defaultWeight: 'fill' },
  'xmark.circle.fill': { component: XCircleIcon, defaultWeight: 'fill' },
  'exclamationmark.triangle.fill': { component: WarningIcon, defaultWeight: 'fill' },
  'face.frown': { component: SmileySadIcon },
  'crown.fill': { component: CrownIcon, defaultWeight: 'fill' },
  'arrow.triangle.2.circlepath': { component: ArrowClockwiseIcon },
  'pause.circle.fill': { component: PauseCircleIcon, defaultWeight: 'fill' },
  'play.circle.fill': { component: PlayCircleIcon, defaultWeight: 'fill' },
  'checkmark.shield': { component: ShieldCheckIcon },
  // Tab Bar Icons
  'house': { component: HouseLineIcon },
  'house.fill': { component: HouseLineIcon, defaultWeight: 'fill' },
  'square.stack.3d.up': { component: StackIcon },
  'square.stack.3d.up.fill': { component: StackIcon, defaultWeight: 'fill' },
  'person.3': { component: UsersThreeIcon },
  'person.3.fill': { component: UsersThreeIcon, defaultWeight: 'fill' },
  'person.crop.circle': { component: UserCircleIcon },
  'person.crop.circle.fill': { component: UserCircleIcon, defaultWeight: 'fill' },
  // Category Icons
  'music.note': { component: MusicNoteIcon },
  'tv': { component: TelevisionIcon },
  'film': { component: FilmSlateIcon },
  'trophy': { component: TrophyIcon },
  'desktopcomputer': { component: DesktopIcon },
  'bag': { component: ShoppingBagOpenIcon },
  'newspaper': { component: NewspaperIcon },
  'lightbulb': { component: LightbulbIcon },
  // Deck Icons
  'paintpalette': { component: PaletteIcon },
  'brain.head.profile': { component: BrainIcon },
  'music.microphone': { component: MicrophoneStageIcon },
  'die.face.5': { component: DiceFiveIcon },
  'flame': { component: FlameIcon },
  'flame.fill': { component: FlameIcon, defaultWeight: 'fill' },
  'star': { component: StarIcon },
  'shuffle': { component: ShuffleIcon },
  // Onboarding Icons
  'hand.point.right': { component: HandSwipeRightIcon },
  'hand.point.left': { component: HandSwipeLeftIcon },
  'checkmark.seal': { component: SealCheckIcon },
  'star.circle': { component: ShootingStarIcon },
} as const satisfies Record<string, IconMapping>;

export type IconSymbolName = keyof typeof ICON_MAP;

/**
 * A list of SF Symbols that appear visually smaller as Phosphor Icons
 * and require a size adjustment on Android/web to match their iOS appearance.
 */
const SIZE_ADJUSTMENT_LIST: IconSymbolName[] = [
  'arrow.left',
  'arrow.up.forward',
  'chevron.right',
  'sun.max',
  'moon',
];

const SYMBOL_WEIGHT_TO_ICON_WEIGHT: Partial<Record<SymbolWeight, IconWeight>> = {
  ultraLight: 'thin',
  thin: 'thin',
  light: 'light',
  regular: 'regular',
  medium: 'regular',
  semibold: 'bold',
  bold: 'bold',
  heavy: 'bold',
  black: 'bold',
};

const mapSymbolWeightToIconWeight = (weight?: SymbolWeight): IconWeight | undefined => {
  if (!weight || weight === 'unspecified') {
    return undefined;
  }
  return SYMBOL_WEIGHT_TO_ICON_WEIGHT[weight];
};

/**
 * An icon component that uses native SF Symbols on iOS, and Phosphor Icons on Android/web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Phosphor.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const iconEntry: IconMapping = ICON_MAP[name];
  const IconComponent = iconEntry.component;
  // Some icons like chevrons need to be larger on Android/web to visually match iOS.
  const adjustedSize = SIZE_ADJUSTMENT_LIST.includes(name) ? size + 4 : size;
  const resolvedWeight = mapSymbolWeightToIconWeight(weight) ?? iconEntry.defaultWeight ?? 'regular';
  const tintColor = typeof color === 'string' ? color : undefined;
  return <IconComponent color={tintColor} size={adjustedSize} style={style} weight={resolvedWeight} />;
}
