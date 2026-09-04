/**
 * OG Landmark — official transparent brand mark.
 *
 * Uses a high-resolution transparent render of the supplied official SVG.
 * The supplied SVG contains an embedded PNG, so using it as an SVG component
 * is not reliable across Expo Web and native. This render avoids interpolation
 * from a small source asset while keeping the same official artwork.
 */
import React from 'react';
import { Image } from 'react-native';

const logoAsset = require('@/assets/images/og-landmark-official-tight.png');
const splashLogoAsset = require('@/assets/images/og-landmark-splash.png');

export function OGLandmarkLogo({
  size = 80,
  variant = 'ui',
}: {
  size?: number;
  variant?: 'ui' | 'splash';
}) {
  return (
    <Image
      source={variant === 'splash' ? splashLogoAsset : logoAsset}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="OG Landmark logo"
    />
  );
}
