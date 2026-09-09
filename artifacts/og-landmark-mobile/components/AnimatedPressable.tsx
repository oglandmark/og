import React from 'react';
import { AccessibilityInfo, Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

type AnimatedPressableProps = Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export function AnimatedPressable({
  children,
  style,
  scaleTo = 0.965,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : 0.9 + scale.value * 0.1,
    transform: [{ scale: reduceMotion ? 1 : scale.value }],
  }), [reduceMotion]);

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          if (!reduceMotion) scale.value = withSpring(scaleTo, { damping: 14, stiffness: 320, mass: 0.7 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          if (!reduceMotion) scale.value = withSpring(1, { damping: 14, stiffness: 280, mass: 0.7 });
          onPressOut?.(event);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch' },
});