import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      presentation: 'card',
      animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
    }} />
  );
}