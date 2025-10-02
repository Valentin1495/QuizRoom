import React, { useRef } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

type Props = {
  score: number;
};

export function ShareSticker({ score }: Props) {
  const viewShotRef = useRef<ViewShot>(null);

  const captureAndShare = async () => {
    if (viewShotRef.current && typeof viewShotRef.current.capture === 'function') {
      const uri = await viewShotRef.current.capture();
      if (uri) {
        await Sharing.shareAsync(uri);
      }
    }
  };

  return (
    <View>
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
        <View style={styles.stickerContainer}>
          <Text style={styles.title}>I scored {score} points!</Text>
          {/* TODO: Add badges and emojis */}
        </View>
      </ViewShot>
      <Button title="Share" onPress={captureAndShare} />
    </View>
  );
}

const styles = StyleSheet.create({
  stickerContainer: {
    padding: 20,
    backgroundColor: '#0B0B14', // BG (Dark) from design tokens
    borderRadius: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5F7FF',
  },
});
