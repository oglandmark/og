/** OG Landmark brand assets supplied by the product owner. */
import React from 'react';
import { Image, View } from 'react-native';

const logoAsset = require('@/assets/images/og-landmark-brand-mark.png');
const splashLogoAsset = require('@/assets/images/og-landmark-brand-transparent.png');

export function OGLandmarkLogo({
  size = 80,
  variant = 'ui',
}: {
  size?: number;
  variant?: 'ui' | 'splash';
}) {
  if (variant === 'splash') {
    return (
      <Image
        source={splashLogoAsset}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="OG Landmark logo"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: Math.round(size * 0.22),
      }}
    >
      <Image
        source={logoAsset}
        style={{ width: size * 0.88, height: size * 0.88 }}
        resizeMode="contain"
        accessibilityLabel="OG Landmark logo"
      />
    </View>
  );
}
