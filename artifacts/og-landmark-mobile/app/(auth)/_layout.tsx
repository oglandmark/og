import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }} />;
}