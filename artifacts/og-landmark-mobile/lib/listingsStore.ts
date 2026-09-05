/**
 * User Listings Store — authenticated backend source of truth.
 */
import {
  createProperty,
  updateProperty,
  deleteProperty,
  getMyProperties,
  type CreatePropertyPayload,
} from '@/lib/api';

export type ListingStatus = 'Active' | 'Pending' | 'Draft' | 'Paused' | 'Sold' | 'Rented';

export type UserListing = {
  id: string;
  apiId?: number;          // backend ID — set after successful POST
  postedBy: string;
  agentName: string;
  role: 'agent' | 'buyer';
  title: string;
  type: string;
  category: string;
  status: string;
  price: number;
  area: number;
  areaUnit: string;
  city: string;
  neighborhood: string;
  description: string;
  bedrooms: number;
  bathrooms: number;
  postedAt: string;
  updatedAt?: string;
  listingStatus: ListingStatus;
  expiresAt?: string;
  views: number;
  saves: number;
  leadsCount: number;
  requirements?: string;
  nehriWater?: boolean | null;
  tubeWell?: boolean | null;
  soilType?: string | null;
  mainCrop?: string;
  village?: string;
  tehsil?: string;
  unionCouncil?: string;
  gpsBoundary?: string;
  latitude?: number;
  longitude?: number;
  fullAddress?: string;    // reverse-geocoded full address
  placeId?: string;        // Google Place ID
  locationAccuracy?: number;
  locationSource?: string;
  images?: string[];       // backend URLs after upload
  videoUrl?: string;       // backend URL after upload
};

function migrateListing(l: Partial<UserListing> & { id: string; postedBy: string }): UserListing {
  return {
    agentName: '', role: 'agent', title: '', type: '', category: '',
    status: 'For Sale', price: 0, area: 0, areaUnit: 'Marla', city: '',
    neighborhood: '', description: '', bedrooms: 0, bathrooms: 0,
    postedAt: new Date().toISOString(), listingStatus: 'Pending',
    views: 0, saves: 0, leadsCount: 0,
    ...l,
  } as UserListing;
}

// ── Public API ────────────────────────────────────────────────────────────────

function mapApiPropToListing(p: Awaited<ReturnType<typeof getMyProperties>>[number]): UserListing {
  return {
    id:           `api_${p.id}`,
    apiId:        p.id,
    postedBy:     String(p.sellerId ?? p.agentId ?? ''),
    agentName:    p.sellerName ?? '',
    role:         'agent' as const,
    title:        p.title,
    type:         p.type,
    category:     p.type,
    status:       p.status,
    price:        p.price,
    area:         p.area,
    areaUnit:     p.areaUnit ?? 'Marla',
    city:         p.city,
    neighborhood: p.address ?? '',
    description:  p.description ?? '',
    bedrooms:     p.bedrooms ?? 0,
    bathrooms:    p.bathrooms ?? 0,
    postedAt:     p.createdAt ?? new Date().toISOString(),
    listingStatus: (
      p.approvalStatus === 'Active'   ? 'Active'  :
      p.approvalStatus === 'Rejected' ? 'Paused'  : 'Pending'
    ) as ListingStatus,
    views:      p.views ?? 0,
    saves:      0,
    leadsCount: p.inquiryCount ?? 0,
    images:     (p.images as string[] | undefined) ?? [],
    videoUrl:   p.videoUrl ?? undefined,
    latitude:   p.lat,
    longitude:  p.lng,
    fullAddress: p.address ?? '',
  };
}

export async function getUserListings(): Promise<UserListing[]> {
  return (await getMyProperties()).map(mapApiPropToListing);
}

export async function saveAllListings(listings: UserListing[]): Promise<void> {
  await Promise.all(listings.filter((listing) => listing.apiId).map((listing) =>
    updateUserListing(listing),
  ));
}

export async function addUserListing(listing: UserListing): Promise<void> {
  const now      = new Date().toISOString();
  const expiry   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const newEntry: UserListing = {
    ...listing,
    views: listing.views ?? 0,
    saves: listing.saves ?? 0,
    leadsCount: listing.leadsCount ?? 0,
    expiresAt: expiry,
    updatedAt: now,
  };

  const payload: CreatePropertyPayload = {
    title: newEntry.title, type: newEntry.type, status: newEntry.status,
    price: newEntry.price, area: newEntry.area, areaUnit: newEntry.areaUnit,
    bedrooms: newEntry.bedrooms, bathrooms: newEntry.bathrooms, city: newEntry.city,
    address: newEntry.fullAddress || newEntry.neighborhood, description: newEntry.description,
    lat: newEntry.latitude, lng: newEntry.longitude, images: newEntry.images, videoUrl: newEntry.videoUrl,
  };
  await createProperty(payload);
}

export async function updateUserListing(updated: UserListing): Promise<void> {
  const now = new Date().toISOString();
  const entry = { ...updated, updatedAt: now };

  if (!entry.apiId) throw new Error('Listing is not available on the server.');
  await updateProperty(entry.apiId, {
    title: entry.title, type: entry.type, status: entry.status, price: entry.price,
    area: entry.area, areaUnit: entry.areaUnit, bedrooms: entry.bedrooms, bathrooms: entry.bathrooms,
    city: entry.city, address: entry.fullAddress || entry.neighborhood, description: entry.description,
    lat: entry.latitude, lng: entry.longitude,
  });
}

export async function updateListingStatus(
  id: string, listingStatus: ListingStatus,
): Promise<UserListing[]> {
  const listing = (await getUserListings()).find((item) => item.id === id);
  if (!listing?.apiId) throw new Error('Listing is not available on the server.');
  await updateProperty(listing.apiId, { status: listingStatus });
  return getUserListings();
}

export async function deleteUserListing(id: string): Promise<UserListing[]> {
  const target = (await getUserListings()).find((listing) => listing.id === id);
  if (!target?.apiId) throw new Error('Listing is not available on the server.');
  await deleteProperty(target.apiId);
  return getUserListings();
}

export async function getMyListings(userId: string): Promise<UserListing[]> {
  const all = await getUserListings();
  return all
    .filter((l) => l.postedBy === userId)
    .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}

export function calcListingStats(listings: UserListing[]) {
  return {
    total:      listings.length,
    active:     listings.filter((l) => l.listingStatus === 'Active').length,
    pending:    listings.filter((l) => l.listingStatus === 'Pending').length,
    sold:       listings.filter((l) => l.listingStatus === 'Sold').length,
    rented:     listings.filter((l) => l.listingStatus === 'Rented').length,
    paused:     listings.filter((l) => l.listingStatus === 'Paused').length,
    totalViews: listings.reduce((s, l) => s + (l.views ?? 0), 0),
    totalSaves: listings.reduce((s, l) => s + (l.saves ?? 0), 0),
    totalLeads: listings.reduce((s, l) => s + (l.leadsCount ?? 0), 0),
  };
}

export function buildAddress(city: string, neighborhood: string): string {
  return neighborhood ? `${neighborhood}, ${city}` : city;
}
