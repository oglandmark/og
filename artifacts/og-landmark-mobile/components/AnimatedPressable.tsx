import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

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
  void scaleTo;
  return (
    <Pressable
      {...props}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
    >
      {children}
    </Pressable>
  );
}