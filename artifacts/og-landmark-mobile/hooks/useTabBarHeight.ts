import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height of the visible bottom tab bar (from _layout.tsx tabBarStyle).
 * The Android system navigation inset is added separately at runtime.
 * Keep in sync with: height: isWeb ? 84 : 68 + insets.bottom
 */
export const TAB_BAR_HEIGHT = Platform.select({ web: 84, default: 68 }) as number;

/**
 * Total space the floating tab bar takes from the bottom of the screen.
 * Use this as `paddingBottom` in any ScrollView / FlatList inside a tab screen
 * so content never hides under the tab bar.
 *
 *   const tabBarHeight = useTabBarHeight();
 *   <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }}>
 */
export function useTabBarHeight(): number {
  const { bottom } = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + bottom;
}
