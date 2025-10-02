import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';
import { Question } from '@/types/question';

type Props = {
  question: Question;
  onSelect: (choiceIndex: number) => void;
  selectedIndex?: number | null;
  correctIndex?: number | null;
};

export default function QuestionCard({ question, onSelect, selectedIndex, correctIndex }: Props) {
  const getButtonState = (index: number) => {
    if (selectedIndex === null || selectedIndex === undefined) return 'default';
    if (index === correctIndex) return 'correct';
    if (index === selectedIndex) return 'incorrect';
    return 'disabled';
  };

  return (
    <BlurView intensity={50} tint="dark" style={styles.card}>
      <Text style={styles.stem}>{question.stem}</Text>
      <View style={styles.choicesContainer}>
        {question.choices.map((choice, index) => {
          const state = getButtonState(index);
          return (
            <Pressable
              key={index}
              style={[
                styles.choiceButton,
                state === 'correct' && styles.correct,
                state === 'incorrect' && styles.incorrect,
                state === 'disabled' && styles.disabled,
              ]}
              onPress={() => onSelect(index)}
              disabled={selectedIndex !== null && selectedIndex !== undefined}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stem: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  choicesContainer: {
    gap: Spacing.sm,
  },
  choiceButton: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  choiceText: {
    ...Typography.body,
    color: Colors.text,
    textAlign: 'center',
  },
  correct: {
    backgroundColor: Colors.accent,
  },
  incorrect: {
    backgroundColor: '#FF6B6B', // 임시 색상
  },
  disabled: {
    opacity: 0.5,
  },
});