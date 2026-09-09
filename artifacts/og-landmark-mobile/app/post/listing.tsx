/**
 * OG Landmark — Property Listing Wizard (Full Spec)
 * Single-page flow: Type → Location → Basic → Type-Specific → Features → Media → Docs → Preview
 * 20 property types with per-type dynamic fields.
 */
import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert, Image, Platform,
  Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { addUserListing } from '@/lib/listingsStore';
import { uploadMultipleImages, uploadVideo } from '@/lib/api';
import { LocationPicker } from '@/components/LocationPicker';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { okaraDistrict } from '@/lib/cities';

// ── Constants ──────────────────────────────────────────────────────────────────

type PropCategory =
  | 'residential'
  | 'plot'
  | 'agricultural'
  | 'commercial'
  | 'industrial'
  | 'project';

type PropType = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  emoji: string;
  category: PropCategory;
  purposes: string[];   // which purposes apply
};

const PROPERTY_TYPES: PropType[] = [
  // Residential
  { key: 'House',              icon: 'home',      emoji: '🏠', label: 'House',              category: 'residential', purposes: ['Sale', 'Rent'] },
  { key: 'Apartment',         icon: 'layers',    emoji: '🏢', label: 'Apartment / Flat',   category: 'residential', purposes: ['Sale', 'Rent'] },
  { key: 'Upper Portion',     icon: 'arrow-up',  emoji: '🏠', label: 'Upper Portion',      category: 'residential', purposes: ['Sale', 'Rent'] },
  { key: 'Lower Portion',     icon: 'arrow-down',emoji: '🏠', label: 'Lower Portion',      category: 'residential', purposes: ['Sale', 'Rent'] },
  { key: 'Room',               icon: 'square',    emoji: '🛏️', label: 'Room',               category: 'residential', purposes: ['Rent'] },
  { key: 'Villa',              icon: 'home',      emoji: '🏡', label: 'Villa',              category: 'residential', purposes: ['Sale', 'Rent'] },
  { key: 'Farm House',        icon: 'home',      emoji: '🌳', label: 'Farm House',         category: 'residential', purposes: ['Sale', 'Rent'] },
  // Plots
  { key: 'Residential Plot',  icon: 'map-pin',   emoji: '📐', label: 'Residential Plot',   category: 'plot',        purposes: ['Sale'] },
  { key: 'Commercial Plot',   icon: 'map-pin',   emoji: '🏢', label: 'Commercial Plot',    category: 'plot',        purposes: ['Sale'] },
  // Agricultural
  { key: 'Agricultural Land', icon: 'map',       emoji: '🌾', label: 'Agricultural Land',  category: 'agricultural',purposes: ['Sale', 'Lease'] },
  { key: 'Farm / Orchard',    icon: 'feather',   emoji: '🌳', label: 'Farm / Orchard',     category: 'agricultural',purposes: ['Sale', 'Lease'] },
  // Commercial
  { key: 'Shop',               icon: 'shopping-bag', emoji: '🛍️', label: 'Shop',            category: 'commercial',  purposes: ['Sale', 'Rent'] },
  { key: 'Office',             icon: 'monitor',   emoji: '💼', label: 'Office',             category: 'commercial',  purposes: ['Sale', 'Rent'] },
  { key: 'Building / Plaza',  icon: 'grid',      emoji: '🏢', label: 'Building / Plaza',   category: 'commercial',  purposes: ['Sale', 'Rent'] },
  { key: 'Warehouse',          icon: 'archive',   emoji: '📦', label: 'Warehouse',          category: 'commercial',  purposes: ['Sale', 'Rent'] },
  { key: 'Showroom',           icon: 'eye',       emoji: '🏬', label: 'Showroom',           category: 'commercial',  purposes: ['Sale', 'Rent'] },
  // Industrial
  { key: 'Factory',            icon: 'zap',       emoji: '🏭', label: 'Factory / Industrial', category: 'industrial', purposes: ['Sale', 'Rent'] },
  { key: 'Industrial Land',   icon: 'layout',    emoji: '🏭', label: 'Industrial Land',    category: 'industrial',  purposes: ['Sale', 'Lease'] },
  // Projects
  { key: 'Housing Society',   icon: 'home',      emoji: '🏗️', label: 'Housing Society',    category: 'project',     purposes: ['Sale'] },
  { key: 'Apartment Project', icon: 'layers',    emoji: '🏙️', label: 'Apt / Villa Project',category: 'project',     purposes: ['Sale'] },
];

const TYPE_GROUPS: { label: string; category: PropCategory; emoji: string }[] = [
  { label: 'Residential', category: 'residential', emoji: '🏠' },
  { label: 'Plots',        category: 'plot',        emoji: '📐' },
  { label: 'Agricultural', category: 'agricultural',emoji: '🌾' },
  { label: 'Commercial',   category: 'commercial',  emoji: '🛍️' },
  { label: 'Industrial',   category: 'industrial',  emoji: '🏭' },
  { label: 'Projects',     category: 'project',     emoji: '🏗️' },
];

const PURPOSES = ['Sale', 'Rent', 'Lease'] as const;
type Purpose = (typeof PURPOSES)[number];

const AREA_UNITS = ['Marla', 'Kanal', 'Acre', 'Sq. Ft.'] as const;
const FURNISHING = ['Furnished', 'Semi-Furnished', 'Unfurnished'];
const FACING_OPTS = ['East', 'West', 'North', 'South', 'Corner'];
const CITIES = okaraDistrict.cities;

const FEATURES_BY_CAT: Record<PropCategory, string[]> = {
  residential:  ['Electricity', 'Gas', 'Water', 'Sewerage', 'Internet', 'Solar', 'Backup Generator',
                  'Security', 'CCTV', 'Parking', 'Lawn / Garden', 'Servant Quarter', 'Drawing Room',
                  'Dining Room', 'TV Lounge', 'Store Room', 'Terrace', 'Balcony', 'Garage'],
  plot:         ['Corner', 'Park Facing', 'Mosque Facing', 'Main Boulevard', 'Main Road', 'Electricity',
                  'Gas', 'Water', 'Sewerage', 'Gated / Boundary Wall', 'Possession Ready', 'Developed', 'Balloted'],
  agricultural: ['Nehri Water', 'Tube Well', 'Solar Tube Well', 'Electric Tube Well', 'Diesel Tube Well',
                  'Electricity', 'Road Access', 'Paved Road', 'Boundary Wall', 'Fencing', 'Farmhouse',
                  'Orchard', 'Irrigation Channel', 'Nearby Canal', 'Livestock Area', 'Store / Warehouse'],
  commercial:   ['Main Road', 'Corner', 'Parking', 'Electricity', 'Gas', 'Water', 'Lift', 'Escalator',
                  'Reception', 'Washrooms', 'Backup Generator', 'Solar', 'CCTV', 'Security', 'Internet',
                  'AC', 'Fire Safety'],
  industrial:   ['Electricity', 'Gas', 'Water', 'Tube Well', 'Truck Access', 'Loading Dock',
                  'High Ceiling', 'Road Frontage', 'Security', 'CCTV', 'Fire Safety', 'Labour Facilities',
                  'Industrial Zone', 'Drainage'],
  project:      ['Gated Community', 'Security', 'CCTV', 'Park', 'Mosque', 'School', 'Commercial Area',
                  'Gym', 'Swimming Pool', 'Community Hall', 'Electricity', 'Gas', 'Water', 'Sewerage',
                  'Backup Power', 'Underground Utilities', 'NOC Approved'],
};

const DOCUMENTS_BY_CAT: Record<PropCategory, string[]> = {
  residential:  ['Ownership Documents', 'Sale Deed', 'Allotment Letter', 'Registry', 'Other'],
  plot:         ['Allotment Letter', 'Registry', 'Sale Deed', 'NOC', 'Ownership Documents', 'Other'],
  agricultural: ['Fard', 'Registry', 'Mutation', 'Ownership Documents', 'NOC / Legal Status', 'Other'],
  commercial:   ['Ownership Documents', 'Sale Deed', 'Registry', 'Commercial Approval', 'NOC', 'Other'],
  industrial:   ['Ownership Documents', 'Industrial NOC', 'Approvals', 'Registry', 'Other'],
  project:      ['Project Documents', 'NOC Status', 'Developer Approval', 'Payment Plan Details', 'Other'],
};

const OWNERSHIP_OPTS = ['Owner', 'Authorized Agent', 'Developer', 'Company'];

// ── Form type ──────────────────────────────────────────────────────────────────

type Form = {
  // Step 1
  propertyType:      string;
  purpose:           string;
  // Step 2 – Location
  city:              string;
  locality:          string;
  society:           string;
  block:             string;
  street:            string;
  landmark:          string;
  latitude:          number | null;
  longitude:         number | null;
  fullAddress:       string;
  placeId:           string;
  locationAccuracy:  number | null;
  locationSource:    string;
  // Step 3 – Basic
  title:             string;
  price:             string;
  isNegotiable:      boolean;
  area:              string;
  areaUnit:          string;
  // Step 4 – Type-specific (shared fields used across types)
  bedrooms:          string;
  bathrooms:         string;
  floors:            string;
  coveredArea:       string;
  furnishing:        string;
  constructionYear:  string;
  parking:           string;
  facing:            string;
  isCorner:          boolean;
  isMainRoad:        boolean;
  isParkFacing:      boolean;
  // House / Villa extras
  roadFront:         string;
  plotDimensions:    string;
  drawingRoom:       boolean;
  diningRoom:        boolean;
  tvLounge:          boolean;
  kitchen:           boolean;
  storeRoom:         boolean;
  servantQuarter:    boolean;
  lawn:              boolean;
  terrace:           boolean;
  balcony:           boolean;
  garage:            boolean;
  // Apartment extras
  floorNumber:       string;
  totalFloors:       string;
  lift:              boolean | null;
  maintenanceCharges:string;
  possessionStatus:  string;
  // Portion extras
  separateEntrance:  boolean | null;
  sepElecMeter:      boolean | null;
  sepGasMeter:       boolean | null;
  // Room extras
  roomType:          string;
  attachedBath:      boolean | null;
  minimumStay:       string;
  availableFrom:     string;
  electricityInc:    boolean | null;
  gasInc:            boolean | null;
  waterInc:          boolean | null;
  familyPref:        string;
  // Farm House extras
  roadAccess:        boolean | null;
  boundaryWall:      boolean | null;
  orchard:           boolean | null;
  tubeWell:          boolean | null;
  waterSource:       string;
  farmArea:          string;
  guestHouse:        boolean | null;
  // Plot extras
  roadWidth:         string;
  devStatus:         string;
  // Agri extras
  landType:          string;
  nehriWater:        boolean | null;
  tubeWellType:      string;
  soilType:          string;
  landLevel:         string;
  currentCrop:       string;
  trees:             string;
  nearbyCanalRiver:  string;
  fardAvailable:     boolean | null;
  registryAvailable: boolean | null;
  mutationAvailable: boolean | null;
  // Farm / Orchard extras
  farmType:          string;
  orchardType:       string;
  numberOfTrees:     string;
  productionStatus:  string;
  // Shop extras
  shopDimensions:    string;
  glassFront:        boolean | null;
  shutter:           boolean | null;
  washroom:          boolean | null;
  storage:           boolean | null;
  // Office extras
  cabins:            string;
  meetingRoom:       boolean | null;
  reception:         boolean | null;
  backupPower:       boolean | null;
  // Building / Plaza extras
  numShops:          string;
  numOffices:        string;
  numApartments:     string;
  occupancyStatus:   string;
  rentalIncome:      string;
  // Warehouse extras
  warehouseHeight:   string;
  truckAccess:       boolean | null;
  electricityLoad:   string;
  // Factory extras
  factoryType:       string;
  machineryIncluded: boolean | null;
  industrialZone:    string;
  // Showroom extras
  ceilingHeight:     string;
  displayArea:       string;
  // Industrial Land extras
  heavyVehicleAccess:boolean | null;
  nocStatus:         string;
  // Project extras
  projectName:       string;
  developer:         string;
  totalUnits:        string;
  startingPrice:     string;
  paymentPlan:       string;
  downPayment:       string;
  installmentPlan:   string;
  possessionDate:    string;
  plotSizes:         string;
  // Step 5
  features:          string[];
  // Step 6
  photos:            string[];
  coverPhotoIndex:   number;
  video:             { uri: string; duration?: number; filename?: string } | null;
  // Step 7
  description:       string;
  keyHighlights:     string;
  ownershipStatus:   string;
  documents:         string[];
  showWhatsApp:      boolean;
  allowCalls:        boolean;
};

const defaultForm = (): Form => ({
  propertyType: 'House', purpose: 'Sale',
  city: 'Okara', locality: '', society: '', block: '', street: '', landmark: '',
  latitude: null, longitude: null, fullAddress: '', placeId: '',
  locationAccuracy: null, locationSource: '',
  title: '', price: '', isNegotiable: false,
  area: '', areaUnit: 'Marla',
  bedrooms: '', bathrooms: '', floors: '', coveredArea: '', furnishing: 'Unfurnished',
  constructionYear: '', parking: '', facing: '',
  isCorner: false, isMainRoad: false, isParkFacing: false,
  roadFront: '', plotDimensions: '',
  drawingRoom: false, diningRoom: false, tvLounge: false, kitchen: false,
  storeRoom: false, servantQuarter: false, lawn: false, terrace: false, balcony: false, garage: false,
  floorNumber: '', totalFloors: '', lift: null, maintenanceCharges: '', possessionStatus: '',
  separateEntrance: null, sepElecMeter: null, sepGasMeter: null,
  roomType: 'Single', attachedBath: null, minimumStay: '', availableFrom: '',
  electricityInc: null, gasInc: null, waterInc: null, familyPref: 'Any',
  roadAccess: null, boundaryWall: null, orchard: null, tubeWell: null,
  waterSource: '', farmArea: '', guestHouse: null,
  roadWidth: '', devStatus: '',
  landType: '', nehriWater: null, tubeWellType: '', soilType: '', landLevel: '',
  currentCrop: '', trees: '', nearbyCanalRiver: '',
  fardAvailable: null, registryAvailable: null, mutationAvailable: null,
  farmType: '', orchardType: '', numberOfTrees: '', productionStatus: '',
  shopDimensions: '', glassFront: null, shutter: null, washroom: null, storage: null,
  cabins: '', meetingRoom: null, reception: null, backupPower: null,
  numShops: '', numOffices: '', numApartments: '', occupancyStatus: '', rentalIncome: '',
  warehouseHeight: '', truckAccess: null, electricityLoad: '',
  factoryType: '', machineryIncluded: null, industrialZone: '',
  ceilingHeight: '', displayArea: '',
  heavyVehicleAccess: null, nocStatus: '',
  projectName: '', developer: '', totalUnits: '', startingPrice: '', paymentPlan: '',
  downPayment: '', installmentPlan: '', possessionDate: '', plotSizes: '',
  features: [],
  photos: [], coverPhotoIndex: 0, video: null,
  description: '', keyHighlights: '',
  ownershipStatus: 'Owner', documents: [],
  showWhatsApp: true, allowCalls: true,
});

function categoryOf(type: string): PropCategory {
  return PROPERTY_TYPES.find((t) => t.key === type)?.category ?? 'residential';
}

function purposesFor(type: string): string[] {
  return PROPERTY_TYPES.find((t) => t.key === type)?.purposes ?? ['Sale', 'Rent'];
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ListingWizard() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ purpose?: string }>();

  const topInset = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const [form, setForm] = useState<Form>(() => {
    const f = defaultForm();
    if (params.purpose === 'rent') f.purpose = 'Rent';
    return f;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const category = categoryOf(form.propertyType);
  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.city) e.city = 'Select a city';
    if (form.latitude == null || form.longitude == null) {
      e.location = 'Set the exact property pin using search, GPS, the map, or coordinates';
    } else if (!locationConfirmed) {
      e.location = 'Confirm the exact property pin before submitting';
    }
    if (!form.price.trim() || isNaN(Number(form.price.replace(/[^0-9]/g, '')))) e.price = 'Enter a valid price';
    if (!form.area.trim() || isNaN(Number(form.area))) e.area = 'Enter a valid area';
    if (form.photos.length === 0) e.photos = 'Add at least one photo';
    if (form.description.trim().length < 20) e.description = 'Description must be at least 20 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Media pickers ──────────────────────────────────────────────────────────

  const pickPhotos = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access to add photos.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, quality: 0.82, selectionLimit: 30,
    });
    if (!result.canceled) update({ photos: [...form.photos, ...result.assets.map((a) => a.uri)].slice(0, 30) });
  };

  const pickVideo = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access to add a video.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false, videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      update({ video: { uri: a.uri, duration: a.duration ?? undefined, filename: a.fileName ?? 'video.mp4' } });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!validate()) {
      Alert.alert('Complete your listing', 'Please fill in the highlighted required details before submitting.');
      return;
    }
    if (form.latitude == null || form.longitude == null || !locationConfirmed) {
      setErrors((prev) => ({ ...prev, location: 'Confirm the exact property pin before publishing' }));
      Alert.alert('Confirm Property Location', 'Please set and confirm the exact property pin before publishing this listing.');
      return;
    }
    setSubmitting(true);
    try {
      const priceNum = Number(form.price.replace(/[^0-9]/g, ''));
      let uploadedImages: string[] = [];
      if (form.photos.length > 0) {
        try { uploadedImages = await uploadMultipleImages(form.photos); }
        catch { throw new Error('Photos could not be uploaded. Please check your connection and try again.'); }
      }
      let uploadedVideoUrl: string | undefined;
      if (form.video?.uri) {
        try { uploadedVideoUrl = (await uploadVideo(form.video.uri, form.video.filename ?? 'video.mp4')).url; }
        catch { throw new Error('Video could not be uploaded. Please try again or remove the video.'); }
      }
      const location = [form.locality, form.society, form.city].filter(Boolean).join(', ');
      const propertyDetails = Object.fromEntries(
        Object.entries(form).filter(([key]) => key !== 'photos' && key !== 'video'),
      );
      const district = form.city.toLowerCase() === 'depalpur'
        ? 'Okara'
        : form.city;
      await addUserListing({
        id: `listing_${Date.now()}`,
        postedBy: user?.id ?? 'unknown',
        agentName: user?.name ?? '',
        role: 'agent',
        title: form.title || `${form.propertyType} ${form.purpose === 'Rent' ? 'for Rent' : form.purpose === 'Lease' ? 'for Lease' : 'for Sale'} in ${form.city}`,
        type: form.propertyType,
        category,
        status: form.purpose === 'Rent' ? 'For Rent' : 'For Sale',
        price: priceNum,
        area: Number(form.area) || 0,
        areaUnit: form.areaUnit,
        city: form.city,
        neighborhood: form.locality,
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        postedAt: new Date().toISOString(),
        listingStatus: 'Pending',
        views: 0, saves: 0, leadsCount: 0,
        images: uploadedImages,
        videoUrl: uploadedVideoUrl,
        features: form.features,
        documents: form.documents,
        district,
        locality: form.locality,
        tehsil: form.city,
        propertyDetails,
        latitude: form.latitude,
        longitude: form.longitude,
        fullAddress: form.fullAddress,
        placeId: form.placeId || undefined,
        locationAccuracy: form.locationAccuracy ?? undefined,
        locationSource: form.locationSource || undefined,
        location: {
          latitude: form.latitude,
          longitude: form.longitude,
          city: form.city,
          district,
          tehsil: form.city,
          locality: form.locality,
          address: form.fullAddress || location,
          province: 'Punjab',
          country: 'Pakistan',
          source: form.locationSource || 'manual',
          accuracy: form.locationAccuracy,
          placeId: form.placeId || null,
        },
        description: [
          form.description,
          form.keyHighlights ? `Key Highlights: ${form.keyHighlights}` : '',
          form.features.length > 0 ? `Features: ${form.features.join(', ')}` : '',
          form.ownershipStatus ? `Ownership: ${form.ownershipStatus}` : '',
          form.isNegotiable ? 'Price is negotiable' : '',
          form.documents.length > 0 ? `Documents: ${form.documents.join(', ')}` : '',
        ].filter(Boolean).join('\n\n'),
        // Agri specifics
        ...(category === 'agricultural' && { nehriWater: form.nehriWater, tubeWell: form.tubeWell, soilType: form.soilType, mainCrop: form.currentCrop }),
      });
      setSubmitted(true);
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Could not save listing. Please try again.';
      Alert.alert('Could not save listing', message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={[s.successIcon, { backgroundColor: '#1a6b3a14', borderColor: '#1a6b3a33' }]}>
          <Feather name="check-circle" size={42} color="#1a6b3a" />
        </View>
        <Text style={[s.successTitle, { color: colors.foreground }]}>Property Submitted!</Text>
        <Text style={[s.successBody, { color: colors.mutedForeground }]}>
          Our team will review your listing before it goes live. You'll be notified once it's approved.
        </Text>
        <View style={[s.reviewBadge, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <Feather name="clock" size={13} color={colors.accentForeground} />
          <Text style={[s.reviewText, { color: colors.accentForeground }]}>PENDING REVIEW</Text>
        </View>
        <AnimatedPressable onPress={() => router.push('/(tabs)/listings')} style={[s.successBtn, { backgroundColor: colors.action, marginTop: 24 }]}>
          <Text style={[s.successBtnText, { color: colors.actionForeground }]}>View My Listings</Text>
          <Feather name="arrow-right" size={16} color={colors.actionForeground} />
        </AnimatedPressable>
        <Pressable onPress={() => router.push('/(tabs)/' as any)} style={{ marginTop: 14 }} hitSlop={10}>
          <Text style={[s.successLink, { color: colors.action }]}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Fixed header ─────────────────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: colors.background, paddingTop: topInset + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={[s.backBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Feather name="arrow-left" size={16} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
          <Text style={[s.headerStep, { color: colors.mutedForeground }]}>CREATE PROPERTY LISTING</Text>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Complete all details in one form</Text>
          <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[s.progressFill, { width: '100%', backgroundColor: colors.action }]} />
          </View>
        </View>
        <View style={[s.purposeBadge, { backgroundColor: colors.accent, borderColor: colors.goldGlassBorder }]}>
          <Feather name="tag" size={11} color={colors.accentForeground} />
          <Text style={[s.purposeBadgeText, { color: colors.accentForeground }]}>FOR {form.purpose.toUpperCase()}</Text>
        </View>
      </View>

      {/* ── Single-page form ──────────────────────────────────────────────── */}
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: insets.bottom + 34 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={28}
      >
        {Object.keys(errors).length > 0 && (
          <View style={[s.validationBanner, { backgroundColor: '#e53e3e12', borderColor: '#e53e3e55' }]}>
            <Feather name="alert-circle" size={16} color="#e53e3e" />
            <Text style={[s.validationText, { color: '#b42318' }]}>
              Please review the highlighted required fields before submitting.
            </Text>
          </View>
        )}

        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepType form={form} update={update} colors={colors} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepLocation
            form={form}
            update={update}
            colors={colors}
            errors={errors}
            onConfirmationChange={setLocationConfirmed}
          />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepBasic form={form} update={update} colors={colors} errors={errors} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepSpecific form={form} update={update} colors={colors} category={category} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepFeatures form={form} update={update} colors={colors} category={category} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepMedia form={form} update={update} colors={colors} errors={errors} pickPhotos={pickPhotos} pickVideo={pickVideo} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepDocs form={form} update={update} colors={colors} errors={errors} user={user} category={category} />
        </View>
        <View style={[s.formSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StepPreview form={form} colors={colors} category={category} />
        </View>

        <View style={[s.submitSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.submitIcon, { backgroundColor: colors.action + '16' }]}>
            <Feather name="check-circle" size={22} color={colors.action} />
          </View>
          <Text style={[s.submitTitle, { color: colors.foreground }]}>Ready to submit?</Text>
          <Text style={[s.submitHint, { color: colors.mutedForeground }]}>
            Review your details above. Your property will go to the OG Landmark team for approval before it becomes public.
          </Text>
          <AnimatedPressable
            onPress={submitting ? undefined : submit}
            style={[s.submitBtn, { backgroundColor: colors.action, opacity: submitting ? 0.65 : 1 }]}
          >
            <Text style={[s.submitBtnText, { color: colors.actionForeground }]}>
              {submitting ? 'Submitting…' : 'Submit Property for Review'}
            </Text>
            <Feather name="arrow-up-right" size={17} color={colors.actionForeground} />
          </AnimatedPressable>
          <Text style={[s.submitFootnote, { color: colors.mutedForeground }]}>
            Required fields are marked with *
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// ── SECTION 1: Property Type ───────────────────────────────────────────────────

function StepType({ form, update, colors }: { form: Form; update: (p: Partial<Form>) => void; colors: any }) {
  const [activeGroup, setActiveGroup] = useState<PropCategory>(categoryOf(form.propertyType));
  const typesInGroup = PROPERTY_TYPES.filter((t) => t.category === activeGroup);
  const availablePurposes = purposesFor(form.propertyType);

  const handleTypeSelect = (key: string) => {
    const purposes = purposesFor(key);
    const newPurpose = purposes.includes(form.purpose) ? form.purpose : purposes[0];
    update({ propertyType: key, purpose: newPurpose });
  };

  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 1</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>What are you listing?</Text>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {TYPE_GROUPS.map((g) => {
          const active = g.category === activeGroup;
          return (
            <Pressable key={g.category} onPress={() => setActiveGroup(g.category)}
               style={[s.groupTab, { backgroundColor: active ? colors.selectionBackground : colors.secondary, borderColor: active ? colors.selectionBorder : colors.border, borderWidth: active ? 1.5 : 1 }]}>
              <Text style={{ fontSize: 12 }}>{g.emoji}</Text>
               <Text style={[s.groupTabText, { color: active ? colors.selectionForeground : colors.foreground, fontWeight: active ? '600' : '400' }]}>{g.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Types grid */}
      <View style={s.typeGrid}>
        {typesInGroup.map((t) => {
          const sel = form.propertyType === t.key;
          return (
            <Pressable key={t.key} onPress={() => handleTypeSelect(t.key)}
               style={[s.typeCard, { backgroundColor: sel ? colors.selectionBackground : colors.card, borderColor: sel ? colors.selectionBorder : colors.border, borderWidth: sel ? 2 : 1 }]}>
              <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
               <Text style={[s.typeLabel, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Purpose selector */}
      <Text style={[s.label, { color: colors.foreground, marginTop: 20 }]}>Purpose</Text>
      <View style={s.purposeRow}>
        {availablePurposes.map((p) => (
          <Pressable key={p} onPress={() => update({ purpose: p })}
            style={[s.purposeBtn, {
               backgroundColor: form.purpose === p ? colors.selectionBackground : colors.secondary,
               borderColor: form.purpose === p ? colors.selectionBorder : colors.border,
               borderWidth: form.purpose === p ? 1.5 : 1,
              flex: 1,
            }]}>
             <Text style={[s.purposeBtnText, { color: form.purpose === p ? colors.selectionForeground : colors.foreground, fontWeight: form.purpose === p ? '600' : '400' }]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      {/* Info hint */}
      <View style={[s.hintBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={12} color={colors.mutedForeground} />
        <Text style={[s.hintText, { color: colors.mutedForeground }]}>
          The fields shown in the next steps will be tailored to your property type.
        </Text>
      </View>
    </AnimatedReveal>
  );
}

// ── SECTION 2: Location ─────────────────────────────────────────────────────────

function StepLocation({ form, update, colors, errors, onConfirmationChange }: any) {
  const neighborhoods = okaraDistrict.areas[form.city] ?? [];
  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 2</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Location</Text>

      <Label colors={colors}>City *</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
        {CITIES.map((c) => (
          <Pressable key={c} onPress={() => update({
            city: c,
            locality: '',
            // A pin from another city would be misleading. Recenter the map
            // on the newly selected city and let the user choose a new pin.
            latitude: null,
            longitude: null,
            fullAddress: '',
            placeId: '',
            locationAccuracy: null,
            locationSource: '',
          })}
             style={[s.chip, { backgroundColor: form.city === c ? colors.selectionBackground : colors.secondary, borderColor: form.city === c ? colors.selectionBorder : colors.border, borderWidth: form.city === c ? 1.5 : 1 }]}>
             <Text style={[s.chipText, { color: form.city === c ? colors.selectionForeground : colors.foreground, fontWeight: form.city === c ? '600' : '400' }]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {errors.city ? <Text style={s.errorText}>{errors.city}</Text> : null}

      {neighborhoods.length > 0 && (
        <>
          <Label colors={colors}>Area / Locality</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 14 }}>
            {neighborhoods.map((n: string) => (
              <Pressable key={n} onPress={() => update({ locality: n })}
                 style={[s.chip, { backgroundColor: form.locality === n ? colors.selectionBackground : colors.secondary, borderColor: form.locality === n ? colors.selectionBorder : colors.border, borderWidth: form.locality === n ? 1.5 : 1 }]}>
                 <Text style={[s.chipText, { color: form.locality === n ? colors.selectionForeground : colors.foreground, fontWeight: form.locality === n ? '600' : '400' }]}>{n}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <WizField label="Society / Scheme" placeholder="e.g. Canal View Society" value={form.society} onChangeText={(v: string) => update({ society: v })} colors={colors} optional />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <WizField label="Block" placeholder="e.g. Block A" value={form.block} onChangeText={(v: string) => update({ block: v })} colors={colors} optional />
        </View>
        <View style={{ flex: 1 }}>
          <WizField label="Street / House #" placeholder="e.g. Street 4" value={form.street} onChangeText={(v: string) => update({ street: v })} colors={colors} optional />
        </View>
      </View>
      <WizField label="Nearby Landmark" placeholder="e.g. Near Government Hospital" value={form.landmark} onChangeText={(v: string) => update({ landmark: v })} colors={colors} optional />

      <LocationPicker
        latitude={form.latitude} longitude={form.longitude}
        address={form.fullAddress}
        city={form.city}
        locality={form.locality}
        onChange={(lat, lng, addr) => update({ latitude: lat, longitude: lng, fullAddress: addr ?? form.fullAddress })}
        onLocationChange={(loc) => update({
          latitude: loc.latitude,
          longitude: loc.longitude,
          fullAddress: loc.fullAddress,
          placeId: loc.placeId ?? '',
          locationAccuracy: loc.accuracy ?? null,
          locationSource: loc.locationSource,
          ...(loc.city && { city: loc.city }),
          ...(loc.locality && { locality: loc.locality }),
        })}
        onClear={() => update({
          latitude: null,
          longitude: null,
          fullAddress: '',
          placeId: '',
          locationAccuracy: null,
          locationSource: '',
        })}
        colors={colors}
        requireConfirm
        onConfirmationChange={onConfirmationChange}
        errorMessage={errors.location}
      />
    </AnimatedReveal>
  );
}

// ── SECTION 3: Basic Details ────────────────────────────────────────────────────

function StepBasic({ form, update, colors, errors }: any) {
  const isRent = form.purpose === 'Rent';
  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 3</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Basic Details</Text>

      <WizField label="Listing Title" optional
        placeholder={`e.g. ${form.propertyType} ${isRent ? 'for Rent' : 'for Sale'} in ${form.city}`}
        value={form.title} onChangeText={(v: string) => update({ title: v })} colors={colors} />

      <WizField
        label={isRent ? 'Monthly Rent (PKR) *' : form.purpose === 'Lease' ? 'Lease Price (PKR) *' : 'Sale Price (PKR) *'}
        placeholder="e.g. 8500000" keyboardType="numeric"
        value={form.price} onChangeText={(v: string) => update({ price: v })}
        colors={colors} error={errors.price}
      />
      <ToggleRow label="Price Negotiable" value={form.isNegotiable} onChange={(v: boolean) => update({ isNegotiable: v })} colors={colors} />

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <WizField label="Area *" placeholder="e.g. 10" keyboardType="numeric"
            value={form.area} onChangeText={(v: string) => update({ area: v })} colors={colors} error={errors.area} />
        </View>
        <View style={{ flex: 1 }}>
          <Label colors={colors}>Unit</Label>
          <View style={s.unitSeg}>
            {AREA_UNITS.map((u) => (
              <Pressable key={u} onPress={() => update({ areaUnit: u })}
                 style={[s.unitBtn, { backgroundColor: form.areaUnit === u ? colors.selectionBackground : 'transparent', borderColor: form.areaUnit === u ? colors.selectionBorder : 'transparent', borderWidth: form.areaUnit === u ? 1.5 : 0 }]}>
                 <Text style={[s.unitText, { color: form.areaUnit === u ? colors.selectionForeground : colors.mutedForeground, fontWeight: form.areaUnit === u ? '600' : '400' }]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </AnimatedReveal>
  );
}

// ── SECTION 4: Type-Specific Fields ────────────────────────────────────────────

function StepSpecific({ form, update, colors, category }: any) {
  const type = form.propertyType;

  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 4</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Property Details</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Specific fields for {type}. Optional unless marked *.</Text>

      {/* ── House / Villa ─────────────────────────────────────── */}
      {(type === 'House' || type === 'Villa') && (
        <HouseFields form={form} update={update} colors={colors} />
      )}

      {/* ── Apartment / Flat ─────────────────────────────────── */}
      {type === 'Apartment' && (
        <ApartmentFields form={form} update={update} colors={colors} />
      )}

      {/* ── Upper / Lower Portion ─────────────────────────────── */}
      {(type === 'Upper Portion' || type === 'Lower Portion') && (
        <PortionFields form={form} update={update} colors={colors} />
      )}

      {/* ── Room ──────────────────────────────────────────────── */}
      {type === 'Room' && (
        <RoomFields form={form} update={update} colors={colors} />
      )}

      {/* ── Farm House ───────────────────────────────────────── */}
      {type === 'Farm House' && (
        <FarmHouseFields form={form} update={update} colors={colors} />
      )}

      {/* ── Residential / Commercial Plot ─────────────────────── */}
      {(type === 'Residential Plot' || type === 'Commercial Plot') && (
        <PlotFields form={form} update={update} colors={colors} />
      )}

      {/* ── Agricultural Land ─────────────────────────────────── */}
      {type === 'Agricultural Land' && (
        <AgriFields form={form} update={update} colors={colors} />
      )}

      {/* ── Farm / Orchard ───────────────────────────────────── */}
      {type === 'Farm / Orchard' && (
        <FarmOrchardFields form={form} update={update} colors={colors} />
      )}

      {/* ── Shop ─────────────────────────────────────────────── */}
      {type === 'Shop' && (
        <ShopFields form={form} update={update} colors={colors} />
      )}

      {/* ── Office ───────────────────────────────────────────── */}
      {type === 'Office' && (
        <OfficeFields form={form} update={update} colors={colors} />
      )}

      {/* ── Building / Plaza ─────────────────────────────────── */}
      {type === 'Building / Plaza' && (
        <BuildingFields form={form} update={update} colors={colors} />
      )}

      {/* ── Warehouse ────────────────────────────────────────── */}
      {type === 'Warehouse' && (
        <WarehouseFields form={form} update={update} colors={colors} />
      )}

      {/* ── Factory ──────────────────────────────────────────── */}
      {type === 'Factory' && (
        <FactoryFields form={form} update={update} colors={colors} />
      )}

      {/* ── Showroom ─────────────────────────────────────────── */}
      {type === 'Showroom' && (
        <ShowroomFields form={form} update={update} colors={colors} />
      )}

      {/* ── Industrial Land ──────────────────────────────────── */}
      {type === 'Industrial Land' && (
        <IndustrialLandFields form={form} update={update} colors={colors} />
      )}

      {/* ── Housing Society ──────────────────────────────────── */}
      {type === 'Housing Society' && (
        <ProjectFields form={form} update={update} colors={colors} />
      )}

      {/* ── Apartment / Villa Project ─────────────────────────── */}
      {type === 'Apartment Project' && (
        <AptProjectFields form={form} update={update} colors={colors} />
      )}
    </AnimatedReveal>
  );
}

// ── Type-specific sub-forms ────────────────────────────────────────────────────

function HouseFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Bedrooms" placeholder="e.g. 4" keyboardType="numeric" value={form.bedrooms} onChangeText={(v: string) => update({ bedrooms: v })} colors={colors} />
        <WizField label="Bathrooms" placeholder="e.g. 3" keyboardType="numeric" value={form.bathrooms} onChangeText={(v: string) => update({ bathrooms: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Floors" placeholder="e.g. 2" keyboardType="numeric" value={form.floors} onChangeText={(v: string) => update({ floors: v })} colors={colors} />
        <WizField label="Parking" placeholder="e.g. 1" keyboardType="numeric" value={form.parking} onChangeText={(v: string) => update({ parking: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Furnishing</Label>
      <ChipRow options={FURNISHING} selected={form.furnishing} onSelect={(v: string) => update({ furnishing: v })} colors={colors} />
      <Row2>
        <WizField label="Covered Area" placeholder="e.g. 8 Marla" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
        <WizField label="Plot Dimensions" placeholder="e.g. 40×60 ft" value={form.plotDimensions} onChangeText={(v: string) => update({ plotDimensions: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Road Front" placeholder="e.g. 40 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
        <WizField label="Construction Year" placeholder="e.g. 2018" keyboardType="numeric" value={form.constructionYear} onChangeText={(v: string) => update({ constructionYear: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Facing</Label>
      <ChipRow options={FACING_OPTS} selected={form.facing} onSelect={(v: string) => update({ facing: v })} colors={colors} />
      <Label colors={colors}>Property Attributes</Label>
      <BoolGrid items={[
        { key: 'isCorner', label: 'Corner' }, { key: 'isMainRoad', label: 'Main Road' },
        { key: 'drawingRoom', label: 'Drawing Room' }, { key: 'diningRoom', label: 'Dining Room' },
        { key: 'tvLounge', label: 'TV Lounge' }, { key: 'kitchen', label: 'Kitchen' },
        { key: 'storeRoom', label: 'Store Room' }, { key: 'servantQuarter', label: 'Servant Quarter' },
        { key: 'lawn', label: 'Lawn / Garden' }, { key: 'terrace', label: 'Terrace' },
        { key: 'balcony', label: 'Balcony' }, { key: 'garage', label: 'Garage' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function ApartmentFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Bedrooms" placeholder="e.g. 2" keyboardType="numeric" value={form.bedrooms} onChangeText={(v: string) => update({ bedrooms: v })} colors={colors} />
        <WizField label="Bathrooms" placeholder="e.g. 2" keyboardType="numeric" value={form.bathrooms} onChangeText={(v: string) => update({ bathrooms: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Floor Number" placeholder="e.g. 3" keyboardType="numeric" value={form.floorNumber} onChangeText={(v: string) => update({ floorNumber: v })} colors={colors} />
        <WizField label="Total Floors" placeholder="e.g. 10" keyboardType="numeric" value={form.totalFloors} onChangeText={(v: string) => update({ totalFloors: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Covered Area" placeholder="e.g. 1,200 sq ft" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
        <WizField label="Construction Year" placeholder="e.g. 2020" keyboardType="numeric" value={form.constructionYear} onChangeText={(v: string) => update({ constructionYear: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Furnishing</Label>
      <ChipRow options={FURNISHING} selected={form.furnishing} onSelect={(v: string) => update({ furnishing: v })} colors={colors} />
      <Label colors={colors}>Facing</Label>
      <ChipRow options={FACING_OPTS} selected={form.facing} onSelect={(v: string) => update({ facing: v })} colors={colors} />
      <Label colors={colors}>Possession Status</Label>
      <ChipRow options={['Ready', 'Under Construction', 'On Booking']} selected={form.possessionStatus} onSelect={(v: string) => update({ possessionStatus: v })} colors={colors} />
      <WizField label="Maintenance Charges" placeholder="e.g. PKR 3,000 / month" value={form.maintenanceCharges} onChangeText={(v: string) => update({ maintenanceCharges: v })} colors={colors} />
      <Label colors={colors}>Amenities</Label>
      <BoolGrid items={[
        { key: 'isCorner', label: 'Corner Unit' }, { key: 'balcony', label: 'Balcony' },
        { key: 'parking', label: 'Parking' }, { key: 'lift', label: 'Lift' },
      ]} form={form} update={update} colors={colors} tristate />
    </>
  );
}

function PortionFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Bedrooms" placeholder="e.g. 3" keyboardType="numeric" value={form.bedrooms} onChangeText={(v: string) => update({ bedrooms: v })} colors={colors} />
        <WizField label="Bathrooms" placeholder="e.g. 2" keyboardType="numeric" value={form.bathrooms} onChangeText={(v: string) => update({ bathrooms: v })} colors={colors} />
      </Row2>
      <WizField label="Covered Area" placeholder="e.g. 5 Marla" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
      <Label colors={colors}>Furnishing</Label>
      <ChipRow options={FURNISHING} selected={form.furnishing} onSelect={(v: string) => update({ furnishing: v })} colors={colors} />
      <Label colors={colors}>Facing</Label>
      <ChipRow options={FACING_OPTS} selected={form.facing} onSelect={(v: string) => update({ facing: v })} colors={colors} />
      <Label colors={colors}>Utilities & Access</Label>
      <TogRow label="Separate Entrance" value={form.separateEntrance} onChange={(v: any) => update({ separateEntrance: v })} colors={colors} />
      <TogRow label="Separate Electricity Meter" value={form.sepElecMeter} onChange={(v: any) => update({ sepElecMeter: v })} colors={colors} />
      <TogRow label="Separate Gas Meter" value={form.sepGasMeter} onChange={(v: any) => update({ sepGasMeter: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'drawingRoom', label: 'Drawing Room' }, { key: 'tvLounge', label: 'TV Lounge' },
        { key: 'kitchen', label: 'Kitchen' }, { key: 'balcony', label: 'Balcony' },
        { key: 'terrace', label: 'Terrace' }, { key: 'storeRoom', label: 'Store' },
        { key: 'servantQuarter', label: 'Servant Quarter' }, { key: 'isCorner', label: 'Corner' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function RoomFields({ form, update, colors }: any) {
  return (
    <>
      <Label colors={colors}>Room Type</Label>
      <ChipRow options={['Single', 'Shared']} selected={form.roomType} onSelect={(v: string) => update({ roomType: v })} colors={colors} />
      <Label colors={colors}>Tenant Preference</Label>
      <ChipRow options={['Family Only', 'Male Only', 'Female Only', 'Any']} selected={form.familyPref} onSelect={(v: string) => update({ familyPref: v })} colors={colors} />
      <Row2>
        <WizField label="Available From" placeholder="e.g. 1 March" value={form.availableFrom} onChangeText={(v: string) => update({ availableFrom: v })} colors={colors} />
        <WizField label="Minimum Stay" placeholder="e.g. 3 months" value={form.minimumStay} onChangeText={(v: string) => update({ minimumStay: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Utilities Included in Rent</Label>
      <TogRow label="Electricity" value={form.electricityInc} onChange={(v: any) => update({ electricityInc: v })} colors={colors} />
      <TogRow label="Gas" value={form.gasInc} onChange={(v: any) => update({ gasInc: v })} colors={colors} />
      <TogRow label="Water" value={form.waterInc} onChange={(v: any) => update({ waterInc: v })} colors={colors} />
      <Label colors={colors}>Room Attributes</Label>
      <TogRow label="Attached Bathroom" value={form.attachedBath} onChange={(v: any) => update({ attachedBath: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'balcony', label: 'Balcony' }, { key: 'storeRoom', label: 'Wardrobe/Store' },
        { key: 'parking', label: 'Parking' }, { key: 'kitchen', label: 'Kitchen Access' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function FarmHouseFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Bedrooms" placeholder="e.g. 4" keyboardType="numeric" value={form.bedrooms} onChangeText={(v: string) => update({ bedrooms: v })} colors={colors} />
        <WizField label="Bathrooms" placeholder="e.g. 3" keyboardType="numeric" value={form.bathrooms} onChangeText={(v: string) => update({ bathrooms: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Covered Area" placeholder="e.g. 10 Marla" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
        <WizField label="Farm Area" placeholder="e.g. 3 Acres" value={form.farmArea} onChangeText={(v: string) => update({ farmArea: v })} colors={colors} />
      </Row2>
      <WizField label="Water Source" placeholder="e.g. Canal + Tube Well" value={form.waterSource} onChangeText={(v: string) => update({ waterSource: v })} colors={colors} />
      <Label colors={colors}>Facilities</Label>
      <TogRow label="Road Access" value={form.roadAccess} onChange={(v: any) => update({ roadAccess: v })} colors={colors} />
      <TogRow label="Boundary Wall" value={form.boundaryWall} onChange={(v: any) => update({ boundaryWall: v })} colors={colors} />
      <TogRow label="Orchard" value={form.orchard} onChange={(v: any) => update({ orchard: v })} colors={colors} />
      <TogRow label="Tube Well" value={form.tubeWell} onChange={(v: any) => update({ tubeWell: v })} colors={colors} />
      <TogRow label="Guest House" value={form.guestHouse} onChange={(v: any) => update({ guestHouse: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'lawn', label: 'Lawn / Garden' }, { key: 'servantQuarter', label: 'Servant Quarter' },
        { key: 'storeRoom', label: 'Store Room' }, { key: 'garage', label: 'Parking / Garage' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function PlotFields({ form, update, colors }: any) {
  const isCommercial = form.propertyType === 'Commercial Plot';
  return (
    <>
      <Row2>
        <WizField label="Plot Dimensions" placeholder="e.g. 30×60 ft" value={form.plotDimensions} onChangeText={(v: string) => update({ plotDimensions: v })} colors={colors} />
        <WizField label="Road Front" placeholder="e.g. 30 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
      </Row2>
      <WizField label="Road Width" placeholder="e.g. 40 ft" value={form.roadWidth} onChangeText={(v: string) => update({ roadWidth: v })} colors={colors} />
      <Label colors={colors}>Facing</Label>
      <ChipRow options={FACING_OPTS} selected={form.facing} onSelect={(v: string) => update({ facing: v })} colors={colors} />
      <Label colors={colors}>Development Status</Label>
      <ChipRow options={['Developed', 'Under Development', 'Undeveloped']} selected={form.devStatus} onSelect={(v: string) => update({ devStatus: v })} colors={colors} />
      {isCommercial && (
        <>
          <WizField label="Commercial Zone" placeholder="e.g. Main Bazaar Commercial Zone" value={form.industrialZone} onChangeText={(v: string) => update({ industrialZone: v })} colors={colors} />
          <WizField label="Floors Allowed" placeholder="e.g. 4" keyboardType="numeric" value={form.floors} onChangeText={(v: string) => update({ floors: v })} colors={colors} />
          <WizField label="NOC Status" placeholder="e.g. NOC Approved" value={form.nocStatus} onChangeText={(v: string) => update({ nocStatus: v })} colors={colors} />
        </>
      )}
      <Label colors={colors}>Plot Attributes</Label>
      <BoolGrid items={[
        { key: 'isCorner', label: 'Corner' }, { key: 'isMainRoad', label: 'Main Road' },
        { key: 'isParkFacing', label: 'Park Facing' }, { key: 'balcony', label: 'Mosque Facing' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function AgriFields({ form, update, colors }: any) {
  return (
    <>
      <WizField label="Land Type" placeholder="e.g. Irrigated, Barani, Canal Command" value={form.landType} onChangeText={(v: string) => update({ landType: v })} colors={colors} />
      <Row2>
        <WizField label="Road Front" placeholder="e.g. 100 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
        <WizField label="Road Width" placeholder="e.g. 30 ft" value={form.roadWidth} onChangeText={(v: string) => update({ roadWidth: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Water Access</Label>
      <TogRow label="Nehri (Canal) Water" value={form.nehriWater} onChange={(v: any) => update({ nehriWater: v })} colors={colors} />
      <TogRow label="Tube Well" value={form.tubeWell} onChange={(v: any) => update({ tubeWell: v })} colors={colors} />
      {form.tubeWell === true && (
        <>
          <Label colors={colors}>Tube Well Type</Label>
          <ChipRow options={['Electric', 'Diesel', 'Solar']} selected={form.tubeWellType} onSelect={(v: string) => update({ tubeWellType: v })} colors={colors} />
        </>
      )}
      <Label colors={colors}>Soil Type</Label>
      <ChipRow options={['Clay', 'Loam', 'Sandy', 'Silty', 'Mixed']} selected={form.soilType} onSelect={(v: string) => update({ soilType: v })} colors={colors} />
      <Label colors={colors}>Land Level</Label>
      <ChipRow options={['Level', 'Slightly Uneven', 'Undulating']} selected={form.landLevel} onSelect={(v: string) => update({ landLevel: v })} colors={colors} />
      <WizField label="Current Crop" placeholder="e.g. Cotton, Wheat, Sugarcane" value={form.currentCrop} onChangeText={(v: string) => update({ currentCrop: v })} colors={colors} />
      <WizField label="Trees / Plants" placeholder="e.g. 200 Mango trees" value={form.trees} onChangeText={(v: string) => update({ trees: v })} colors={colors} />
      <WizField label="Nearby Canal / River" placeholder="e.g. Near Pakpattan Canal" value={form.nearbyCanalRiver} onChangeText={(v: string) => update({ nearbyCanalRiver: v })} colors={colors} />
      <Label colors={colors}>Documents Available</Label>
      <TogRow label="Fard Available" value={form.fardAvailable} onChange={(v: any) => update({ fardAvailable: v })} colors={colors} />
      <TogRow label="Registry Available" value={form.registryAvailable} onChange={(v: any) => update({ registryAvailable: v })} colors={colors} />
      <TogRow label="Mutation Available" value={form.mutationAvailable} onChange={(v: any) => update({ mutationAvailable: v })} colors={colors} />
      <Label colors={colors}>Structures</Label>
      <BoolGrid items={[
        { key: 'boundaryWall', label: 'Boundary / Fencing' }, { key: 'guestHouse', label: 'Farm House' },
        { key: 'storeRoom', label: 'Store / Warehouse' }, { key: 'servantQuarter', label: 'Livestock Area' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function FarmOrchardFields({ form, update, colors }: any) {
  return (
    <>
      <Label colors={colors}>Farm Type</Label>
      <ChipRow options={['Crop Farm', 'Dairy Farm', 'Poultry Farm', 'Mixed Farm']} selected={form.farmType} onSelect={(v: string) => update({ farmType: v })} colors={colors} />
      <Label colors={colors}>Orchard Type</Label>
      <ChipRow options={['Mango', 'Citrus', 'Guava', 'Mixed', 'None']} selected={form.orchardType} onSelect={(v: string) => update({ orchardType: v })} colors={colors} />
      <Row2>
        <WizField label="Number of Trees" placeholder="e.g. 150" keyboardType="numeric" value={form.numberOfTrees} onChangeText={(v: string) => update({ numberOfTrees: v })} colors={colors} />
        <WizField label="Current Crop" placeholder="e.g. Wheat" value={form.currentCrop} onChangeText={(v: string) => update({ currentCrop: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Production Status</Label>
      <ChipRow options={['Producing', 'Developing', 'Fallow']} selected={form.productionStatus} onSelect={(v: string) => update({ productionStatus: v })} colors={colors} />
      <Label colors={colors}>Water & Utilities</Label>
      <TogRow label="Nehri Water" value={form.nehriWater} onChange={(v: any) => update({ nehriWater: v })} colors={colors} />
      <TogRow label="Tube Well" value={form.tubeWell} onChange={(v: any) => update({ tubeWell: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'boundaryWall', label: 'Boundary / Fencing' }, { key: 'guestHouse', label: 'Farmhouse' },
        { key: 'storeRoom', label: 'Storage' }, { key: 'servantQuarter', label: 'Livestock' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function ShopFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Shop Dimensions" placeholder="e.g. 12×20 ft" value={form.shopDimensions} onChangeText={(v: string) => update({ shopDimensions: v })} colors={colors} />
        <WizField label="Front Width" placeholder="e.g. 12 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Floor" placeholder="e.g. Ground" value={form.floorNumber} onChangeText={(v: string) => update({ floorNumber: v })} colors={colors} />
        <WizField label="Building Floors" placeholder="e.g. 5" keyboardType="numeric" value={form.totalFloors} onChangeText={(v: string) => update({ totalFloors: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Possession Status</Label>
      <ChipRow options={['Ready', 'Under Construction', 'On Booking']} selected={form.possessionStatus} onSelect={(v: string) => update({ possessionStatus: v })} colors={colors} />
      <Label colors={colors}>Shop Attributes</Label>
      <TogRow label="Glass Front" value={form.glassFront} onChange={(v: any) => update({ glassFront: v })} colors={colors} />
      <TogRow label="Shutter" value={form.shutter} onChange={(v: any) => update({ shutter: v })} colors={colors} />
      <TogRow label="Washroom" value={form.washroom} onChange={(v: any) => update({ washroom: v })} colors={colors} />
      <TogRow label="Storage" value={form.storage} onChange={(v: any) => update({ storage: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isCorner', label: 'Corner' }, { key: 'isMainRoad', label: 'Main Road' },
        { key: 'parking', label: 'Parking' }, { key: 'lift', label: 'Lift' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function OfficeFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Rooms / Cabins" placeholder="e.g. 6" keyboardType="numeric" value={form.cabins} onChangeText={(v: string) => update({ cabins: v })} colors={colors} />
        <WizField label="Washrooms" placeholder="e.g. 2" keyboardType="numeric" value={form.bathrooms} onChangeText={(v: string) => update({ bathrooms: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Floor" placeholder="e.g. 4" keyboardType="numeric" value={form.floorNumber} onChangeText={(v: string) => update({ floorNumber: v })} colors={colors} />
        <WizField label="Total Floors" placeholder="e.g. 12" keyboardType="numeric" value={form.totalFloors} onChangeText={(v: string) => update({ totalFloors: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Furnishing</Label>
      <ChipRow options={FURNISHING} selected={form.furnishing} onSelect={(v: string) => update({ furnishing: v })} colors={colors} />
      <WizField label="Maintenance Charges" placeholder="e.g. PKR 5,000 / month" value={form.maintenanceCharges} onChangeText={(v: string) => update({ maintenanceCharges: v })} colors={colors} />
      <Label colors={colors}>Office Amenities</Label>
      <TogRow label="Meeting Room" value={form.meetingRoom} onChange={(v: any) => update({ meetingRoom: v })} colors={colors} />
      <TogRow label="Reception" value={form.reception} onChange={(v: any) => update({ reception: v })} colors={colors} />
      <TogRow label="Backup Power" value={form.backupPower} onChange={(v: any) => update({ backupPower: v })} colors={colors} />
      <TogRow label="Lift" value={form.lift} onChange={(v: any) => update({ lift: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'parking', label: 'Parking' }, { key: 'storeRoom', label: 'Kitchen / Pantry' },
        { key: 'isCorner', label: 'Corner Unit' }, { key: 'isMainRoad', label: 'Main Road View' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function BuildingFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Total Floors" placeholder="e.g. 8" keyboardType="numeric" value={form.totalFloors} onChangeText={(v: string) => update({ totalFloors: v })} colors={colors} />
        <WizField label="Front Width" placeholder="e.g. 40 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Number of Shops" placeholder="e.g. 10" keyboardType="numeric" value={form.numShops} onChangeText={(v: string) => update({ numShops: v })} colors={colors} />
        <WizField label="Number of Offices" placeholder="e.g. 4" keyboardType="numeric" value={form.numOffices} onChangeText={(v: string) => update({ numOffices: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Number of Apts" placeholder="e.g. 6" keyboardType="numeric" value={form.numApartments} onChangeText={(v: string) => update({ numApartments: v })} colors={colors} />
        <WizField label="Monthly Rental Income" placeholder="e.g. PKR 200,000" value={form.rentalIncome} onChangeText={(v: string) => update({ rentalIncome: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Occupancy Status</Label>
      <ChipRow options={['Fully Occupied', 'Partially Occupied', 'Vacant']} selected={form.occupancyStatus} onSelect={(v: string) => update({ occupancyStatus: v })} colors={colors} />
      <WizField label="Road Width" placeholder="e.g. 50 ft" value={form.roadWidth} onChangeText={(v: string) => update({ roadWidth: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isCorner', label: 'Corner' }, { key: 'isMainRoad', label: 'Main Road' },
        { key: 'parking', label: 'Parking' }, { key: 'lift', label: 'Lift' },
        { key: 'storeRoom', label: 'Generator' }, { key: 'balcony', label: 'Solar' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function WarehouseFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Warehouse Height" placeholder="e.g. 25 ft" value={form.warehouseHeight} onChangeText={(v: string) => update({ warehouseHeight: v })} colors={colors} />
        <WizField label="Electricity Load" placeholder="e.g. 100 KVA" value={form.electricityLoad} onChangeText={(v: string) => update({ electricityLoad: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Road Front" placeholder="e.g. 60 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
        <WizField label="Road Width" placeholder="e.g. 40 ft" value={form.roadWidth} onChangeText={(v: string) => update({ roadWidth: v })} colors={colors} />
      </Row2>
      <WizField label="Covered Land Area" placeholder="e.g. 5 Kanal" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
      <Label colors={colors}>Access & Facilities</Label>
      <TogRow label="Truck / Heavy Vehicle Access" value={form.truckAccess} onChange={(v: any) => update({ truckAccess: v })} colors={colors} />
      <TogRow label="Loading / Unloading Area" value={form.storage} onChange={(v: any) => update({ storage: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isMainRoad', label: 'Main Road' }, { key: 'parking', label: 'Parking' },
        { key: 'washroom', label: 'Office Space' }, { key: 'servantQuarter', label: 'Fire Safety' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function FactoryFields({ form, update, colors }: any) {
  return (
    <>
      <WizField label="Factory Type" placeholder="e.g. Textile, Food Processing, General" value={form.factoryType} onChangeText={(v: string) => update({ factoryType: v })} colors={colors} />
      <Row2>
        <WizField label="Electricity Load" placeholder="e.g. 500 KVA" value={form.electricityLoad} onChangeText={(v: string) => update({ electricityLoad: v })} colors={colors} />
        <WizField label="Industrial Zone" placeholder="e.g. GT Road Zone" value={form.industrialZone} onChangeText={(v: string) => update({ industrialZone: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Covered Area" placeholder="e.g. 10 Kanal" value={form.coveredArea} onChangeText={(v: string) => update({ coveredArea: v })} colors={colors} />
        <WizField label="Road Front" placeholder="e.g. 80 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Utilities & Access</Label>
      <TogRow label="Gas Connection" value={form.boundaryWall} onChange={(v: any) => update({ boundaryWall: v })} colors={colors} />
      <TogRow label="Truck / Heavy Vehicle Access" value={form.truckAccess} onChange={(v: any) => update({ truckAccess: v })} colors={colors} />
      <TogRow label="Machinery Included" value={form.machineryIncluded} onChange={(v: any) => update({ machineryIncluded: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isMainRoad', label: 'Main Road' }, { key: 'storeRoom', label: 'Warehouse Area' },
        { key: 'washroom', label: 'Office Space' }, { key: 'servantQuarter', label: 'Labour Quarters' },
        { key: 'parking', label: 'Parking' }, { key: 'garage', label: 'Fire Safety' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function ShowroomFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Front Width" placeholder="e.g. 30 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
        <WizField label="Ceiling Height" placeholder="e.g. 14 ft" value={form.ceilingHeight} onChangeText={(v: string) => update({ ceilingHeight: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Floor" placeholder="e.g. Ground" value={form.floorNumber} onChangeText={(v: string) => update({ floorNumber: v })} colors={colors} />
        <WizField label="Display Area" placeholder="e.g. 2,000 sq ft" value={form.displayArea} onChangeText={(v: string) => update({ displayArea: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Showroom Attributes</Label>
      <TogRow label="Glass Front" value={form.glassFront} onChange={(v: any) => update({ glassFront: v })} colors={colors} />
      <TogRow label="Storage Area" value={form.storage} onChange={(v: any) => update({ storage: v })} colors={colors} />
      <TogRow label="Office Room" value={form.reception} onChange={(v: any) => update({ reception: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isMainRoad', label: 'Main Road' }, { key: 'isCorner', label: 'Corner' },
        { key: 'parking', label: 'Parking' }, { key: 'washroom', label: 'Washroom' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function IndustrialLandFields({ form, update, colors }: any) {
  return (
    <>
      <Row2>
        <WizField label="Plot Dimensions" placeholder="e.g. 200×400 ft" value={form.plotDimensions} onChangeText={(v: string) => update({ plotDimensions: v })} colors={colors} />
        <WizField label="Road Front" placeholder="e.g. 100 ft" value={form.roadFront} onChangeText={(v: string) => update({ roadFront: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Road Width" placeholder="e.g. 60 ft" value={form.roadWidth} onChangeText={(v: string) => update({ roadWidth: v })} colors={colors} />
        <WizField label="Industrial Zone" placeholder="e.g. GT Road Zone" value={form.industrialZone} onChangeText={(v: string) => update({ industrialZone: v })} colors={colors} />
      </Row2>
      <Label colors={colors}>Development Status</Label>
      <ChipRow options={['Developed', 'Under Development', 'Undeveloped']} selected={form.devStatus} onSelect={(v: string) => update({ devStatus: v })} colors={colors} />
      <WizField label="Electricity Load Available" placeholder="e.g. 500 KVA available" value={form.electricityLoad} onChangeText={(v: string) => update({ electricityLoad: v })} colors={colors} />
      <WizField label="NOC / Industrial Approval" placeholder="e.g. Approved, Pending" value={form.nocStatus} onChangeText={(v: string) => update({ nocStatus: v })} colors={colors} />
      <Label colors={colors}>Access & Utilities</Label>
      <TogRow label="Heavy Vehicle Access" value={form.heavyVehicleAccess} onChange={(v: any) => update({ heavyVehicleAccess: v })} colors={colors} />
      <TogRow label="Possession Ready" value={form.orchard} onChange={(v: any) => update({ orchard: v })} colors={colors} />
      <BoolGrid items={[
        { key: 'isMainRoad', label: 'Near Highway' }, { key: 'isCorner', label: 'Corner' },
        { key: 'boundaryWall', label: 'Boundary Wall' }, { key: 'drainage', label: 'Drainage / Sewerage' },
      ]} form={form} update={update} colors={colors} />
    </>
  );
}

function ProjectFields({ form, update, colors }: any) {
  return (
    <>
      <WizField label="Project / Society Name" placeholder="e.g. Green Valley Housing Society" value={form.projectName} onChangeText={(v: string) => update({ projectName: v })} colors={colors} />
      <WizField label="Developer / Builder" placeholder="e.g. OG Developers" value={form.developer} onChangeText={(v: string) => update({ developer: v })} colors={colors} />
      <Row2>
        <WizField label="Total Units / Plots" placeholder="e.g. 500" keyboardType="numeric" value={form.totalUnits} onChangeText={(v: string) => update({ totalUnits: v })} colors={colors} />
        <WizField label="Starting Price (PKR)" placeholder="e.g. 3000000" keyboardType="numeric" value={form.startingPrice} onChangeText={(v: string) => update({ startingPrice: v })} colors={colors} />
      </Row2>
      <WizField label="Plot Sizes Available" placeholder="e.g. 5 Marla, 10 Marla, 1 Kanal" value={form.plotSizes} onChangeText={(v: string) => update({ plotSizes: v })} colors={colors} />
      <WizField label="Down Payment" placeholder="e.g. 20%" value={form.downPayment} onChangeText={(v: string) => update({ downPayment: v })} colors={colors} />
      <WizField label="Installment Plan" placeholder="e.g. 36 monthly installments" value={form.installmentPlan} onChangeText={(v: string) => update({ installmentPlan: v })} colors={colors} />
      <WizField label="Possession Date" placeholder="e.g. Dec 2026" value={form.possessionDate} onChangeText={(v: string) => update({ possessionDate: v })} colors={colors} />
      <Label colors={colors}>Development Status</Label>
      <ChipRow options={['Launching', 'Under Development', 'Fully Developed', 'Possession Given']} selected={form.devStatus} onSelect={(v: string) => update({ devStatus: v })} colors={colors} />
    </>
  );
}

function AptProjectFields({ form, update, colors }: any) {
  return (
    <>
      <WizField label="Project Name" placeholder="e.g. Skyline Apartments" value={form.projectName} onChangeText={(v: string) => update({ projectName: v })} colors={colors} />
      <WizField label="Developer" placeholder="e.g. OG Developers" value={form.developer} onChangeText={(v: string) => update({ developer: v })} colors={colors} />
      <Row2>
        <WizField label="Total Floors" placeholder="e.g. 15" keyboardType="numeric" value={form.totalFloors} onChangeText={(v: string) => update({ totalFloors: v })} colors={colors} />
        <WizField label="Available Units" placeholder="e.g. 24" keyboardType="numeric" value={form.totalUnits} onChangeText={(v: string) => update({ totalUnits: v })} colors={colors} />
      </Row2>
      <Row2>
        <WizField label="Bedrooms" placeholder="e.g. 2-4 BHK" value={form.bedrooms} onChangeText={(v: string) => update({ bedrooms: v })} colors={colors} />
        <WizField label="Starting Price" placeholder="e.g. PKR 8,000,000" value={form.startingPrice} onChangeText={(v: string) => update({ startingPrice: v })} colors={colors} />
      </Row2>
      <WizField label="Down Payment" placeholder="e.g. 30%" value={form.downPayment} onChangeText={(v: string) => update({ downPayment: v })} colors={colors} />
      <WizField label="Installment Plan" placeholder="e.g. 48 monthly installments" value={form.installmentPlan} onChangeText={(v: string) => update({ installmentPlan: v })} colors={colors} />
      <WizField label="Possession Date" placeholder="e.g. June 2027" value={form.possessionDate} onChangeText={(v: string) => update({ possessionDate: v })} colors={colors} />
      <Label colors={colors}>Construction Status</Label>
      <ChipRow options={['Launching', 'Foundation', 'Under Construction', 'Finishing', 'Complete']} selected={form.devStatus} onSelect={(v: string) => update({ devStatus: v })} colors={colors} />
    </>
  );
}

// ── SECTION 5: Features ─────────────────────────────────────────────────────────

function StepFeatures({ form, update, colors, category }: any) {
  const available = FEATURES_BY_CAT[category as PropCategory] ?? FEATURES_BY_CAT.residential;
  const toggle = (f: string) => {
    const features = form.features.includes(f) ? form.features.filter((x: string) => x !== f) : [...form.features, f];
    update({ features });
  };
  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 5</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Features & Amenities</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Select all that apply. These appear as highlighted tags on your listing.</Text>
      <View style={s.featureGrid}>
        {available.map((f: string) => {
          const sel = form.features.includes(f);
          return (
            <Pressable key={f} onPress={() => toggle(f)}
              style={[s.featureChip, { backgroundColor: sel ? colors.selectionBackground : colors.secondary, borderColor: sel ? colors.selectionBorder : colors.border, borderWidth: sel ? 1.5 : 1 }]}>
              {sel && <Feather name="check" size={11} color={colors.selectionForeground} />}
              <Text style={[s.featureText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[s.stepSub, { color: colors.mutedForeground, marginTop: 8 }]}>{form.features.length} selected</Text>
    </AnimatedReveal>
  );
}

// ── SECTION 6: Photos & Media ───────────────────────────────────────────────────

function StepMedia({ form, update, colors, errors, pickPhotos, pickVideo }: any) {
  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 6</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Photos & Media</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Properties with 5+ photos get 3× more enquiries. Add up to 30 photos.</Text>

      <View style={[s.mediaBox, { borderColor: errors.photos ? '#e53e3e' : colors.border, backgroundColor: colors.card }]}>
        <View style={s.mediaRow}>
          <View style={[s.mediaIconWrap, { backgroundColor: colors.action + '18' }]}>
            <Feather name="camera" size={16} color={colors.action} />
          </View>
          <Text style={[s.mediaTitle, { color: colors.foreground }]}>Photos {form.photos.length > 0 ? `(${form.photos.length}/30)` : '*'}</Text>
          <Pressable onPress={pickPhotos} style={[s.addBtn, { backgroundColor: colors.action }]}>
            <Feather name="plus" size={12} color="#ffffff" />
            <Text style={[s.addBtnText, { color: '#ffffff' }]}>Add</Text>
          </Pressable>
        </View>
        {form.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
            {form.photos.map((uri: string, i: number) => (
              <View key={i} style={s.thumbWrap}>
                <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
                {i === form.coverPhotoIndex && (
                  <View style={s.coverBadge}><Text style={s.coverText}>COVER</Text></View>
                )}
                <Pressable onPress={() => update({ coverPhotoIndex: i })} style={s.thumbStarBtn}>
                  <Feather name="star" size={9} color={i === form.coverPhotoIndex ? '#f4c430' : '#ffffff88'} />
                </Pressable>
                <Pressable onPress={() => update({ photos: form.photos.filter((_: any, idx: number) => idx !== i) })} style={s.thumbRemove}>
                  <Feather name="x" size={10} color="#ffffff" />
                </Pressable>
              </View>
            ))}
            {form.photos.length < 30 && (
              <Pressable onPress={pickPhotos} style={[s.thumbAdd, { borderColor: colors.action + '66', backgroundColor: colors.action + '12' }]}>
                <Feather name="plus" size={20} color={colors.action} />
                <Text style={[s.thumbAddText, { color: colors.action }]}>More</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </View>
      {errors.photos ? <Text style={s.errorText}>{errors.photos}</Text> : null}

      <View style={[s.mediaBox, { borderColor: colors.border, backgroundColor: colors.card, marginTop: 12 }]}>
        <View style={s.mediaRow}>
          <View style={[s.mediaIconWrap, { backgroundColor: colors.action + '18' }]}>
            <Feather name="video" size={16} color={colors.action} />
          </View>
          <Text style={[s.mediaTitle, { color: colors.foreground }]}>Video {form.video ? '(1/1)' : '(optional)'}</Text>
          {!form.video && (
            <Pressable onPress={pickVideo} style={[s.addBtn, { backgroundColor: colors.action }]}>
              <Feather name="plus" size={12} color="#ffffff" />
              <Text style={[s.addBtnText, { color: '#ffffff' }]}>Add</Text>
            </Pressable>
          )}
        </View>
        {form.video ? (
          <View style={[s.videoCard, { backgroundColor: colors.secondary, borderColor: colors.border, marginTop: 10 }]}>
            <Feather name="film" size={20} color={colors.action} />
            <Text style={[s.videoName, { color: colors.foreground }]} numberOfLines={1}>{form.video.filename ?? 'video.mp4'}</Text>
            <Pressable onPress={() => update({ video: null })} hitSlop={8}>
              <Feather name="trash-2" size={16} color="#e53838" />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[s.stepSub, { color: colors.mutedForeground, marginTop: 10 }]}>
        Tap ⭐ on a photo to set it as the cover image shown in search results.
      </Text>
    </AnimatedReveal>
  );
}

// ── SECTION 7: Description + Documents ─────────────────────────────────────────

function StepDocs({ form, update, colors, errors, user, category }: any) {
  const docOptions = DOCUMENTS_BY_CAT[category as PropCategory] ?? DOCUMENTS_BY_CAT.residential;
  const toggleDoc = (d: string) => {
    const docs = form.documents.includes(d) ? form.documents.filter((x: string) => x !== d) : [...form.documents, d];
    update({ documents: docs });
  };
  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 7</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Description & Docs</Text>

      {/* Description */}
      <Label colors={colors}>Property Description *</Label>
      <View style={[s.textAreaWrap, { borderColor: errors.description ? '#e53e3e' : colors.border, backgroundColor: colors.card }]}>
        <TextInput
          value={form.description}
          onChangeText={(v) => update({ description: v })}
          placeholder="Describe the property — location, condition, key features, nearby facilities…"
          placeholderTextColor={colors.mutedForeground}
          multiline numberOfLines={6} textAlignVertical="top"
          style={[s.textArea, { color: colors.foreground }]}
          maxLength={2000}
        />
        <Text style={[s.charCount, { color: colors.mutedForeground }]}>{form.description.length}/2000</Text>
      </View>
      {errors.description ? <Text style={s.errorText}>{errors.description}</Text> : null}

      <WizField label="Key Highlights" optional
        placeholder="e.g. Corner plot, gas available, near main road"
        value={form.keyHighlights} onChangeText={(v: string) => update({ keyHighlights: v })} colors={colors} multiline />

      {/* Ownership & Documents */}
      <Label colors={colors}>Your Role</Label>
      <ChipRow options={OWNERSHIP_OPTS} selected={form.ownershipStatus} onSelect={(v: string) => update({ ownershipStatus: v })} colors={colors} />

      <Label colors={colors}>Documents You Can Provide</Label>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Listings with verified documents get 2× more enquiries.</Text>
      <View style={s.featureGrid}>
        {docOptions.map((d: string) => {
          const sel = form.documents.includes(d);
          return (
            <Pressable key={d} onPress={() => toggleDoc(d)}
              style={[s.featureChip, { backgroundColor: sel ? colors.selectionBackground : colors.secondary, borderColor: sel ? colors.selectionBorder : colors.border, borderWidth: sel ? 1.5 : 1 }]}>
              {sel && <Feather name="check" size={11} color={colors.selectionForeground} />}
              <Text style={[s.featureText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{d}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Contact */}
      <View style={[s.contactCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
        <Text style={[s.label, { color: colors.foreground, marginBottom: 10 }]}>Contact Info (from Profile)</Text>
        {[
          { icon: 'user' as const, label: 'Name', val: user?.name ?? '—' },
          { icon: 'phone' as const, label: 'Phone', val: user?.phone ?? '—' },
        ].map((r) => (
          <View key={r.label} style={s.contactRow}>
            <Feather name={r.icon} size={13} color={colors.mutedForeground} />
            <Text style={[s.contactLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
            <Text style={[s.contactValue, { color: colors.foreground }]}>{r.val}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8, marginTop: 6 }}>
        <ToggleRow label="WhatsApp contact visible" value={form.showWhatsApp} onChange={(v: boolean) => update({ showWhatsApp: v })} colors={colors} />
        <ToggleRow label="Allow phone calls" value={form.allowCalls} onChange={(v: boolean) => update({ allowCalls: v })} colors={colors} />
      </View>

      <View style={[s.hintBox, { backgroundColor: '#1a6b3a0e', borderColor: '#1a6b3a33', marginTop: 14 }]}>
        <Feather name="shield" size={12} color="#1a6b3a" />
        <Text style={[s.hintText, { color: '#1a6b3a' }]}>
          Your listing will be reviewed by the OG Landmark team before it goes live.
        </Text>
      </View>
    </AnimatedReveal>
  );
}

// ── SECTION 8: Preview ──────────────────────────────────────────────────────────

function StepPreview({ form, colors, category }: any) {
  const priceLabel = form.purpose === 'Rent'
    ? `PKR ${Number(form.price.replace(/[^0-9]/g, '') || '0').toLocaleString()} / mo`
    : `PKR ${Number(form.price.replace(/[^0-9]/g, '') || '0').toLocaleString()}`;
  const location = [form.locality, form.society, form.city].filter(Boolean).join(', ');
  const typeInfo = PROPERTY_TYPES.find((t) => t.key === form.propertyType);

  return (
    <AnimatedReveal>
      <Text style={[s.stepEyebrow, { color: colors.action }]}>SECTION 8</Text>
      <Text style={[s.stepTitle, { color: colors.foreground }]}>Preview & Publish</Text>
      <Text style={[s.stepSub, { color: colors.mutedForeground }]}>Review your listing before submitting it for approval.</Text>

      <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {form.photos.length > 0 ? (
          <Image source={{ uri: form.photos[form.coverPhotoIndex] ?? form.photos[0] }} style={s.previewImage} resizeMode="cover" />
        ) : (
          <View style={[s.previewImagePlaceholder, { backgroundColor: colors.secondary }]}>
            <Text style={{ fontSize: 32 }}>{typeInfo?.emoji ?? '🏠'}</Text>
            <Text style={[s.stepSub, { color: colors.mutedForeground, marginTop: 6 }]}>No cover photo</Text>
          </View>
        )}
        <View style={s.previewBody}>
          <View style={s.previewRow}>
            <View style={[s.statusBadge, { backgroundColor: form.purpose === 'Rent' ? '#1a6b3a' : colors.action }]}>
              <Text style={s.statusBadgeText}>FOR {form.purpose.toUpperCase()}</Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: colors.secondary, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[s.statusBadgeText, { color: colors.foreground }]}>{form.propertyType.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={[s.previewTitle, { color: colors.foreground }]}>
            {form.title || `${form.propertyType} ${form.purpose === 'Rent' ? 'for Rent' : 'for Sale'} in ${form.city}`}
          </Text>
          <Text style={[s.previewPrice, { color: colors.action }]}>{priceLabel}{form.isNegotiable ? ' · Negotiable' : ''}</Text>
          {location ? (
            <View style={s.previewMeta}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[s.previewMetaText, { color: colors.mutedForeground }]}>{location}</Text>
            </View>
          ) : null}
          <View style={s.previewMeta}>
            <Feather name="maximize" size={12} color={colors.mutedForeground} />
            <Text style={[s.previewMetaText, { color: colors.mutedForeground }]}>{form.area} {form.areaUnit}</Text>
            {form.bedrooms ? <Text style={[s.previewMetaText, { color: colors.mutedForeground }]}>· {form.bedrooms} Beds</Text> : null}
            {form.bathrooms ? <Text style={[s.previewMetaText, { color: colors.mutedForeground }]}>· {form.bathrooms} Baths</Text> : null}
          </View>
          {form.features.length > 0 && (
            <View style={s.featureChipRow}>
              {form.features.slice(0, 5).map((f: string) => (
                <View key={f} style={[s.previewTag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[s.previewTagText, { color: colors.foreground }]}>{f}</Text>
                </View>
              ))}
              {form.features.length > 5 && (
                <View style={[s.previewTag, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[s.previewTagText, { color: colors.mutedForeground }]}>+{form.features.length - 5}</Text>
                </View>
              )}
            </View>
          )}
          {form.description ? (
            <Text style={[s.previewDesc, { color: colors.mutedForeground }]} numberOfLines={3}>{form.description}</Text>
          ) : null}
          <View style={[s.previewReview, { backgroundColor: '#1a6b3a0e', borderColor: '#1a6b3a33' }]}>
            <Feather name="clock" size={12} color="#1a6b3a" />
            <Text style={[s.previewReviewText, { color: '#1a6b3a' }]}>Pending review · Not yet public · {form.photos.length} photo(s) · {form.documents.length} doc(s)</Text>
          </View>
        </View>
      </View>
    </AnimatedReveal>
  );
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function Label({ children, colors }: { children: React.ReactNode; colors: any }) {
  return <Text style={[s.label, { color: colors.foreground }]}>{children}</Text>;
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 10 }}>{React.Children.map(children, (c) => <View style={{ flex: 1 }}>{c}</View>)}</View>;
}

function WizField({ label, placeholder, value, onChangeText, keyboardType, colors, error, multiline, optional }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={[s.label, { color: colors.foreground }]}>
          {label}{optional ? <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}> (optional)</Text> : null}
        </Text>
      ) : null}
      <View style={[s.inputWrap, { borderColor: error ? '#e53e3e' : colors.border, backgroundColor: colors.card }]}>
        <TextInput
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType ?? 'default'} multiline={multiline}
          numberOfLines={multiline ? 3 : 1} textAlignVertical={multiline ? 'top' : 'center'}
          style={[s.input, { color: colors.foreground, minHeight: multiline ? 72 : undefined }]}
        />
      </View>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

function ChipRow({ options, selected, onSelect, colors }: { options: string[]; selected: string; onSelect: (v: string) => void; colors: any }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onSelect(o)}
           style={[s.chip, { backgroundColor: selected === o ? colors.selectionBackground : colors.secondary, borderColor: selected === o ? colors.selectionBorder : colors.border, borderWidth: selected === o ? 1.5 : 1 }]}>
           <Text style={[s.chipText, { color: selected === o ? colors.selectionForeground : colors.foreground, fontWeight: selected === o ? '600' : '400' }]}>{o}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ToggleRow({ label, value, onChange, colors }: { label: string; value: boolean | null; onChange: (v: any) => void; colors: any }) {
  const isOn = value === true;
  return (
    <Pressable onPress={() => onChange(!value)}
      style={[s.toggleRow, { backgroundColor: isOn ? colors.action + '14' : colors.secondary, borderColor: isOn ? colors.action : colors.border }]}>
      <Text style={[s.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[s.togglePill, { backgroundColor: isOn ? colors.action : colors.border }]}>
        <Text style={[s.togglePillText, { color: '#ffffff' }]}>{isOn ? 'Yes' : 'No'}</Text>
      </View>
    </Pressable>
  );
}

// Tristate toggle: null (—) / true (Yes) / false (No)
function TogRow({ label, value, onChange, colors }: { label: string; value: boolean | null; onChange: (v: any) => void; colors: any }) {
  const isOn = value === true;
  const isOff = value === false;
  return (
    <Pressable
      onPress={() => onChange(value === null ? true : value === true ? false : null)}
      style={[s.toggleRow, { backgroundColor: isOn ? colors.action + '14' : colors.secondary, borderColor: isOn ? colors.action : colors.border, marginBottom: 8 }]}>
      <Text style={[s.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[s.togglePill, { backgroundColor: isOn ? colors.action : isOff ? '#e5383822' : colors.border }]}>
        <Text style={[s.togglePillText, { color: isOn ? '#ffffff' : isOff ? '#e53838' : colors.mutedForeground }]}>
          {value === null ? '—' : isOn ? 'Yes' : 'No'}
        </Text>
      </View>
    </Pressable>
  );
}

// Bool grid — togglable chips (for simple boolean attributes)
function BoolGrid({ items, form, update, colors, tristate }: { items: { key: string; label: string }[]; form: any; update: any; colors: any; tristate?: boolean }) {
  return (
    <View style={[s.featureGrid, { marginBottom: 14 }]}>
      {items.map((it) => {
        const val = (form as any)[it.key];
        const sel = tristate ? val === true : val === true || val === 1;
        return (
          <Pressable key={it.key}
            onPress={() => update({ [it.key]: tristate ? (val === null ? true : val === true ? false : null) : !val })}
            style={[s.featureChip, { backgroundColor: sel ? colors.selectionBackground : colors.secondary, borderColor: sel ? colors.selectionBorder : colors.border, borderWidth: sel ? 1.5 : 1 }]}>
            {sel && <Feather name="check" size={11} color={colors.selectionForeground} />}
            <Text style={[s.featureText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:               { flex: 1 },
  // Header
  header:               { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn:              { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerStep:           { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 3 },
  headerTitle:          { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 6 },
  progressTrack:        { height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill:         { height: 3, borderRadius: 2 },
  purposeBadge:         { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 1 },
  purposeBadgeText:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.4 },
  // Single-page sections
  formSection:          { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 14, overflow: 'hidden' },
  validationBanner:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  validationText:        { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17, flex: 1 },
  stepEyebrow:          { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.4, marginBottom: 4 },
  stepTitle:            { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 6 },
  stepSub:              { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginBottom: 14 },
  label:                { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 8, marginTop: 2 },
  // Type selection
  groupTab:             { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  groupTabText:         { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  typeGrid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard:             { width: '30.5%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 7 },
  typeLabel:            { fontFamily: 'Inter_600SemiBold', fontSize: 10, textAlign: 'center', lineHeight: 13 },
  // Purpose
  purposeRow:           { flexDirection: 'row', gap: 10, marginBottom: 18 },
  purposeBtn:           { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  purposeBtnText:       { fontFamily: 'Inter_700Bold', fontSize: 13 },
  // Inputs
  inputWrap:            { borderRadius: 13, borderWidth: 1, overflow: 'hidden', marginBottom: 2 },
  input:                { fontFamily: 'Inter_400Regular', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  unitSeg:              { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', borderColor: 'transparent', flexWrap: 'wrap' },
  unitBtn:              { flex: 1, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 2 },
  unitText:             { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  // Chips
  chip:                 { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  chipText:             { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  // Feature grid
  featureGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureChip:          { borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  featureText:          { fontFamily: 'Inter_500Medium', fontSize: 11 },
  featureChipRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  // Toggle
  toggleRow:            { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  toggleLabel:          { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  togglePill:           { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  togglePillText:       { fontFamily: 'Inter_700Bold', fontSize: 11 },
  // Media
  mediaBox:             { borderRadius: 16, borderWidth: 1, padding: 14 },
  mediaIconWrap:        { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mediaRow:             { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mediaTitle:           { fontFamily: 'Inter_600SemiBold', fontSize: 14, flex: 1 },
  addBtn:               { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:           { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  thumbWrap:            { position: 'relative' },
  thumb:                { width: 88, height: 88, borderRadius: 12 },
  coverBadge:           { position: 'absolute', top: 4, left: 4, backgroundColor: '#000000aa', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  coverText:            { fontFamily: 'Inter_700Bold', fontSize: 7, color: '#f4c430' },
  thumbStarBtn:         { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#000000aa', borderRadius: 8, padding: 4 },
  thumbRemove:          { position: 'absolute', top: 4, right: 4, backgroundColor: '#000000aa', borderRadius: 8, padding: 3 },
  thumbAdd:             { width: 88, height: 88, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  thumbAddText:         { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  videoCard:            { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1, padding: 12 },
  videoName:            { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  // Description
  textAreaWrap:         { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  textArea:             { fontFamily: 'Inter_400Regular', fontSize: 14, padding: 14, minHeight: 120 },
  charCount:            { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right', paddingRight: 12, paddingBottom: 8 },
  // Contact
  contactCard:          { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  contactRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactLabel:         { fontFamily: 'Inter_400Regular', fontSize: 12, width: 44 },
  contactValue:         { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  // Preview
  previewCard:          { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  previewImage:         { width: '100%', height: 200 },
  previewImagePlaceholder: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
  previewBody:          { padding: 16, gap: 8 },
  previewRow:           { flexDirection: 'row', gap: 8 },
  previewTitle:         { fontFamily: 'Inter_700Bold', fontSize: 17, lineHeight: 22 },
  previewPrice:         { fontFamily: 'Inter_700Bold', fontSize: 20 },
  previewMeta:          { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  previewMetaText:      { fontFamily: 'Inter_400Regular', fontSize: 12 },
  previewTag:           { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  previewTagText:       { fontFamily: 'Inter_500Medium', fontSize: 10 },
  previewDesc:          { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  previewReview:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10, marginTop: 4 },
  previewReviewText:    { fontFamily: 'Inter_500Medium', fontSize: 11, flex: 1 },
  statusBadge:          { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText:      { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff' },
  // Submit
  submitSection:        { alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 2 },
  submitIcon:           { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  submitTitle:          { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 6 },
  submitHint:           { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: 16 },
  submitBtn:            { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 18 },
  submitBtnText:        { fontFamily: 'Inter_700Bold', fontSize: 14 },
  submitFootnote:        { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 10 },
  // Hint
  hintBox:              { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 6 },
  hintText:             { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, flex: 1 },
  // Success
  successIcon:          { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 20 },
  successTitle:         { fontFamily: 'Inter_700Bold', fontSize: 26, textAlign: 'center', marginBottom: 10 },
  successBody:          { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  reviewBadge:          { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  reviewText:           { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  successBtn:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28 },
  successBtnText:       { fontFamily: 'Inter_700Bold', fontSize: 15 },
  successLink:          { fontFamily: 'Inter_600SemiBold', fontSize: 14, textDecorationLine: 'underline' },
  // Misc
  errorText:            { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#e53e3e', marginTop: 2, marginBottom: 6 },
});
