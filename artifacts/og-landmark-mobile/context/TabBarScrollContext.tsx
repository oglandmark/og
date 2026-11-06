import { createContext, useCallback, useContext, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const TabBarVisibilityContext = createContext<(hidden: boolean) => void>(() => undefined);

export function useTabBarScrollHandler() {
  const setTabBarHidden = useContext(TabBarVisibilityContext);
  const isHidden = useRef(false);

  const updateVisibility = useCallback((hidden: boolean) => {
    if (isHidden.current === hidden) return;
    isHidden.current = hidden;
    setTabBarHidden(hidden);
  }, [setTabBarHidden]);

  useFocusEffect(useCallback(() => {
    isHidden.current = false;
    setTabBarHidden(false);
  }, [setTabBarHidden]));

  // Keep the bottom navigation visible in both scroll directions.
  return useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => updateVisibility(false),
    [updateVisibility],
  );
}