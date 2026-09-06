/**
 * Sample agent data — demo profiles used until real backend is connected.
 * Replace with oglandmark.com API response when live.
 */
import type { ImageSourcePropType } from 'react-native';

export type SampleAgent = {
  id: string;
  name: string;           // card label (may include \n)
  displayName: string;    // clean single-line name
  initials: string;
  profileImage?: ImageSourcePropType;
  photo?: string;
  agency: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  years: number;
  listings: number;
  areas: string[];
  color: string;          // avatar background
  phone: string;
  specialties: string[];
  about: string;
};

export type ManagedAgentRecord = {
  id: number | string;
  name?: string;
  displayName?: string;
  initials?: string;
  agency?: string;
  verified?: boolean;
  rating?: number;
  reviewCount?: number;
  years?: number;
  listings?: number;
  areas?: string[];
  color?: string;
  phone?: string;
  specialties?: string[];
  about?: string;
  photo?: string | null;
  profilePhoto?: string | null;
};

export function apiAgentToSample(agent: ManagedAgentRecord): SampleAgent {
  const displayName = agent.displayName || agent.name || 'Property Agent';
  const initials = agent.initials || displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2);
  const photo = agent.photo || agent.profilePhoto || undefined;
  return {
    id: String(agent.id),
    name: displayName,
    displayName,
    initials: initials.toUpperCase(),
    profileImage: photo ? { uri: photo } : undefined,
    photo,
    agency: agent.agency || 'OG Landmark Agent',
    verified: agent.verified !== false,
    rating: Number(agent.rating || 0),
    reviewCount: Number(agent.reviewCount || 0),
    years: Number(agent.years || 0),
    listings: Number(agent.listings || 0),
    areas: Array.isArray(agent.areas) ? agent.areas : [],
    color: agent.color || '#102a43',
    phone: agent.phone || '',
    specialties: Array.isArray(agent.specialties) ? agent.specialties : [],
    about: agent.about || '',
  };
}

export const SAMPLE_AGENTS: SampleAgent[] = [
  {
    id: 'sa1',
    name: 'Ahmed Property\nConsultants',
    displayName: 'Ahmed Property Consultants',
    initials: 'AC',
    profileImage: require('@/assets/images/agents/ahmed.jpg'),
    agency: 'Ahmed Real Estate',
    verified: true,
    rating: 4.9,
    reviewCount: 126,
    years: 12,
    listings: 48,
    areas: ['Okara City', 'Depalpur'],
    color: '#1a6b3a',
    phone: '03012345678',
    specialties: ['Residential', 'Agricultural Land', 'Plots'],
    about:
      'With over 12 years of experience in Okara District real estate, Ahmed Property Consultants specialises in residential plots, houses, and agricultural land across Okara and Depalpur. Trusted by hundreds of satisfied buyers and sellers with transparent, professional service.',
  },
  {
    id: 'sa2',
    name: 'Malik Properties',
    displayName: 'Malik Properties',
    initials: 'MP',
    profileImage: require('@/assets/images/agents/malik.jpg'),
    agency: 'Malik & Sons Real Estate',
    verified: true,
    rating: 4.8,
    reviewCount: 94,
    years: 8,
    listings: 32,
    areas: ['Renala Khurd', 'Okara City'],
    color: '#102a43',
    phone: '03042569000',
    specialties: ['Commercial', 'Residential', 'Rentals'],
    about:
      'Malik Properties has been serving clients in Renala Khurd and Okara since 2016. Specialising in residential and commercial properties with a strong focus on client satisfaction and straightforward dealings.',
  },
  {
    id: 'sa3',
    name: 'Ch. Property\nServices',
    displayName: 'Ch. Property Services',
    initials: 'CS',
    profileImage: require('@/assets/images/agents/chaudhry.jpg'),
    agency: 'Chaudhry Property Group',
    verified: true,
    rating: 4.9,
    reviewCount: 173,
    years: 15,
    listings: 61,
    areas: ['Depalpur', 'Hujra Shah Muqeem'],
    color: '#8b6c2a',
    phone: '03331234567',
    specialties: ['Agricultural Land', 'Plots', 'Commercial', 'Investment'],
    about:
      'Chaudhry Property Group is one of the most experienced real estate firms in the Depalpur area. With 15+ years of serving buyers, sellers, and investors, the group is expert in agricultural land deals, residential plots, and large-scale commercial transactions.',
  },
  {
    id: 'sa4',
    name: 'Baig Property\nAdvisors',
    displayName: 'Baig Property Advisors',
    initials: 'BA',
    agency: 'Baig & Associates',
    verified: true,
    rating: 4.7,
    reviewCount: 68,
    years: 5,
    listings: 21,
    areas: ['Okara City', 'Renala Khurd'],
    color: '#4a2d6b',
    phone: '03156789012',
    specialties: ['Residential', 'Rentals', 'Plots'],
    about:
      'Baig Property Advisors is a young and energetic firm based in Okara City, known for fast, honest dealing in residential rentals and plot sales. With 5 years in the market, the team has built a reputation for clear communication and follow-through.',
  },
  {
    id: 'sa5',
    name: 'Raza Industrial\n& Commercial',
    displayName: 'Raza Industrial & Commercial',
    initials: 'RI',
    agency: 'Raza Enterprises Real Estate',
    verified: true,
    rating: 4.8,
    reviewCount: 82,
    years: 9,
    listings: 27,
    areas: ['Okara City', 'Depalpur', 'Renala Khurd'],
    color: '#374151',
    phone: '03219876543',
    specialties: ['Commercial', 'Industrial', 'Investment'],
    about:
      'Raza Enterprises specialises in commercial shops, offices, warehouses, and industrial plots across Okara District. With 9 years of experience in the commercial sector, the firm is the go-to for investors and business owners seeking premium commercial space.',
  },
];
