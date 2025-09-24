import { memo, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Easing,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import Svg, {
    Circle,
    Defs,
    Stop,
    LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type TimerRingProps = {
    progress: number; // 0..1 elapsed
    secondsLeft: number;
    size?: number;
    strokeWidth?: number;
    accentColor?: string;
    trackColor?: string;
    style?: StyleProp<ViewStyle>;
};

export const TimerRing = memo(function TimerRing({
    progress,
    secondsLeft,
    size = 108,
    strokeWidth = 6,
    accentColor = '#8B7DB8',
    trackColor = 'rgba(255,255,255,0.16)',
    style,
}: TimerRingProps) {
    const remaining = useMemo(
        () => Math.max(0, Math.min(1, 1 - progress)),
        [progress]
    );

    const animatedRemaining = useRef(new Animated.Value(remaining)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        Animated.timing(animatedRemaining, {
            toValue: remaining,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [animatedRemaining, remaining]);

    useEffect(() => {
        if (secondsLeft <= 5) {
            pulseLoopRef.current?.stop();
            pulseLoopRef.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 520,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 0,
                        duration: 520,
                        easing: Easing.in(Easing.quad),
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseLoopRef.current.start();
        } else {
            pulseLoopRef.current?.stop();
            pulse.setValue(0);
        }

        return () => {
            pulseLoopRef.current?.stop();
        };
    }, [pulse, secondsLeft]);

    const radius = useMemo(() => size / 2 - strokeWidth / 2, [size, strokeWidth]);
    const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);

    const dashOffset = animatedRemaining.interpolate({
        inputRange: [0, 1],
        outputRange: [circumference, 0],
    });

    const glowScale = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2],
    });
    const glowOpacity = pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.25, 0.6],
    });

    return (
        <View style={[styles.container, style]}>
            <Animated.View
                pointerEvents="none"
                style={[
                    styles.glow,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        transform: [{ scale: glowScale }],
                        opacity: glowOpacity,
                    },
                ]}
            />
            <Svg height={size} width={size} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Defs>
                    <SvgLinearGradient id="timerRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={accentColor} stopOpacity={0.95} />
                        <Stop offset="60%" stopColor="#FF9A9E" stopOpacity={0.95} />
                        <Stop offset="100%" stopColor="#FAD0C4" stopOpacity={0.85} />
                    </SvgLinearGradient>
                </Defs>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="transparent"
                />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#timerRingGradient)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={dashOffset}
                    fill="transparent"
                />
            </Svg>
            <View style={styles.labelWrap} pointerEvents="none">
                <Animated.Text style={styles.secondsText}>{secondsLeft}s</Animated.Text>
                <Animated.Text style={styles.captionText}>남은 시간</Animated.Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        backgroundColor: 'rgba(111, 29, 27, 0.28)',
    },
    labelWrap: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondsText: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: 0.6,
    },
    captionText: {
        marginTop: 2,
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
    },
});

