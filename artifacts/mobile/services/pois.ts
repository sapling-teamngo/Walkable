// ── POI types & category metadata ────────────────────────────────────────────

export type POICategory =
  | "food"
  | "shop"
  | "health"
  | "finance"
  | "lodging"
  | "tourism"
  | "leisure"
  | "entertainment"
  | "transit"
  | "worship"
  | "education"
  | "services";

export interface POICategoryMeta {
  label: string;
  icon: string; // Feather icon name
  color: string;
}

export const POI_CATEGORIES: Record<POICategory, POICategoryMeta> = {
  food:          { label: "Food & Drink",   icon: "coffee",        color: "#F97316" },
  shop:          { label: "Shopping",       icon: "shopping-bag",  color: "#8B5CF6" },
  health:        { label: "Health",         icon: "heart",         color: "#EF4444" },
  finance:       { label: "Finance",        icon: "credit-card",   color: "#3B82F6" },
  lodging:       { label: "Lodging",        icon: "home",          color: "#F59E0B" },
  tourism:       { label: "Attractions",    icon: "star",          color: "#EC4899" },
  leisure:       { label: "Parks",          icon: "sun",           color: "#22C55E" },
  entertainment: { label: "Entertainment",  icon: "film",          color: "#A855F7" },
  transit:       { label: "Transit",        icon: "navigation",    color: "#64748B" },
  worship:       { label: "Worship",        icon: "book-open",     color: "#A78BFA" },
  education:     { label: "Education",      icon: "book",          color: "#0EA5E9" },
  services:      { label: "Services",       icon: "tool",          color: "#78716C" },
};

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  latitude: number;
  longitude: number;
}

// ── Overpass API ─────────────────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function buildQuery(lat: number, lon: number, radius: number, limit: number): string {
  return `
[out:json][timeout:20];
(
  node["amenity"~"restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|bakery|marketplace|biergarten"](around:${radius},${lat},${lon});
  node["amenity"~"supermarket|convenience"](around:${radius},${lat},${lon});
  node["shop"~"supermarket|convenience|mall|department_store|clothes|shoes|electronics|books|butcher|greengrocer|hardware|sports|cosmetics|gift|jewelry|mobile_phone|hairdresser|florist"](around:${radius},${lat},${lon});
  node["amenity"~"pharmacy|hospital|clinic|doctors|dentist|veterinary"](around:${radius},${lat},${lon});
  node["amenity"~"bank|atm|bureau_de_change"](around:${radius},${lat},${lon});
  node["tourism"~"hotel|hostel|guest_house|motel|chalet|apartment"](around:${radius},${lat},${lon});
  node["tourism"~"attraction|museum|artwork|gallery|viewpoint|zoo|theme_park"](around:${radius},${lat},${lon});
  node["leisure"~"park|garden|playground|sports_centre|swimming_pool|stadium|pitch"](around:${radius},${lat},${lon});
  node["amenity"~"cinema|theatre|nightclub|casino|arts_centre|library|community_centre|gym|fitness_centre"](around:${radius},${lat},${lon});
  node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
  node["amenity"~"school|college|university|kindergarten"](around:${radius},${lat},${lon});
  node["amenity"~"post_office|police|fire_station|townhall|fuel|parking"](around:${radius},${lat},${lon});
  node["public_transport"="stop_position"]["name"](around:${radius},${lat},${lon});
  node["highway"="bus_stop"]["name"](around:${radius},${lat},${lon});
  node["railway"~"station|halt|tram_stop|subway_entrance"](around:${radius},${lat},${lon});
);
out body ${limit};
`.trim();
}

function categorizePOI(tags: Record<string, string>): POICategory {
  const a  = tags.amenity ?? "";
  const t  = tags.tourism ?? "";
  const sh = tags.shop ?? "";
  const le = tags.leisure ?? "";
  const rw = tags.railway ?? "";
  const hw = tags.highway ?? "";
  const pt = tags.public_transport ?? "";

  if (/restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|bakery|marketplace|biergarten/.test(a)) return "food";
  if (/supermarket|convenience/.test(a) || sh) return "shop";
  if (/pharmacy|hospital|clinic|doctors|dentist|veterinary/.test(a)) return "health";
  if (/bank|atm|bureau_de_change/.test(a)) return "finance";
  if (/hotel|hostel|guest_house|motel|chalet|apartment/.test(t)) return "lodging";
  if (/attraction|museum|artwork|gallery|viewpoint|zoo|theme_park/.test(t)) return "tourism";
  if (/park|garden|playground|sports_centre|swimming_pool|stadium|pitch/.test(le)) return "leisure";
  if (/cinema|theatre|nightclub|casino|arts_centre|library|community_centre|gym|fitness_centre/.test(a)) return "entertainment";
  if (a === "place_of_worship") return "worship";
  if (/school|college|university|kindergarten/.test(a)) return "education";
  if (/station|halt|tram_stop|subway_entrance/.test(rw) || hw === "bus_stop" || pt === "stop_position") return "transit";
  return "services";
}

function getPOIName(tags: Record<string, string>): string | null {
  return tags.name || tags["name:en"] || tags["brand"] || null;
}

/** Straight-line distance in metres between two lat/lon points (Haversine). */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchNearbyPOIs(
  lat: number,
  lon: number,
  radiusM = 1_500,
  limit = 80,
): Promise<POI[]> {
  const body = buildQuery(lat, lon, radiusM, limit);

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(body)}`,
  });

  if (!res.ok) throw new Error("Overpass API error");

  const data = (await res.json()) as any;
  const results: POI[] = [];

  for (const el of data.elements as any[]) {
    const tags: Record<string, string> = el.tags ?? {};
    const name = getPOIName(tags);
    if (!name) continue; // skip unnamed features

    results.push({
      id: `${el.type ?? "n"}${el.id}`,
      name,
      category: categorizePOI(tags),
      latitude: el.lat,
      longitude: el.lon,
    });
  }

  // Sort by distance from the search center
  results.sort(
    (a, b) =>
      haversineDistance(lat, lon, a.latitude, a.longitude) -
      haversineDistance(lat, lon, b.latitude, b.longitude),
  );

  return results;
}
