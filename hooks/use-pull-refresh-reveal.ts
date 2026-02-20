import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { Easing, cancelAnimation, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

type UsePullRefreshRevealParams = {
  isRefreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxDistance?: number;
  dragRatio?: number;
  topTolerance?: number;
  refreshingDistance?: number;
};

const DEFAULT_THRESHOLD = 64;
const DEFAULT_MAX_DISTANCE = 108;
const DEFAULT_DRAG_RATIO = 0.55;
const DEFAULT_TOP_TOLERANCE = 4;

const RESET_TIMING_CONFIG = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

const HOLD_TIMING_CONFIG = {
  duration: 170,
  easing: Easing.out(Easing.cubic),
};

export function usePullRefreshReveal({
  isRefreshing,
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  maxDistance = DEFAULT_MAX_DISTANCE,
  dragRatio = DEFAULT_DRAG_RATIO,
  topTolerance = DEFAULT_TOP_TOLERANCE,
  refreshingDistance = threshold,
}: UsePullRefreshRevealParams) {
  const [distance, setDistance] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isPullingDownState, setIsPullingDownState] = useState(false);
  const triggerInFlightRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRefreshingRef = useRef(isRefreshing);

  const scrollY = useSharedValue(0);
  const pullDistance = useSharedValue(0);
  const canPull = useSharedValue(false);
  const isPullingDown = useSharedValue(false);
  const isRefreshingShared = useSharedValue(isRefreshing);

  const setDistanceSafely = useCallback((next: number) => {
    setDistance((prev) => {
      if (next === 0 && prev !== 0) return 0;
      return Math.abs(prev - next) > 0.8 ? next : prev;
    });
  }, []);

  const runRefresh = useCallback(() => {
    if (triggerInFlightRef.current) return;
    triggerInFlightRef.current = true;
    void Promise.resolve(onRefresh()).finally(() => {
      triggerInFlightRef.current = false;
    });
  }, [onRefresh]);

  useAnimatedReaction(
    () => pullDistance.value,
    (next, prev) => {
      if (prev == null || Math.abs(next - prev) > 0.8 || next === 0) {
        runOnJS(setDistanceSafely)(next);
      }
    }
  );

  useAnimatedReaction(
    () => isPullingDown.value,
    (next, prev) => {
      if (prev !== next) {
        runOnJS(setIsPullingDownState)(next);
      }
    }
  );

  useEffect(() => {
    isRefreshingShared.value = isRefreshing;
    if (isRefreshing) {
      cancelAnimation(pullDistance);
      pullDistance.value = withTiming(refreshingDistance, HOLD_TIMING_CONFIG);
      return;
    }
    pullDistance.value = withTiming(0, RESET_TIMING_CONFIG);
  }, [isRefreshing, isRefreshingShared, pullDistance, refreshingDistance]);

  useEffect(() => {
    if (isRefreshing) {
      setShowCompletion(false);
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    } else if (wasRefreshingRef.current) {
      setShowCompletion(true);
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      completionTimerRef.current = setTimeout(() => {
        setShowCompletion(false);
        completionTimerRef.current = null;
      }, 800);
    }
    wasRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    return () => {
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          canPull.value = false;
          isPullingDown.value = false;
          if (isRefreshingShared.value) return;
          if (scrollY.value <= topTolerance) {
            canPull.value = true;
            cancelAnimation(pullDistance);
          }
        })
        .onUpdate((event) => {
          if (isRefreshingShared.value) return;

          if (!canPull.value) {
            if (event.translationY > 0 && scrollY.value <= topTolerance) {
              canPull.value = true;
              cancelAnimation(pullDistance);
            } else {
              isPullingDown.value = false;
              return;
            }
          }

          if (event.translationY <= 0) {
            isPullingDown.value = false;
            pullDistance.value = 0;
            return;
          }

          isPullingDown.value = true;
          const damped = Math.min(maxDistance, event.translationY * dragRatio);
          pullDistance.value = damped;
        })
        .onEnd(() => {
          isPullingDown.value = false;
          if (!canPull.value) return;

          const shouldRefresh = pullDistance.value >= threshold;
          canPull.value = false;

          if (shouldRefresh && !isRefreshingShared.value) {
            isRefreshingShared.value = true;
            pullDistance.value = withTiming(refreshingDistance, HOLD_TIMING_CONFIG);
            runOnJS(runRefresh)();
            return;
          }

          if (!isRefreshingShared.value) {
            pullDistance.value = withTiming(0, RESET_TIMING_CONFIG);
          }
        })
        .onFinalize(() => {
          canPull.value = false;
          isPullingDown.value = false;
          if (!isRefreshingShared.value && pullDistance.value < threshold) {
            pullDistance.value = withTiming(0, RESET_TIMING_CONFIG);
          }
        }),
    [
      canPull,
      dragRatio,
      isPullingDown,
      isRefreshingShared,
      maxDistance,
      pullDistance,
      refreshingDistance,
      runRefresh,
      scrollY,
      threshold,
      topTolerance,
    ]
  );

  const nativeGesture = useMemo(() => Gesture.Native(), []);
  const gesture = useMemo(
    () => Gesture.Simultaneous(nativeGesture, panGesture),
    [nativeGesture, panGesture]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pullDistance.value }],
  }));

  const progress = Math.min(1, distance / threshold);
  const showStretchHeader = isRefreshing || isPullingDownState;
  const label = isRefreshing
    ? '새로고침 중...'
    : progress >= 1
      ? '놓으면 새로고침'
      : '당겨서 새로고침';

  return {
    gesture,
    onScroll,
    containerAnimatedStyle,
    showStretchHeader,
    showCompletion,
    distance,
    progress,
    label,
    scrollEventThrottle: 16,
  };
}
