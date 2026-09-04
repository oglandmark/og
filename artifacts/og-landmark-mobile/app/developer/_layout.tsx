import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function DeveloperLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === 'ios' ? 'slide_from_right' : 'fade_from_bottom',
      }}
    />
  );
}
