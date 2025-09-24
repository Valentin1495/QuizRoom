import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
    StyleProp,
    StyleSheet,
    View,
    ViewProps,
    ViewStyle,
} from 'react-native';

type GlassCardProps = ViewProps & {
    children: ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    gradientColors?: readonly string[];
    blurIntensity?: number;
};

export function GlassCard({
    children,
    style,
    contentStyle,
    gradientColors = ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)'],
    blurIntensity = 45,
    ...rest
}: GlassCardProps) {
    return (
        <View style={[styles.container, style]} {...rest}>
            <LinearGradient
                colors={gradientColors as string[]}
                start={{ x: 0.05, y: 0.05 }}
                end={{ x: 0.95, y: 0.95 }}
                style={StyleSheet.absoluteFillObject}
            />
            <BlurView
                intensity={blurIntensity}
                tint="light"
                style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.inner, contentStyle]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(12, 8, 24, 0.35)',
    },
    inner: {
        padding: 20,
    },
});

