import React from 'react';
import { StyleSheet, Text as NativeText, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { OGLandmarkLogo } from '@/components/OGLandmarkLogo';
import { useColors } from '@/hooks/useColors';
import brandColors from '@/constants/colors';

export function BrandMark({
  inverse = false,
  size = 'default',
  showName = true,
  animateOnWeb = false,
  focused,
}: {
  inverse?: boolean;
  size?: 'default' | 'hero';
  showName?: boolean;
  animateOnWeb?: boolean;
  focused?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.container, size === 'hero' && styles.heroContainer]}>
      <OGLandmarkLogo
        size={size === 'hero' ? (!showName ? 116 : 68) : 46}
        inverse={inverse}
        animateOnWeb={animateOnWeb}
        focused={focused}
      />
      {showName && (
        <View>
          <NativeText
            numberOfLines={1}
            accessibilityLabel="OG Landmark"
            style={[styles.title, { color: inverse ? colors.background : colors.action }, size === 'hero' && styles.heroTitle]}
          >
            OG Landmark
          </NativeText>
          <Text style={[styles.subtitle, { color: inverse ? colors.gold : colors.primary }, size === 'hero' && styles.heroSubtitle]}>REAL ESTATE</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 15, letterSpacing: 0.2, flexShrink: 0, color: '#1c2024' },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 8, letterSpacing: 2.3, color: brandColors.light.gold, marginTop: 2 },
  heroContainer: { justifyContent: 'center', gap: 13 },
  heroTitle: { fontSize: 20, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 9, letterSpacing: 3.1, marginTop: 4 },
});