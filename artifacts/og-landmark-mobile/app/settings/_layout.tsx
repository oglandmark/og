import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: Platform.OS === 'ios' ? 'slide_from_right' : 'none',
    }} />
  );
}
