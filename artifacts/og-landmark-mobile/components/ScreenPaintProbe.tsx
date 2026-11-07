import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ScreenPaintProbe({ label }: { label: string }) {
  if (!__DEV__) return null;

  return (
    <View pointerEvents="none" style={styles.badge}>
      <Text style={styles.text}>{`PAINT CHECK: ${label}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 9999,
    elevation: 9999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'magenta',
  },
  text: {
    color: 'black',
    fontSize: 12,
    fontWeight: '700',
  },
});
