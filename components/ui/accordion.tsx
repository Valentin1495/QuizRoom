import { PropsWithChildren, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

interface AccordionProps extends PropsWithChildren {
  title: string | React.ReactNode;
  defaultOpen?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Accordion({ title, defaultOpen = true, children, style, contentStyle }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'border');
  const cardColor = useThemeColor({}, 'card');

  const toggle = () => {
    const next = !isOpen;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
    setIsOpen(next);
  };

  const maxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight || 1],
  });
  const opacity = progress;
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '-90deg'],
  });

  return (
    <View style={[styles.container, { borderColor, backgroundColor: cardColor }, style]}>
      <Pressable
        style={styles.header}
        onPress={toggle}
        android_ripple={{ color: 'rgba(0,0,0,0.04)', borderless: false }}
      >
        {typeof title === 'string' ? (
          <ThemedText type="defaultSemiBold" style={styles.title}>
            {title}
          </ThemedText>
        ) : (
          title
        )}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <IconSymbol name="chevron.right" size={18} color={textColor} />
        </Animated.View>
      </Pressable>
      <Animated.View
        style={[styles.contentWrapper, { maxHeight, opacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <View
          style={[styles.content, contentStyle]}
          onLayout={(e) => {
            const height = e.nativeEvent.layout.height;
            if (height && height !== contentHeight) {
              setContentHeight(height);
            }
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  contentWrapper: {
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    gap: Spacing.xs,
  },
});
