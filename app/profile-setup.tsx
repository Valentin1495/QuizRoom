import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { Colors, Spacing, Typography, Radius } from '@/theme/tokens';

export default function ProfileSetupScreen() {
    const router = useRouter();
    const setProfile = useUserStore((s) => s.setProfile);
    const [nickname, setNickname] = useState('');

    const handlePress = () => {
        if (nickname.trim().length > 1) {
            setProfile({ nickname: nickname.trim() });
            router.replace('/(tabs)/home');
        } else {
            // Basic validation feedback
            alert('Please enter a nickname (at least 2 characters).');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>What should we call you?</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter your nickname"
                    placeholderTextColor={Colors.subtext}
                    value={nickname}
                    onChangeText={setNickname}
                    maxLength={15}
                />
            </View>
            <Pressable style={styles.button} onPress={handlePress}>
                <Text style={styles.buttonText}>Start Playing</Text>
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
        gap: Spacing.lg,
    },
    title: {
        ...Typography.h2,
        color: Colors.text,
        textAlign: 'center',
    },
    input: {
        ...Typography.body,
        backgroundColor: Colors.card,
        color: Colors.text,
        padding: Spacing.md,
        borderRadius: Radius.md,
        width: '100%',
        textAlign: 'center',
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
