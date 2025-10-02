import React from 'react';
import { View, Text, Button, Modal, StyleSheet } from 'react-native';
import { GlassCard } from './glass-card';

type Props = {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DoubleDownModal({ visible, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent>
      <View style={styles.container}>
        <GlassCard>
          <Text style={styles.title}>Double Down?</Text>
          <Text style={styles.description}>
            Correct answer will multiply your score by 1.3x.
            Wrong answer will reduce your score by 0.7x.
          </Text>
          <View style={styles.buttonContainer}>
            <Button title="Confirm" onPress={onConfirm} />
            <Button title="Cancel" onPress={onCancel} color="red" />
          </View>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5F7FF',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#A4A8BA',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
});
