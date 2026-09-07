import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height of the floating bottom tab bar (from _layout.tsx tabBarStyle).
 * Keep in sync with: height: isWeb ? 84 : 78
 */
export const TAB_BAR_HEIGHT = Platform.select({ web: 84, default: 78 }) as number;

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
