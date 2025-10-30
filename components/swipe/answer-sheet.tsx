import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Palette, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type Choice = {
  id: string;
  text: string;
};

type ChoiceVariant = 'default' | 'selected' | 'correct' | 'incorrect';

export type AnswerSheetProps = {
  choices: Choice[];
  disabled?: boolean;
  selectedIndex: number | null;
  correctIndex?: number;
  onSelect: (index: number) => void;
};

function AnswerSheetComponent({
  choices,
  disabled = false,
  selectedIndex,
  correctIndex,
  onSelect,
}: AnswerSheetProps) {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const baseColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  const variants = useMemo(() => {
    return choices.map<ChoiceVariant>((_, index) => {
      if (correctIndex != null && index === correctIndex) {
        return 'correct';
      }
      if (selectedIndex === index && correctIndex != null && index !== correctIndex) {
        return 'incorrect';
      }
      if (selectedIndex === index) {
        return 'selected';
      }
      return 'default';
    });
  }, [choices, correctIndex, selectedIndex]);

  return (
    <View style={styles.container}>
      {choices.map((choice, index) => {
        const variant = variants[index];
        const isDisabled = disabled || correctIndex !== undefined;
        const backgroundColor =
          variant === 'correct'
            ? palette.success
            : variant === 'incorrect'
              ? Palette.gray100
              : variant === 'selected'
                ? Palette.gray200
                : baseColor;
        const color =
          variant === 'correct'
            ? '#ffffff'
            : variant === 'incorrect'
              ? Palette.gray950
              : variant === 'selected'
                ? Palette.gray900
                : textColor;

        return (
          <Pressable
            key={choice.id}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedIndex === index }}
            onPress={() => onSelect(index)}
            style={[
              styles.choice,
              {
                backgroundColor,
                borderColor,
                opacity: disabled && variant === 'default' ? 0.6 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.choiceText, { color }]}>{choice.text}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const AnswerSheet = memo(AnswerSheetComponent);

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  choice: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  choiceText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
