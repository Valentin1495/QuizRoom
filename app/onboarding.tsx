import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/use-auth';
import { Colors, Spacing, Typography } from '@/theme/tokens';

const GUEST_ID_KEY = 'guestId';

export default function OnboardingScreen() {
    const router = useRouter();
    const { finishOnboarding, setGuestId } = useUserStore((s) => ({
        finishOnboarding: s.finishOnboarding,
        setGuestId: s.setGuestId,
    }));
    const { handleGoogleButtonPress, isSigningIn } = useAuth();

    const handleGuestPress = async () => {
        try {
            let guestId = await SecureStore.getItemAsync(GUEST_ID_KEY);
            if (!guestId) {
                guestId = Crypto.randomUUID();
                await SecureStore.setItemAsync(GUEST_ID_KEY, guestId);
            }
            setGuestId(guestId);
            finishOnboarding();
            router.replace('/(tabs)/home');
        } catch (error) {
            console.error('Failed to set up guest mode:', error);
            // Handle error appropriately
        }
    };

    const handleGooglePress = async () => {
        try {
            await handleGoogleButtonPress();
            // On success, the user state change will be caught by the root layout
            // and automatically navigate to the home screen.
            finishOnboarding();
        } catch (error) {
            // Handle error (e.g., user cancels sign-in)
            console.log('Google Sign-in was cancelled or failed.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Welcome to QZY!</Text>
                <Text style={styles.subtitle}>
                    Challenge your knowledge, climb the leaderboards, and have fun.
                </Text>
            </View>
            <View style={styles.buttonContainer}>
                <Pressable
                    style={[styles.button, styles.googleButton]}
                    onPress={handleGooglePress}
                    disabled={isSigningIn}
                >
                    {isSigningIn ? (
                        <ActivityIndicator color={Colors.text} />
                    ) : (
                        <Text style={styles.buttonText}>Sign in with Google</Text>
                    )}
                </Pressable>
                <Pressable
                    style={[styles.button, styles.guestButton]}
                    onPress={handleGuestPress}
                    disabled={isSigningIn}
                >
                    <Text style={styles.buttonText}>Continue as Guest</Text>
                </Pressable>
            </View>
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
    buttonContainer: {
        gap: Spacing.md,
    },
    button: {
        padding: Spacing.md,
        borderRadius: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
    },
    googleButton: {
        backgroundColor: '#4285F4', // Google's brand color
    },
    guestButton: {
        backgroundColor: Colors.primary,
    },
    buttonText: {
        ...Typography.button,
        color: Colors.text,
    },
});
