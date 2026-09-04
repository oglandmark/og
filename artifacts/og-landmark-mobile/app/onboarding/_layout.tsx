import { Stack } from 'expo-router';
import React from 'react';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="select-role" />
      <Stack.Screen name="register-buyer" />
      <Stack.Screen name="register-agent" />
      <Stack.Screen name="register-developer" />
    </Stack>
  );
}
