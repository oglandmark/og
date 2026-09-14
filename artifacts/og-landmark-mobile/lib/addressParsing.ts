import type { LocationData } from './locationService';

export interface GoogleAddressComponent {
  long_name: string;
  short_name?: string;
  types: string[];
}

export interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  city_district?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

function pick(components: GoogleAddressComponent[], ...types: string[]): string {
  for (const type of types) {
    const component = components.find((candidate) => candidate.types.includes(type));
    if (component?.long_name) return component.long_name;
  }
  return '';
}

export function parseGoogleAddressComponents(
  components: GoogleAddressComponent[],
): Partial<LocationData> {
  return {
    streetAddress: [
      pick(components, 'street_number'),
      pick(components, 'route'),
    ].filter(Boolean).join(' ') || undefined,
    locality: pick(
      components,
      'sublocality_level_1',
      'sublocality',
      'neighborhood',
      'locality',
    ) || undefined,
    city: pick(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_2',
    ) || undefined,
    district: pick(components, 'administrative_area_level_2') || undefined,
    tehsil: pick(
      components,
      'administrative_area_level_3',
      'locality',
      'postal_town',
    ) || undefined,
    province: pick(components, 'administrative_area_level_1') || undefined,
    postalCode: pick(components, 'postal_code') || undefined,
    country: pick(components, 'country') || undefined,
  };
}

export function parseNominatimAddress(
  address: NominatimAddress,
): Partial<LocationData> {
  return {
    streetAddress: [address.house_number, address.road].filter(Boolean).join(' ') || undefined,
    locality: address.neighbourhood
      ?? address.suburb
      ?? address.village
      ?? address.town
      ?? undefined,
    city: address.city
      ?? address.town
      ?? address.village
      ?? undefined,
    district: address.county
      ?? address.state_district
      ?? undefined,
    tehsil: address.city_district
      ?? address.municipality
      ?? address.town
      ?? address.village
      ?? undefined,
    province: address.state ?? undefined,
    postalCode: address.postcode ?? undefined,
    country: address.country ?? undefined,
  };
}