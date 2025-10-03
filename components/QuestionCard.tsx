import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';
import { Question } from '@/types/question';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

type Props = {
  question: Question;
  onSelect: (choiceIndex: number) => void;
  onContinue: () => void;
  selectedIndex?: number | null;
  isCorrect?: boolean | null;
  removedChoices?: number[];
};

export default function QuestionCard({
  question,
  onSelect,
  onContinue,
  selectedIndex,
  isCorrect,
  removedChoices = [],
}: Props) {
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    // When the answer is revealed, show the explanation
    if (isCorrect !== null) {
      setShowExplanation(true);
    }
  }, [isCorrect]);

  // Reset explanation visibility when the question changes
  useEffect(() => {
    setShowExplanation(false);
  }, [question.id]);

  const getButtonState = (index: number) => {
    if (selectedIndex === null || selectedIndex === undefined) return 'default';
    if (index === question.answerIndex) return 'correct';
    if (index === selectedIndex) return 'incorrect';
    return 'disabled';
  };

  return (
    <BlurView intensity={50} tint="dark" style={styles.card}>
      <Text style={styles.stem}>{question.stem}</Text>
      <View style={styles.choicesContainer}>
        {question.choices.map((choice, index) => {
          const state = getButtonState(index);
          const isRemoved = removedChoices.includes(index);
          return (
            <Pressable
              key={index}
              style={[
                styles.choiceButton,
                state === 'correct' && styles.correct,
                state === 'incorrect' && styles.incorrect,
                state === 'disabled' && styles.disabled,
                isRemoved && styles.removedChoice,
              ]}
              onPress={() => onSelect(index)}
              disabled={selectedIndex !== null && selectedIndex !== undefined || isRemoved}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </Pressable>
          );
        })}
      </View>
      {showExplanation && (
        <Reanimated.View entering={FadeIn.delay(300).duration(500)}>
          {question.explanation && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationTitle}>해설</Text>
              <Text style={styles.explanationText}>{question.explanation}</Text>
            </View>
          )}
          <Pressable style={styles.continueButton} onPress={onContinue}>
            <Text style={styles.continueButtonText}>계속하기</Text>
          </Pressable>
        </Reanimated.View>
      )}
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
  removedChoice: {
    opacity: 0.7,
    textDecorationLine: 'line-through',
  },
  explanationContainer: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  explanationTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.accent,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  explanationText: {
    ...Typography.body,
    color: Colors.subtext,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  continueButtonText: {
    ...Typography.button,
    color: Colors.text,
  },
});