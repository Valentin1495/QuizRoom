import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

import { ThemedText } from '../themed-text';
import { IconSymbol } from '../ui/icon-symbol';

type PullRefreshStretchHeaderProps = {
  visible: boolean;
  top: number;
  distance: number;
  progress: number;
  label: string;
  isRefreshing: boolean;
  color: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
};

type PullRefreshCompleteStripProps = {
  visible: boolean;
  top: number;
  label?: string;
  color: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
};

const MAX_HEADER_HEIGHT = 88;
const MIN_REFRESHING_HEIGHT = 40;
const MIN_VISIBLE_HEIGHT = 4;

export function PullRefreshStretchHeader({
  visible,
  top,
  distance,
  progress,
  label,
  isRefreshing,
  color,
  textColor,
  backgroundColor,
  borderColor,
}: PullRefreshStretchHeaderProps) {
  if (!visible) return null;

  const baseHeight = isRefreshing ? Math.max(distance, MIN_REFRESHING_HEIGHT) : distance;
  const height = Math.min(MAX_HEADER_HEIGHT, Math.max(0, baseHeight));

  if (!isRefreshing && height < MIN_VISIBLE_HEIGHT) return null;

  const opacity = Math.min(1, height / 26);

  return (
    <View pointerEvents="none" style={[styles.headerOverlay, { top }]}>
      <View style={[styles.headerContainer, { height }]}>
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor,
              borderColor,
              opacity,
            },
          ]}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <IconSymbol
              name="arrow.left"
              size={15}
              color={color}
              style={{ transform: [{ rotate: progress >= 1 ? '90deg' : '-90deg' }] }}
            />
          )}
          <ThemedText style={[styles.headerLabel, { color: textColor }]}>{label}</ThemedText>
        </View>
      </View>
    </View>
  );
}

export function PullRefreshCompleteStrip({
  visible,
  top,
  label = '업데이트 완료',
  color,
  textColor,
  backgroundColor,
  borderColor,
}: PullRefreshCompleteStripProps) {
  if (!visible) return null;

  return (
    <View pointerEvents="none" style={[styles.stripOverlay, { top }]}>
      <View style={[styles.stripCard, { backgroundColor, borderColor }]}>
        <IconSymbol name="checkmark.circle.fill" size={14} color={color} />
        <ThemedText style={[styles.stripLabel, { color: textColor }]}>{label}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 39,
  },
  headerContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 30,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  stripOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 41,
  },
  stripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 30,
  },
  stripLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
