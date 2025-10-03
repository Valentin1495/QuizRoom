import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import Reanimated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing, Typography } from '@/theme/tokens';
import { Feather } from '@expo/vector-icons';
import { Particles } from './Particles';

type Props = {
    visible: boolean;
    stageName: string;
    currentScore: number;
    onNextStage: () => void;
};

const AnimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

export default function StageClearModal({ visible, stageName, currentScore, onNextStage }: Props) {
    const backdropOpacity = useSharedValue(0);
    const scale = useSharedValue(0.8);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            backdropOpacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1, { damping: 15, stiffness: 200 });
            opacity.value = withTiming(1, { duration: 200 });
        } else {
            backdropOpacity.value = withTiming(0, { duration: 300 });
            scale.value = withTiming(0.8, { duration: 200 });
            opacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    if (!visible) {
        return null;
    }

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
            <AnimatedBlurView
                intensity={10}
                tint="dark"
                style={[StyleSheet.absoluteFillObject, animatedBackdropStyle]}
            />
            <View style={styles.container}>
                <Reanimated.View style={[styles.card, animatedCardStyle]}>
                    <Particles count={50} />
                    <Text style={styles.title}>{stageName} 단계 클리어!</Text>
                    <Text style={styles.scoreLabel}>현재 점수</Text>
                    <Text style={styles.scoreValue}>{currentScore}</Text>

                    <Pressable style={styles.nextButton} onPress={onNextStage}>
                        <Text style={styles.nextButtonText}>다음 단계로</Text>
                    </Pressable>
                </Reanimated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    card: {
        backgroundColor: 'rgba(30, 30, 40, 0.8)',
        borderRadius: Radius.xl,
        padding: Spacing.xl,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        ...Typography.h1,
        color: Colors.accent,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    scoreLabel: {
        ...Typography.body,
        color: Colors.subtext,
        fontSize: 18,
    },
    scoreValue: {
        ...Typography.h1,
        color: Colors.text,
        fontSize: 60,
        fontWeight: 'bold',
        marginBottom: Spacing.xl,
    },
    nextButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Radius.lg,
        alignItems: 'center',
    },
    nextButtonText: {
        ...Typography.button,
        color: Colors.text,
    },
});
