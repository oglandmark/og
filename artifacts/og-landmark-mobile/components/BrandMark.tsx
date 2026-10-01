import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useColors } from '@/hooks/useColors';

export function BrandMark({
  inverse = false,
  size = 'default',
  showName = true,
}: {
  inverse?: boolean;
  size?: 'default' | 'hero';
  showName?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.container, size === 'hero' && styles.heroContainer]}>
      <OGLandmarkLogo size={size === 'hero' ? (!showName ? 116 : 68) : 46} inverse={inverse} />
      {showName && (
        <View>
          <Text style={[styles.title, { color: inverse ? colors.background : colors.action }, size === 'hero' && styles.heroTitle]}>OG Landmark</Text>
          <Text style={[styles.subtitle, { color: inverse ? colors.gold : colors.primary }, size === 'hero' && styles.heroSubtitle]}>REAL ESTATE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 14, letterSpacing: 0.4, color: '#1c2024' },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 2.3, color: '#c8a45a', marginTop: 2 },
  heroContainer: { justifyContent: 'center', gap: 13 },
  heroTitle: { fontSize: 20, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 9, letterSpacing: 3.1, marginTop: 4 },
});