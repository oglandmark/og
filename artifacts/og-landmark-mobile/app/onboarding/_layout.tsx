import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
    }}>
      <Stack.Screen name="select-role" />
      <Stack.Screen name="register-buyer" />
      <Stack.Screen name="register-agent" />
      <Stack.Screen name="register-developer" />
    </Stack>
  );
}
