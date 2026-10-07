/**
 * PropertyCard — optimised for all Android devices.
 * BlurView removed (it forces a GPU-heavy off-screen composition pass on
 * Android and is the single biggest frame-drop cause). Replaced with
 * semi-transparent solid colours that look identical at 60 fps.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Image as ExpoImage } from 'expo-image';
import { WhatsAppLogo } from '@/components/WhatsAppIcon';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { formatAreaDisplay, formatPrice, Property } from '@/lib/properties';
import { useSaved } from '@/context/SavedContext';
import { PropertyVideoModal } from '@/components/PropertyMediaStrip';
import { PropertyGalleryModal } from '@/components/PropertyGalleryModal';
import { PropertyDemoBadge } from '@/components/PropertyDemoBadge';
import { propertyImages } from '@/lib/properties';
import { shareProperty } from '@/lib/share';

function PropertyCardInner({ property, compact = false }: { property: Property; compact?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const { isSaved, toggleSaved } = useSaved();
  const [activeImage, setActiveImage] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const images = propertyImages(property);
  const videoSource = property.videoAsset != null
    ? property.videoAsset
    : property.videoUrl
      ? { uri: property.videoUrl }
      : null;
  const hasVideo = videoSource != null;
  const areaDisplay = formatAreaDisplay(property.area, property.areaUnit);
  const saved = isSaved(property.id);
  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      images.length > 1
      && Math.abs(gesture.dx) > 12
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 34) return;
      setActiveImage((current) => gesture.dx < 0
        ? (current + 1) % images.length
        : (current - 1 + images.length) % images.length);
      void Haptics.selectionAsync();
    },
    onPanResponderTerminationRequest: () => false,
  }), [images.length]);

  const handleShare = useCallback((event: any) => {
    event.stopPropagation();
    void shareProperty(property);
  }, [property]);

  const handleSave = useCallback((event: any) => {
    event.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSaved(property.id);
  }, [toggleSaved, property.id]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder, shadowColor: colors.shadow },
        compact && styles.compactCard,
      ]}
    >
      {/* Solid overlay replaces BlurView — same visual, zero GPU cost */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />

      <View style={styles.pressable}>
        <View style={[styles.imageWrap, compact && styles.compactImageWrap]} {...swipeResponder.panHandlers}>
          <Pressable
            onPress={(event) => { event.stopPropagation(); setGalleryVisible(true); }}
            style={styles.imageTap}
            accessibilityLabel="Open property images full screen"
          >
            <ExpoImage
              source={images[activeImage] ?? images[0]}
              style={[styles.image, { backgroundColor: colors.actionDeep }]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </Pressable>
          {images.length > 1 && (
            <>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setActiveImage((current) => (current - 1 + images.length) % images.length);
                }}
                style={[styles.galleryArrow, styles.galleryArrowLeft, { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder }]}
                hitSlop={6}
                accessibilityLabel="Previous property image"
              >
                <Feather name="chevron-left" size={17} color={colors.actionForeground} />
              </Pressable>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setActiveImage((current) => (current + 1) % images.length);
                }}
                style={[styles.galleryArrow, styles.galleryArrowRight, { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder }]}
                hitSlop={6}
                accessibilityLabel="Next property image"
              >
                <Feather name="chevron-right" size={17} color={colors.actionForeground} />
              </Pressable>
              <View pointerEvents="none" style={[styles.imageCounter, { backgroundColor: colors.actionGlassStrong }]}>
                <Feather name="image" size={10} color={colors.actionForeground} />
                <Text style={[styles.imageCounterText, { color: colors.actionForeground }]}>{activeImage + 1}/{images.length}</Text>
              </View>
            </>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={[colors.actionDeep + '00', colors.actionDeep + '66']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.imageShade}
          />
          {/* Status badge */}
          <View style={[styles.status, compact && styles.compactStatus, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <Text style={[styles.statusText, compact && styles.compactStatusText, { color: colors.foreground }]}>{property.status}</Text>
          </View>
          <PropertyDemoBadge visible={property.isDemo === true} style={styles.demoBadge} />
          {/* Featured ribbon */}
          {property.featured && (
            <View style={[styles.featuredBadge, { backgroundColor: colors.primary }]}>
              <Feather name="star" size={8} color={colors.goldForeground} />
              <Text style={[styles.featuredText, { color: colors.goldForeground }]}>FEATURED</Text>
            </View>
          )}
          {/* Action buttons */}
          <View style={[styles.cardActions, compact && styles.compactCardActions]}>
            {hasVideo && (
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setVideoVisible(true);
                }}
                style={[styles.videoTourButton, compact && styles.compactVideoTourButton, { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder }]}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Play video visit for ${property.title}`}
              >
                <Feather name="play" size={compact ? 11 : 13} color={colors.actionForeground} />
                <Text style={[styles.videoTourText, compact && styles.compactVideoTourText, { color: colors.actionForeground }]}>Video visit</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.circleAction,
                compact && styles.compactCircleAction,
                { backgroundColor: colors.actionGlass, borderColor: colors.actionGlassBorder, opacity: pressed ? 0.78 : 1 },
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Share ${property.title}`}
              testID={`share-property-${property.id}`}
            >
              <Feather name="share-2" size={16} color={colors.actionForeground} />
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.circleAction,
                compact && styles.compactCircleAction,
                {
                  backgroundColor: colors.goldGlass,
                  borderColor: saved ? colors.gold : colors.goldGlassBorder,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${saved ? 'Remove from' : 'Add to'} favorites: ${property.title}`}
              testID={`save-property-${property.id}`}
            >
              <Feather
                name="heart"
                size={17}
                color={saved ? colors.gold : colors.goldForeground}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => router.push(`/property/${property.id}`)}
            style={({ pressed }) => [styles.body, compact && styles.compactBody, { borderTopColor: colors.glassBorder, opacity: pressed ? 0.82 : 1 }]}
          testID={`property-card-${property.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${property.title}. ${formatPrice(property.price, property.status)}. ${property.city}. Open property details.`}
        >
          {/* Solid tint instead of BlurView */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
          <View
            pointerEvents="none"
            style={[styles.bodyHighlight, { backgroundColor: colors.card, opacity: 0.28 }]}
          />
          <Text style={[styles.price, compact && styles.compactPrice, { color: colors.foreground }]}>{formatPrice(property.price, property.status)}</Text>
          <Text numberOfLines={1} style={[styles.title, compact && styles.compactTitle, { color: colors.foreground }]}>{property.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[styles.location, styles.metaCity, compact && styles.compactLocation, { color: colors.mutedForeground }]}>{property.city}</Text>
            <View style={[styles.metaMetric, compact && styles.compactMetaMetric]}>
              <Feather name="home" size={12} color={colors.mutedForeground} />
              <Text numberOfLines={1} style={[styles.metaMetricText, compact && styles.compactMetaMetricText, { color: colors.mutedForeground }]}>
                {property.bedrooms > 0 ? `${property.bedrooms} Beds` : '— Beds'}
              </Text>
            </View>
            <View style={[styles.metaMetric, compact && styles.compactMetaMetric]}>
              <Feather name="droplet" size={12} color={colors.mutedForeground} />
              <Text numberOfLines={1} style={[styles.metaMetricText, compact && styles.compactMetaMetricText, { color: colors.mutedForeground }]}>
                {property.bathrooms > 0 ? `${property.bathrooms} Baths` : '— Baths'}
              </Text>
            </View>
            <View style={[styles.metaMetric, compact && styles.compactMetaMetric]}>
              <Feather name="maximize" size={12} color={colors.mutedForeground} />
              <Text numberOfLines={1} style={[styles.metaMetricText, compact && styles.compactMetaMetricText, { color: colors.mutedForeground }]}>
                {property.area > 0 ? `${areaDisplay.value} ${areaDisplay.label}` : '— Marla'}
              </Text>
            </View>
            <View style={[styles.metaMetric, compact && styles.compactMetaMetric]}>
              <Feather name="tag" size={12} color={colors.mutedForeground} />
              <Text numberOfLines={1} style={[styles.metaMetricText, compact && styles.compactMetaMetricText, { color: colors.mutedForeground }]}>
                {property.type || '—'}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={[ctaStyles.row, compact && ctaStyles.compactRow, { borderTopColor: colors.border, backgroundColor: colors.surfaceRaised }]}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`sms:${property.agentPhone ?? '03011484303'}`); }}
          style={({ pressed }) => [ctaStyles.smsBtn, compact && ctaStyles.compactButton, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Send SMS"
        >
          <Feather name="message-square" size={14} color={colors.foreground} />
          <Text style={[ctaStyles.smsTxt, { color: colors.foreground }]}>SMS</Text>
        </Pressable>

        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`tel:${property.agentPhone ?? '+923011484303'}`); }}
          style={({ pressed }) => [ctaStyles.callBtn, compact && ctaStyles.compactButton, { backgroundColor: colors.action, opacity: pressed ? 0.82 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Call agent"
        >
          <Feather name="phone" size={14} color={colors.actionForeground} />
          <Text style={[ctaStyles.callTxt, { color: colors.actionForeground }]}>Call</Text>
        </Pressable>

        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`https://wa.me/92${(property.agentPhone ?? '03011484303').replace(/\D/g, '').replace(/^0/, '')}`); }}
          style={({ pressed }) => [ctaStyles.waBtn, { opacity: pressed ? 0.75 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="WhatsApp agent"
        >
          <WhatsAppLogo size={compact ? 30 : 34} />
        </Pressable>
      </View>

      <PropertyGalleryModal
        property={property}
        visible={galleryVisible}
        initialIndex={activeImage}
        onClose={() => setGalleryVisible(false)}
      />
      {hasVideo && (
        <PropertyVideoModal
          property={property}
          videoSource={videoSource}
          visible={videoVisible}
          onClose={() => setVideoVisible(false)}
        />
      )}

    </View>
  );
}

// React.memo prevents re-renders when parent list scrolls
export const PropertyCard = React.memo(PropertyCardInner);

const ctaStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: 1 },
  compactRow: { gap: 5, paddingHorizontal: 9, paddingVertical: 7 },
  smsBtn:  { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 6 },
  compactButton: { minHeight: 36, paddingVertical: 4 },
  smsTxt:  { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  callBtn: { flex: 1.6, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 6 },
  callTxt: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
  waBtn:   { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  card:          { width: 268, borderRadius: 22, overflow: 'hidden', marginRight: 14, borderWidth: 1, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  compactCard:   { width: '100%', marginRight: 0, marginBottom: 14 },
  pressable:     { flex: 1 },
  imageTap:      { flex: 1 },
  imageWrap:     { height: 182, position: 'relative' },
  compactImageWrap: { height: 148 },
  image:         { width: '100%', height: '100%' },
  galleryArrow:  { position: 'absolute', top: '44%', width: 30, height: 30, borderRadius: 15, backgroundColor: '#07152199', borderWidth: 1, borderColor: '#ffffff55', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  galleryArrowLeft: { left: 8 },
  galleryArrowRight:{ right: 8 },
  imageCounter:  { position: 'absolute', bottom: 8, right: 9, zIndex: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#071521bb', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  imageCounterText:{ fontSize: 9, fontWeight: '700' },
  imageShade:    { ...StyleSheet.absoluteFill },
  status:        { position: 'absolute', top: 12, left: 12, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden' },
  demoBadge:    { position: 'absolute', top: 48, left: 12 },
  statusText:    { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  compactStatus: { top: 9, left: 10, paddingHorizontal: 7, paddingVertical: 5 },
  compactStatusText: { fontSize: 9 },
  featuredBadge: { position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  featuredText:  { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#1c2024', letterSpacing: 0.7 },
  videoTourButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
  compactVideoTourButton: { minHeight: 36, gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  videoTourText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  compactVideoTourText: { fontSize: 9 },
  cardActions:   { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 7 },
  compactCardActions: { top: 8, right: 8, gap: 5 },
  circleAction:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden', shadowColor: '#d9b96d', shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  compactCircleAction: { width: 32, height: 32, borderRadius: 16 },
  body:          { padding: 15, overflow: 'hidden', borderTopWidth: 1 },
  compactBody: { padding: 12 },
  bodyHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 36 },
  price:         { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: 0.1, marginBottom: 6 },
  compactPrice: { fontSize: 15, marginBottom: 4 },
  title:         { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 14, lineHeight: 19, marginBottom: 10 },
  compactTitle: { fontSize: 13, lineHeight: 17, marginBottom: 7 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', gap: 5 },
  metaCity:      { flex: 1, minWidth: 0 },
  metaMetric:    { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0, flexShrink: 1 },
  compactMetaMetric: { gap: 2 },
  metaMetricText: { fontFamily: 'Inter_400Regular', fontSize: 10, maxWidth: 68, flexShrink: 1 },
  compactMetaMetricText: { fontSize: 9, maxWidth: 58 },
  location:      { fontFamily: 'Inter_400Regular', fontSize: 11 },
  compactLocation: { fontSize: 10 },
});
