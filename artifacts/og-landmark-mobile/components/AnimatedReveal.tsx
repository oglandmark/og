/**
 * AnimatedReveal — compatibility wrapper for existing screens.
 *
 * Motion is intentionally disabled app-wide so navigation and long forms
 * render immediately on lower-end Android devices.
 */
import React from 'react';
import { StyleProp, Text as NativeText, View, ViewStyle } from 'react-native';

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
  const safeChildren = React.Children.map(children, (child, index) => {
    if (typeof child === 'string') {
      // JSX formatting between siblings becomes whitespace-only text nodes.
      // A native View cannot render those directly, so drop them.
      if (!child.trim()) return null;
      return <NativeText key={`animated-text-${index}`}>{child}</NativeText>;
    }

    // Numbers are also text nodes in React Native and need a Text parent.
    if (typeof child === 'number') {
      return <NativeText key={`animated-number-${index}`}>{child}</NativeText>;
    }

    return child;
  });
  return <View style={style}>{safeChildren}</View>;
}
