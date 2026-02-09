// components/ui/Avatar.tsx
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildGuestAvatarUrl } from '@/lib/guest';
import { Colors, Palette, Radius } from '../../constants/theme';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

type AvatarProps = {
    uri?: string | null;
    name?: string | null;
    guestId?: number | null;
    live?: boolean;
    size?: Size;
    radius?: number;
    onPress?: () => void;
    accessibilityLabel?: string;
    backgroundColorOverride?: string;
    style?: StyleProp<ViewStyle>;
    textStyle?: TextStyle;
};

type GuestAvatarProps = Omit<AvatarProps, 'name' | 'uri' | 'guestId'> & {
    seed?: string | null;
};

const SIZE: Record<Size, number> = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };

function initials(name?: string | null) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || '';
}

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }

function hashIndex(seed: string, mod: number) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(h) % mod;
}

function readableTextColor(bgHex: string) {
    const hex = bgHex.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    return L > 0.55 ? Palette.gray950 : Palette.white;
}

export function Avatar({
    uri,
    name,
    guestId,
    live,
    size = 'md',
    radius = Radius.pill,
    onPress,
    accessibilityLabel,
    backgroundColorOverride,
    style,
    textStyle,
}: AvatarProps) {
    const scheme = useColorScheme() ?? 'light';
    const c = Colors[scheme];

    // 게스트/이니셜 라벨
    const label = useMemo(() => {
        if (guestId != null) return `G${pad2(guestId % 100)}`;
        if (name === null) return `G${pad2(0)}`;
        return initials(name) || 'Q';
    }, [guestId, name]);

    // 카드 배경(c.secondary)과 명도차가 충분한 파스텔 색상 위주로 구성
    const fallbackPalette = [
        '#D7F5E5', // mint
        '#D0CFFF', // lavender
        '#FFE3D4', // peach
        '#FDE2F2', // pink
        '#C8E6C9', // green
        '#B3E5FC', // blue
        '#FFECB3', // yellow
        '#FFD180', // orange
    ];

    const bg = useMemo(() => {
        if (backgroundColorOverride) return backgroundColorOverride;
        const seed = guestId != null ? `guest-${guestId}` : (name ?? 'anon');
        return fallbackPalette[hashIndex(seed, fallbackPalette.length)];
    }, [backgroundColorOverride, guestId, name, fallbackPalette]);

    const px = SIZE[size];
    const fontSize = Math.round(px * 0.42);

    const base: ViewStyle = {
        width: px,
        height: px,
        borderRadius: radius,
        backgroundColor: uri ? c.card : bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderColor: c.border,
        borderWidth: 1,
    };

    const labelStyle: TextStyle = {
        color: uri ? c.text : readableTextColor(bg),
        fontSize,
        fontWeight: '700',
    };

    const LiveBadge = live ? (
        <View
            style={{
                position: 'absolute',
                right: -2,
                top: -2,
                backgroundColor: c.primary,
                paddingHorizontal: Math.max(4, Math.round(px * 0.12)),
                paddingVertical: Math.max(2, Math.round(px * 0.06)),
                borderRadius: Radius.pill,
                borderWidth: 1,
                borderColor: c.background,
            }}
        >
            <Text
                style={{
                    color: c.primaryForeground, // 토큰 사용
                    fontSize: Math.max(9, Math.round(px * 0.24)),
                    fontWeight: '800',
                }}
            >
                LIVE
            </Text>
        </View>
    ) : null;

    const content = uri ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    ) : (
        <Text style={[labelStyle, textStyle]} numberOfLines={1} adjustsFontSizeToFit>
            {label}
        </Text>
    );

    const body = (
        <View style={[base, style]}>
            {content}
            {LiveBadge}
        </View>
    );

    if (!onPress) return body;

    return (
        <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={accessibilityLabel ?? (guestId != null ? `게스트 ${pad2(guestId)}` : `${name ?? '아바타'}`)}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                onPress?.();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
            {body}
        </Pressable>
    );
}

export function GuestAvatar(props: GuestAvatarProps) {
    const scheme = useColorScheme() ?? 'light';
    const c = Colors[scheme];
    const size = props.size ?? 'md';
    const px = SIZE[size];
    const seed = props.seed?.trim() ? props.seed.trim() : 'guest';
    const avatarUri = useMemo(() => buildGuestAvatarUrl(seed), [seed]);
    const [hasRenderError, setHasRenderError] = useState(false);

    useEffect(() => {
        setHasRenderError(false);
    }, [avatarUri]);

    const base: ViewStyle = {
        width: px,
        height: px,
        borderRadius: props.radius ?? Radius.pill,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderColor: c.border,
        borderWidth: StyleSheet.hairlineWidth,
    };
    const body = (
        <View style={[base, props.style]}>
            {hasRenderError ? (
                <IconSymbol name="person.crop.circle.dashed" size={Math.round(px * 1.2)} color={c.textMuted} />
            ) : (
                <Image
                    source={{ uri: avatarUri }}
                    resizeMode="cover"
                    onError={() => setHasRenderError(true)}
                    style={{ width: '100%', height: '100%' }}
                />
            )}
        </View>
    );

    if (!props.onPress) return body;

    return (
        <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={props.accessibilityLabel ?? '게스트 아바타'}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                props.onPress?.();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
        >
            {body}
        </Pressable>
    );
}
