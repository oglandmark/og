import { createContext, useCallback, useContext, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const TabBarVisibilityContext = createContext<(hidden: boolean) => void>(() => undefined);

export function useTabBarScrollHandler() {
  const setTabBarHidden = useContext(TabBarVisibilityContext);
  const lastOffset = useRef<number | null>(null);
  const direction = useRef<-1 | 1 | null>(null);
  const accumulatedDelta = useRef(0);
  const isHidden = useRef(false);

  const updateVisibility = useCallback((hidden: boolean) => {
    if (isHidden.current === hidden) return;
    isHidden.current = hidden;
    setTabBarHidden(hidden);
  }, [setTabBarHidden]);

  useFocusEffect(useCallback(() => {
    lastOffset.current = null;
    direction.current = null;
    accumulatedDelta.current = 0;
    isHidden.current = false;
    setTabBarHidden(false);
  }, [setTabBarHidden]));

  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const previousY = lastOffset.current;
    lastOffset.current = offsetY;

    if (previousY === null) return;
    if (offsetY <= 8) {
      direction.current = null;
      accumulatedDelta.current = 0;
      updateVisibility(false);
      return;
    }

    const delta = offsetY - previousY;
    if (Math.abs(delta) < 1) return;

    const nextDirection: -1 | 1 = delta > 0 ? 1 : -1;
    if (direction.current !== nextDirection) {
      direction.current = nextDirection;
      accumulatedDelta.current = 0;
    }
    accumulatedDelta.current += delta;

    if (accumulatedDelta.current >= 12) {
      accumulatedDelta.current = 0;
      updateVisibility(true);
    } else if (accumulatedDelta.current <= -12) {
      accumulatedDelta.current = 0;
      updateVisibility(false);
    }
  }, [updateVisibility]);
}