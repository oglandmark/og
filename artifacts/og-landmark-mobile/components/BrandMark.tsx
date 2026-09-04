import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';

export function BrandMark({
  inverse = false,
  size = 'default',
  showName = true,
}: {
  inverse?: boolean;
  size?: 'default' | 'hero';
  showName?: boolean;
}) {
  return (
    <View style={[styles.container, size === 'hero' && styles.heroContainer]}>
      <OGLandmarkLogo size={size === 'hero' ? (!showName ? 116 : 68) : 46} />
      {showName && (
        <View>
          <Text style={[styles.title, size === 'hero' && styles.heroTitle, inverse && styles.inverseText]}>OG Landmark</Text>
          <Text style={[styles.subtitle, size === 'hero' && styles.heroSubtitle, inverse && styles.inverseSub]}>REAL ESTATE</Text>
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
  inverseText: { color: '#f8f6f1' },
  inverseSub: { color: '#d9b96d' },
});