import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Colors, Spacing, Typography, Radius } from '@/theme/tokens';

export default function ProfileSetupScreen() {
    const router = useRouter();
    const user = useQuery(api.users.getUser);
    const updateProfile = useMutation(api.users.updateProfile);

    const [nickname, setNickname] = useState('');
    const [avatar, setAvatar] = useState('');

    useEffect(() => {
        if (user) {
            setNickname(user.nickname);
            setAvatar(user.avatar);
        }
    }, [user]);

    const handleSave = async () => {
        if (nickname.trim().length < 2) {
            Alert.alert('Error', 'Nickname must be at least 2 characters long.');
            return;
        }

        try {
            await updateProfile({ nickname: nickname.trim(), avatar });
            router.replace('/(tabs)/home');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to update profile. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Set up your Profile</Text>
                {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : null}

                <TextInput
                    style={styles.input}
                    placeholder="Enter your nickname"
                    placeholderTextColor={Colors.subtext}
                    value={nickname}
                    onChangeText={setNickname}
                    maxLength={20}
                />
                {/* Avatar URL can be edited too if desired */}
                {/* <TextInput
                    style={styles.input}
                    placeholder="Avatar URL"
                    placeholderTextColor={Colors.subtext}
                    value={avatar}
                    onChangeText={setAvatar}
                /> */}
            </View>
            <Pressable style={styles.button} onPress={handleSave}>
                <Text style={styles.buttonText}>Save & Start Playing</Text>
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
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: Colors.primary,
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
