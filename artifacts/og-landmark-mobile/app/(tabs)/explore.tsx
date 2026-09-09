/**
 * OG Landmark — Explore / Search / Discovery
 * Comprehensive upgrade: multi-select filters, filter chips, Buy/Rent toggle,
 * quick filters, save search, recent searches, recently viewed, map view,
 * agriculture/plot/commercial specific filters, seller type, verified only.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, Pressable,
  ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
// BlurView removed — crashes Android
import { PropertyCard } from '@/components/PropertyCard';
import { AnimatedReveal } from '@/components/AnimatedReveal';
import { properties, apiPropertyToProperty } from '@/lib/properties';
import { getProperties, getPropertiesInBounds, getNearbyProperties } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { GlassCard } from '@/components/GlassCard';
import { projects as staticProjects } from '@/lib/projects';
import { getAllPublicProjects, type DeveloperProject } from '@/lib/developerStore';
import { saveSearch, getSavedSearches } from '@/lib/savedSearchesStore';
import { addRecentSearch, getRecentSearches, clearRecentSearches, removeRecentSearch } from '@/lib/recentSearchesStore';
import { getVisitHistory, type VisitRecord } from '@/lib/visitHistoryStore';
import { useAuth } from '@/context/AuthContext';
import { ExploreMapView, type MapBounds } from '@/components/ExploreMapView';
import { getCurrentPosition, haversineDistance, formatDistance } from '@/lib/locationService';
import {
  fetchAutocompleteSuggestions,
  fetchPlaceDetails,
  type AutocompleteSuggestion,
} from '@/lib/geocodingService';

// ── Property type for TypeScript ─────────────────────────────────────────────
type Property = (typeof properties)[number];

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_PROPERTY_TYPES = ['House', 'Apartment', 'Plot', 'Commercial', 'Agriculture Land', 'Farmhouse', 'Industrial', 'Warehouse', 'Office', 'Building', 'Other'];
const CITIES = ['Okara', 'Depalpur', 'Renala Khurd', 'Hujra Shah Muqeem', 'Basirpur', 'Haveli Lakha'];
const AREA_UNITS = ['Marla', 'Kanal', 'Sq Ft', 'Sq Yard', 'Acre'];

const PRICE_PRESETS_SALE = [
  { label: 'Under 50L',    min: 0,         max: 5000000   },
  { label: '50L – 1 Cr',  min: 5000000,   max: 10000000  },
  { label: '1 – 2 Cr',    min: 10000000,  max: 20000000  },
  { label: '2 – 5 Cr',    min: 20000000,  max: 50000000  },
  { label: '5 – 10 Cr',   min: 50000000,  max: 100000000 },
  { label: '10 Cr+',      min: 100000000, max: 0         },
];
const PRICE_PRESETS_RENT = [
  { label: 'Under 15K',   min: 0,      max: 15000  },
  { label: '15K – 30K',   min: 15000,  max: 30000  },
  { label: '30K – 60K',   min: 30000,  max: 60000  },
  { label: '60K – 1L',    min: 60000,  max: 100000 },
  { label: '1L+',         min: 100000, max: 0      },
];

const BEDROOM_OPTIONS  = [0, 1, 2, 3, 4, 5, 6];
const BATHROOM_OPTIONS = [0, 1, 2, 3, 4, 5];
const FURNISHING_OPTS  = ['Any', 'Furnished', 'Semi-Furnished', 'Unfurnished'];
const CONSTRUCTION_AGE = ['Any', 'New', '1–5 Years', '5–10 Years', '10+ Years'];
const FLOORS_OPTS      = ['Any', 'Ground', 'Single Storey', 'Double Storey', 'Multi Storey'];
const PARKING_OPTS     = [0, 1, 2, 3];
const CONDITION_OPTS   = ['Any', 'New Construction', 'Ready to Move', 'Under Construction', 'Possession Available', 'Recently Renovated'];

const PLOT_CATEGORIES = ['Residential Plot', 'Commercial Plot', 'Industrial Plot', 'Agricultural Plot'];
const PLOT_FEATURES   = ['Corner', 'Park Facing', 'Main Boulevard', 'Main Road', 'Near Mosque', 'Near School', 'Near Commercial Area', 'Possession Available', 'Balloted', 'Developed', 'Development Charges Paid'];

const COMMERCIAL_TYPES    = ['Shop', 'Office', 'Plaza', 'Building', 'Warehouse', 'Factory', 'Commercial Plot', 'Showroom', 'Hotel', 'Other'];
const COMMERCIAL_FEATURES = ['Main Road', 'Main Boulevard', 'Corner', 'Parking', 'Basement', 'Ground Floor', 'Lift', 'Electricity', 'Gas', 'Generator', 'CCTV', 'Security', 'Washrooms', 'Reception', 'Rental Income Available'];

const AGRI_WATER      = ['Nehri Water', 'Tube Well', 'Solar Tube Well', 'Canal Access', 'Water Available'];
const AGRI_ELECTRICITY = ['Electricity Available', 'Transformer Nearby'];
const AGRI_ROAD       = ['Main Road Front', 'Road Access'];
const AGRI_LAND_FEATS = ['Fertile Land', 'Orchard', 'Farmhouse', 'Boundary Wall', 'Residential Construction', 'Agricultural Buildings'];
const AGRI_CROPS      = ['Wheat', 'Rice', 'Maize', 'Sugarcane', 'Potato', 'Orchard', 'Other'];

const AMENITIES_ALL  = ['Electricity', 'Gas', 'Water', 'Sewerage', 'Internet', 'Security', 'CCTV', 'Parking', 'Garden', 'Balcony', 'Terrace', 'Servant Quarter', 'Store Room', 'Drawing Room', 'Dining Room', 'Lift', 'Backup Generator', 'Solar'];
const SELLER_TYPES   = ['Any', 'Owner', 'Verified Owner', 'Agent', 'Verified Agent', 'Developer', 'Verified Developer', 'Company'];
const LISTING_AGE_OPTS = [
  { label: 'Anytime',      value: 0  },
  { label: 'Today',        value: 1  },
  { label: 'Last 3 Days',  value: 3  },
  { label: 'Last 7 Days',  value: 7  },
  { label: 'Last 30 Days', value: 30 },
];

type SortOption = 'recommended' | 'newest' | 'price-low' | 'price-high' | 'area-large' | 'area-small' | 'most-viewed' | 'most-favorited';

const SORT_OPTIONS: { value: SortOption; label: string; icon: string }[] = [
  { value: 'recommended',   label: 'Recommended',      icon: 'star'          },
  { value: 'newest',        label: 'Newest',           icon: 'clock'         },
  { value: 'price-low',     label: 'Price: Low → High', icon: 'trending-down' },
  { value: 'price-high',    label: 'Price: High → Low', icon: 'trending-up'  },
  { value: 'area-large',    label: 'Largest Area',     icon: 'maximize-2'    },
  { value: 'area-small',    label: 'Smallest Area',    icon: 'minimize-2'    },
  { value: 'most-viewed',   label: 'Most Viewed',      icon: 'eye'           },
  { value: 'most-favorited',label: 'Most Favorited',   icon: 'heart'         },
];

// ── Filter state type ─────────────────────────────────────────────────────────

type FilterState = {
  purpose: 'Buy' | 'Rent';
  propertyTypes: string[];
  cities: string[];
  minPrice: string;
  maxPrice: string;
  areaUnit: string;
  minArea: string;
  maxArea: string;
  minBedrooms: number;
  minBathrooms: number;
  furnishing: string;
  constructionAge: string;
  floors: string;
  minParking: number;
  plotCategory: string;
  plotFeatures: string[];
  commercialType: string;
  commercialFeatures: string[];
  agriWater: string[];
  agriElectricity: string[];
  agriRoad: string[];
  agriLandFeatures: string[];
  agriCrop: string[];
  amenities: string[];
  condition: string;
  sellerType: string;
  verifiedOnly: boolean;
  listingAge: number;
  sortBy: SortOption;
};

const emptyFilters: FilterState = {
  purpose: 'Buy',
  propertyTypes: [],
  cities: [],
  minPrice: '',
  maxPrice: '',
  areaUnit: 'Marla',
  minArea: '',
  maxArea: '',
  minBedrooms: 0,
  minBathrooms: 0,
  furnishing: 'Any',
  constructionAge: 'Any',
  floors: 'Any',
  minParking: 0,
  plotCategory: '',
  plotFeatures: [],
  commercialType: '',
  commercialFeatures: [],
  agriWater: [],
  agriElectricity: [],
  agriRoad: [],
  agriLandFeatures: [],
  agriCrop: [],
  amenities: [],
  condition: 'Any',
  sellerType: 'Any',
  verifiedOnly: false,
  listingAge: 0,
  sortBy: 'recommended',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMarla(val: number, unit: string): number {
  if (!val) return 0;
  switch (unit) {
    case 'Kanal':   return val * 20;
    case 'Acre':    return val * 160;
    case 'Sq Ft':   return val / 272.25;
    case 'Sq Yard': return val / 30.25;
    default:        return val;
  }
}

function daysSince(iso?: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const d = new Date(iso).getTime();
  return Number.isNaN(d) ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor((Date.now() - d) / 86400000));
}

function formatPKR(amount: number): string {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (amount >= 100000)   return `${(amount / 100000).toFixed(0)} L`;
  if (amount >= 1000)     return `${(amount / 1000).toFixed(0)}K`;
  return String(amount);
}

// ── Core filter logic ─────────────────────────────────────────────────────────

function matchesProperty(p: Property, f: FilterState, query: string): boolean {
  // Purpose
  const isPurposeRent = f.purpose === 'Rent';
  if (isPurposeRent && p.status !== 'For Rent') return false;
  if (!isPurposeRent && p.status === 'For Rent') return false;

  // Property type (OR)
  if (f.propertyTypes.length > 0) {
    const typeMatch = f.propertyTypes.some((t) => {
      if (t === 'House')          return ['House', 'Villa', 'Apartment', 'Farm House', 'Duplex', 'Townhouse', 'Studio', 'Farmhouse'].includes(p.type);
      if (t === 'Plot')           return /plot/i.test(p.type);
      if (t === 'Industrial')     return /industrial|factory|warehouse/i.test(p.type);
      if (t === 'Agriculture Land') return ['Agriculture Land', 'Farmhouse', 'Farm', 'Farm House'].includes(p.type) || /agri|farm/i.test(p.type);
      if (t === 'Commercial')     return ['Commercial', 'Shop', 'Office', 'Plaza', 'Building', 'Warehouse', 'Showroom', 'Hotel'].includes(p.type) || /commercial|shop|office/i.test(p.type);
      return p.type === t;
    });
    if (!typeMatch) return false;
  }

  // Cities (OR)
  if (f.cities.length > 0) {
    const cityMatch = f.cities.some((c) => p.city.toLowerCase() === c.toLowerCase());
    if (!cityMatch) return false;
  }

  // Text search
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    const searchable = `${p.title} ${p.city} ${p.address} ${p.type} ${String(p.id)}`.toLowerCase();
    const hasMatch = q.split(/\s+/).filter((t) => t.length > 1).some((token) => searchable.includes(token));
    if (!hasMatch) return false;
  }

  // Price
  const minP = Number(f.minPrice) || 0;
  const maxP = Number(f.maxPrice) || 0;
  if (minP && p.price < minP) return false;
  if (maxP && p.price > maxP) return false;

  // Area (normalize to Marla for comparison)
  const propAreaMarla = toMarla(p.area, p.areaUnit ?? 'Marla');
  const minA = toMarla(Number(f.minArea) || 0, f.areaUnit);
  const maxA = toMarla(Number(f.maxArea) || 0, f.areaUnit);
  if (minA && propAreaMarla < minA) return false;
  if (maxA && propAreaMarla > maxA) return false;

  // Residential filters
  const isResidential = ['House', 'Apartment', 'Farmhouse', 'Villa', 'Farm House', 'Duplex', 'Townhouse', 'Studio'].includes(p.type);
  if (isResidential || f.propertyTypes.some((t) => ['House', 'Apartment', 'Farmhouse'].includes(t))) {
    if (f.minBedrooms > 0 && (p.bedrooms ?? 0) < f.minBedrooms) return false;
    if (f.minBathrooms > 0 && (p.bathrooms ?? 0) < f.minBathrooms) return false;
  }

  // Agriculture filters
  const isAgri = p.type === 'Agriculture Land';
  if (isAgri) {
    const agriData = (p as any).agriDetails as { nehriWater?: boolean; tubeWell?: boolean } | undefined;
    if (f.agriWater.length > 0 && agriData) {
      const waterMatch = f.agriWater.some((w) => {
        if (w === 'Nehri Water')     return agriData.nehriWater;
        if (w === 'Tube Well')       return agriData.tubeWell;
        if (w === 'Solar Tube Well') return false;
        return p.amenities?.some((a) => a.toLowerCase().includes(w.toLowerCase()));
      });
      if (!waterMatch) return false;
    }
    if (f.agriLandFeatures.length > 0) {
      const feat = f.agriLandFeatures.some((feat) =>
        p.amenities?.some((a) => a.toLowerCase().includes(feat.toLowerCase()))
      );
      if (!feat) return false;
    }
  }

  // Plot features
  const isPlot = /plot/i.test(p.type);
  if (isPlot && f.plotFeatures.length > 0) {
    const plotMatch = f.plotFeatures.some((feat) =>
      p.amenities?.some((a) => a.toLowerCase().includes(feat.toLowerCase()))
    );
    if (!plotMatch) return false;
  }

  // Commercial features
  const isCommercial = ['Commercial', 'Shop', 'Office', 'Plaza'].includes(p.type) || /commercial/i.test(p.type);
  if (isCommercial && f.commercialFeatures.length > 0) {
    const comMatch = f.commercialFeatures.some((feat) =>
      p.amenities?.some((a) => a.toLowerCase().includes(feat.toLowerCase()))
    );
    if (!comMatch) return false;
  }

  // Amenities (AND — user wants ALL selected amenities)
  if (f.amenities.length > 0) {
    const amenityMatch = f.amenities.every((req) =>
      p.amenities?.some((a) => a.toLowerCase().includes(req.toLowerCase()))
    );
    if (!amenityMatch) return false;
  }

  // Verified only
  if (f.verifiedOnly && !(p as any).verified) return false;

  // Listing age
  if (f.listingAge > 0 && daysSince((p as any).listedDate) > f.listingAge) return false;

  return true;
}

// ── Active chips builder ───────────────────────────────────────────────────────

type Chip = { label: string; key: string };

function buildChips(f: FilterState, query: string): Chip[] {
  const chips: Chip[] = [];
  if (query.trim()) chips.push({ label: `"${query.trim()}"`, key: 'query' });
  if (f.purpose === 'Rent') chips.push({ label: 'For Rent', key: 'purpose' });
  f.propertyTypes.forEach((t) => chips.push({ label: t, key: `type:${t}` }));
  f.cities.forEach((c) => chips.push({ label: c, key: `city:${c}` }));
  if (f.minPrice || f.maxPrice) {
    const label = f.minPrice && f.maxPrice
      ? `PKR ${formatPKR(Number(f.minPrice))} – ${formatPKR(Number(f.maxPrice))}`
      : f.minPrice ? `From PKR ${formatPKR(Number(f.minPrice))}` : `Up to PKR ${formatPKR(Number(f.maxPrice))}`;
    chips.push({ label, key: 'price' });
  }
  if (f.minArea || f.maxArea) {
    const label = f.minArea && f.maxArea
      ? `${f.minArea} – ${f.maxArea} ${f.areaUnit}`
      : f.minArea ? `${f.minArea}+ ${f.areaUnit}` : `Up to ${f.maxArea} ${f.areaUnit}`;
    chips.push({ label, key: 'area' });
  }
  if (f.minBedrooms > 0) chips.push({ label: `${f.minBedrooms}+ Beds`, key: 'beds' });
  if (f.minBathrooms > 0) chips.push({ label: `${f.minBathrooms}+ Baths`, key: 'baths' });
  if (f.furnishing !== 'Any') chips.push({ label: f.furnishing, key: 'furnishing' });
  if (f.condition !== 'Any') chips.push({ label: f.condition, key: 'condition' });
  if (f.plotCategory) chips.push({ label: f.plotCategory, key: 'plotCat' });
  f.plotFeatures.forEach((feat) => chips.push({ label: feat, key: `pf:${feat}` }));
  if (f.commercialType) chips.push({ label: f.commercialType, key: 'comType' });
  f.commercialFeatures.forEach((feat) => chips.push({ label: feat, key: `cf:${feat}` }));
  f.agriWater.forEach((w) => chips.push({ label: w, key: `aw:${w}` }));
  f.agriLandFeatures.forEach((feat) => chips.push({ label: feat, key: `alf:${feat}` }));
  f.agriCrop.forEach((c) => chips.push({ label: c, key: `ac:${c}` }));
  f.amenities.forEach((a) => chips.push({ label: a, key: `am:${a}` }));
  if (f.sellerType !== 'Any') chips.push({ label: f.sellerType, key: 'seller' });
  if (f.verifiedOnly) chips.push({ label: 'Verified Only', key: 'verified' });
  if (f.listingAge > 0) {
    const opt = LISTING_AGE_OPTS.find((o) => o.value === f.listingAge);
    if (opt) chips.push({ label: opt.label, key: 'listingAge' });
  }
  return chips;
}

// ── Sort logic ─────────────────────────────────────────────────────────────────

function sortProperties(props: Property[], sortBy: SortOption): Property[] {
  return [...props].sort((a, b) => {
    switch (sortBy) {
      case 'newest':         return daysSince((a as any).listedDate) - daysSince((b as any).listedDate);
      case 'price-low':      return a.price - b.price;
      case 'price-high':     return b.price - a.price;
      case 'area-large':     return toMarla(b.area, b.areaUnit ?? 'Marla') - toMarla(a.area, a.areaUnit ?? 'Marla');
      case 'area-small':     return toMarla(a.area, a.areaUnit ?? 'Marla') - toMarla(b.area, b.areaUnit ?? 'Marla');
      case 'most-viewed':    return (b.score ?? 0) - (a.score ?? 0);
      case 'most-favorited': return (b.investmentScore ?? 0) - (a.investmentScore ?? 0);
      default:               return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (b.score ?? 0) - (a.score ?? 0);
    }
  });
}

// ── Quick filter definitions ───────────────────────────────────────────────────

type QuickFilter = { label: string; icon: string; section: string };
const QUICK_FILTERS: QuickFilter[] = [
  { label: 'Price',    icon: 'tag',           section: 'price'    },
  { label: 'Type',     icon: 'home',          section: 'type'     },
  { label: 'Location', icon: 'map-pin',       section: 'location' },
  { label: 'Beds',     icon: 'moon',          section: 'beds'     },
  { label: 'Size',     icon: 'maximize-2',    section: 'size'     },
  { label: 'Verified', icon: 'shield',        section: 'verified' },
];

// ══════════════════════════════════════════════════════════════════════════════
// Main screen
// ══════════════════════════════════════════════════════════════════════════════

export default function ExploreScreen() {
  const colors     = useColors();
  const insets     = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router     = useRouter();
  const navigation = useNavigation();
  const { isLoggedIn } = useAuth();

  // Scroll-to-top when user taps the Explore tab icon while already on this screen
  const flatListRef = useRef<FlatList>(null);
  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation]);
  const params     = useLocalSearchParams<{
    type?: string; search?: string; city?: string; category?: string;
    propertyType?: string;   // comma-separated, e.g. "House" or "Agriculture Land"
    minPrice?: string; maxPrice?: string;
    minArea?: string;  maxArea?: string;
    agriWater?: string; agriRoad?: string;
    verifiedOnly?: string;  // '1' = true
  }>();
  const topInset   = insets.top + (Platform.OS === 'web' ? 67 : 0);

  // ── State ──────────────────────────────────────────────────────────────────

  const [query, setQuery]                     = useState(params.search ?? '');
  const [filters, setFilters]                 = useState<FilterState>(() => {
    const init: FilterState = { ...emptyFilters };
    // Purpose
    if (params.type === 'Rent') init.purpose = 'Rent';
    // Property types — new granular param takes priority over category
    if (params.propertyType) {
      init.propertyTypes = params.propertyType.split(',').map((t) => t.trim());
    } else if (params.category === 'Agriculture Land') {
      init.propertyTypes = ['Agriculture Land'];
    } else if (params.category === 'Homes') {
      init.propertyTypes = ['House'];
    } else if (params.category === 'Plots') {
      init.propertyTypes = ['Plot'];
    } else if (params.category === 'Commercial') {
      init.propertyTypes = ['Commercial'];
    } else if (params.category === 'Industrial') {
      init.propertyTypes = ['Industrial'];
    }
    // Location
    if (params.city) init.cities = [params.city];
    // Price range
    if (params.minPrice) init.minPrice = params.minPrice;
    if (params.maxPrice) init.maxPrice = params.maxPrice;
    // Area range (in Marla)
    if (params.minArea) init.minArea = params.minArea;
    if (params.maxArea) init.maxArea = params.maxArea;
    // Agriculture-specific water / road features
    if (params.agriWater) init.agriWater = params.agriWater.split(',').map((v) => v.trim());
    if (params.agriRoad)  init.agriRoad  = params.agriRoad.split(',').map((v) => v.trim());
    // Verified only
    if (params.verifiedOnly === '1') init.verifiedOnly = true;
    return init;
  });
  const [draftFilters, setDraftFilters]       = useState<FilterState>(filters);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [openSection, setOpenSection]         = useState<string | null>(null);
  const [viewMode, setViewMode]               = useState<'list' | 'map'>('list');
  const [searchFocused, setSearchFocused]     = useState(false);
  const [saveModalOpen, setSaveModalOpen]     = useState(false);
  const [saveName, setSaveName]               = useState('');
  const [recentSearches, setRecentSearches]   = useState<string[]>([]);
  const [savedSearchLabels, setSavedSearchLabels] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed]   = useState<VisitRecord[]>([]);
  const [devProjects, setDevProjects]         = useState<DeveloperProject[]>([]);
  const [isProjectsMode, setIsProjectsMode]   = useState(
    params.category === 'Projects' || params.propertyType === 'Project',
  );
  const [allProperties, setAllProperties]     = useState(properties);
  const [nearMe, setNearMe]                   = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const [nearMeLoading, setNearMeLoading]     = useState(false);
  const [searchedPlace, setSearchedPlace]     = useState<{ lat: number; lng: number; radiusKm: number; label: string } | null>(null);
  const [placeSuggestions, setPlaceSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [placeSuggestionsLoading, setPlaceSuggestionsLoading] = useState(false);
  const [mapBoundsFilter, setMapBoundsFilter] = useState<MapBounds | null>(null);
  const [geoLoading, setGeoLoading]             = useState(false);
  const [geoError, setGeoError]                 = useState('');
  const searchRef = useRef<React.ElementRef<typeof TextInput>>(null);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    getRecentSearches().then(setRecentSearches).catch(() => {});
    getSavedSearches().then((ss) => setSavedSearchLabels(ss.slice(0, 4).map((s) => s.label))).catch(() => {});
    getVisitHistory().then((h) => setRecentlyViewed(h.slice(0, 6))).catch(() => {});
    getAllPublicProjects().then(setDevProjects).catch(() => {});
    // Fetch live properties from backend; fall back to local mock on error
    getProperties({ limit: 100 })
      .then((ps) => { if (ps.length) setAllProperties(ps.map(apiPropertyToProperty)); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const radiusLocation = nearMe ?? searchedPlace;
    if (!radiusLocation && !mapBoundsFilter) {
      let cancelled = false;
      setGeoError('');
      setGeoLoading(true);
      getProperties({ limit: 100 })
        .then((items) => {
          if (!cancelled && items.length) setAllProperties(items.map(apiPropertyToProperty));
        })
        .catch(() => {
          if (!cancelled) {
            setGeoError('Live properties could not be refreshed. Showing the properties already loaded on this device.');
          }
        })
        .finally(() => {
          if (!cancelled) setGeoLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setGeoLoading(true);
    setGeoError('');

    const request = radiusLocation
      ? getNearbyProperties({
          lat: radiusLocation.lat,
          lng: radiusLocation.lng,
          radiusKm: radiusLocation.radiusKm,
        }, { limit: 100 })
      : getPropertiesInBounds({
          minLat: mapBoundsFilter!.south,
          maxLat: mapBoundsFilter!.north,
          minLng: mapBoundsFilter!.west,
          maxLng: mapBoundsFilter!.east,
        }, { limit: 100 });

    request
      .then((items) => {
        if (!cancelled) setAllProperties(items.map(apiPropertyToProperty));
      })
      .catch(() => {
        if (!cancelled) {
          setGeoError('Live map results could not be refreshed. Showing the properties already loaded on this device.');
        }
      })
      .finally(() => {
        if (!cancelled) setGeoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nearMe, searchedPlace, mapBoundsFilter]);

  useEffect(() => {
    const text = query.trim();
    if (!searchFocused || text.length < 2) {
      setPlaceSuggestions([]);
      setPlaceSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setPlaceSuggestionsLoading(true);
      const results = await fetchAutocompleteSuggestions(text);
      if (!cancelled) {
        setPlaceSuggestions(results.slice(0, 5));
        setPlaceSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, searchFocused]);

  // ── Memos ──────────────────────────────────────────────────────────────────

  const filteredProperties = useMemo(() => {
    let matched = allProperties.filter((p) => matchesProperty(p, filters, query));

    // GPS or searched-place radius filter
    const radiusLocation = nearMe ?? searchedPlace;
    if (radiusLocation) {
      matched = matched
        .map((p) => {
          const pLat = (p as any).lat ?? (p as any).latitude;
          const pLng = (p as any).lng ?? (p as any).longitude;
          if (!pLat || !pLng) return null;
          const dist = haversineDistance(radiusLocation.lat, radiusLocation.lng, Number(pLat), Number(pLng));
          if (dist > radiusLocation.radiusKm) return null;
          return { ...p, _distKm: dist, _distLabel: formatDistance(dist) };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a._distKm - b._distKm) as typeof matched;
    }

    // Map bounds filter (after "Search this area" tap)
    if (mapBoundsFilter && !radiusLocation) {
      const { north, south, east, west } = mapBoundsFilter;
      matched = matched.filter((p) => {
        const pLat = Number((p as any).lat ?? (p as any).latitude ?? 0);
        const pLng = Number((p as any).lng ?? (p as any).longitude ?? 0);
        return pLat >= south && pLat <= north && pLng >= west && pLng <= east;
      });
    }

    return radiusLocation ? matched : sortProperties(matched, filters.sortBy);
  }, [allProperties, filters, query, nearMe, searchedPlace, mapBoundsFilter]);

  const draftResultCount = useMemo(
    () => allProperties.filter((p) => matchesProperty(p, draftFilters, query)).length,
    [allProperties, draftFilters, query],
  );

  const activeChips = useMemo(() => buildChips(filters, query), [filters, query]);

  const hasActiveFilters = activeChips.length > 0;

  // Track which quick-filter sections have active state (for chip highlight)
  const activeFilterSections = useMemo(() => {
    const s = new Set<string>();
    if (filters.purpose === 'Rent') s.add('purpose');
    if (filters.minPrice || filters.maxPrice) s.add('price');
    if (filters.propertyTypes.length > 0) s.add('type');
    if (filters.cities.length > 0) s.add('location');
    if (filters.minBedrooms > 0 || filters.minBathrooms > 0) s.add('beds');
    if (filters.minArea || filters.maxArea) s.add('size');
    if (filters.verifiedOnly) s.add('verified');
    return s;
  }, [filters]);

  // Detect which property types are selected (for conditional filter sections)
  const selectedTypes = draftFilters.propertyTypes;
  const isResidentialDraft  = selectedTypes.length === 0 || selectedTypes.some((t) => ['House', 'Apartment', 'Farmhouse'].includes(t));
  const isPlotDraft         = selectedTypes.some((t) => t === 'Plot') || (selectedTypes.length === 0);
  const isCommercialDraft   = selectedTypes.some((t) => ['Commercial', 'Office', 'Building', 'Warehouse'].includes(t)) || selectedTypes.length === 0;
  const isAgriDraft         = selectedTypes.some((t) => t === 'Agriculture Land') || selectedTypes.length === 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSearchSubmit = useCallback(() => {
    if (query.trim()) {
      addRecentSearch(query.trim()).then(() => getRecentSearches().then(setRecentSearches));
    }
    setSearchFocused(false);
    searchRef.current?.blur();
  }, [query]);

  const removeChip = useCallback((key: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (key === 'query') { setQuery(''); return next; }
      if (key === 'purpose') next.purpose = 'Buy';
      if (key === 'price') { next.minPrice = ''; next.maxPrice = ''; }
      if (key === 'area') { next.minArea = ''; next.maxArea = ''; }
      if (key === 'beds') next.minBedrooms = 0;
      if (key === 'baths') next.minBathrooms = 0;
      if (key === 'furnishing') next.furnishing = 'Any';
      if (key === 'condition') next.condition = 'Any';
      if (key === 'plotCat') next.plotCategory = '';
      if (key === 'comType') next.commercialType = '';
      if (key === 'seller') next.sellerType = 'Any';
      if (key === 'verified') next.verifiedOnly = false;
      if (key === 'listingAge') next.listingAge = 0;
      if (key.startsWith('type:'))  next.propertyTypes = prev.propertyTypes.filter((t) => `type:${t}` !== key);
      if (key.startsWith('city:'))  next.cities = prev.cities.filter((c) => `city:${c}` !== key);
      if (key.startsWith('pf:'))    next.plotFeatures = prev.plotFeatures.filter((f) => `pf:${f}` !== key);
      if (key.startsWith('cf:'))    next.commercialFeatures = prev.commercialFeatures.filter((f) => `cf:${f}` !== key);
      if (key.startsWith('aw:'))    next.agriWater = prev.agriWater.filter((w) => `aw:${w}` !== key);
      if (key.startsWith('alf:'))   next.agriLandFeatures = prev.agriLandFeatures.filter((f) => `alf:${f}` !== key);
      if (key.startsWith('ac:'))    next.agriCrop = prev.agriCrop.filter((c) => `ac:${c}` !== key);
      if (key.startsWith('am:'))    next.amenities = prev.amenities.filter((a) => `am:${a}` !== key);
      return next;
    });
  }, []);

  const resetAllFilters = useCallback(() => {
    setFilters({ ...emptyFilters });
    setDraftFilters({ ...emptyFilters });
    setQuery('');
    setIsProjectsMode(false);
    setNearMe(null);
    setSearchedPlace(null);
    setMapBoundsFilter(null);
  }, []);

  const handleNearMe = useCallback(async () => {
    if (nearMe) {
      setNearMe(null);
      return;
    }
    setNearMeLoading(true);
    try {
      const pos = await getCurrentPosition();
      if (!pos) { setNearMeLoading(false); return; }
      setNearMe({ lat: pos.latitude, lng: pos.longitude, radiusKm: 10 });
      setSearchedPlace(null);
      setMapBoundsFilter(null);
      // Switch to map so user sees their location
      setViewMode('map');
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setNearMeLoading(false);
    }
  }, [nearMe]);

  const handleSearchArea = useCallback((bounds: MapBounds) => {
    setMapBoundsFilter(bounds);
    setNearMe(null);
    setSearchedPlace(null);
  }, []);

  const handlePlaceSuggestion = useCallback(async (suggestion: AutocompleteSuggestion) => {
    const details = await fetchPlaceDetails(suggestion.placeId);
    if (!details) {
      Alert.alert(
        'Location unavailable',
        'We could not load this place. Check your internet connection and try again.',
      );
      return;
    }

    const label = details.name || suggestion.mainText;
    setQuery(label);
    setPlaceSuggestions([]);
    setSearchFocused(false);
    searchRef.current?.blur();
    setSearchedPlace({
      lat: details.latitude,
      lng: details.longitude,
      radiusKm: 25,
      label,
    });
    setNearMe(null);
    setMapBoundsFilter(null);
    setViewMode('map');
    addRecentSearch(label).then(() => getRecentSearches().then(setRecentSearches)).catch(() => undefined);
  }, []);

  const openFilterSheet = useCallback((section?: string) => {
    setDraftFilters({ ...filters });
    setOpenSection(section ?? null);
    setFilterSheetOpen(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    setFilterSheetOpen(false);
  }, [draftFilters]);

  const handleSaveSearch = useCallback(async () => {
    if (!isLoggedIn) {
      Alert.alert('Sign In Required', 'Please sign in to save searches.');
      return;
    }
    const label = saveName.trim() || buildAutoLabel();
    await saveSearch({ label, query, filters: { location: filters.cities.join(', '), minPrice: filters.minPrice, maxPrice: filters.maxPrice } });
    setSaveModalOpen(false);
    setSaveName('');
    Alert.alert('Search Saved ✓', `"${label}" has been saved to your profile.`);
  }, [saveName, query, filters, isLoggedIn]);

  function buildAutoLabel(): string {
    const parts: string[] = [];
    if (filters.propertyTypes.length > 0) parts.push(filters.propertyTypes.join('/'));
    if (filters.cities.length > 0) parts.push(filters.cities.join(' & '));
    if (query.trim()) parts.push(query.trim());
    return parts.join(' · ') || 'My Search';
  }

  const toggleType = (t: string) => {
    setFilters((prev) => {
      const types = prev.propertyTypes.includes(t) ? prev.propertyTypes.filter((x) => x !== t) : [...prev.propertyTypes, t];
      return { ...prev, propertyTypes: types };
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[ex.screen, { backgroundColor: colors.background }]}>
      {/* ── Sticky header ── */}
      <View style={[ex.stickyHeader, { paddingTop: topInset + 10, backgroundColor: colors.background, borderBottomColor: colors.border }]}>

        {/* Buy / Rent toggle */}
        <View style={[ex.purposeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['Buy', 'Rent'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setFilters((prev) => ({ ...prev, purpose: p }))}
               style={[ex.purposeTab, filters.purpose === p && { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }]}
            >
               <Text style={[ex.purposeTabText, { color: filters.purpose === p ? colors.selectionForeground : colors.mutedForeground, fontWeight: filters.purpose === p ? '600' : '400' }]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* Search row */}
        <View style={ex.searchRow}>
          <View style={[ex.searchBar, { backgroundColor: colors.glassCard, borderColor: searchFocused ? colors.action : colors.glassBorder }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.14)' }]} />
            <Feather name="search" size={17} color={colors.mutedForeground} style={ex.searchIcon} />
            <TextInput
              ref={searchRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              placeholder="Search city, area, society or property…"
              placeholderTextColor={colors.mutedForeground}
              style={[ex.searchInput, { color: colors.foreground }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setSearchedPlace(null); setPlaceSuggestions([]); }} hitSlop={8}>
                <Feather name="x-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Filter button */}
           <Pressable onPress={() => openFilterSheet()} style={[ex.filterBtn, { backgroundColor: hasActiveFilters ? colors.selectionBackground : colors.glassCard, borderColor: hasActiveFilters ? colors.selectionBorder : colors.glassBorder, borderWidth: hasActiveFilters ? 1.5 : 1 }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
             <Feather name="sliders" size={17} color={hasActiveFilters ? colors.selectionForeground : colors.foreground} />
            {hasActiveFilters && <View style={[ex.filterDot, { backgroundColor: colors.gold }]}><Text style={[ex.filterDotText, { color: '#1c2024' }]}>{activeChips.length}</Text></View>}
          </Pressable>

          {/* List / Map toggle */}
          <View style={[ex.viewToggle, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
            {(['list', 'map'] as const).map((m) => (
               <Pressable key={m} onPress={() => setViewMode(m)} style={[ex.viewToggleBtn, viewMode === m && { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }]}>
                 <Feather name={m === 'list' ? 'list' : 'map'} size={15} color={viewMode === m ? colors.selectionForeground : colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Pakistan location autocomplete */}
        {searchFocused && query.trim().length >= 2 && (placeSuggestionsLoading || placeSuggestions.length > 0) && (
          <View style={[ex.recentDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={ex.recentHeader}>
              <Text style={[ex.recentLabel, { color: colors.mutedForeground }]}>Locations in Pakistan</Text>
            </View>
            {placeSuggestionsLoading ? (
              <View style={ex.recentItem}>
                <Feather name="loader" size={13} color={colors.action} />
                <Text style={[ex.recentItemText, { color: colors.mutedForeground }]}>Finding locations…</Text>
              </View>
            ) : placeSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.placeId}
                style={ex.recentItem}
                onPress={() => handlePlaceSuggestion(suggestion)}
              >
                <Feather name="map-pin" size={13} color={colors.action} />
                <View style={{ flex: 1 }}>
                  <Text style={[ex.recentItemText, { color: colors.foreground }]}>{suggestion.mainText}</Text>
                  {suggestion.secondaryText ? (
                    <Text style={[ex.recentLabel, { color: colors.mutedForeground, marginTop: 2 }]} numberOfLines={1}>
                      {suggestion.secondaryText}
                    </Text>
                  ) : null}
                </View>
                <Feather name="arrow-up-left" size={13} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Recent + Saved searches dropdown */}
        {searchFocused && !query && (recentSearches.length > 0 || savedSearchLabels.length > 0) && (
          <View style={[ex.recentDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {recentSearches.length > 0 && (
              <>
                <View style={ex.recentHeader}>
                  <Text style={[ex.recentLabel, { color: colors.mutedForeground }]}>Recent Searches</Text>
                  <Pressable onPress={() => clearRecentSearches().then(() => setRecentSearches([]))}>
                    <Text style={[ex.recentClear, { color: colors.action }]}>Clear</Text>
                  </Pressable>
                </View>
                {recentSearches.slice(0, 4).map((s) => (
                  <Pressable key={s} style={ex.recentItem} onPress={() => { setQuery(s); setSearchFocused(false); }}>
                    <Feather name="clock" size={13} color={colors.mutedForeground} />
                    <Text style={[ex.recentItemText, { color: colors.foreground }]}>{s}</Text>
                    <Pressable onPress={() => removeRecentSearch(s).then(() => getRecentSearches().then(setRecentSearches))} hitSlop={8}>
                      <Feather name="x" size={13} color={colors.mutedForeground} />
                    </Pressable>
                  </Pressable>
                ))}
              </>
            )}
            {savedSearchLabels.length > 0 && (
              <>
                <View style={[ex.recentHeader, { marginTop: recentSearches.length > 0 ? 6 : 0, borderTopWidth: recentSearches.length > 0 ? 1 : 0, borderTopColor: colors.border, paddingTop: recentSearches.length > 0 ? 10 : 0 }]}>
                  <Text style={[ex.recentLabel, { color: colors.mutedForeground }]}>Saved Searches</Text>
                </View>
                {savedSearchLabels.map((label) => (
                  <Pressable key={label} style={ex.recentItem} onPress={() => { setQuery(label); setSearchFocused(false); }}>
                    <Feather name="bookmark" size={13} color={colors.primary} />
                    <Text style={[ex.recentItemText, { color: colors.foreground }]}>{label}</Text>
                    <Feather name="arrow-up-left" size={13} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}

        {/* Quick filter row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={ex.quickFilters}>
          {/* Near Me pill */}
          <Pressable
            onPress={handleNearMe}
            disabled={nearMeLoading}
             style={[ex.quickChip, { backgroundColor: nearMe ? colors.selectionBackground : colors.glassCard, borderColor: nearMe ? colors.selectionBorder : colors.glassBorder, borderWidth: nearMe ? 1.5 : 1, opacity: nearMeLoading ? 0.65 : 1 }]}
          >
             <Feather name="crosshair" size={12} color={nearMe ? colors.selectionForeground : colors.mutedForeground} />
             <Text style={[ex.quickChipText, { color: nearMe ? colors.selectionForeground : colors.foreground, fontWeight: nearMe ? '600' : '400' }]}>
              {nearMeLoading ? 'Locating…' : nearMe ? 'Near Me ✓' : 'Near Me'}
            </Text>
          </Pressable>

          {/* Near Me radius selector */}
          {nearMe && (
            <>
              {[1, 5, 10, 25, 50].map((km) => (
                <Pressable
                  key={km}
                  onPress={() => setNearMe((prev) => prev ? { ...prev, radiusKm: km } : null)}
                  style={[ex.quickChip, {
                     backgroundColor: nearMe.radiusKm === km ? colors.selectionBackground : colors.glassCard,
                     borderColor: nearMe.radiusKm === km ? colors.selectionBorder : colors.glassBorder,
                     borderWidth: nearMe.radiusKm === km ? 1.5 : 1,
                  }]}
                >
                   <Text style={[ex.quickChipText, { color: nearMe.radiusKm === km ? colors.selectionForeground : colors.foreground, fontWeight: nearMe.radiusKm === km ? '600' : '400' }]}>{km} km</Text>
                </Pressable>
              ))}
            </>
          )}

          {searchedPlace && (
            <Pressable
              onPress={() => { setSearchedPlace(null); setQuery(''); }}
               style={[ex.quickChip, { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }]}
            >
               <Feather name="map-pin" size={12} color={colors.selectionForeground} />
               <Text style={[ex.quickChipText, { color: colors.selectionForeground, fontWeight: '600' }]} numberOfLines={1}>
                {searchedPlace.label} · 25 km
              </Text>
               <Feather name="x" size={11} color={colors.selectionForeground} />
            </Pressable>
          )}

          {/* Projects pill */}
          <Pressable
            onPress={() => { setIsProjectsMode((v) => !v); }}
             style={[ex.quickChip, { backgroundColor: isProjectsMode ? colors.selectionBackground : colors.glassCard, borderColor: isProjectsMode ? colors.selectionBorder : colors.glassBorder, borderWidth: isProjectsMode ? 1.5 : 1 }]}
          >
             <Text style={[ex.quickChipText, { color: isProjectsMode ? colors.selectionForeground : colors.foreground, fontWeight: isProjectsMode ? '600' : '400' }]}>Projects</Text>
          </Pressable>
          {QUICK_FILTERS.map((qf) => {
            const isActive = activeFilterSections.has(qf.section);
            return (
              <Pressable
                key={qf.label}
                onPress={() => openFilterSheet(qf.section)}
                style={[ex.quickChip, {
                  backgroundColor: isActive ? colors.selectionBackground : colors.glassCard,
                  borderColor: isActive ? colors.selectionBorder : colors.glassBorder,
                  borderWidth: isActive ? 1.5 : 1,
                }]}
              >
                <Feather name={qf.icon as any} size={12} color={isActive ? colors.selectionForeground : colors.mutedForeground} />
                <Text style={[ex.quickChipText, { color: isActive ? colors.selectionForeground : colors.foreground, fontFamily: isActive ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>{qf.label}</Text>
                {isActive && <View style={[ex.quickChipDot, { backgroundColor: colors.selectionForeground }]} />}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Active filter chips */}
        {activeChips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={ex.chipRow}>
            {activeChips.map((chip) => (
              <Pressable key={chip.key} onPress={() => removeChip(chip.key)} style={[ex.chip, { backgroundColor: colors.goldGlass, borderColor: colors.goldGlassBorder }]}>
                <Text style={[ex.chipText, { color: colors.goldForeground }]}>{chip.label}</Text>
                <Feather name="x" size={11} color={colors.goldForeground} />
              </Pressable>
            ))}
            <Pressable onPress={resetAllFilters} style={[ex.clearAll, { borderColor: colors.border }]}>
              <Text style={[ex.clearAllText, { color: colors.mutedForeground }]}>Clear All</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* ── Scrollable body ── */}
      <FlatList
        ref={flatListRef}
        data={isProjectsMode ? [] : (viewMode === 'list' ? filteredProperties : [])}
        keyExtractor={(p) => String(p.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarHeight, paddingTop: 14 }}
        ListHeaderComponent={
          <>
            {/* Result count + sort + save */}
            {!isProjectsMode && (
              <View style={ex.resultBar}>
                <Text style={[ex.resultCount, { color: colors.foreground }]}>
                  {viewMode === 'list' ? `${filteredProperties.length} properties` : `${filteredProperties.length} on map`}
                </Text>
                  <View style={ex.resultBarRight}>
                  {filteredProperties.length > 0 && (
                    <>
                      <Pressable
                        onPress={() => Alert.alert('Search Alert Set ✓', 'We\'ll notify you when new matching properties are listed.')}
                        style={[ex.saveBtn, { borderColor: colors.border }]}
                      >
                        <Feather name="bell" size={13} color={colors.action} />
                        <Text style={[ex.saveBtnText, { color: colors.action }]}>Alert</Text>
                      </Pressable>
                      <Pressable onPress={() => setSaveModalOpen(true)} style={[ex.saveBtn, { borderColor: colors.border }]}>
                        <Feather name="bookmark" size={13} color={colors.action} />
                        <Text style={[ex.saveBtnText, { color: colors.action }]}>Save</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable onPress={() => openFilterSheet('sort')} style={ex.sortBtn}>
                    <Feather name="chevrons-down" size={13} color={colors.mutedForeground} />
                    <Text style={[ex.sortBtnText, { color: colors.mutedForeground }]}>
                      {SORT_OPTIONS.find((s) => s.value === filters.sortBy)?.label ?? 'Sort'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Map view */}
            {!isProjectsMode && viewMode === 'map' && (
              <ExploreMapView
                properties={filteredProperties.map((p: any) => ({
                  ...p,
                  distance: p._distLabel,
                  image: typeof p.image === 'string' ? p.image : undefined,
                }))}
                count={filteredProperties.length}
                colors={colors}
                onSelect={(id) => router.push(`/property/${id}` as any)}
                onSearchArea={handleSearchArea}
                userLat={nearMe?.lat}
                userLng={nearMe?.lng}
                centerLat={searchedPlace?.lat}
                centerLng={searchedPlace?.lng}
              />
            )}

            {/* Projects mode */}
            {isProjectsMode && (
              <ProjectsList staticProjects={staticProjects} devProjects={devProjects} router={router} colors={colors} />
            )}

            {/* Recently Viewed */}
            {!isProjectsMode && viewMode === 'list' && recentlyViewed.length > 0 && !hasActiveFilters && !query && (
              <RecentlyViewedRow items={recentlyViewed} colors={colors} router={router} />
            )}
          </>
        }
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        updateCellsBatchingPeriod={30}
        renderItem={({ item: p }) => (
          <PropertyCard property={p} compact />
        )}
        ListEmptyComponent={
          !isProjectsMode && viewMode === 'list' ? (
            <NoResultsView colors={colors} onAdjust={() => openFilterSheet()} onClear={resetAllFilters} />
          ) : null
        }
      />

      {/* ── Filter bottom sheet ── */}
      <FilterSheet
        open={filterSheetOpen}
        draft={draftFilters}
        onChange={setDraftFilters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={applyFilters}
        onReset={() => setDraftFilters({ ...emptyFilters })}
        draftResultCount={draftResultCount}
        colors={colors}
        openSection={openSection}
        isResidential={isResidentialDraft}
        isPlot={isPlotDraft}
        isCommercial={isCommercialDraft}
        isAgri={isAgriDraft}
        insets={insets}
      />

      {/* ── Save Search modal ── */}
      <Modal visible={saveModalOpen} transparent animationType="fade" onRequestClose={() => setSaveModalOpen(false)}>
        <View style={ex.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSaveModalOpen(false)} />
          <View style={[ex.saveModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[ex.saveModalTitle, { color: colors.foreground }]}>Save Search</Text>
            <Text style={[ex.saveModalSub, { color: colors.mutedForeground }]}>Name this search to find it later in your profile.</Text>
            <View style={[ex.saveModalInput, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
              <TextInput
                value={saveName}
                onChangeText={setSaveName}
                placeholder={buildAutoLabel()}
                placeholderTextColor={colors.mutedForeground}
                style={[ex.saveModalInputText, { color: colors.foreground }]}
                returnKeyType="done"
              />
            </View>
            <View style={ex.saveModalBtns}>
              <Pressable onPress={() => setSaveModalOpen(false)} style={[ex.saveModalCancel, { borderColor: colors.border }]}>
                <Text style={[ex.saveModalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveSearch} style={[ex.saveModalConfirm, { backgroundColor: colors.action }]}>
                <Feather name="bookmark" size={14} color={colors.actionForeground} />
                <Text style={[ex.saveModalConfirmText, { color: colors.actionForeground }]}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Filter Sheet
// ══════════════════════════════════════════════════════════════════════════════

function FilterSheet({ open, draft, onChange, onClose, onApply, onReset, draftResultCount, colors, openSection, isResidential, isPlot, isCommercial, isAgri, insets }: {
  open: boolean; draft: FilterState; onChange: (f: FilterState) => void; onClose: () => void;
  onApply: () => void; onReset: () => void; draftResultCount: number; colors: any;
  openSection: string | null; isResidential: boolean; isPlot: boolean; isCommercial: boolean; isAgri: boolean;
  insets: { bottom: number };
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (open && openSection) setExpanded((prev) => ({ ...prev, [openSection]: true }));
  }, [open, openSection]);

  const set = (partial: Partial<FilterState>) => onChange({ ...draft, ...partial });
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleArr = <K extends keyof FilterState>(key: K, item: string) => {
    const arr = draft[key] as string[];
    onChange({ ...draft, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] } as any);
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={fs.root}>
        <Pressable style={fs.backdrop} onPress={onClose} />
        <View style={[fs.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={fs.handle} />
          {/* Header */}
          <View style={fs.header}>
            <View>
              <Text style={[fs.eyebrow, { color: colors.primary }]}>ADVANCED FILTERS</Text>
              <Text style={[fs.title, { color: colors.foreground }]}>Refine Search</Text>
            </View>
            <Pressable onPress={onReset} hitSlop={10}>
              <Text style={[fs.reset, { color: colors.action }]}>Reset All</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

            {/* ── Purpose ── */}
            <Section label="Purpose" icon="refresh-cw" expanded={expanded.purpose} onToggle={() => toggle('purpose')}>
              <PillRow options={['Buy', 'Rent']} selected={draft.purpose}
                onSelect={(v) => set({ purpose: v as 'Buy' | 'Rent' })} colors={colors} />
            </Section>

            {/* ── Property Type ── */}
            <Section label="Property Type" icon="home" expanded={expanded.type ?? true} onToggle={() => toggle('type')}>
              <View style={fs.typeGrid}>
                {ALL_PROPERTY_TYPES.map((t) => {
                  const sel = draft.propertyTypes.includes(t);
                  return (
                    <Pressable key={t} onPress={() => {
                      const next = sel ? draft.propertyTypes.filter((x) => x !== t) : [...draft.propertyTypes, t];
                      set({ propertyTypes: next });
                    }} style={[fs.typeChip, { backgroundColor: sel ? colors.selectionBackground : colors.glassCard, borderColor: sel ? colors.selectionBorder : colors.glassBorder, borderWidth: sel ? 1.5 : 1 }]}>
                      <Text style={[fs.typeChipText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{t}</Text>
                      {sel && <Feather name="check" size={11} color={colors.actionForeground} />}
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* ── Location ── */}
            <Section label="Location" icon="map-pin" expanded={expanded.location} onToggle={() => toggle('location')}>
              <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Select cities (tap multiple)</Text>
              <View style={fs.cityGrid}>
                {CITIES.map((c) => {
                  const sel = draft.cities.includes(c);
                  return (
                    <Pressable key={c} onPress={() => {
                      const next = sel ? draft.cities.filter((x) => x !== c) : [...draft.cities, c];
                      set({ cities: next });
                     }} style={[fs.cityChip, { backgroundColor: sel ? colors.selectionBackground : colors.glassCard, borderColor: sel ? colors.selectionBorder : colors.glassBorder, borderWidth: sel ? 1.5 : 1 }]}>
                       <Feather name="map-pin" size={11} color={sel ? colors.selectionForeground : colors.mutedForeground} />
                       <Text style={[fs.cityChipText, { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '400' }]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* ── Price ── */}
            <Section label={draft.purpose === 'Rent' ? 'Monthly Rent' : 'Price'} icon="tag" expanded={expanded.price} onToggle={() => toggle('price')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
                {(draft.purpose === 'Rent' ? PRICE_PRESETS_RENT : PRICE_PRESETS_SALE).map((p) => {
                  const active = Number(draft.minPrice) === p.min && Number(draft.maxPrice) === p.max;
                  return (
                    <Pressable key={p.label} onPress={() => set({ minPrice: p.min ? String(p.min) : '', maxPrice: p.max ? String(p.max) : '' })}
                       style={[fs.presetChip, { backgroundColor: active ? colors.selectionBackground : colors.glassCard, borderColor: active ? colors.selectionBorder : colors.glassBorder, borderWidth: active ? 1.5 : 1 }]}>
                       <Text style={[fs.presetChipText, { color: active ? colors.selectionForeground : colors.foreground, fontWeight: active ? '600' : '400' }]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={fs.rangeRow}>
                <RangeInput label="PKR" value={draft.minPrice} placeholder="Min" onChangeText={(v) => set({ minPrice: v })} colors={colors} />
                <Text style={[fs.dash, { color: colors.mutedForeground }]}>–</Text>
                <RangeInput label="PKR" value={draft.maxPrice} placeholder="Max" onChangeText={(v) => set({ maxPrice: v })} colors={colors} />
              </View>
            </Section>

            {/* ── Property Size ── */}
            <Section label="Property Size" icon="maximize-2" expanded={expanded.size} onToggle={() => toggle('size')}>
              <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Unit</Text>
              <PillRow options={AREA_UNITS} selected={draft.areaUnit} onSelect={(v) => set({ areaUnit: v })} colors={colors} />
              <View style={[fs.rangeRow, { marginTop: 10 }]}>
                <RangeInput label="Min" value={draft.minArea} placeholder="e.g. 5" onChangeText={(v) => set({ minArea: v })} colors={colors} />
                <Text style={[fs.dash, { color: colors.mutedForeground }]}>–</Text>
                <RangeInput label="Max" value={draft.maxArea} placeholder="e.g. 20" onChangeText={(v) => set({ maxArea: v })} colors={colors} />
              </View>
            </Section>

            {/* ── Bedrooms & Bathrooms (residential) ── */}
            {(isResidential || draft.propertyTypes.length === 0) && (
              <Section label="Bedrooms & Bathrooms" icon="moon" expanded={expanded.beds} onToggle={() => toggle('beds')}>
                <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Bedrooms</Text>
                <PillRow
                  options={BEDROOM_OPTIONS.map((n) => (n === 0 ? 'Any' : `${n}+`))}
                  selected={draft.minBedrooms === 0 ? 'Any' : `${draft.minBedrooms}+`}
                  onSelect={(v) => set({ minBedrooms: v === 'Any' ? 0 : parseInt(v) })}
                  colors={colors}
                />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Bathrooms</Text>
                <PillRow
                  options={BATHROOM_OPTIONS.map((n) => (n === 0 ? 'Any' : `${n}+`))}
                  selected={draft.minBathrooms === 0 ? 'Any' : `${draft.minBathrooms}+`}
                  onSelect={(v) => set({ minBathrooms: v === 'Any' ? 0 : parseInt(v) })}
                  colors={colors}
                />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Furnishing</Text>
                <PillRow options={FURNISHING_OPTS} selected={draft.furnishing} onSelect={(v) => set({ furnishing: v })} colors={colors} />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Construction Age</Text>
                <PillRow options={CONSTRUCTION_AGE} selected={draft.constructionAge} onSelect={(v) => set({ constructionAge: v })} colors={colors} />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Floors</Text>
                <PillRow options={FLOORS_OPTS} selected={draft.floors} onSelect={(v) => set({ floors: v })} colors={colors} />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Parking Spaces</Text>
                <PillRow
                  options={PARKING_OPTS.map((n) => (n === 0 ? 'Any' : `${n}+`))}
                  selected={draft.minParking === 0 ? 'Any' : `${draft.minParking}+`}
                  onSelect={(v) => set({ minParking: v === 'Any' ? 0 : parseInt(v) })}
                  colors={colors}
                />
              </Section>
            )}

            {/* ── Plot Filters ── */}
            {(isPlot || draft.propertyTypes.includes('Plot') || draft.propertyTypes.length === 0) && (
              <Section label="Plot Features" icon="grid" expanded={expanded.plot} onToggle={() => toggle('plot')}>
                <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Plot Category</Text>
                <PillRow options={['Any', ...PLOT_CATEGORIES]} selected={draft.plotCategory || 'Any'}
                  onSelect={(v) => set({ plotCategory: v === 'Any' ? '' : v })} colors={colors} />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Features</Text>
                <View style={fs.checkGrid}>
                  {PLOT_FEATURES.map((feat) => (
                    <CheckChip key={feat} label={feat} selected={draft.plotFeatures.includes(feat)}
                      onToggle={() => toggleArr('plotFeatures', feat)} colors={colors} />
                  ))}
                </View>
              </Section>
            )}

            {/* ── Commercial Filters ── */}
            {(isCommercial || draft.propertyTypes.some((t) => ['Commercial', 'Office', 'Building', 'Warehouse'].includes(t))) && (
              <Section label="Commercial" icon="briefcase" expanded={expanded.commercial} onToggle={() => toggle('commercial')}>
                <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Commercial Type</Text>
                <PillRow options={['Any', ...COMMERCIAL_TYPES]} selected={draft.commercialType || 'Any'}
                  onSelect={(v) => set({ commercialType: v === 'Any' ? '' : v })} colors={colors} />
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Features</Text>
                <View style={fs.checkGrid}>
                  {COMMERCIAL_FEATURES.map((feat) => (
                    <CheckChip key={feat} label={feat} selected={draft.commercialFeatures.includes(feat)}
                      onToggle={() => toggleArr('commercialFeatures', feat)} colors={colors} />
                  ))}
                </View>
              </Section>
            )}

            {/* ── Agriculture Filters ── */}
            {(isAgri || draft.propertyTypes.includes('Agriculture Land')) && (
              <Section label="Agriculture Land" icon="sun" expanded={expanded.agri} onToggle={() => toggle('agri')}>
                <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Water Source</Text>
                <View style={fs.checkGrid}>
                  {AGRI_WATER.map((w) => (
                    <CheckChip key={w} label={w} selected={draft.agriWater.includes(w)}
                      onToggle={() => toggleArr('agriWater', w)} colors={colors} accentColor="#1a6b3a" />
                  ))}
                </View>
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Electricity</Text>
                <View style={fs.checkGrid}>
                  {AGRI_ELECTRICITY.map((e) => (
                    <CheckChip key={e} label={e} selected={draft.agriElectricity.includes(e)}
                      onToggle={() => toggleArr('agriElectricity', e)} colors={colors} accentColor="#1a6b3a" />
                  ))}
                </View>
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Road Access</Text>
                <View style={fs.checkGrid}>
                  {AGRI_ROAD.map((r) => (
                    <CheckChip key={r} label={r} selected={draft.agriRoad.includes(r)}
                      onToggle={() => toggleArr('agriRoad', r)} colors={colors} accentColor="#1a6b3a" />
                  ))}
                </View>
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Land Features</Text>
                <View style={fs.checkGrid}>
                  {AGRI_LAND_FEATS.map((feat) => (
                    <CheckChip key={feat} label={feat} selected={draft.agriLandFeatures.includes(feat)}
                      onToggle={() => toggleArr('agriLandFeatures', feat)} colors={colors} accentColor="#1a6b3a" />
                  ))}
                </View>
                <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Crop Type</Text>
                <View style={fs.checkGrid}>
                  {AGRI_CROPS.map((c) => (
                    <CheckChip key={c} label={c} selected={draft.agriCrop.includes(c)}
                      onToggle={() => toggleArr('agriCrop', c)} colors={colors} accentColor="#1a6b3a" />
                  ))}
                </View>
              </Section>
            )}

            {/* ── Property Condition & Amenities ── */}
            <Section label="Condition & Amenities" icon="check-circle" expanded={expanded.condition} onToggle={() => toggle('condition')}>
              <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Condition</Text>
              <PillRow options={CONDITION_OPTS} selected={draft.condition} onSelect={(v) => set({ condition: v })} colors={colors} />
              <Text style={[fs.subLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Must-Have Amenities</Text>
              <View style={fs.checkGrid}>
                {AMENITIES_ALL.map((a) => (
                  <CheckChip key={a} label={a} selected={draft.amenities.includes(a)}
                    onToggle={() => toggleArr('amenities', a)} colors={colors} />
                ))}
              </View>
            </Section>

            {/* ── Seller & Verification ── */}
            <Section label="Seller & Verification" icon="shield" expanded={expanded.verified} onToggle={() => toggle('verified')}>
              <Text style={[fs.subLabel, { color: colors.mutedForeground }]}>Seller Type</Text>
              <PillRow options={SELLER_TYPES} selected={draft.sellerType || 'Any'}
                onSelect={(v) => set({ sellerType: v })} colors={colors} />
              <Pressable onPress={() => set({ verifiedOnly: !draft.verifiedOnly })}
                style={[fs.toggleRow, { backgroundColor: draft.verifiedOnly ? colors.goldGlass : colors.glassCard, borderColor: draft.verifiedOnly ? colors.goldGlassBorder : colors.glassBorder, marginTop: 12 }]}>
                <Feather name="shield" size={16} color={draft.verifiedOnly ? colors.goldForeground : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[fs.toggleLabel, { color: draft.verifiedOnly ? colors.goldForeground : colors.foreground }]}>Verified Listings Only</Text>
                  <Text style={[fs.toggleSub, { color: colors.mutedForeground }]}>Show only OG-verified properties</Text>
                </View>
                <Feather name={draft.verifiedOnly ? 'check-circle' : 'circle'} size={18} color={draft.verifiedOnly ? colors.goldForeground : colors.mutedForeground} />
              </Pressable>
            </Section>

            {/* ── Listing Age ── */}
            <Section label="Listing Date" icon="calendar" expanded={expanded.listingAge} onToggle={() => toggle('listingAge')}>
              <PillRow
                options={LISTING_AGE_OPTS.map((o) => o.label)}
                selected={LISTING_AGE_OPTS.find((o) => o.value === draft.listingAge)?.label ?? 'Anytime'}
                onSelect={(v) => { const opt = LISTING_AGE_OPTS.find((o) => o.label === v); if (opt) set({ listingAge: opt.value }); }}
                colors={colors}
              />
            </Section>

            {/* ── Sort ── */}
            <Section label="Sort By" icon="bar-chart-2" expanded={expanded.sort} onToggle={() => toggle('sort')}>
              <View style={fs.sortGrid}>
                {SORT_OPTIONS.map((s) => (
                  <Pressable key={s.value} onPress={() => set({ sortBy: s.value })}
                     style={[fs.sortChip, { backgroundColor: draft.sortBy === s.value ? colors.selectionBackground : colors.glassCard, borderColor: draft.sortBy === s.value ? colors.selectionBorder : colors.glassBorder, borderWidth: draft.sortBy === s.value ? 1.5 : 1 }]}>
                     <Feather name={s.icon as any} size={13} color={draft.sortBy === s.value ? colors.selectionForeground : colors.mutedForeground} />
                     <Text style={[fs.sortChipText, { color: draft.sortBy === s.value ? colors.selectionForeground : colors.foreground, fontWeight: draft.sortBy === s.value ? '600' : '400' }]}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>

          </ScrollView>

          {/* Sticky apply button */}
          <Pressable
            onPress={onApply}
            style={[fs.applyBtn, { backgroundColor: draftResultCount > 0 ? colors.action : colors.muted }]}
          >
            <Text style={[fs.applyBtnText, { color: draftResultCount > 0 ? colors.actionForeground : colors.mutedForeground }]}>
              {draftResultCount > 0 ? `Show ${draftResultCount} Properties` : '0 Properties Found'}
            </Text>
            <Feather name="arrow-right" size={16} color={draftResultCount > 0 ? colors.actionForeground : colors.mutedForeground} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Section collapsible ────────────────────────────────────────────────────────

function Section({ label, icon, expanded, onToggle, children }: {
  label: string; icon: string; expanded?: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const colors = { foreground: '#1c2024', mutedForeground: '#6c757d', border: '#e8e3d9' };
  return (
    <View style={fs.section}>
      <Pressable onPress={onToggle} style={fs.sectionHeader}>
        <Feather name={icon as any} size={15} color={colors.mutedForeground} />
        <Text style={[fs.sectionLabel, { color: colors.foreground }]}>{label}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.mutedForeground} />
      </Pressable>
      {expanded && <View style={fs.sectionBody}>{children}</View>}
    </View>
  );
}

// ── Reusable pill row ──────────────────────────────────────────────────────────

function PillRow({ options, selected, onSelect, colors }: { options: string[]; selected: string; onSelect: (v: string) => void; colors: any }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onSelect(o)}
           style={[fs.pill, { backgroundColor: selected === o ? colors.selectionBackground : colors.glassCard, borderColor: selected === o ? colors.selectionBorder : colors.glassBorder, borderWidth: selected === o ? 1.5 : 1 }]}>
           <Text style={[fs.pillText, { color: selected === o ? colors.selectionForeground : colors.foreground, fontWeight: selected === o ? '600' : '400' }]}>{o}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Check chip ─────────────────────────────────────────────────────────────────

function CheckChip({ label, selected, onToggle, colors, accentColor }: { label: string; selected: boolean; onToggle: () => void; colors: any; accentColor?: string }) {
  const accent = accentColor ?? colors.goldForeground;
  return (
    <Pressable onPress={onToggle} style={[fs.checkChip, {
      backgroundColor: selected ? (accentColor ? accentColor + '18' : colors.goldGlass) : colors.glassCard,
      borderColor: selected ? (accentColor ?? colors.goldGlassBorder) : colors.glassBorder,
    }]}>
      <Feather name={selected ? 'check-circle' : 'circle'} size={12} color={selected ? accent : colors.mutedForeground} />
      <Text style={[fs.checkChipText, { color: selected ? accent : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

// ── Range input ────────────────────────────────────────────────────────────────

function RangeInput({ label, value, placeholder, onChangeText, colors }: { label: string; value: string; placeholder: string; onChangeText: (v: string) => void; colors: any }) {
  return (
    <View style={[fs.rangeInput, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
      <Text style={[fs.rangeLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, ''))}
        placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
        keyboardType="numeric" style={[fs.rangeInputText, { color: colors.foreground }]} />
    </View>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// Projects list
// ══════════════════════════════════════════════════════════════════════════════

function ProjectsList({ staticProjects, devProjects, router, colors }: { staticProjects: any[]; devProjects: DeveloperProject[]; router: any; colors: any }) {
  const all = [...staticProjects, ...devProjects];
  if (all.length === 0) return (
    <NoResultsView colors={colors} message="No projects yet — check back soon." onAdjust={() => {}} onClear={() => {}} />
  );
  return (
    <>
      {staticProjects.map((proj) => (
        <AnimatedReveal key={proj.id} distance={14}>
          <Pressable onPress={() => router.push(`/project/${proj.id}` as any)} style={[pj.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={proj.image} style={pj.image} resizeMode="cover" />
            <View style={pj.body}>
              <View style={[pj.badge, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Text style={[pj.badgeText, { color: colors.accentForeground }]}>{proj.category}</Text>
              </View>
              <Text style={[pj.name, { color: colors.foreground }]} numberOfLines={2}>{proj.name}</Text>
              <Text style={[pj.dev, { color: colors.primary }]} numberOfLines={1}>{proj.developer}</Text>
              <View style={pj.meta}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[pj.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{proj.location}</Text>
              </View>
              <Text style={[pj.price, { color: colors.foreground }]}>{proj.priceRange}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.action} style={{ alignSelf: 'center' }} />
          </Pressable>
        </AnimatedReveal>
      ))}
      {devProjects.map((dp) => (
        <AnimatedReveal key={dp.id} distance={14}>
          <Pressable onPress={() => router.push(`/project/${dp.id}` as any)} style={[pj.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[pj.imagePlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="layers" size={20} color={colors.mutedForeground} />
            </View>
            <View style={pj.body}>
              <View style={[pj.badge, { backgroundColor: colors.accent, borderColor: colors.border }]}>
                <Text style={[pj.badgeText, { color: colors.accentForeground }]}>{dp.type || 'Development'}</Text>
              </View>
              <Text style={[pj.name, { color: colors.foreground }]} numberOfLines={2}>{dp.name}</Text>
              <Text style={[pj.dev, { color: colors.primary }]} numberOfLines={1}>Verified Developer</Text>
              <View style={pj.meta}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[pj.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>{dp.city || 'Okara'}</Text>
              </View>
              <Text style={[pj.price, { color: colors.foreground }]}>
                {dp.startingPrice > 0 ? `From PKR ${(dp.startingPrice / 100000).toFixed(0)} Lac` : 'Contact for price'}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.action} style={{ alignSelf: 'center' }} />
          </Pressable>
        </AnimatedReveal>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Recently Viewed row
// ══════════════════════════════════════════════════════════════════════════════

function RecentlyViewedRow({ items, colors, router }: { items: VisitRecord[]; colors: any; router: any }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={[rv.heading, { color: colors.foreground }]}>Recently Viewed</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} removeClippedSubviews contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {items.map((v) => (
          <Pressable key={`${v.propertyId}-${v.viewedAt}`} onPress={() => router.push(`/property/${v.propertyId}` as any)}
            style={[rv.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[rv.type, { color: colors.primary }]}>{v.propertyType}</Text>
            <Text style={[rv.title, { color: colors.foreground }]} numberOfLines={2}>{v.propertyTitle}</Text>
            <Text style={[rv.price, { color: colors.foreground }]}>PKR {formatPKR(v.propertyPrice)}</Text>
            <Text style={[rv.city, { color: colors.mutedForeground }]}>{v.propertyCity}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// No Results view
// ══════════════════════════════════════════════════════════════════════════════

function NoResultsView({ colors, message, onAdjust, onClear }: { colors: any; message?: string; onAdjust: () => void; onClear: () => void }) {
  return (
    <View style={[nr.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[nr.icon, { backgroundColor: colors.accent }]}>
        <Feather name="search" size={24} color={colors.accentForeground} />
      </View>
      <Text style={[nr.title, { color: colors.foreground }]}>No Properties Found</Text>
      <Text style={[nr.sub, { color: colors.mutedForeground }]}>
        {message ?? 'Try adjusting your filters or expanding your search area.'}
      </Text>
      <View style={nr.suggestions}>
        {[
          '• Increase your budget range',
          '• Select additional cities',
          '• Remove some specific filters',
          '• Try a broader property type',
        ].map((s) => (
          <Text key={s} style={[nr.suggestion, { color: colors.mutedForeground }]}>{s}</Text>
        ))}
      </View>
      <View style={nr.btnRow}>
        <Pressable onPress={onAdjust} style={[nr.btn, { backgroundColor: colors.action }]}>
          <Text style={[nr.btnText, { color: colors.actionForeground }]}>Adjust Filters</Text>
        </Pressable>
        <Pressable onPress={onClear} style={[nr.btn, { backgroundColor: colors.glassCard, borderWidth: 1, borderColor: colors.glassBorder }]}>
          <Text style={[nr.btnText, { color: colors.foreground }]}>Clear All</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Styles
// ══════════════════════════════════════════════════════════════════════════════

const ex = StyleSheet.create({
  screen:          { flex: 1 },
  stickyHeader:    { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingBottom: 8 },
  // Purpose toggle
  purposeRow:      { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden', alignSelf: 'stretch', padding: 3 },
  purposeTab:      { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 13 },
  purposeTabText:  { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.3 },
  // Search row
  searchRow:       { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBar:       { flex: 1, height: 46, borderRadius: 15, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  searchIcon:      { paddingHorizontal: 12, zIndex: 1 },
  searchInput:     { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, zIndex: 1, paddingVertical: 0 },
  filterBtn:       { width: 46, height: 46, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  filterDot:       { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterDotText:   { fontFamily: 'Inter_700Bold', fontSize: 8 },
  viewToggle:      { flexDirection: 'row', borderRadius: 15, borderWidth: 1, overflow: 'hidden', alignItems: 'center' },
  viewToggleBtn:   { width: 34, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  // Recent searches
  recentDropdown:  { borderRadius: 14, borderWidth: 1, marginBottom: 6, overflow: 'hidden' },
  recentHeader:    { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  recentLabel:     { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  recentClear:     { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  recentItem:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  recentItemText:  { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  geoStatus:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  geoStatusText:   { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 15 },
  // Quick filters
  quickFilters:    { gap: 8, paddingVertical: 8, paddingRight: 4 },
  quickChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  quickChipText:   { fontSize: 10 },
  quickChipDot:    { width: 5, height: 5, borderRadius: 2.5, marginLeft: 1 },
  // Active filter chips
  chipRow:         { gap: 8, paddingVertical: 4, paddingBottom: 10 },
  chip:            { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  chipText:        { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  clearAll:        { borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  clearAllText:    { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  // Result bar
  resultBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, minHeight: 34 },
  resultCount:     { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: 0.1 },
  resultBarRight:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  saveBtnText:     { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  sortBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText:     { fontFamily: 'Inter_400Regular', fontSize: 11 },
  // Save modal
  modalBackdrop:   { flex: 1, backgroundColor: '#102a4366', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  saveModal:       { width: '100%', borderRadius: 20, borderWidth: 1, padding: 24 },
  saveModalTitle:  { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 6 },
  saveModalSub:    { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  saveModalInput:  { height: 48, borderRadius: 13, borderWidth: 1, overflow: 'hidden', marginBottom: 18, flexDirection: 'row', alignItems: 'center' },
  saveModalInputText: { flex: 1, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', fontSize: 13, zIndex: 1 },
  saveModalBtns:   { flexDirection: 'row', gap: 10 },
  saveModalCancel: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveModalCancelText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  saveModalConfirm: { flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  saveModalConfirmText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});

const fs = StyleSheet.create({
  root:          { flex: 1, justifyContent: 'flex-end', backgroundColor: '#102a4366' },
  backdrop:      { ...StyleSheet.absoluteFill },
  sheet:         { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24 },
  handle:        { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#c8a45a', opacity: 0.7, marginBottom: 18 },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  eyebrow:       { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.6, marginBottom: 4 },
  title:         { fontFamily: 'Inter_700Bold', fontSize: 22 },
  reset:         { fontFamily: 'Inter_600SemiBold', fontSize: 12, paddingTop: 2 },
  // Section
  section:       { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e8e3d9' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  sectionLabel:  { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  sectionBody:   { paddingBottom: 18 },
  subLabel:      { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.5, marginBottom: 8 },
  // Type grid
  typeGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeChipText:  { fontFamily: 'Inter_500Medium', fontSize: 11 },
  // City grid
  cityGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityChip:      { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  cityChipText:  { fontFamily: 'Inter_500Medium', fontSize: 11 },
  // Preset chips
  presetChip:    { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  presetChipText:{ fontFamily: 'Inter_500Medium', fontSize: 10 },
  // Range
  rangeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeInput:    { flex: 1, height: 44, borderRadius: 13, borderWidth: 1, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  rangeLabel:    { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  rangeInputText:{ flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, zIndex: 1 },
  dash:          { fontFamily: 'Inter_500Medium', fontSize: 12 },
  // Pills
  pill:          { borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  pillText:      { fontFamily: 'Inter_500Medium', fontSize: 11 },
  // Check chips
  checkGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkChip:     { borderRadius: 18, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  checkChipText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  // Toggle
  toggleRow:     { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel:   { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  toggleSub:     { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  // Sort
  sortGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip:      { width: '48%', borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sortChipText:  { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 10 },
  // Apply button
  applyBtn:      { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  applyBtnText:  { fontFamily: 'Inter_700Bold', fontSize: 13 },
});

const map = StyleSheet.create({
  container:       { height: 420, borderRadius: 18, overflow: 'hidden', marginBottom: 20, position: 'relative' },
  pin:             { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  pinText:         { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#ffffff' },
  preview:         { position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewType:     { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 2 },
  previewPrice:    { fontFamily: 'Inter_700Bold', fontSize: 16 },
  previewSub:      { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },
  webFallback:     { height: 180, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  webFallbackText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' },
  webFallbackSub:  { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 6 },
});

const pj = StyleSheet.create({
  card:            { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  image:           { width: 100, height: 90 },
  imagePlaceholder:{ width: 100, height: 90, alignItems: 'center', justifyContent: 'center' },
  body:            { flex: 1, padding: 12, gap: 3 },
  badge:           { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
  badgeText:       { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.4 },
  name:            { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 17 },
  dev:             { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  meta:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText:        { fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1 },
  price:           { fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 4 },
});

const rv = StyleSheet.create({
  heading: { fontFamily: 'Inter_700Bold', fontSize: 15, marginBottom: 12 },
  card:    { width: 160, borderRadius: 14, borderWidth: 1, padding: 12, gap: 3 },
  type:    { fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1, marginBottom: 2 },
  title:   { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 },
  price:   { fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 4 },
  city:    { fontFamily: 'Inter_400Regular', fontSize: 10 },
});

const nr = StyleSheet.create({
  wrap:       { borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 20 },
  icon:       { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title:      { fontFamily: 'Inter_700Bold', fontSize: 17, marginBottom: 8 },
  sub:        { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  suggestions:{ alignSelf: 'flex-start', width: '100%', marginBottom: 22 },
  suggestion: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 22 },
  btnRow:     { flexDirection: 'row', gap: 10 },
  btn:        { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnText:    { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
