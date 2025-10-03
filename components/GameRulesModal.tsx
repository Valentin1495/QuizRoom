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

type Props = {
    visible: boolean;
    onClose: () => void;
    onStart: () => void;
};

const AnimatedBlurView = Reanimated.createAnimatedComponent(BlurView);

export default function GameRulesModal({ visible, onClose, onStart }: Props) {
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
        <View style={StyleSheet.absoluteFillObject}>
            <AnimatedBlurView
                intensity={10}
                tint="dark"
                style={[StyleSheet.absoluteFillObject, animatedBackdropStyle]}
            />
            <View style={styles.container}>
                <Reanimated.View style={[styles.card, animatedCardStyle]}>
                    <Pressable style={styles.closeButton} onPress={onClose}>
                        <Feather name="x" size={24} color={Colors.subtext} />
                    </Pressable>
                    <Text style={styles.title}>규칙!</Text>
                    <View style={styles.ruleContainer}>
                        <Text style={styles.ruleText}>퀴즈는 여러 난이도 단계로 구성됩니다 🪜</Text>
                        <Text style={styles.ruleText}>각 단계의 문제를 모두 정답이면 다음 단계로 넘어가요 ✅</Text>
                        <Text style={styles.ruleText}>하나라도 틀리면 즉시 종료됩니다 ❌</Text>
                    </View>

                    <Text style={styles.levelTitle}>난이도 레벨</Text>
                    <Text style={styles.levelText}>
                        유치원 → 초등학교 저학년 → 초등학교 고학년 → 중학교 → 고등학교 → 대학교
                    </Text>

                    <Pressable style={styles.startButton} onPress={onStart}>
                        <Text style={styles.startButtonText}>도전하기!</Text>
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
        padding: Spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    closeButton: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        zIndex: 1,
    },
    title: {
        ...Typography.h1,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    ruleContainer: {
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
    },
    ruleText: {
        ...Typography.body,
        color: Colors.subtext,
        fontSize: 16,
        textAlign: 'center',
    },
    levelTitle: {
        ...Typography.h2,
        fontSize: 20,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    levelText: {
        ...Typography.body,
        color: Colors.accent,
        textAlign: 'center',
        marginBottom: Spacing.xl,
        fontSize: 14,
        fontWeight: '600',
    },
    startButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: Radius.lg,
        alignItems: 'center',
    },
    startButtonText: {
        ...Typography.button,
        color: Colors.text,
    },
});
