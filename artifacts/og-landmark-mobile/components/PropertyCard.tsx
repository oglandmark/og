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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { formatAreaDisplay, formatPrice, Property } from '@/lib/properties';
import { useSaved } from '@/context/SavedContext';
import { PropertyMediaStrip } from '@/components/PropertyMediaStrip';
import { PropertyGalleryModal } from '@/components/PropertyGalleryModal';
import { PropertyDemoBadge } from '@/components/PropertyDemoBadge';
import { propertyImages } from '@/lib/properties';
import { shareProperty } from '@/lib/share';

function PropertyCardInner({ property, compact = false }: { property: Property; compact?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const { isSaved, toggleSaved } = useSaved();
  const cardScale = useSharedValue(1);
  const heartScale = useSharedValue(1);
  const [activeImage, setActiveImage] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const images = propertyImages(property);
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

  const heartAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const cardAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const handleShare = useCallback((event: any) => {
    event.stopPropagation();
    void shareProperty(property);
  }, [property]);

  const handleSave = useCallback((event: any) => {
    event.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    heartScale.value = withSequence(
      withSpring(1.22, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 240 }),
    );
    toggleSaved(property.id);
  }, [heartScale, toggleSaved, property.id]);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.glassCard, borderColor: colors.glassBorder },
        compact && styles.compactCard,
        cardAnimatedStyle,
      ]}
    >
      {/* Solid overlay replaces BlurView — same visual, zero GPU cost */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />

      <View style={styles.pressable}>
        <View style={styles.imageWrap} {...swipeResponder.panHandlers}>
          <Pressable
            onPress={(event) => { event.stopPropagation(); setGalleryVisible(true); }}
            style={styles.imageTap}
            accessibilityLabel="Open property images full screen"
          >
            <ExpoImage
              source={images[activeImage] ?? images[0]}
              style={[styles.image, { backgroundColor: colors.actionDeep }]}
              contentFit="cover"
              transition={250}
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
                style={[styles.galleryArrow, styles.galleryArrowLeft]}
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
                style={[styles.galleryArrow, styles.galleryArrowRight]}
                hitSlop={6}
                accessibilityLabel="Next property image"
              >
                <Feather name="chevron-right" size={17} color={colors.actionForeground} />
              </Pressable>
              <View pointerEvents="none" style={styles.imageCounter}>
                <Feather name="image" size={10} color={colors.actionForeground} />
                <Text style={styles.imageCounterText}>{activeImage + 1}/{images.length}</Text>
              </View>
            </>
          )}
          <LinearGradient
            pointerEvents="none"
            colors={['#15191d00', '#15191d4d']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.imageShade}
          />
          {/* Status badge */}
          <View style={[styles.status, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <Text style={[styles.statusText, { color: colors.foreground }]}>{property.status}</Text>
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
          <View style={styles.cardActions}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.circleAction,
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
              <Animated.View style={heartAnimatedStyle}>
                <Feather
                  name="heart"
                  size={17}
                  color={saved ? colors.gold : colors.goldForeground}
                />
              </Animated.View>
            </Pressable>
          </View>
        </View>

        <PropertyMediaStrip
          property={property}
          activeIndex={activeImage}
          onSelect={setActiveImage}
        />

        <Pressable
          onPress={() => router.push(`/property/${property.id}`)}
          onPressIn={() => { cardScale.value = withSpring(0.985, { damping: 18, stiffness: 260 }); }}
          onPressOut={() => { cardScale.value = withSpring(1, { damping: 18, stiffness: 260 }); }}
          style={[styles.body, { borderTopColor: colors.glassBorder }]}
          testID={`property-card-${property.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${property.title}. ${formatPrice(property.price, property.status)}. ${property.city}. Open property details.`}
        >
          {/* Solid tint instead of BlurView */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassOverlay }]} />
          <LinearGradient
            pointerEvents="none"
            colors={['#ffffff75', '#ffffff00']}
            style={styles.bodyHighlight}
          />
          <Text style={[styles.price, { color: colors.foreground }]}>{formatPrice(property.price, property.status)}</Text>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>{property.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[styles.location, { color: colors.mutedForeground }]}>{property.city}</Text>
            <View style={styles.metaSpacer} />
            {property.bedrooms > 0 && (
              <>
                <Feather name="home" size={13} color={colors.mutedForeground} />
                <Text style={[styles.location, { color: colors.mutedForeground }]}>{property.bedrooms} bd</Text>
              </>
            )}
          </View>
          <View style={styles.facts}>
            {(() => {
              const ptype = (property.type ?? '').toLowerCase();
              const areaFmt = formatAreaDisplay(property.area, property.areaUnit);

              // ── Agriculture land ─────────────────────────────────────
              if (property.agriDetails) {
                return (
                  <>
                    <Fact icon="maximize" value={`${property.agriDetails.sizeAcres}`} label="Acres" colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="droplet" value={property.agriDetails.nehriWater ? 'Yes' : 'No'} label="Nehri" colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="zap" value={property.agriDetails.tubeWell ? 'Yes' : 'No'} label="TubeWell" colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="sun" value={(property.agriDetails.mainCrop || '').split(' ')[0] || '—'} label="Crop" colors={colors} accentColor="#1a6b3a" />
                  </>
                );
              }
              if (ptype.includes('agriculture') || ptype.includes('agri')) {
                // Agri from API (no agriDetails object yet)
                const hasNehri = (property.amenities ?? []).some((a) => a.toLowerCase().includes('nehri'));
                const hasTube  = (property.amenities ?? []).some((a) => a.toLowerCase().includes('tube'));
                return (
                  <>
                    <Fact icon="maximize" value={areaFmt.value} label={areaFmt.label} colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="droplet" value={hasNehri ? 'Yes' : '—'} label="Nehri" colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="zap" value={hasTube ? 'Yes' : '—'} label="TubeWell" colors={colors} accentColor="#1a6b3a" />
                    <Fact icon="tag" value={property.type} label="Type" colors={colors} accentColor="#1a6b3a" />
                  </>
                );
              }

              // ── Plot / Commercial / Industrial ───────────────────────
              const isNonResidential =
                ptype.includes('plot') ||
                ptype.includes('commercial') ||
                ptype.includes('industrial') ||
                ptype.includes('warehouse') ||
                ptype.includes('office') ||
                ptype.includes('building');
              if (isNonResidential) {
                return (
                  <>
                    <Fact icon="maximize" value={areaFmt.value} label={areaFmt.label} colors={colors} />
                    <Fact icon="tag" value={property.type} label="Type" colors={colors} />
                  </>
                );
              }

              // ── Residential (House / Apartment / Farmhouse / etc.) ───
              return (
                <>
                  <Fact icon="home"     value={property.bedrooms  > 0 ? `${property.bedrooms}`  : '—'} label="Beds"  colors={colors} />
                  <Fact icon="droplet"  value={property.bathrooms > 0 ? `${property.bathrooms}` : '—'} label="Baths" colors={colors} />
                  <Fact icon="maximize" value={areaFmt.value} label={areaFmt.label} colors={colors} />
                  <Fact icon="tag"      value={property.type} label="Type" colors={colors} />
                </>
              );
            })()}
          </View>
        </Pressable>
      </View>

      <PropertyGalleryModal
        property={property}
        visible={galleryVisible}
        initialIndex={activeImage}
        onClose={() => setGalleryVisible(false)}
      />

      {/* ── Contact buttons (Zameen-style) ─────────────────────────────── */}
      <View style={[ctaStyles.row, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`sms:${property.agentPhone ?? '03042569000'}`); }}
          style={({ pressed }) => [ctaStyles.smsBtn, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.75 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Send SMS"
        >
          <Feather name="message-square" size={14} color={colors.foreground} />
          <Text style={[ctaStyles.smsTxt, { color: colors.foreground }]}>SMS</Text>
        </Pressable>

        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`tel:${property.agentPhone ?? '03042569000'}`); }}
          style={({ pressed }) => [ctaStyles.callBtn, { backgroundColor: colors.action, opacity: pressed ? 0.82 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Call agent"
        >
          <Feather name="phone" size={14} color={colors.actionForeground} />
          <Text style={[ctaStyles.callTxt, { color: colors.actionForeground }]}>Call</Text>
        </Pressable>

        <Pressable
          onPress={(e) => { e.stopPropagation(); void Linking.openURL(`https://wa.me/92${(property.agentPhone ?? '03042569000').replace(/\D/g, '').replace(/^0/, '')}`); }}
          style={({ pressed }) => [ctaStyles.waBtn, { opacity: pressed ? 0.75 : 1 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="WhatsApp agent"
        >
          <WhatsAppLogo size={34} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// React.memo prevents re-renders when parent list scrolls
export const PropertyCard = React.memo(PropertyCardInner);

function Fact({ icon, value, label, colors, accentColor }: {
  icon: 'home' | 'droplet' | 'maximize' | 'tag' | 'zap' | 'sun';
  value: string; label: string; colors: ReturnType<typeof useColors>; accentColor?: string;
}) {
  const iconColor = accentColor ?? colors.action;
  return (
    <View style={styles.fact}>
      <Feather name={icon} size={11} color={iconColor} />
      <Text numberOfLines={1} style={[styles.factValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.factLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const ctaStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderTopWidth: 1 },
  smsBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 8 },
  smsTxt:  { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  callBtn: { flex: 1.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, paddingVertical: 9 },
  callTxt: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  waBtn:   { width: 38, height: 34, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  card:          { width: 268, borderRadius: 18, overflow: 'hidden', marginRight: 14, borderWidth: 1, shadowColor: '#1c2024', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  compactCard:   { width: '100%', marginRight: 0, marginBottom: 14 },
  pressable:     { flex: 1 },
  imageTap:      { flex: 1 },
  imageWrap:     { height: 174, position: 'relative' },
  image:         { width: '100%', height: '100%' },
  galleryArrow:  { position: 'absolute', top: '44%', width: 30, height: 30, borderRadius: 15, backgroundColor: '#07152199', borderWidth: 1, borderColor: '#ffffff55', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  galleryArrowLeft: { left: 8 },
  galleryArrowRight:{ right: 8 },
  imageCounter:  { position: 'absolute', bottom: 8, right: 9, zIndex: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#071521bb', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4 },
  imageCounterText:{ color: '#fff', fontSize: 9, fontWeight: '700' },
  imageShade:    { ...StyleSheet.absoluteFill },
  status:        { position: 'absolute', top: 12, left: 12, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden' },
  demoBadge:    { position: 'absolute', top: 48, left: 12 },
  statusText:    { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.4 },
  featuredBadge: { position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  featuredText:  { fontFamily: 'Inter_700Bold', fontSize: 8, color: '#1c2024', letterSpacing: 0.7 },
  cardActions:   { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 7 },
  circleAction:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden', shadowColor: '#d9b96d', shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  body:          { padding: 13, overflow: 'hidden', borderTopWidth: 1 },
  bodyHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 36 },
  price:         { fontFamily: 'Inter_700Bold', fontSize: 16, marginBottom: 6 },
  title:         { fontFamily: 'PlayfairDisplay_500Medium', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaSpacer:    { flex: 1 },
  location:      { fontFamily: 'Inter_400Regular', fontSize: 11 },
  facts:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#ffffff55' },
  fact:          { flex: 1, alignItems: 'center', gap: 3, minWidth: 0 },
  factValue:     { fontFamily: 'Inter_700Bold', fontSize: 10, maxWidth: 52 },
  factLabel:     { fontFamily: 'Inter_400Regular', fontSize: 8 },
});
