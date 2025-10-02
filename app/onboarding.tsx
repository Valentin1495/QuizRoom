import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { Colors, Spacing, Typography } from '@/theme/tokens';

export default function OnboardingScreen() {
    const router = useRouter();
    const finishOnboarding = useUserStore((s) => s.finishOnboarding);

    const handlePress = () => {
        finishOnboarding();
        router.replace('/profile-setup');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome to QZY!</Text>
                <Text style={styles.subtitle}>
                    Challenge your knowledge, climb the leaderboards, and have fun.
                </Text>
            </View>
            <Pressable style={styles.button} onPress={handlePress}>
                <Text style={styles.buttonText}>Get Started</Text>
            </Pressable>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    title: {
        ...Typography.h1,
        color: Colors.text,
        textAlign: 'center',
    },
    subtitle: {
        ...Typography.body,
        color: Colors.subtext,
        textAlign: 'center',
        maxWidth: '80%',
    },
    button: {
        backgroundColor: Colors.primary,
        padding: Spacing.md,
        borderRadius: Spacing.md,
        alignItems: 'center',
    },
    buttonText: {
        ...Typography.button,
        color: Colors.text,
    },
});
