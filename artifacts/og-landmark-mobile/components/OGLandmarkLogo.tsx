/** OG Landmark roof-and-OG brand mark in teal and landmark gold. */
import React from 'react';
import { Image } from 'expo-image';

const logoAsset = require('@/assets/images/og-landmark-brand-mark-color.png');
const inverseLogoAsset = require('@/assets/images/og-landmark-brand-mark-inverse.png');

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
