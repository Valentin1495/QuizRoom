import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { errorHaptic, lightHaptic, successHaptic } from '@/lib/haptics';

type ColorMode = 'light' | 'dark';

type Choice = {
  id: string;
  text: string;
};

type ChoiceVariant = 'default' | 'selected' | 'correct' | 'incorrect' | 'dim';

type ChoiceVisual = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  iconName?: IconSymbolName;
  gradientColors?: [string, string];
  dimOpacity: number;
};

type ChoiceDefaults = {
  baseColor: string;
  borderColor: string;
  textColor: string;
};

const getChoiceVisual = (
  mode: ColorMode,
  variant: ChoiceVariant,
  defaults: ChoiceDefaults
): ChoiceVisual => {
  const isDark = mode === 'dark';

  switch (variant) {
    case 'correct':
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        textColor: '#FFFFFF',
        gradientColors: ['#2D9CDB', '#56CCF2'],
        iconName: 'checkmark.circle.fill',
        dimOpacity: 1,
      };
    case 'incorrect':
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        textColor: '#FFFFFF',
        gradientColors: ['#EB5757', '#FF7676'],
        iconName: 'xmark.circle.fill',
        dimOpacity: 1,
      };
    case 'selected':
      return {
        backgroundColor: isDark ? Palette.gray700 : Palette.gray200,
        borderColor: isDark ? Palette.gray500 : Palette.gray400,
        textColor: isDark ? Palette.gray25 : Palette.gray950,
        dimOpacity: 1,
      };
    case 'dim':
      return {
        backgroundColor: Palette.gray100,
        borderColor: Palette.gray200,
        textColor: Palette.gray500,
        dimOpacity: 0.6,
      };
    default:
      return {
        backgroundColor: defaults.baseColor,
        borderColor: defaults.borderColor,
        textColor: defaults.textColor,
        dimOpacity: 1,
      };
  }
};

export type AnswerSheetProps = {
  choices: Choice[];
  disabled?: boolean;
  selectedIndex: number | null;
  correctIndex?: number;
  onSelect: (index: number) => void;
};

type ChoiceButtonProps = {
  choice: Choice;
  variant: ChoiceVariant;
  onPress: () => void;
  disabled: boolean;
  isRevealed: boolean;
  mode: ColorMode;
  defaults: ChoiceDefaults;
};

function ChoiceButton({ choice, variant, onPress, disabled, isRevealed, mode, defaults }: ChoiceButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const visual = useMemo(() => getChoiceVisual(mode, variant, defaults), [mode, variant, defaults]);

  useEffect(() => {
    const targetScale = variant === 'correct' ? 1.05 : variant === 'selected' && !isRevealed ? 1.03 : 1;
    Animated.spring(scale, {
      toValue: targetScale,
      stiffness: 260,
      damping: 22,
      useNativeDriver: true,
    }).start();
  }, [variant, isRevealed, scale]);

  useEffect(() => {
    if (variant === 'incorrect') {
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: -6,
          duration: 45,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 6,
          duration: 90,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -3,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 70,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateX.setValue(0);
    }
  }, [variant, translateX]);

  const handlePressIn = useCallback(() => {
    if (disabled || isRevealed) return;
    lightHaptic();
    Animated.spring(scale, {
      toValue: 1.04,
      stiffness: 320,
      damping: 20,
      useNativeDriver: true,
    }).start();
  }, [disabled, isRevealed, scale]);

  const handlePressOut = useCallback(() => {
    if (disabled || isRevealed) return;
    const target = variant === 'selected' ? 1.03 : 1;
    Animated.spring(scale, {
      toValue: target,
      stiffness: 300,
      damping: 24,
      useNativeDriver: true,
    }).start();
  }, [disabled, isRevealed, variant, scale]);

  const content = (
    <View style={styles.choiceContent}>
      {visual.iconName ? (
        <IconSymbol name={visual.iconName} size={20} color={visual.textColor} />
      ) : null}
      <ThemedText
        style={styles.choiceText}
        lightColor={visual.textColor}
        darkColor={visual.textColor}
      >
        {choice.text}
      </ThemedText>
    </View>
  );

  const animatedStyle = {
    transform: [{ translateX }, { scale }],
  };

  const shadowStyle =
    variant === 'correct'
      ? styles.choiceGlowSuccess
      : variant === 'incorrect'
        ? styles.choiceGlowError
        : variant === 'dim'
          ? null
          : styles.choiceShadow;

  const wrapperStyles = [
    styles.choiceWrapper,
    shadowStyle,
    { borderColor: visual.borderColor },
    visual.gradientColors ? { backgroundColor: 'transparent' } : { backgroundColor: visual.backgroundColor },
    animatedStyle,
  ];

  return (
    <Animated.View style={wrapperStyles}>
      <Pressable
        disabled={disabled || isRevealed}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.choicePressable,
          pressed && !(disabled || isRevealed) ? styles.choicePressed : null,
        ]}
      >
        {visual.gradientColors ? (
          <LinearGradient
            colors={visual.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.choiceInner, { opacity: visual.dimOpacity }]}
          >
            {content}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.choiceInner,
              { backgroundColor: visual.backgroundColor, opacity: visual.dimOpacity },
            ]}
          >
            {content}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function AnswerSheetComponent({
  choices,
  disabled = false,
  selectedIndex,
  correctIndex,
  onSelect,
}: AnswerSheetProps) {
  const colorScheme = useColorScheme();
  const normalizedScheme = (colorScheme ?? 'light') as ColorMode;
  const baseColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  const defaults = useMemo(
    () => ({ baseColor, borderColor, textColor }),
    [baseColor, borderColor, textColor]
  );

  const variants = useMemo(() => {
    return choices.map<ChoiceVariant>((_, index) => {
      if (correctIndex != null) {
        if (index === correctIndex) {
          return 'correct';
        }
        if (selectedIndex === index) {
          return 'incorrect';
        }
        return 'dim';
      }
      if (selectedIndex === index) {
        return 'selected';
      }
      return 'default';
    });
  }, [choices, correctIndex, selectedIndex]);

  const isRevealed = correctIndex != null;
  const isChoiceDisabled = disabled || isRevealed;

  const handleSelect = useCallback(
    (index: number) => {
      if (isChoiceDisabled) {
        return;
      }
      onSelect(index);
    },
    [isChoiceDisabled, onSelect]
  );

  const revealedRef = useRef<number | null>(null);
  useEffect(() => {
    if (correctIndex == null) {
      revealedRef.current = null;
      return;
    }
    if (revealedRef.current !== correctIndex && selectedIndex != null) {
      if (selectedIndex === correctIndex) {
        successHaptic();
      } else {
        errorHaptic();
      }
    }
    revealedRef.current = correctIndex;
  }, [correctIndex, selectedIndex]);

  return (
    <View style={styles.container}>
      {choices.map((choice, index) => (
        <ChoiceButton
          key={choice.id}
          choice={choice}
          variant={variants[index]}
          onPress={() => handleSelect(index)}
          disabled={isChoiceDisabled}
          isRevealed={isRevealed}
          mode={normalizedScheme}
          defaults={defaults}
        />
      ))}
    </View>
  );
}

export const AnswerSheet = memo(AnswerSheetComponent);

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  choiceWrapper: {
    borderRadius: Radius.md,
    borderWidth: 1,
    width: '100%',
    overflow: 'visible',
  },
  choicePressable: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  choicePressed: {
    opacity: 0.92,
  },
  choiceInner: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  choiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  choiceText: {
    fontWeight: '600',
    fontSize: 16,
    flexShrink: 1,
  },
  choiceShadow: {
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowOpacity: 1,
    elevation: 3,
  },
  choiceGlowSuccess: {
    shadowColor: '#56CCF2',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    shadowOpacity: 0.45,
    elevation: 8,
  },
  choiceGlowError: {
    shadowColor: '#FF7676',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    shadowOpacity: 0.4,
    elevation: 6,
  },
});
