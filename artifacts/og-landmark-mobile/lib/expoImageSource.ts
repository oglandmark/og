import type { ImageSource as ExpoImageSource } from 'expo-image';
import type { ImageSourcePropType } from 'react-native';

export function toExpoImageSource(
  source: ImageSourcePropType | undefined,
): ExpoImageSource | ExpoImageSource[] | string | number | undefined {
  if (Array.isArray(source)) {
    return source.map((item) => item as ExpoImageSource);
  }
  return source as ExpoImageSource | string | number | undefined;
}
