import type { CreatePropertyPayload } from './api';

export interface ListingPayloadSource {
  title: string;
  type: string;
  status: string;
  price: number;
  area: number;
  areaUnit: string;
  bedrooms: number;
  bathrooms: number;
  city: string;
  fullAddress?: string;
  neighborhood: string;
  description: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  videoUrl?: string;
  district?: string;
  locality?: string;
  tehsil?: string;
  features?: string[];
  documents?: string[];
  propertyDetails?: Record<string, unknown>;
  locationSource?: string;
  locationAccuracy?: number;
  placeId?: string;
  location?: CreatePropertyPayload['location'];
}

export function buildCreatePropertyPayload(
  listing: ListingPayloadSource,
): CreatePropertyPayload {
  return {
    title: listing.title,
    type: listing.type,
    status: listing.status,
    listingStatus: 'Pending',
    price: listing.price,
    area: listing.area,
    areaUnit: listing.areaUnit,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    city: listing.city,
    address: listing.fullAddress || listing.neighborhood,
    description: listing.description,
    lat: listing.latitude,
    lng: listing.longitude,
    images: listing.images,
    videoUrl: listing.videoUrl,
    district: listing.district,
    locality: listing.locality ?? listing.neighborhood,
    tehsil: listing.tehsil,
    features: listing.features,
    amenities: listing.features,
    documents: listing.documents,
    propertyDetails: listing.propertyDetails,
    location: listing.location ?? {
      latitude: listing.latitude,
      longitude: listing.longitude,
      city: listing.city,
      district: listing.district,
      tehsil: listing.tehsil,
      locality: listing.locality ?? listing.neighborhood,
      address: listing.fullAddress || listing.neighborhood,
      source: listing.locationSource,
      accuracy: listing.locationAccuracy,
      placeId: listing.placeId,
    },
  };
}