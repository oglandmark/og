/**
 * OG Landmark — Premium Browse / Discovery Module
 * Structure: EXPLORE THE MARKET → Find Your Property
 *   8 category chips | 5 tabs (Popular, Location, Size, Budget, Features)
 *   Cards: gold circle icon + bold label + "Curated search" subtitle
 *   Live property counts from actual data. Navigate to explore with all filters.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, View,
} from 'react-native';
import { LocalizedText as Text } from '@/components/LocalizedText';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { properties } from '@/lib/properties';

// ── Types ──────────────────────────────────────────────────────────────────────
type Colors = Record<string, any>;
type NavParams = Record<string, string>;

interface Props {
  transaction: 'Buy' | 'Rent';
  selectedLocation: string;
  colors: Colors;
  router: any;
  content?: { showCategories?: boolean; eyebrow?: string; title?: string };
  categoryLabels?: Record<string, string>;
}

// ── Categories ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'Houses',      label: 'Houses',            icon: 'home'      as const, propertyType: 'House'            },
  { key: 'Apartments',  label: 'Apartments',        icon: 'layers'    as const, propertyType: 'Apartment'        },
  { key: 'Plots',       label: 'Plots & Land',      icon: 'map-pin'   as const, propertyType: 'Plot'             },
  { key: 'Commercial',  label: 'Commercial',        icon: 'briefcase' as const, propertyType: 'Commercial'       },
  { key: 'Agriculture', label: 'Agriculture Land',  icon: 'sun'       as const, propertyType: 'Agriculture Land' },
  { key: 'Farmhouses',  label: 'Farmhouses',        icon: 'home'      as const, propertyType: 'Farmhouse'        },
  { key: 'Industrial',  label: 'Industrial',        icon: 'tool'      as const, propertyType: 'Industrial'       },
  { key: 'Projects',    label: 'Projects',          icon: 'grid'      as const, propertyType: 'Project'          },
] as const;
type CategoryKey = typeof CATEGORIES[number]['key'];

const TABS = ['Popular', 'Location', 'Size', 'Budget', 'Features'] as const;
type TabKey = typeof TABS[number];

// ── Card data ──────────────────────────────────────────────────────────────────
type CardItem = { label: string; params: NavParams };

type CatalogEntry = {
  Popular:  CardItem[];
  Location: CardItem[];
  Size:     CardItem[];
  Budget:   CardItem[];
  Features: CardItem[];
};

const CATALOG: Record<CategoryKey, CatalogEntry> = {
  Houses: {
    Popular: [
      { label: 'House',         params: { propertyType: 'House'         } },
      { label: 'Upper Portion', params: { propertyType: 'Upper Portion' } },
      { label: 'Lower Portion', params: { propertyType: 'Lower Portion' } },
      { label: 'Room',          params: { propertyType: 'Room'          } },
      { label: 'Villa',         params: { propertyType: 'Villa'         } },
      { label: 'Low Price',     params: { propertyType: 'House', maxPrice: '3000000' } },
    ],
    Location: [
      { label: 'Officers Colony',   params: { propertyType: 'House', city: 'Okara'              } },
      { label: 'Renala Khurd',      params: { propertyType: 'House', city: 'Renala Khurd'       } },
      { label: 'Depalpur',          params: { propertyType: 'House', city: 'Depalpur'           } },
      { label: 'Haveli Lakha',      params: { propertyType: 'House', city: 'Haveli Lakha'       } },
      { label: 'Okara City',        params: { propertyType: 'House', city: 'Okara'              } },
      { label: 'Hujra Shah Muqeem', params: { propertyType: 'House', city: 'Hujra Shah Muqeem' } },
    ],
    Size: [
      { label: '3 Marla Houses',  params: { propertyType: 'House', minArea: '2',  maxArea: '4'  } },
      { label: '5 Marla Houses',  params: { propertyType: 'House', minArea: '4',  maxArea: '6'  } },
      { label: '7 Marla Houses',  params: { propertyType: 'House', minArea: '6',  maxArea: '8'  } },
      { label: '10 Marla Houses', params: { propertyType: 'House', minArea: '9',  maxArea: '11' } },
      { label: '1 Kanal Houses',  params: { propertyType: 'House', minArea: '19', maxArea: '21' } },
      { label: '2 Kanal Houses',  params: { propertyType: 'House', minArea: '39', maxArea: '41' } },
    ],
    Budget: [
      { label: 'Under 30 Lac',  params: { propertyType: 'House', maxPrice: '3000000'                         } },
      { label: '30–60 Lac',     params: { propertyType: 'House', minPrice: '3000000',  maxPrice: '6000000'   } },
      { label: '60 Lac–1 Cr',   params: { propertyType: 'House', minPrice: '6000000',  maxPrice: '10000000'  } },
      { label: '1–2 Crore',     params: { propertyType: 'House', minPrice: '10000000', maxPrice: '20000000'  } },
      { label: '2–5 Crore',     params: { propertyType: 'House', minPrice: '20000000', maxPrice: '50000000'  } },
      { label: '5 Cr+',         params: { propertyType: 'House', minPrice: '50000000'                        } },
    ],
    Features: [
      { label: 'Verified Only',  params: { propertyType: 'House', verifiedOnly: '1' } },
      { label: 'Corner House',   params: { propertyType: 'House'                   } },
      { label: 'Park Facing',    params: { propertyType: 'House'                   } },
      { label: 'With Garden',    params: { propertyType: 'House'                   } },
      { label: 'Furnished',      params: { propertyType: 'House', furnishing: 'Furnished' } },
      { label: 'Near School',    params: { propertyType: 'House'                   } },
    ],
  },
  Apartments: {
    Popular: [
      { label: 'Flat',      params: { propertyType: 'Flat'      } },
      { label: 'Studio',    params: { propertyType: 'Studio'    } },
      { label: 'Penthouse', params: { propertyType: 'Penthouse' } },
    ],
    Location: [
      { label: 'Okara City',        params: { propertyType: 'Apartment', city: 'Okara'              } },
      { label: 'Renala Khurd',      params: { propertyType: 'Apartment', city: 'Renala Khurd'       } },
      { label: 'Depalpur',          params: { propertyType: 'Apartment', city: 'Depalpur'           } },
      { label: 'Haveli Lakha',      params: { propertyType: 'Apartment', city: 'Haveli Lakha'       } },
      { label: 'Basirpur',          params: { propertyType: 'Apartment', city: 'Basirpur'           } },
      { label: 'Hujra Shah Muqeem', params: { propertyType: 'Apartment', city: 'Hujra Shah Muqeem' } },
    ],
    Size: [
      { label: 'Studio',     params: { propertyType: 'Apartment', maxArea: '5'                  } },
      { label: '5 Marla',    params: { propertyType: 'Apartment', minArea: '4',  maxArea: '6'   } },
      { label: '10 Marla',   params: { propertyType: 'Apartment', minArea: '9',  maxArea: '11'  } },
      { label: '1 Kanal',    params: { propertyType: 'Apartment', minArea: '19', maxArea: '21'  } },
      { label: 'Small Flat', params: { propertyType: 'Apartment', maxArea: '8'                  } },
      { label: 'Large Flat', params: { propertyType: 'Apartment', minArea: '15'                 } },
    ],
    Budget: [
      { label: 'Under 20 Lac', params: { propertyType: 'Apartment', maxPrice: '2000000'                        } },
      { label: '20–50 Lac',    params: { propertyType: 'Apartment', minPrice: '2000000',  maxPrice: '5000000'  } },
      { label: '50 Lac–1 Cr',  params: { propertyType: 'Apartment', minPrice: '5000000',  maxPrice: '10000000' } },
      { label: '1–2 Crore',    params: { propertyType: 'Apartment', minPrice: '10000000', maxPrice: '20000000' } },
      { label: '2 Cr+',        params: { propertyType: 'Apartment', minPrice: '20000000'                       } },
      { label: 'Affordable',   params: { propertyType: 'Apartment', maxPrice: '3000000'                        } },
    ],
    Features: [
      { label: 'Verified Only', params: { propertyType: 'Apartment', verifiedOnly: '1'              } },
      { label: 'Furnished',     params: { propertyType: 'Apartment', furnishing: 'Furnished'        } },
      { label: 'With Lift',     params: { propertyType: 'Apartment'                                 } },
      { label: 'Penthouse',     params: { propertyType: 'Apartment'                                 } },
      { label: 'Ground Floor',  params: { propertyType: 'Apartment'                                 } },
      { label: 'Corner Unit',   params: { propertyType: 'Apartment'                                 } },
    ],
  },
  Plots: {
    Popular: [
      { label: 'Residential Plot',              params: { propertyType: 'Residential Plot'              } },
      { label: 'Commercial Plot',               params: { propertyType: 'Commercial Plot'               } },
      { label: 'Industrial Plot',               params: { propertyType: 'Industrial Plot'               } },
      { label: 'Farm Land / Agricultural Land', params: { propertyType: 'Farm Land / Agricultural Land' } },
    ],
    Location: [
      { label: 'Okara City',        params: { propertyType: 'Plot', city: 'Okara'              } },
      { label: 'Depalpur',          params: { propertyType: 'Plot', city: 'Depalpur'           } },
      { label: 'Renala Khurd',      params: { propertyType: 'Plot', city: 'Renala Khurd'       } },
      { label: 'Haveli Lakha',      params: { propertyType: 'Plot', city: 'Haveli Lakha'       } },
      { label: 'Basirpur',          params: { propertyType: 'Plot', city: 'Basirpur'           } },
      { label: 'Hujra Shah Muqeem', params: { propertyType: 'Plot', city: 'Hujra Shah Muqeem' } },
    ],
    Size: [
      { label: '3 Marla',  params: { propertyType: 'Plot', minArea: '2',  maxArea: '4'  } },
      { label: '5 Marla',  params: { propertyType: 'Plot', minArea: '4',  maxArea: '6'  } },
      { label: '10 Marla', params: { propertyType: 'Plot', minArea: '9',  maxArea: '11' } },
      { label: '1 Kanal',  params: { propertyType: 'Plot', minArea: '19', maxArea: '21' } },
      { label: '2 Kanal',  params: { propertyType: 'Plot', minArea: '39', maxArea: '41' } },
      { label: '4 Kanal',  params: { propertyType: 'Plot', minArea: '79', maxArea: '81' } },
    ],
    Budget: [
      { label: 'Under 10 Lac', params: { propertyType: 'Plot', maxPrice: '1000000'                       } },
      { label: '10–30 Lac',    params: { propertyType: 'Plot', minPrice: '1000000', maxPrice: '3000000'  } },
      { label: '30–60 Lac',    params: { propertyType: 'Plot', minPrice: '3000000', maxPrice: '6000000'  } },
      { label: '60 Lac–1 Cr',  params: { propertyType: 'Plot', minPrice: '6000000', maxPrice: '10000000' } },
      { label: '1 Cr+',        params: { propertyType: 'Plot', minPrice: '10000000'                      } },
      { label: 'Affordable',   params: { propertyType: 'Plot', maxPrice: '2000000'                       } },
    ],
    Features: [
      { label: 'Verified Only',    params: { propertyType: 'Plot', verifiedOnly: '1' } },
      { label: 'Corner Plot',      params: { propertyType: 'Plot'                    } },
      { label: 'Park Facing',      params: { propertyType: 'Plot'                    } },
      { label: 'Possession Ready', params: { propertyType: 'Plot'                    } },
      { label: 'Society Plot',     params: { propertyType: 'Plot'                    } },
      { label: 'Road Facing',      params: { propertyType: 'Plot'                    } },
    ],
  },
  Commercial: {
    Popular: [
      { label: 'Shop',      params: { propertyType: 'Shop'      } },
      { label: 'Office',    params: { propertyType: 'Office'    } },
      { label: 'Plaza',     params: { propertyType: 'Plaza'     } },
      { label: 'Building',  params: { propertyType: 'Building'  } },
      { label: 'Showroom',  params: { propertyType: 'Showroom'  } },
      { label: 'Warehouse', params: { propertyType: 'Warehouse' } },
    ],
    Location: [
      { label: 'Okara GT Road',   params: { propertyType: 'Commercial', city: 'Okara'              } },
      { label: 'Depalpur Bazaar', params: { propertyType: 'Commercial', city: 'Depalpur'           } },
      { label: 'Renala Market',   params: { propertyType: 'Commercial', city: 'Renala Khurd'       } },
      { label: 'Haveli Lakha',    params: { propertyType: 'Commercial', city: 'Haveli Lakha'       } },
      { label: 'Basirpur',        params: { propertyType: 'Commercial', city: 'Basirpur'           } },
      { label: 'Hujra Market',    params: { propertyType: 'Commercial', city: 'Hujra Shah Muqeem' } },
    ],
    Size: [
      { label: '1 Marla Shop',      params: { propertyType: 'Shop',       minArea: '1',  maxArea: '1'  } },
      { label: '2 Marla Shop',      params: { propertyType: 'Shop',       minArea: '2',  maxArea: '2'  } },
      { label: '5 Marla Office',    params: { propertyType: 'Office',     minArea: '4',  maxArea: '6'  } },
      { label: '1 Kanal Warehouse', params: { propertyType: 'Warehouse',  minArea: '19', maxArea: '21' } },
      { label: 'Large Commercial',  params: { propertyType: 'Commercial', minArea: '40'               } },
      { label: 'Small Shop',        params: { propertyType: 'Shop',       maxArea: '3'                } },
    ],
    Budget: [
      { label: 'Under 20 Lac', params: { propertyType: 'Commercial', maxPrice: '2000000'                         } },
      { label: '20–50 Lac',    params: { propertyType: 'Commercial', minPrice: '2000000',  maxPrice: '5000000'   } },
      { label: '50 Lac–1 Cr',  params: { propertyType: 'Commercial', minPrice: '5000000',  maxPrice: '10000000'  } },
      { label: '1–3 Crore',    params: { propertyType: 'Commercial', minPrice: '10000000', maxPrice: '30000000'  } },
      { label: '3 Cr+',        params: { propertyType: 'Commercial', minPrice: '30000000'                        } },
      { label: 'Affordable',   params: { propertyType: 'Commercial', maxPrice: '3000000'                         } },
    ],
    Features: [
      { label: 'Verified Only',    params: { propertyType: 'Commercial', verifiedOnly: '1' } },
      { label: 'Corner Shop',      params: { propertyType: 'Shop'                          } },
      { label: 'Main Road',        params: { propertyType: 'Commercial'                   } },
      { label: 'Parking',          params: { propertyType: 'Commercial'                   } },
      { label: 'Near Market',      params: { propertyType: 'Commercial'                   } },
      { label: 'Possession Ready', params: { propertyType: 'Commercial'                   } },
    ],
  },
  Agriculture: {
    Popular: [
      { label: 'Agricultural Land',       params: { propertyType: 'Agricultural Land'       } },
      { label: 'Farm / Cultivation Land', params: { propertyType: 'Farm / Cultivation Land' } },
      { label: 'Orchard',                 params: { propertyType: 'Orchard'                 } },
      { label: 'Ranch',                   params: { propertyType: 'Ranch'                   } },
      { label: 'Agriculture + Farmhouse', params: { propertyType: 'Agriculture + Farmhouse' } },
    ],
    Location: [
      { label: 'Depalpur Tehsil',   params: { propertyType: 'Agriculture Land', city: 'Depalpur'           } },
      { label: 'Renala Khurd',      params: { propertyType: 'Agriculture Land', city: 'Renala Khurd'       } },
      { label: 'Hujra Shah Muqeem', params: { propertyType: 'Agriculture Land', city: 'Hujra Shah Muqeem' } },
      { label: 'Okara Tehsil',      params: { propertyType: 'Agriculture Land', city: 'Okara'              } },
      { label: 'Haveli Lakha',      params: { propertyType: 'Agriculture Land', city: 'Haveli Lakha'       } },
      { label: 'Basirpur',          params: { propertyType: 'Agriculture Land', city: 'Basirpur'           } },
    ],
    Size: [
      { label: '5 Acre Farms',   params: { propertyType: 'Agriculture Land', minArea: '36',  maxArea: '44'  } },
      { label: '10 Acre Farms',  params: { propertyType: 'Agriculture Land', minArea: '76',  maxArea: '84'  } },
      { label: '15 Acre Farms',  params: { propertyType: 'Agriculture Land', minArea: '116', maxArea: '124' } },
      { label: '25 Acre Farms',  params: { propertyType: 'Agriculture Land', minArea: '196', maxArea: '204' } },
      { label: '50+ Acre Farms', params: { propertyType: 'Agriculture Land', minArea: '400'                } },
      { label: 'Small 1–4 Acre', params: { propertyType: 'Agriculture Land', maxArea: '32'                 } },
    ],
    Budget: [
      { label: 'Under 50 Lac', params: { propertyType: 'Agriculture Land', maxPrice: '5000000'                        } },
      { label: '50 Lac–1 Cr',  params: { propertyType: 'Agriculture Land', minPrice: '5000000',  maxPrice: '10000000' } },
      { label: '1–3 Crore',    params: { propertyType: 'Agriculture Land', minPrice: '10000000', maxPrice: '30000000' } },
      { label: '3–5 Crore',    params: { propertyType: 'Agriculture Land', minPrice: '30000000', maxPrice: '50000000' } },
      { label: '5 Cr+',        params: { propertyType: 'Agriculture Land', minPrice: '50000000'                       } },
      { label: 'Affordable',   params: { propertyType: 'Agriculture Land', maxPrice: '3000000'                        } },
    ],
    Features: [
      { label: 'Nehri Water',   params: { propertyType: 'Agriculture Land', agriWater: 'Nehri Water' } },
      { label: 'Tube Well',     params: { propertyType: 'Agriculture Land', agriWater: 'Tube Well'   } },
      { label: 'Road Access',   params: { propertyType: 'Agriculture Land', agriRoad: 'Road Access'  } },
      { label: 'Near Highway',  params: { propertyType: 'Agriculture Land'                           } },
      { label: 'Loam Soil',     params: { propertyType: 'Agriculture Land'                           } },
      { label: 'Verified Only', params: { propertyType: 'Agriculture Land', verifiedOnly: '1'        } },
    ],
  },
  Farmhouses: {
    Popular: [
      { label: 'Farmhouse',                     params: { propertyType: 'Farmhouse'                     } },
      { label: 'Agro Farm',                     params: { propertyType: 'Agro Farm'                     } },
      { label: 'Farmhouse + Agricultural Land', params: { propertyType: 'Farmhouse + Agricultural Land' } },
    ],
    Location: [
      { label: 'Okara City',        params: { propertyType: 'Farmhouse', city: 'Okara'              } },
      { label: 'Depalpur',          params: { propertyType: 'Farmhouse', city: 'Depalpur'           } },
      { label: 'Renala Khurd',      params: { propertyType: 'Farmhouse', city: 'Renala Khurd'       } },
      { label: 'Haveli Lakha',      params: { propertyType: 'Farmhouse', city: 'Haveli Lakha'       } },
      { label: 'Hujra Shah Muqeem', params: { propertyType: 'Farmhouse', city: 'Hujra Shah Muqeem' } },
      { label: 'Basirpur',          params: { propertyType: 'Farmhouse', city: 'Basirpur'           } },
    ],
    Size: [
      { label: '1 Kanal',  params: { propertyType: 'Farmhouse', minArea: '19', maxArea: '21' } },
      { label: '2 Kanal',  params: { propertyType: 'Farmhouse', minArea: '39', maxArea: '41' } },
      { label: '4 Kanal',  params: { propertyType: 'Farmhouse', minArea: '79', maxArea: '81' } },
      { label: '1 Acre',   params: { propertyType: 'Farmhouse', minArea: '30', maxArea: '34' } },
      { label: '2 Acre',   params: { propertyType: 'Farmhouse', minArea: '62', maxArea: '68' } },
      { label: '5+ Kanal', params: { propertyType: 'Farmhouse', minArea: '99'                } },
    ],
    Budget: [
      { label: 'Under 1 Cr', params: { propertyType: 'Farmhouse', maxPrice: '10000000'                        } },
      { label: '1–2 Crore',  params: { propertyType: 'Farmhouse', minPrice: '10000000', maxPrice: '20000000'  } },
      { label: '2–5 Crore',  params: { propertyType: 'Farmhouse', minPrice: '20000000', maxPrice: '50000000'  } },
      { label: '5 Cr+',      params: { propertyType: 'Farmhouse', minPrice: '50000000'                        } },
      { label: 'Affordable',  params: { propertyType: 'Farmhouse', maxPrice: '8000000'                        } },
      { label: 'Luxury',      params: { propertyType: 'Farmhouse', minPrice: '30000000'                       } },
    ],
    Features: [
      { label: 'Verified Only', params: { propertyType: 'Farmhouse', verifiedOnly: '1' } },
      { label: 'With Pool',     params: { propertyType: 'Farmhouse'                   } },
      { label: 'With Garden',   params: { propertyType: 'Farmhouse'                   } },
      { label: 'Guest House',   params: { propertyType: 'Farmhouse'                   } },
      { label: 'Furnished',     params: { propertyType: 'Farmhouse', furnishing: 'Furnished' } },
      { label: 'Road Facing',   params: { propertyType: 'Farmhouse'                   } },
    ],
  },
  Industrial: {
    Popular: [
      { label: 'Factory',             params: { propertyType: 'Factory'             } },
      { label: 'Industrial Building', params: { propertyType: 'Industrial Building' } },
      { label: 'Industrial Land',     params: { propertyType: 'Industrial Land'     } },
      { label: 'Warehouse',           params: { propertyType: 'Warehouse'           } },
      { label: 'Cold Storage',        params: { propertyType: 'Cold Storage'        } },
    ],
    Location: [
      { label: 'Okara Industrial Area', params: { propertyType: 'Industrial', city: 'Okara'              } },
      { label: 'Depalpur',              params: { propertyType: 'Industrial', city: 'Depalpur'           } },
      { label: 'Renala Khurd',          params: { propertyType: 'Industrial', city: 'Renala Khurd'       } },
      { label: 'Haveli Lakha',          params: { propertyType: 'Industrial', city: 'Haveli Lakha'       } },
      { label: 'Basirpur',              params: { propertyType: 'Industrial', city: 'Basirpur'           } },
      { label: 'Hujra Shah Muqeem',     params: { propertyType: 'Industrial', city: 'Hujra Shah Muqeem' } },
    ],
    Size: [
      { label: 'Small Industrial Unit',  params: { propertyType: 'Industrial', maxArea: '10'                } },
      { label: 'Medium Industrial Unit', params: { propertyType: 'Industrial', minArea: '10', maxArea: '50' } },
      { label: 'Large Industrial Unit',  params: { propertyType: 'Industrial', minArea: '50'                } },
    ],
    Budget: [
      { label: 'Under 1 Crore', params: { propertyType: 'Industrial', maxPrice: '10000000'                         } },
      { label: '1–5 Crore',     params: { propertyType: 'Industrial', minPrice: '10000000', maxPrice: '50000000'   } },
      { label: '5 Cr+',         params: { propertyType: 'Industrial', minPrice: '50000000'                         } },
    ],
    Features: [
      { label: 'Verified Only',        params: { propertyType: 'Industrial', verifiedOnly: '1' } },
      { label: 'Main Road Access',     params: { propertyType: 'Industrial'                    } },
      { label: 'Electricity Available',params: { propertyType: 'Industrial'                    } },
    ],
  },
  Projects: {
    Popular: [
      { label: 'Housing Projects',    params: { propertyType: 'Project', projectType: 'Housing Projects'    } },
      { label: 'Apartment Projects',  params: { propertyType: 'Project', projectType: 'Apartment Projects'  } },
      { label: 'Plot Projects',       params: { propertyType: 'Project', projectType: 'Plot Projects'       } },
      { label: 'Commercial Projects', params: { propertyType: 'Project', projectType: 'Commercial Projects' } },
      { label: 'Farmhouse Projects',  params: { propertyType: 'Project', projectType: 'Farmhouse Projects'  } },
    ],
    Location: [
      { label: 'Projects in Okara',        params: { propertyType: 'Project', city: 'Okara'        } },
      { label: 'Projects in Depalpur',     params: { propertyType: 'Project', city: 'Depalpur'     } },
      { label: 'Projects in Renala Khurd', params: { propertyType: 'Project', city: 'Renala Khurd' } },
      { label: 'Projects in Basirpur',     params: { propertyType: 'Project', city: 'Basirpur'     } },
    ],
    Size: [
      { label: 'Small Projects',  params: { propertyType: 'Project', projectSize: 'small'  } },
      { label: 'Medium Projects', params: { propertyType: 'Project', projectSize: 'medium' } },
      { label: 'Large Projects',  params: { propertyType: 'Project', projectSize: 'large'  } },
    ],
    Budget: [
      { label: 'Affordable Projects', params: { propertyType: 'Project', maxPrice: '5000000'   } },
      { label: 'Premium Projects',    params: { propertyType: 'Project', minPrice: '10000000'  } },
      { label: 'Luxury Projects',     params: { propertyType: 'Project', minPrice: '50000000'  } },
    ],
    Features: [
      { label: 'Verified Projects', params: { propertyType: 'Project', verifiedOnly: '1' } },
      { label: 'Possession Ready',  params: { propertyType: 'Project'                    } },
      { label: 'Installment Plans', params: { propertyType: 'Project'                    } },
    ],
  },
};

const OKARA_CITIES = ['Okara', 'Depalpur', 'Renala Khurd', 'Haveli Lakha', 'Basirpur', 'Hujra Shah Muqeem'];

// ── Helper: count matching properties ─────────────────────────────────────────
function countFor(
  params: NavParams,
  catPropertyType: string,
  transaction: 'Buy' | 'Rent',
  location: string,
): number {
  const status = transaction === 'Rent' ? 'For Rent' : 'For Sale';
  const pt = (params.propertyType ?? catPropertyType).toLowerCase();

  return properties.filter((p) => {
    if (p.status !== status) return false;

    // Broad type matching (mirrors explore.tsx logic)
    const ptype = (p.type ?? '').toLowerCase();
    let typeMatch = false;
    if (pt === 'house')             typeMatch = ['house','villa','apartment','farm house','duplex','townhouse','studio','farmhouse'].includes(ptype);
    else if (pt === 'apartment')    typeMatch = ['apartment','flat','studio','penthouse'].includes(ptype);
    else if (pt === 'plot')         typeMatch = /plot/i.test(p.type ?? '');
    else if (pt === 'commercial')   typeMatch = ['commercial','shop','office','plaza','building','warehouse','showroom','hotel'].includes(ptype) || /commercial|shop|office/i.test(p.type ?? '');
    else if (pt === 'agriculture land') typeMatch = ['agriculture land','farmhouse','farm','farm house'].includes(ptype) || /agri|farm/i.test(p.type ?? '');
    else if (pt === 'farmhouse')    typeMatch = ptype.includes('farmhouse') || ptype === 'agro farm';
    else if (pt === 'industrial')   typeMatch = /industrial|factory|warehouse/i.test(p.type ?? '');
    else                            typeMatch = (p.type ?? '') === (params.propertyType ?? catPropertyType);
    if (!typeMatch) return false;

    if (params.city && p.city !== params.city) return false;
    if (location && location !== 'Okara District' && p.city !== location) return false;
    if (params.minPrice && p.price < Number(params.minPrice)) return false;
    if (params.maxPrice && p.price > Number(params.maxPrice)) return false;
    if (params.minArea) {
      const marla = p.areaUnit === 'Kanal' ? p.area * 20 : p.areaUnit === 'Acre' ? p.area * 160 : p.area;
      if (marla < Number(params.minArea)) return false;
    }
    if (params.maxArea) {
      const marla = p.areaUnit === 'Kanal' ? p.area * 20 : p.areaUnit === 'Acre' ? p.area * 160 : p.area;
      if (marla > Number(params.maxArea)) return false;
    }
    return true;
  }).length;
}

// ── Card sub-components ────────────────────────────────────────────────────────

/** Card: bold label + "Curated search" subtitle — no icon */
function DiscCard({
  label, colors, onPress,
}: { label: string; icon?: string; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [dc.pressable, { opacity: pressed ? 0.82 : 1 }]}
    >
      <GlassCard
        intensity={30}
        style={[dc.card, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}
        contentStyle={dc.content}
      >
        <View style={dc.body}>
          <Text style={[dc.label, { color: colors.foreground }]} numberOfLines={2}>{label}</Text>
          <Text style={[dc.sub, { color: colors.mutedForeground }]}>Curated search</Text>
        </View>
        <Feather name="chevron-right" size={15} color={colors.action} />
      </GlassCard>
    </Pressable>
  );
}

/** Location card: gold map-pin + city name + count */
function LocationCard({
  city, count, colors, onPress,
}: { city: string; count: number; colors: Colors; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [lc.pressable, { opacity: pressed ? 0.82 : 1 }]}
    >
      <GlassCard
        intensity={28}
        style={[lc.card, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}
        contentStyle={lc.content}
      >
        <View style={lc.body}>
          <Text style={[lc.city, { color: colors.foreground }]}>{city}</Text>
          {count > 0 && (
            <Text style={[lc.count, { color: colors.primary }]}>{count} properties</Text>
          )}
        </View>
        <Feather name="chevron-right" size={13} color={colors.primary} />
      </GlassCard>
    </Pressable>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function BrowseDiscoveryModule({ transaction, selectedLocation, colors, router, content, categoryLabels }: Props) {
  const [activeCat, setActiveCat] = useState<CategoryKey>('Houses');
  const [activeTab, setActiveTab] = useState<TabKey>('Popular');
  const [pagerWidth, setPagerWidth] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const catDef     = CATEGORIES.find((c) => c.key === activeCat) ?? CATEGORIES[0];
  const catCatalog = CATALOG[activeCat] ?? CATALOG.Houses;

  const categoryCount = useMemo(() => countFor(
    { propertyType: catDef.propertyType },
    catDef.propertyType,
    transaction,
    selectedLocation,
  ), [activeCat, transaction, selectedLocation]);

  function handleCard(item: CardItem) {
    const base = { ...item.params };
    if (transaction === 'Rent' && !base.type) base.type = 'rent';
    if (selectedLocation && selectedLocation !== 'Okara District' && !base.city) {
      base.city = selectedLocation;
    }
    if (activeCat === 'Projects') {
      router.push({ pathname: '/explore', params: { ...base, category: 'Projects' } });
      return;
    }
    router.push({ pathname: '/explore', params: base });
  }

  function goToTab(tab: TabKey) {
    const idx = TABS.indexOf(tab);
    setActiveTab(tab);
    if (pagerWidth > 0) {
      pagerRef.current?.scrollTo({ x: idx * pagerWidth, animated: true });
    }
  }

  function getRows(tab: TabKey): [CardItem | null, CardItem | null][] {
    const items = catCatalog[tab] ?? [];
    const rows: [CardItem | null, CardItem | null][] = [];
    for (let i = 0; i < items.length; i += 2) {
      rows.push([items[i] ?? null, items[i + 1] ?? null]);
    }
    return rows;
  }

  function handleSwipeEnd(offsetX: number) {
    if (pagerWidth <= 0) return;
    const idx = Math.max(0, Math.min(TABS.length - 1, Math.round(offsetX / pagerWidth)));
    setActiveTab(TABS[idx]);
  }

  return (
    <GlassCard
      intensity={38}
      style={[mod.wrapper, { backgroundColor: colors.glassCard, borderColor: colors.glassBorder }]}
      contentStyle={mod.wrapperContent}
    >

      {/* ── Header ── */}
      <View style={mod.header}>
        <View>
          <Text style={[mod.eyebrow, { color: colors.primary }]}>{content?.eyebrow || 'EXPLORE THE MARKET'}</Text>
          <Text style={[mod.title, { color: colors.foreground }]}>{content?.title || 'Find Your Property'}</Text>
          <Text style={[mod.subtitle, { color: colors.mutedForeground }]}>
            Verified properties by type, location &amp; budget
          </Text>
        </View>
        <Pressable
          onPress={() => router.push({
            pathname: '/explore',
            params: activeCat === 'Projects'
              ? { propertyType: catDef.propertyType, category: 'Projects' }
              : { propertyType: catDef.propertyType },
          })}
          style={[mod.viewAll, { borderColor: colors.border }]}
        >
          <Text style={[mod.viewAllText, { color: colors.foreground }]}>View All</Text>
          <Feather name="arrow-right" size={13} color={colors.foreground} />
        </Pressable>
      </View>

      {/* ── Category chips ── */}
      {content?.showCategories !== false && <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mod.catRow}
      >
        {CATEGORIES.map((cat) => {
          const sel = activeCat === cat.key;
          return (
            <Pressable
              key={cat.key}
              onPress={() => {
                setActiveCat(cat.key as CategoryKey);
                // Reset to Popular and scroll pager back to start
                setActiveTab('Popular');
                pagerRef.current?.scrollTo({ x: 0, animated: false });
              }}
              style={[
                mod.catChip,
                 sel
                    ? { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 2 }
                  : { backgroundColor: colors.glassOverlay, borderColor: colors.glassBorder },
              ]}
            >
              <View style={[
                mod.catIcon,
                {
                    backgroundColor: sel ? colors.selectionTint : colors.glassOverlay,
                   borderColor: sel ? colors.selectionBorder : colors.glassBorder,
                },
              ]}>
                <Feather name={cat.icon} size={17} color={sel ? colors.selectionForeground : colors.mutedForeground} />
              </View>
              <Text style={[
                mod.catLabel,
                { color: sel ? colors.selectionForeground : colors.foreground, fontWeight: sel ? '600' : '500' },
              ]}>
                 {(categoryLabels as any)?.[cat.key.toLowerCase()] || cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>}

      {/* ── Category count badge ── */}
      {categoryCount > 0 && (
        <View style={mod.countRow}>
          <View style={[mod.countBadge, { backgroundColor: colors.accent, borderColor: colors.primary + '44' }]}>
            <Feather name="layers" size={10} color={colors.primary} />
            <Text style={[mod.countText, { color: colors.accentForeground }]}>
              {categoryCount} {catDef.label.toLowerCase()} in{' '}
              {selectedLocation === 'Okara District' ? 'Okara District' : selectedLocation}
            </Text>
          </View>
        </View>
      )}

      {/* ── Sub-tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={mod.tabRow}
      >
        {TABS.map((tab) => {
          const sel = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => goToTab(tab)}
              style={[
                mod.tabPill,
                 sel
                   ? { backgroundColor: colors.selectionBackground, borderColor: colors.selectionBorder, borderWidth: 1.5 }
                   : { backgroundColor: 'transparent' },
              ]}
            >
              <Text style={[
                mod.tabText,
                { color: sel ? colors.selectionForeground : colors.mutedForeground,
                  fontWeight: sel ? '600' : '400' },
              ]}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Swipeable tab pages (fixed height — no dynamic tracking) ── */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => setPagerWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={(e) => handleSwipeEnd(e.nativeEvent.contentOffset.x)}
        style={mod.pager}
        contentContainerStyle={mod.pagerContent}
      >
        {TABS.map((tab) => (
          <View
            key={tab}
            style={[mod.page, pagerWidth > 0 && { width: pagerWidth }]}
          >
            {tab === 'Location' ? (
              <View style={mod.locGrid}>
                {OKARA_CITIES.map((city) => {
                  const cnt = countFor(
                    { propertyType: catDef.propertyType, city },
                    catDef.propertyType,
                    transaction,
                    selectedLocation,
                  );
                  return (
                    <LocationCard
                      key={city}
                      city={city}
                      count={cnt}
                      colors={colors}
                      onPress={() => handleCard({ label: city, params: { propertyType: catDef.propertyType, city } })}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={mod.grid}>
                {getRows(tab).map((row, ri) => (
                  <View key={ri} style={mod.row}>
                    <View style={mod.half}>
                      {row[0] ? (
                        <DiscCard label={row[0].label} icon={catDef.icon} colors={colors} onPress={() => handleCard(row[0]!)} />
                      ) : null}
                    </View>
                    <View style={mod.half}>
                      {row[1] ? (
                        <DiscCard label={row[1].label} icon={catDef.icon} colors={colors} onPress={() => handleCard(row[1]!)} />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

    </GlassCard>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const mod = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    shadowOpacity: 0,
    elevation: 0,
  },
  wrapperContent: {
    paddingTop: 20,
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 4 },
  title:   { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 2 },
  subtitle:{ fontSize: 12 },
  viewAll: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, marginTop: 4,
  },
  viewAllText: { fontSize: 12.5, fontWeight: '500' },
  catRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 14 },
  catChip: {
    alignItems: 'center', gap: 7,
    minWidth: 86, paddingHorizontal: 10, paddingVertical: 10,
    borderRadius: 18, borderWidth: 1,
  },
  catIcon: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  catLabel: { fontSize: 13, fontWeight: '500' },
  countRow: { paddingHorizontal: 18, marginBottom: 12 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  countText: { fontSize: 11.5, fontWeight: '500' },
  tabRow: { paddingHorizontal: 14, gap: 4, marginBottom: 14 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  tabText: { fontSize: 13.5 },
  // Fixed height covers 3 rows × 84px + location rowGap. No dynamic tracking = no blinking.
  pager: { height: 280 },
  pagerContent: { alignItems: 'flex-start' },
  page: { flexShrink: 0, height: 280 },
  // Grid: rows with two flex:1 halves — no percentages, guaranteed 50/50 split
  grid: { paddingHorizontal: 16 },
  row:  { flexDirection: 'row' },
  half: { flex: 1 },
  locGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 8,
  },
});

// DiscCard styles
const dc = StyleSheet.create({
  // width:100% fills the half-column; no flex so height comes from content (minHeight on card)
  pressable: { width: '100%' },
  card: {
    minHeight: 84,
    borderRadius: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  iconWrap: { alignItems: 'center', marginRight: 10 },
  circle: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
  body:  { flex: 1 },
  label: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  sub:   { fontSize: 11, marginTop: 2 },
});

// LocationCard styles
const lc = StyleSheet.create({
  pressable: { width: '48.5%' },
  card: {
    borderRadius: 14,
    minHeight: 84,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 10,
  },
  icon: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  body:  { flex: 1 },
  city:  { fontSize: 13.5, fontWeight: '600' },
  count: { fontSize: 11.5, marginTop: 1 },
});
