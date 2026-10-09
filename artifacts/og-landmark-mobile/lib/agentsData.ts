/**
 * Sample agent data — demo profiles used until real backend is connected.
 * Replace with oglandmark.com API response when live.
 */
import type { ImageSourcePropType } from 'react-native';
import { PUBLIC_CONTACT_PHONE } from './publicContact';

export type SampleAgent = {
  id: string;
  name: string;           // card label (may include \n)
  displayName: string;    // clean single-line name
  initials: string;
  profileImage?: ImageSourcePropType;
  photo?: string;
  coverPhoto?: string;
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
  coverPhoto?: string | null;
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
    coverPhoto: agent.coverPhoto || undefined,
    agency: agent.agency || 'OG Landmark Agent',
    verified: agent.verified !== false,
    rating: Number(agent.rating || 0),
    reviewCount: Number(agent.reviewCount || 0),
    years: Number(agent.years || 0),
    listings: Number(agent.listings || 0),
    areas: Array.isArray(agent.areas) ? agent.areas : [],
    color: agent.color || '#0B1F3A',
    phone: PUBLIC_CONTACT_PHONE,
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
    color: '#183B60',
    phone: PUBLIC_CONTACT_PHONE,
    specialties: ['Residential', 'Agricultural Land', 'Plots'],
    about:
      'Residential plots, houses, and agricultural land in Okara City and Depalpur.',
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
    color: '#0B1F3A',
    phone: PUBLIC_CONTACT_PHONE,
    specialties: ['Commercial', 'Residential', 'Rentals'],
    about:
      'Commercial and residential properties, including rentals, in Renala Khurd and Okara City.',
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
    phone: PUBLIC_CONTACT_PHONE,
    specialties: ['Agricultural Land', 'Plots', 'Commercial', 'Investment'],
    about:
      'Agricultural land, plots, and commercial properties in Depalpur and Hujra Shah Muqeem.',
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
    phone: PUBLIC_CONTACT_PHONE,
    specialties: ['Residential', 'Rentals', 'Plots'],
    about:
      'Residential rentals and plots in Okara City and Renala Khurd.',
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
    phone: PUBLIC_CONTACT_PHONE,
    specialties: ['Commercial', 'Industrial', 'Investment'],
    about:
      'Commercial shops, offices, warehouses, and industrial plots across Okara District.',
  },
];
