/** OG Landmark brand assets supplied by the product owner. */
import React from 'react';
import { Image } from 'expo-image';

const logoAsset = require('@/assets/images/og-landmark-brand-mark.png');
const inverseLogoAsset = require('@/assets/images/og-landmark-brand-mark-white.png');

export function OGLandmarkLogo({
  size = 80,
  inverse = false,
}: {
  size?: number;
  inverse?: boolean;
}) {
  return (
    <Image
      source={inverse ? inverseLogoAsset : logoAsset}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={0}
      accessibilityLabel="OG Landmark logo"
    />
  );
}
