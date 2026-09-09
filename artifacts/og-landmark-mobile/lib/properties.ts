import type { ImageSourcePropType } from 'react-native';

export type Property = {
  id: number;
  title: string;
  type: string;
  status: string;
  price: number;
  area: number;
  areaUnit: string;
  bedrooms: number;
  bathrooms: number;
  city: string;
  address: string;
  lat: number;
  lng: number;
  /** Structured backend location; lat/lng remain compatibility fields. */
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    district?: string;
    tehsil?: string;
    locality?: string;
    address?: string;
    province?: string;
    country?: string;
  };
  description: string;
  image: ImageSourcePropType;
  gallery: ImageSourcePropType[];
  featured?: boolean;
  /** True only for the bundled sample listings shown when the API is unavailable. */
  isDemo?: boolean;
  agent: string;
  agentTitle: string;
  score: number;
  agentPhone?: string;
  agentEmail?: string;
  listedDate?: string;
  amenities?: string[];
  investmentScore?: number;
  landSize?: string;
  locationDetails?: {
    province: string;
    district: string;
    tehsil: string;
    village: string;
    gps: string;
  };
  agriDetails?: {
    sizeAcres: number;
    sizeKanal: number;
    nehriWater: boolean;
    tubeWell: boolean;
    soilType: 'Clay' | 'Loam' | 'Sandy' | 'Silty' | 'Mixed';
    mainCrop: string;
    village?: string;
    tehsil?: string;
    unionCouncil?: string;
    gpsBoundary?: string;
  };
  videoUrl?: string;
  /** Bundled video asset (require()). Takes priority over videoUrl. */
  videoAsset?: number;
};

const bundledDemoProperties: Property[] = [
  // ── Okara District Residential Houses ─────────────────────────────────────
  {
    id: 1,
    title: '5 Marla House — Model Town, Okara',
    type: 'House',
    status: 'For Sale',
    price: 4800000,
    area: 5,
    areaUnit: 'Marla',
    bedrooms: 3,
    bathrooms: 2,
    city: 'Okara',
    lat: 30.8094,
    lng: 73.4537,
    address: 'Block C, Model Town, Okara City',
    description:
      'Well-built 5 Marla double-storey house in the popular Model Town area of Okara City. Three bedrooms with attached baths, separate drawing and dining rooms, modern kitchen, and a small front garden. All utilities connected — WASA water, gas, and 24-hour electricity. Walking distance from schools, Madina Market, and a mosque.',
    image: require('@/assets/images/property-1.jpg'),
    gallery: [
      require('@/assets/images/property-2.jpg'),
      require('@/assets/images/property-3.jpg'),
      require('@/assets/images/property-4.jpg'),
    ],
    featured: true,
    agent: 'Abdul Rehman',
    agentTitle: 'Property Consultant — Okara City',
    score: 4.7,
    agentPhone: '0302-4562211',
    agentEmail: 'abdulrehman@oglandmark.com',
    listedDate: 'August 2, 2026',
    amenities: ['WASA Water', 'Gas', 'Electricity', 'Drawing Room', 'Parking', 'Near School', 'Near Mosque'],
    investmentScore: 7.2,
    landSize: '5 Marla · 1,125 Sq Ft Plot',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Model Town',
      gps: '30.8094, 73.4537',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  {
    id: 2,
    title: '10 Marla House — New City Society, Depalpur',
    type: 'House',
    status: 'For Sale',
    price: 7800000,
    area: 10,
    areaUnit: 'Marla',
    bedrooms: 4,
    bathrooms: 3,
    city: 'Depalpur',
    lat: 30.6468,
    lng: 73.9742,
    address: 'Street 5, New City Society, Depalpur',
    description:
      'Spacious double-storey house on 10 Marla in the well-planned New City Society, Depalpur. Four bedrooms (two with attached baths), large lounge, proper drawing room, modern kitchen with tiles, and a covered car porch. Society has boundary wall, park, and round-the-clock security. Ideal for a large family.',
    image: require('@/assets/images/property-2.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-4.jpg'),
      require('@/assets/images/property-5.jpg'),
    ],
    featured: true,
    agent: 'Naveed Akhtar',
    agentTitle: 'Senior Property Consultant — Depalpur',
    score: 4.8,
    agentPhone: '0300-6671234',
    agentEmail: 'naveed@oglandmark.com',
    listedDate: 'July 30, 2026',
    amenities: ['Society Security', 'Car Porch', 'Gas', 'WASA Water', 'Park Nearby', 'Boundary Wall', 'Tiled Kitchen'],
    investmentScore: 7.8,
    landSize: '10 Marla · 2,250 Sq Ft Plot',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'New City Society',
      gps: '30.6468, 73.9742',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  {
    id: 3,
    title: '5 Marla House for Rent — Renala Khurd',
    type: 'House',
    status: 'For Rent',
    price: 22000,
    area: 5,
    areaUnit: 'Marla',
    bedrooms: 3,
    bathrooms: 2,
    city: 'Renala Khurd',
    lat: 30.8795,
    lng: 73.5954,
    address: 'Gulshan Colony, Renala Khurd',
    description:
      'Neat and clean 5 Marla house available for rent in Gulshan Colony, Renala Khurd. Ground floor only — three bedrooms, lounge, kitchen, and a small verandah. Family-friendly street. Separate electricity meter. One month advance + one month security. Ideal for working families or couples.',
    image: require('@/assets/images/property-3.jpg'),
    gallery: [
      require('@/assets/images/property-5.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    agent: 'Muhammad Asif',
    agentTitle: 'Property Dealer — Renala Khurd',
    score: 4.4,
    agentPhone: '0321-5551234',
    agentEmail: 'asif@oglandmark.com',
    listedDate: 'August 6, 2026',
    amenities: ['Separate Electric Meter', 'Gas', 'Water Motor', 'Peaceful Street'],
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Renala Khurd',
      village: 'Gulshan Colony',
      gps: '30.8795, 73.5954',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  // ── Commercial ───────────────────────────────────────────────────────────────
  {
    id: 4,
    title: 'Corner Commercial Shop — Main Bazar, Okara',
    type: 'Commercial',
    status: 'For Sale',
    price: 9500000,
    area: 4,
    areaUnit: 'Marla',
    bedrooms: 0,
    bathrooms: 1,
    city: 'Okara',
    lat: 30.8120,
    lng: 73.4490,
    address: 'Main Bazar Chowk, Okara City',
    description:
      'Prime corner commercial shop in the busiest commercial hub of Okara City. Ground floor with 18-foot frontage and full basement for storage. High foot traffic — ideal for a pharmacy, bank branch, showroom, or franchise. Ready for immediate handover.',
    image: require('@/assets/images/property-4.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Zahid Hussain',
    agentTitle: 'Commercial Property Specialist — Okara',
    score: 4.6,
    agentPhone: '0333-6667788',
    agentEmail: 'zahid@oglandmark.com',
    listedDate: 'July 25, 2026',
    amenities: ['Corner Location', '18-Ft Frontage', 'Full Basement', 'High Foot Traffic', 'Electricity 3-Phase'],
    investmentScore: 8.5,
    landSize: '4 Marla · 900 Sq Ft',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Main Bazar',
      gps: '30.8120, 73.4490',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  {
    id: 14,
    title: 'Double Storey Plaza — GT Road, Depalpur',
    type: 'Commercial',
    status: 'For Sale',
    price: 14500000,
    area: 8,
    areaUnit: 'Marla',
    bedrooms: 0,
    bathrooms: 2,
    city: 'Depalpur',
    lat: 30.6620,
    lng: 73.9890,
    address: 'GT Road, Depalpur, Okara District',
    description:
      'Solid double-storey commercial plaza on the main GT Road Depalpur — maximum visibility. Ground floor (3 shops) + first floor (4 offices). Fully rented. Annual rental income approx. PKR 12 Lakh. Roof rights available. Electricity 3-phase. Ideal as a long-term income-generating asset for investors.',
    image: require('@/assets/images/property-2.jpg'),
    gallery: [
      require('@/assets/images/property-4.jpg'),
      require('@/assets/images/property-5.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Zahid Hussain',
    agentTitle: 'Commercial Property Specialist — Depalpur',
    score: 4.7,
    agentPhone: '0333-6667788',
    agentEmail: 'zahid@oglandmark.com',
    listedDate: 'August 3, 2026',
    amenities: ['GT Road Frontage', '3-Phase Electricity', 'Fully Rented', 'Double Storey', 'Roof Rights Included', 'High Visibility'],
    investmentScore: 9.0,
    landSize: '8 Marla · 1,800 Sq Ft',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'GT Road',
      gps: '30.6620, 73.9890',
    },
  },
  // ── Plots ────────────────────────────────────────────────────────────────────
  {
    id: 5,
    title: '10 Marla Plot — Canal View Society, Okara',
    type: 'Plot',
    status: 'For Sale',
    price: 3800000,
    area: 10,
    areaUnit: 'Marla',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Okara',
    lat: 30.8210,
    lng: 73.4620,
    address: 'Block A, Canal View Society, Okara',
    description:
      'Ready-to-build 10 Marla residential plot in Canal View Society, Okara — a planned residential scheme. Wide streets, underground sewerage, and tree-lined boulevard. Plot is on a 30-foot street — east-open facing. Development 90% complete. Electricity and WASA connection available on plot.',
    image: require('@/assets/images/property-5.jpg'),
    gallery: [
      require('@/assets/images/property-3.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Abdul Rehman',
    agentTitle: 'Property Consultant — Okara City',
    score: 4.5,
    agentPhone: '0302-4562211',
    agentEmail: 'abdulrehman@oglandmark.com',
    listedDate: 'August 4, 2026',
    amenities: ['Approved Layout', 'Underground Sewerage', '30-Ft Street', 'East-Open', 'Tree-Lined Boulevard'],
    investmentScore: 7.5,
    landSize: '10 Marla · 2,250 Sq Ft',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Canal View Society',
      gps: '30.8210, 73.4620',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  // ── Affordable Residential ───────────────────────────────────────────────────
  {
    id: 6,
    title: '3 Marla House — Hujra Shah Muqeem',
    type: 'House',
    status: 'For Sale',
    price: 2600000,
    area: 3,
    areaUnit: 'Marla',
    bedrooms: 2,
    bathrooms: 1,
    city: 'Hujra Shah Muqeem',
    lat: 30.7389,
    lng: 73.8237,
    address: 'Islam Colony, Hujra Shah Muqeem, Okara District',
    description:
      'Budget-friendly 3 Marla house — perfect for first-time buyers or investment. Two bedrooms, one bathroom, small kitchen and sitting area. Ground floor only. All utilities available. Situated in a quiet residential street of Islam Colony. Easy access to main bazar and government hospital.',
    image: require('@/assets/images/property-6.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-2.jpg'),
    ],
    agent: 'Muhammad Asif',
    agentTitle: 'Property Dealer — Hujra Shah Muqeem',
    score: 4.2,
    agentPhone: '0321-5551234',
    agentEmail: 'asif@oglandmark.com',
    listedDate: 'August 7, 2026',
    amenities: ['Gas', 'Electricity', 'Quiet Street', 'Near Hospital'],
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'Islam Colony',
      gps: '30.7389, 73.8237',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  // ── Large Residential ────────────────────────────────────────────────────────
  {
    id: 15,
    title: '1 Kanal House — Officers Colony, Okara',
    type: 'House',
    status: 'For Sale',
    price: 13500000,
    area: 20,
    areaUnit: 'Marla',
    bedrooms: 5,
    bathrooms: 4,
    city: 'Okara',
    lat: 30.8156,
    lng: 73.4480,
    address: 'Officers Colony, Near DCO Office, Okara City',
    description:
      'Prestigious 1 Kanal double-storey house in Officers Colony — one of Okara\'s most desirable addresses. Five bedrooms (all attached), grand drawing room, formal dining, modern kitchen, servant quarters, and large lawn with garden. Backup generator and UPS installed. Solar panels (5kW) on roof. Ideal for senior civil or military officers and business families.',
    image: require('@/assets/images/property-5.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-3.jpg'),
      require('@/assets/images/property-4.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Naveed Akhtar',
    agentTitle: 'Senior Property Consultant — Okara',
    score: 4.9,
    agentPhone: '0300-6671234',
    agentEmail: 'naveed@oglandmark.com',
    listedDate: 'July 22, 2026',
    amenities: ['5kW Solar Panels', 'Generator + UPS', 'Lawn & Garden', 'Servant Quarters', 'Grand Drawing Room', 'All Attached Baths', 'Car Porch (2 Cars)'],
    investmentScore: 8.8,
    landSize: '1 Kanal · 20 Marla · 4,500 Sq Ft Plot',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Officers Colony',
      gps: '30.8156, 73.4480',
    },
    videoAsset: require('@/assets/videos/property-tour-2.mp4') as unknown as number,
  },
  // ── Agricultural (non-Okara agriDetails) ────────────────────────────────────
  {
    id: 7,
    title: '30-Acre Agri Land — Okara Tehsil',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 42000000,
    area: 240,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Okara',
    lat: 30.7985,
    lng: 73.4280,
    address: 'Chak 5/4-L, Okara Tehsil, Okara District',
    description:
      'Productive 30-acre agricultural land in Okara Tehsil — currently under cotton and wheat rotation. Nehri water (LBDC seasonal) plus electric tube well (10HP). Loam-silty soil with excellent fertility. Farmhouse (pakka) with electricity on site. Boundary marked with concrete pillars. Ideal for large-scale farming or agri-investment.',
    image: require('@/assets/images/property-3.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-5.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Tariq Mehmood',
    agentTitle: 'Agricultural Property Specialist — Okara',
    score: 4.8,
    agentPhone: '0300-4561234',
    agentEmail: 'tariq@oglandmark.com',
    listedDate: 'July 28, 2026',
    amenities: ['Nehri Water (LBDC)', 'Tube Well (10HP)', 'Pakka Farmhouse', 'Electricity', 'Concrete Boundary', 'Road Access'],
    investmentScore: 8.6,
    landSize: '30 Acres · 240 Kanal · 4,800 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Chak 5/4-L',
      gps: '30.7985, 73.4280',
    },
    agriDetails: {
      sizeAcres: 30,
      sizeKanal: 240,
      nehriWater: true,
      tubeWell: true,
      soilType: 'Loam',
      mainCrop: 'Cotton',
      village: 'Chak 5/4-L',
      tehsil: 'Okara',
      unionCouncil: 'UC Okara-3',
      gpsBoundary: '30.7985, 73.4280',
    },
  },

  // ── Okara District Agricultural Land Listings ────────────────────────────────
  {
    id: 20,
    title: '25-Acre Prime Cotton Land — Depalpur',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 37500000,
    area: 200,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Depalpur',
    lat: 30.6892,
    lng: 73.9254,
    address: 'Chak 34/4-R, Depalpur Tehsil, Okara District',
    description:
      'Prime cotton-growing land in the heart of Okara District. Loam soil with excellent water retention. Nehri water channel runs along the western boundary with full seasonal flow. Tube well (12HP electric) installed. Road-accessible from Depalpur–Sahiwal highway.',
    image: require('@/assets/images/property-3.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-4.jpg'),
      require('@/assets/images/property-5.jpg'),
    ],
    featured: true,
    agent: 'Tariq Mehmood',
    agentTitle: 'Agricultural Property Specialist — Okara',
    score: 4.8,
    agentPhone: '0300-4561234',
    agentEmail: 'tariq@oglandmark.com',
    listedDate: 'August 1, 2026',
    amenities: ['Nehri Water', 'Tube Well (12HP)', 'Road Access', 'Electricity', 'Boundary Wall'],
    investmentScore: 8.2,
    landSize: '25 Acres · 200 Kanal · 4,000 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'Chak 34/4-R',
      gps: '30.6892, 73.9254',
    },
    agriDetails: {
      sizeAcres: 25,
      sizeKanal: 200,
      nehriWater: true,
      tubeWell: true,
      soilType: 'Loam',
      mainCrop: 'Cotton',
      village: 'Chak 34/4-R',
      tehsil: 'Depalpur',
      unionCouncil: 'Depalpur East',
      gpsBoundary: '30.6892, 73.9254',
    },
  },
  {
    id: 21,
    title: '15-Acre Sugarcane Land — Renala Khurd',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 18750000,
    area: 120,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Renala Khurd',
    lat: 30.8811,
    lng: 73.5973,
    address: 'Chak 8/4-R, Renala Khurd Tehsil, Okara District',
    description:
      'Fertile sugarcane land adjacent to Renala Khurd Sugar Mills — commanding premium rates for cane supply contracts. Clay-loam soil ideal for sugarcane. Nehri water access confirmed from Upper Bari Doab Canal. No tube well but water pressure excellent. Mango trees along boundaries. Easy transfer on possession.',
    image: require('@/assets/images/property-5.jpg'),
    gallery: [
      require('@/assets/images/property-2.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: true,
    agent: 'Muhammad Asif',
    agentTitle: 'Agricultural Land Dealer — Renala Khurd',
    score: 4.6,
    agentPhone: '0321-5551234',
    agentEmail: 'asif@oglandmark.com',
    listedDate: 'July 28, 2026',
    amenities: ['Nehri Water', 'Road Access', 'Near Sugar Mill', 'Mango Trees on Boundary'],
    investmentScore: 7.8,
    landSize: '15 Acres · 120 Kanal · 2,400 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Renala Khurd',
      village: 'Chak 8/4-R',
      gps: '30.8811, 73.5973',
    },
    agriDetails: {
      sizeAcres: 15,
      sizeKanal: 120,
      nehriWater: true,
      tubeWell: false,
      soilType: 'Clay',
      mainCrop: 'Sugarcane',
      village: 'Chak 8/4-R',
      tehsil: 'Renala Khurd',
      unionCouncil: 'UC Renala-2',
      gpsBoundary: '30.8811, 73.5973',
    },
  },
  {
    id: 22,
    title: '12-Acre Wheat & Rice Land — Okara City',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 15600000,
    area: 96,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Okara',
    lat: 30.8098,
    lng: 73.4516,
    address: 'Chak 13/4-R, Okara Tehsil, Okara District',
    description:
      'Dual-crop rotation land (wheat in rabi, rice in kharif) with silty loam soil. Nehri water from Lower Bari Doab Canal available in both seasons. Tube well (8HP diesel) for supplemental irrigation. Small farmhouse (kutcha) on site. Conveniently located 8km from Okara city centre.',
    image: require('@/assets/images/property-4.jpg'),
    gallery: [
      require('@/assets/images/property-1.jpg'),
      require('@/assets/images/property-3.jpg'),
      require('@/assets/images/property-6.jpg'),
    ],
    featured: false,
    agent: 'Tariq Mehmood',
    agentTitle: 'Agricultural Property Specialist — Okara',
    score: 4.5,
    agentPhone: '0300-4561234',
    agentEmail: 'tariq@oglandmark.com',
    listedDate: 'August 5, 2026',
    amenities: ['Nehri Water', 'Tube Well (Diesel)', 'Road Access', 'Farmhouse (Kutcha)'],
    investmentScore: 7.4,
    landSize: '12 Acres · 96 Kanal · 1,920 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Okara',
      village: 'Chak 13/4-R',
      gps: '30.8098, 73.4516',
    },
    agriDetails: {
      sizeAcres: 12,
      sizeKanal: 96,
      nehriWater: true,
      tubeWell: true,
      soilType: 'Silty',
      mainCrop: 'Wheat',
      village: 'Chak 13/4-R',
      tehsil: 'Okara',
      unionCouncil: 'UC Okara-5',
      gpsBoundary: '30.8098, 73.4516',
    },
  },
  {
    id: 23,
    title: '8-Acre Mixed Farming — Hujra Shah Muqeem',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 8800000,
    area: 64,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Hujra Shah Muqeem',
    lat: 30.7342,
    lng: 73.8123,
    address: 'Moray Wala, Hujra Shah Muqeem, Okara District',
    description:
      'Sandy-loam land suitable for mixed farming — currently under maize and cotton. No nehri access but deep tube well (16HP) provides year-round irrigation. Lower land price ideal for first-time agricultural investors or young farmers. Boundary marked with pillars.',
    image: require('@/assets/images/property-6.jpg'),
    gallery: [
      require('@/assets/images/property-2.jpg'),
      require('@/assets/images/property-5.jpg'),
    ],
    featured: false,
    agent: 'Zahid Hussain',
    agentTitle: 'Property Dealer — Hujra Shah Muqeem',
    score: 4.3,
    agentPhone: '0333-6667788',
    agentEmail: 'zahid@oglandmark.com',
    listedDate: 'July 20, 2026',
    amenities: ['Tube Well (16HP)', 'Road Access', 'Boundary Pillars', 'Electricity'],
    investmentScore: 6.8,
    landSize: '8 Acres · 64 Kanal · 1,280 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'Moray Wala',
      gps: '30.7342, 73.8123',
    },
    agriDetails: {
      sizeAcres: 8,
      sizeKanal: 64,
      nehriWater: false,
      tubeWell: true,
      soilType: 'Sandy',
      mainCrop: 'Mixed Farming',
      village: 'Moray Wala',
      tehsil: 'Depalpur',
      unionCouncil: 'UC Hujra-3',
      gpsBoundary: '30.7342, 73.8123',
    },
  },
  {
    id: 24,
    title: '4-Acre Nehri Cotton Land — Depalpur',
    type: 'Agriculture Land',
    status: 'For Sale',
    price: 5200000,
    area: 32,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    city: 'Depalpur',
    lat: 30.6541,
    lng: 73.9812,
    address: 'Chak 45/4-R, Depalpur Tehsil, Okara District',
    description:
      'Affordable entry-level agricultural plot ideal for small farmers. Nehri water fully available. Rich loam soil currently producing cotton. Suitable for cotton, wheat rotation. Good neighbours and peaceful farming community. Price negotiable for serious buyers.',
    image: require('@/assets/images/property-1.jpg'),
    gallery: [
      require('@/assets/images/property-3.jpg'),
      require('@/assets/images/property-4.jpg'),
    ],
    featured: false,
    agent: 'Muhammad Asif',
    agentTitle: 'Agricultural Land Dealer — Depalpur',
    score: 4.4,
    agentPhone: '0321-5551234',
    agentEmail: 'asif@oglandmark.com',
    listedDate: 'August 7, 2026',
    amenities: ['Nehri Water', 'Road Access'],
    investmentScore: 6.5,
    landSize: '4 Acres · 32 Kanal · 640 Marla',
    locationDetails: {
      province: 'Punjab',
      district: 'Okara',
      tehsil: 'Depalpur',
      village: 'Chak 45/4-R',
      gps: '30.6541, 73.9812',
    },
    agriDetails: {
      sizeAcres: 4,
      sizeKanal: 32,
      nehriWater: true,
      tubeWell: false,
      soilType: 'Loam',
      mainCrop: 'Cotton',
      village: 'Chak 45/4-R',
      tehsil: 'Depalpur',
      unionCouncil: 'UC Depalpur-2',
      gpsBoundary: '30.6541, 73.9812',
    },
  },
  // ── Industrial: Warehouse ──────────────────────────────────────────────────
  {
    id: 25,
    title: '5 Kanal Industrial Warehouse — GT Road Okara',
    city: 'Okara',
    lat: 30.8180,
    lng: 73.4510,
    address: 'GT Road Industrial Zone, Okara City',
    type: 'Industrial Warehouse',
    status: 'For Sale',
    price: 28500000,
    area: 100,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 2,
    description: '5 Kanal industrial warehouse on GT Road Okara with 24-foot ceiling height, heavy truck access, and 3-phase electricity. Includes security guard room and front office. Suitable for manufacturing, storage, or logistics operations.',
    agent: 'OG Landmark',
    agentTitle: 'Industrial Division',
    image: require('@/assets/images/property-3.jpg'),
    gallery: [],
    amenities: ['Loading Dock', 'High Ceiling', 'Electricity', 'Water Supply', 'Security', 'Truck Access', 'Road Frontage', 'Parking'],
    featured: false,
    score: 7.8,
    investmentScore: 8.0,
  },

  // ── Industrial: Industrial Plot ────────────────────────────────────────────
  {
    id: 26,
    title: '10 Kanal Industrial Plot — Renala Industrial Zone',
    city: 'Renala Khurd',
    lat: 30.8850,
    lng: 73.6020,
    address: 'Industrial Zone, Renala Khurd, Okara District',
    type: 'Industrial Plot',
    status: 'For Sale',
    price: 18000000,
    area: 200,
    areaUnit: 'Kanal',
    bedrooms: 0,
    bathrooms: 0,
    description: '10 Kanal corner industrial plot in Renala Khurd industrial zone, ready for factory or warehouse construction. Gas, electricity and water connections available. 60-foot road frontage on main industrial corridor with easy access from Renala-Okara Road.',
    agent: 'OG Landmark',
    agentTitle: 'Industrial Division',
    image: require('@/assets/images/property-4.jpg'),
    gallery: [],
    amenities: ['Electricity', 'Gas Connection', 'Water Supply', 'Road Frontage', 'Industrial Zone', 'Possession Ready'],
    featured: false,
    score: 7.5,
    investmentScore: 8.2,
  },
];

// Keep the demo marker local to bundled fallback data. API/admin properties are
// mapped separately and intentionally do not receive this flag.
export const properties: Property[] = bundledDemoProperties.map((property) => ({
  ...property,
  isDemo: true,
}));

export function formatPrice(price: number, status: string) {
  if (status === 'For Rent') {
    return `PKR ${new Intl.NumberFormat('en-US').format(price)} / mo`;
  }
  if (status === 'For Lease') {
    return `PKR ${(price / 100000).toFixed(price % 100000 === 0 ? 0 : 1)} Lac / yr`;
  }
  if (price >= 10000000) {
    return `PKR ${(price / 10000000).toFixed(price % 10000000 === 0 ? 0 : 1)} Cr`;
  }
  if (price >= 100000) {
    return `PKR ${(price / 100000).toFixed(price % 100000 === 0 ? 0 : 1)} Lac`;
  }
  return `PKR ${new Intl.NumberFormat('en-US').format(price)}`;
}

// All available property image assets — used for padding to 8
const ALL_IMAGES: ImageSourcePropType[] = [
  require('@/assets/images/property-1.jpg'),
  require('@/assets/images/property-2.jpg'),
  require('@/assets/images/property-3.jpg'),
  require('@/assets/images/property-4.jpg'),
  require('@/assets/images/property-5.jpg'),
  require('@/assets/images/property-6.jpg'),
];

/** Returns exactly 15 images: property's own first, padded with other assets if needed. */
export function propertyImages(property: Property): ImageSourcePropType[] {
  const own = [property.image, ...property.gallery];
  const pool = ALL_IMAGES.filter(
    (img) => !own.some((o) => JSON.stringify(o) === JSON.stringify(img)),
  );
  const result = [...own];
  let i = 0;
  while (result.length < 15) {
    result.push(pool[i % pool.length]);
    i++;
  }
  return result.slice(0, 15);
}

/**
 * Resolves a property video URL.
 * If the stored value is a relative path (e.g. /static/property-tour.mp4),
 * it is resolved against the Replit dev domain at runtime.
 * Absolute URLs (http/https) are returned as-is.
 */
export function resolveVideoUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const domain = process.env.EXPO_PUBLIC_DOMAIN as string | undefined;
  if (!domain) return undefined;
  return `https://${domain}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function formatMarla(area: number, areaUnit: string) {
  const unit = areaUnit.toLowerCase();
  if (unit === 'marla') return `${area} Marla`;
  if (unit === 'kanal') return `${area * 20} Marla`;
  // sq ft → convert
  return `${(area / 272.25).toFixed(1)} Marla`;
}

/** Returns a display-friendly {value, label} pair preserving the native unit. */
export function formatAreaDisplay(area: number, areaUnit: string): { value: string; label: string } {
  const unit = (areaUnit ?? '').toLowerCase().trim();
  if (unit === 'marla')                          return { value: `${area}`, label: 'Marla' };
  if (unit === 'kanal')                          return { value: `${area}`, label: 'Kanal' };
  if (unit === 'acre')                           return { value: `${area}`, label: 'Acre' };
  if (unit === 'sq. yard' || unit === 'sq yard') return { value: `${area}`, label: 'Sq.Yd' };
  if (unit === 'sq. ft.' || unit === 'sq ft' || unit === 'sqft')
                                                 return { value: (area / 272.25).toFixed(1), label: 'Marla' };
  // Unknown unit — show as-is
  return { value: `${area}`, label: areaUnit };
}

// ─── Resolve backend image URL (relative or absolute) ────────────────────────
const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) || 'https://oglandmark.com';

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// ─── Placeholder images (cycled when backend property has no images) ───────────
const PLACEHOLDERS: ImageSourcePropType[] = [
  require('@/assets/images/property-1.jpg'),
  require('@/assets/images/property-2.jpg'),
  require('@/assets/images/property-3.jpg'),
  require('@/assets/images/property-4.jpg'),
  require('@/assets/images/property-5.jpg'),
  require('@/assets/images/property-6.jpg'),
];

/**
 * Convert an ApiProperty (from the backend) to the Property shape used
 * throughout the mobile app. Falls back to placeholder images when the
 * backend property has no uploaded images.
 *
 * All fields are defensively coerced so a partial/malformed API response
 * never causes a runtime crash in downstream components.
 */
export function apiPropertyToProperty(ap: {
  id?: number | null; title?: string | null; type?: string | null;
  status?: string | null; price?: number | null;
  area?: number | null; areaUnit?: string | null;
  bedrooms?: number | null; bathrooms?: number | null;
  city?: string | null; address?: string | null;
  description?: string | null; images?: string[] | null;
  featured?: boolean | null; sellerName?: string | null;
  sellerPhone?: string | null; amenities?: string[] | null;
  createdAt?: string | null; tags?: string[] | null;
  propertyScore?: { overall?: number | null } | null;
  lat?: number | null; lng?: number | null;
   location?: {
     latitude?: number | null; longitude?: number | null;
     city?: string | null; district?: string | null; tehsil?: string | null;
     locality?: string | null; address?: string | null; province?: string | null;
     country?: string | null;
   } | null;
  agentId?: number | null; sellerId?: number | null;
}): Property {
  const safeId   = typeof ap.id === 'number' && isFinite(ap.id) ? ap.id : 0;
  const imgs     = Array.isArray(ap.images) ? ap.images.filter(Boolean) : [];
  const placeholder = PLACEHOLDERS[safeId % PLACEHOLDERS.length] ?? PLACEHOLDERS[0]!;
  const image: ImageSourcePropType = imgs[0] ? { uri: resolveImageUrl(imgs[0]) } : placeholder;
  const gallery: ImageSourcePropType[] = imgs.slice(1).map(
    (u) => ({ uri: resolveImageUrl(u) } as ImageSourcePropType),
  );

  // Structured coordinates are authoritative. Legacy lat/lng remain a
  // compatibility fallback for older API rows and bundled demo properties.
  const rawLat = typeof ap.lat === 'number' ? ap.lat : NaN;
  const rawLng = typeof ap.lng === 'number' ? ap.lng : NaN;
  const structuredLat = typeof ap.location?.latitude === 'number' ? ap.location.latitude : NaN;
  const structuredLng = typeof ap.location?.longitude === 'number' ? ap.location.longitude : NaN;
  const lat = isFinite(structuredLat) && structuredLat !== 0
    ? structuredLat
    : isFinite(rawLat) && rawLat !== 0 ? rawLat : 30.8094;
  const lng = isFinite(structuredLng) && structuredLng !== 0
    ? structuredLng
    : isFinite(rawLng) && rawLng !== 0 ? rawLng : 73.4537;

  return {
    id:          safeId,
    title:       ap.title?.trim() || 'Untitled Property',
    type:        ap.type?.trim()  || 'Property',
    status:      ap.status?.trim() || 'For Sale',
    price:       typeof ap.price === 'number' && isFinite(ap.price) ? ap.price : 0,
    area:        typeof ap.area === 'number' && isFinite(ap.area)   ? ap.area  : 0,
    areaUnit:    ap.areaUnit?.trim() || 'Marla',
    bedrooms:    typeof ap.bedrooms === 'number' ? Math.max(0, ap.bedrooms)  : 0,
    bathrooms:   typeof ap.bathrooms === 'number' ? Math.max(0, ap.bathrooms) : 0,
    city:        ap.city?.trim()    || 'Okara',
    address:     ap.address?.trim() || '',
    lat,
    lng,
    location: {
      latitude: lat,
      longitude: lng,
      city: ap.location?.city?.trim() || ap.city?.trim() || undefined,
      district: ap.location?.district?.trim() || undefined,
      tehsil: ap.location?.tehsil?.trim() || undefined,
      locality: ap.location?.locality?.trim() || undefined,
      address: ap.location?.address?.trim() || ap.address?.trim() || undefined,
      province: ap.location?.province?.trim() || undefined,
      country: ap.location?.country?.trim() || undefined,
    },
    locationDetails: {
      province: ap.location?.province?.trim() || '',
      district: ap.location?.district?.trim() || '',
      tehsil: ap.location?.tehsil?.trim() || '',
      village: ap.location?.locality?.trim() || '',
      gps: `${lat}, ${lng}`,
    },
    description: ap.description?.trim() || '',
    image,
    gallery,
    featured:    ap.featured === true,
    isDemo:      false,
    agent:       ap.sellerName?.trim() || 'OG Landmark',
    agentTitle:  'Property Consultant',
    agentPhone:  ap.sellerPhone?.trim() || undefined,
    score:       (typeof ap.propertyScore?.overall === 'number' && isFinite(ap.propertyScore.overall))
                   ? ap.propertyScore.overall
                   : 4.5,
    amenities:   Array.isArray(ap.amenities) ? ap.amenities.filter((a): a is string => typeof a === 'string') : [],
    listedDate:  ap.createdAt
      ? (() => {
          try { return new Date(ap.createdAt!).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }); }
          catch { return undefined; }
        })()
      : undefined,
  };
}