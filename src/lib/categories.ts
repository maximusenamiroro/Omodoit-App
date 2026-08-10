// Single source of truth for category + subcategory names, used across
// the whole app: category browsing, worker registration, and Flash Job
// requests. This used to be defined independently in four different
// screens, and had drifted out of sync in real ways — e.g. a worker
// could not register as "Mechanic" or "Barber" even though a client
// could request exactly those via Flash Job, and one screen used
// "Construction" while every other screen used "Construction & Real
// Estate", meaning any worker who registered under the short name
// would silently never appear in searches filtered by the full name.
//
// Keep this as the ONLY place category/subcategory names are defined.
// Anything that needs to show or filter by category should import from
// here rather than defining its own list.

export interface CategoryDef {
  name: string;
  emoji: string;
  color: string;
  subs: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    name: 'Handwork & Skilled Workers',
    emoji: '🛠️',
    color: '#16a34a',
    subs: ['Electrician', 'Plumber', 'Carpenter', 'Mechanic', 'Welder', 'Tailor',
      'Painter', 'Barber', 'Hair Stylist', 'AC Repair', 'Phone Repair',
      'Computer Repair', 'Solar Installer', 'Generator Repair', 'Tiler', 'Mason'],
  },
  {
    name: 'Food & Restaurant',
    emoji: '🍔',
    color: '#F97316',
    subs: ['Caterer', 'Home Chef', 'Baker', 'Restaurant', 'Fast Food',
      'Food Vendor', 'Cake Shop', 'Drinks Vendor'],
  },
  {
    name: 'Hotel & Accommodation',
    emoji: '🏨',
    color: '#8B5CF6',
    subs: ['Hotel', 'Shortlet Apartment', 'Guest House', 'Event Center', 'Lodge'],
  },
  {
    name: 'Transport & Logistics',
    emoji: '🚗',
    color: '#3B82F6',
    subs: ['Driver', 'Dispatch Rider', 'Taxi', 'Car Hire', 'Moving Service',
      'Courier', 'Logistics', 'Haulage'],
  },
  {
    name: 'Beauty & Fashion',
    emoji: '💄',
    color: '#D946EF',
    subs: ['Makeup Artist', 'Hair Stylist', 'Salon', 'Fashion Designer',
      'Nail Tech', 'Spa', 'Wig Seller'],
  },
  {
    name: 'Health & Medical',
    emoji: '💊',
    color: '#EF4444',
    subs: ['Nurse', 'Physiotherapist', 'Pharmacist', 'Caregiver', 'Lab Tech',
      'Clinic', 'Dental Clinic'],
  },
  {
    name: 'Retail & Shops',
    emoji: '🛍️',
    color: '#EAB308',
    subs: ['General Store', 'Supermarket', 'Phone Accessories', 'Electronics',
      'Clothing Store', 'Hardware Store', 'Auto Parts'],
  },
  {
    name: 'Construction & Real Estate',
    emoji: '🏗️',
    color: '#78716C',
    subs: ['Builder', 'Building Contractor', 'Real Estate Agent', 'Architect',
      'Surveyor', 'Interior Design', 'Roofing', 'Civil Engineer'],
  },
  {
    name: 'Media & Event Services',
    emoji: '🎥',
    color: '#06B6D4',
    subs: ['Photographer', 'Videographer', 'DJ', 'Event Planner', 'MC'],
  },
  {
    name: 'Technology & IT',
    emoji: '💻',
    color: '#6366F1',
    subs: ['Software Developer', 'Web Developer', 'IT Support', 'Computer Store',
      'CCTV Install', 'Networking'],
  },
  {
    name: 'Home & Personal Services',
    emoji: '🏠',
    color: '#14B8A6',
    subs: ['Laundry', 'Cleaning Service', 'Caregiver', 'Pest Control', 'Home Chef'],
  },
  {
    name: 'Agriculture & Farming',
    emoji: '🌾',
    color: '#84CC16',
    subs: ['Poultry', 'Fish Farm', 'Crop Farming', 'Farm Produce Seller'],
  },
  {
    name: 'Wholesale & Trade',
    emoji: '💼',
    color: '#F59E0B',
    subs: ['Wholesaler', 'Distributor', 'Importer/Exporter', 'Market Trader'],
  },
  {
    name: 'Other Business',
    emoji: '📦',
    color: '#9CA3AF',
    subs: ['Other'],
  },
];

export function findCategory(name: string | null | undefined): CategoryDef | undefined {
  if (!name) return undefined;
  return CATEGORIES.find(c => c.name === name);
}

// Best-effort match for old/inconsistent data already in the database
// (e.g. a profile saved with the short name "Construction" before this
// file existed) — falls back to a partial match so existing users
// aren't left with a category that resolves to nothing.
export function findCategoryLoose(name: string | null | undefined): CategoryDef | undefined {
  if (!name) return undefined;
  const exact = findCategory(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return CATEGORIES.find(c =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase().split(' ')[0])
  );
}
