/**
 * AnimatedReveal — compatibility wrapper for existing screens.
 *
 * Motion is intentionally disabled app-wide so navigation and long forms
 * render immediately on lower-end Android devices.
 */
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type AnimatedRevealProps = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedReveal({
  children,
  delay = 0,
  distance = 8,
  style,
}: AnimatedRevealProps) {
  void delay;
  void distance;
  return <View style={style}>{children}</View>;
}
