import React from 'react';
import {
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const MotionPressable = Animated.createAnimatedComponent(Pressable);

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
  const reduceMotion = useReducedMotion();
  const pressScale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = React.useCallback(
    (event: GestureResponderEvent) => {
      onPressIn?.(event);
      if (!reduceMotion) {
        pressScale.value = withSpring(scaleTo, {
          damping: 18,
          stiffness: 320,
          mass: 0.5,
        });
      }
    },
    [onPressIn, pressScale, reduceMotion, scaleTo],
  );

  const handlePressOut = React.useCallback(
    (event: GestureResponderEvent) => {
      onPressOut?.(event);
      pressScale.value = withSpring(1, {
        damping: 18,
        stiffness: 320,
        mass: 0.5,
      });
    },
    [onPressOut, pressScale],
  );

  return (
    <MotionPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </MotionPressable>
  );
}