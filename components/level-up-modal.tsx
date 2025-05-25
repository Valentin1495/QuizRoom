import { Dimensions, Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export function LevelUpModal({
  visible,
  level,
}: {
  visible: boolean;
  level: number;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View entering={BounceIn} style={styles.modal}>
          <Text style={styles.levelUpText}>🎉 레벨 업!</Text>
          <Text style={styles.levelText}>Lv.{level}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
  },
  modal: {
    width: 250,
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
  levelUpText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  levelText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
});
