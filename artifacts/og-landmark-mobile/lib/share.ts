import { Platform, Share } from 'react-native';
import type { Property } from '@/lib/properties';

export async function shareProperty(property: Pick<Property, 'id' | 'title' | 'address' | 'price'>) {
  const url = `https://oglandmark.com/properties/${property.id}`;
  const message = `${property.title}\n${property.address}\n${url}`;

  if (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    await navigator.share({
      title: property.title,
      text: `${property.title}\n${property.address}`,
      url,
    });
    return;
  }

  await Share.share({
    title: property.title,
    message,
    url: Platform.OS === 'ios' ? url : undefined,
  });
}