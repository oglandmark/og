import { getProperties, type ApiProperty } from '@/lib/api';

export type Project = {
  id: string;
  name: string;
  developer: string;
  location: string;
  priceRange: string;
  category: string;
  image: any;
  description: string;
  keyPoints: string[];
  features: { title: string; items: string[] }[];
  units: { name: string; price: string; area: string; bedrooms: string; bathrooms: string }[];
};

/** Convert a backend ApiProperty into a Project card for the Projects tab */
function apiToProject(p: ApiProperty): Project {
  const fmtPrice = (n: number) =>
    n >= 10_000_000 ? `PKR ${(n / 10_000_000).toFixed(1)} Crore`
    : n >= 100_000  ? `PKR ${(n / 100_000).toFixed(0)} Lakh`
    : `PKR ${n.toLocaleString()}`;

  return {
    id:          String(p.id),
    name:        p.title,
    developer:   p.sellerName ?? 'OG Landmark',
    location:    p.address ? `${p.address}, ${p.city}` : p.city,
    priceRange:  fmtPrice(p.price),
    category:    p.type,
    image:       p.images?.[0]
                   ? { uri: p.images[0] }
                   : require('@/assets/images/property-1.jpg'),
    description: p.description ?? '',
    keyPoints:   p.amenities?.slice(0, 6) ?? [],
    features:    p.amenities?.length
                   ? [{ title: 'Features', items: p.amenities }]
                   : [],
    units: [{
      name:      p.type,
      price:     fmtPrice(p.price),
      area:      `${p.area} ${p.areaUnit ?? 'Marla'}`,
      bedrooms:  p.bedrooms ? String(p.bedrooms) : '—',
      bathrooms: p.bathrooms ? String(p.bathrooms) : '—',
    }],
  };
}

/** Fetch live projects from backend. Errors deliberately propagate to the UI. */
export async function fetchProjects(): Promise<Project[]> {
  const apiProps = await getProperties({ type: 'Housing Society', limit: 50 });
  if (apiProps.length > 0) return apiProps.map(apiToProject);
  const all = await getProperties({ limit: 100 });
  const projectTypes = ['Housing Society', 'Apartment', 'Commercial'];
  return all.filter((p) => projectTypes.includes(p.type)).map(apiToProject);
}

// ── Local fallback (sample data) ──────────────────────────────────────────────
export const projects: Project[] = [
  {
    id: 'okara-model-town',
    name: 'OG Model Town Okara',
    developer: 'OG Landmark Developers',
    location: 'Canal Road, Okara City, Okara District',
    priceRange: 'PKR 38 Lakh to 1.35 Crore (sample prices)',
    category: 'Houses & Plots',
    image: require('@/assets/images/property-1.jpg'),
    description:
      'Sample project data — for demonstration purposes only. OG Model Town is a conceptual planned residential community in Okara District offering plots and ready-built houses. Wide streets, underground utilities, and round-the-clock security are among the proposed features in this sample listing.',
    keyPoints: [
      'Sample project — details shown are for demonstration only',
      'Planned underground electricity, gas, and sewerage',
      'Wide 40-foot main boulevard and 30-foot streets (proposed)',
      'Round-the-clock security with CCTV surveillance (proposed)',
      'Community park, mosque, and commercial zone within society (proposed)',
      'Located on Canal Road, Okara City',
    ],
    features: [
      {
        title: 'Society Infrastructure (Sample)',
        items: [
          'Gated Entry with Guard Post',
          'CCTV Surveillance',
          'Underground Sewerage',
          'Underground Electricity',
          'Street Lighting',
          'Carpeted Roads',
        ],
      },
      {
        title: 'Community Facilities (Sample)',
        items: [
          'Central Park & Jogging Track',
          'Masjid',
          'Community Centre',
          'Commercial Area',
          "Children's Play Area",
        ],
      },
    ],
    units: [
      { name: '5 Marla Plot',    price: 'PKR 38 Lakh (sample)',    area: '5 Marla',  bedrooms: '—', bathrooms: '—' },
      { name: '10 Marla Plot',   price: 'PKR 68 Lakh (sample)',    area: '10 Marla', bedrooms: '—', bathrooms: '—' },
      { name: '5 Marla House',   price: 'PKR 58 Lakh (sample)',    area: '5 Marla',  bedrooms: '3', bathrooms: '2' },
      { name: '10 Marla House',  price: 'PKR 95 Lakh (sample)',    area: '10 Marla', bedrooms: '4', bathrooms: '3' },
      { name: '1 Kanal House',   price: 'PKR 1.35 Crore (sample)', area: '1 Kanal',  bedrooms: '5', bathrooms: '4' },
    ],
  },
];
