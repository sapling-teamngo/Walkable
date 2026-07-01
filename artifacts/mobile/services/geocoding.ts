export interface GeoLocation {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

// Bias coordinates set once from IP location — improves local relevance
let _biasLat: number | null = null;
let _biasLon: number | null = null;

export function setSearchBias(lat: number, lon: number) {
  _biasLat = lat;
  _biasLon = lon;
}

// ── Photon (primary) ────────────────────────────────────────────────────────
// Photon is built on OpenStreetMap + Elasticsearch. It has fuzzy matching,
// multilingual support (Arabic, CJK, etc.), and location-biasing built in.
// Every result maps to a real OSM feature, so it always appears on the map.

async function searchPhoton(query: string): Promise<GeoLocation[]> {
  const params = new URLSearchParams({ q: query, limit: "7" });

  if (_biasLat !== null && _biasLon !== null) {
    params.set("lat", _biasLat.toString());
    params.set("lon", _biasLon.toString());
  }

  const res = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { "User-Agent": "WalkableApp/1.0 (pedestrian-routing)" },
  });
  if (!res.ok) throw new Error("Photon unavailable");

  const data = (await res.json()) as any;
  const results: GeoLocation[] = [];

  for (const f of data.features as any[]) {
    const p = f.properties ?? {};
    const [lon, lat] = f.geometry.coordinates as [number, number];

    // Build a human-readable primary name
    const streetAddr =
      p.housenumber && p.street
        ? `${p.housenumber} ${p.street}`
        : p.street ?? null;

    const primaryName =
      p.name ||
      streetAddr ||
      p.city ||
      p.town ||
      p.village ||
      p.county ||
      p.country ||
      null;

    if (!primaryName) continue;

    const locationParts = [
      p.city || p.town || p.village,
      p.state,
      p.country,
    ].filter(Boolean);

    const displayName = [primaryName, ...locationParts]
      .filter(Boolean)
      .join(", ");

    results.push({
      id: `${p.osm_type ?? "N"}${p.osm_id ?? `${lat},${lon}`}`,
      name: primaryName,
      displayName,
      latitude: lat,
      longitude: lon,
    });
  }

  return results;
}

// ── Nominatim (fallback) ────────────────────────────────────────────────────

async function searchNominatim(query: string): Promise<GeoLocation[]> {
  const isArabic = /[\u0600-\u06FF]/.test(query);

  const url =
    `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}` +
    `&format=json&limit=7&addressdetails=0`;

  const res = await fetch(url, {
    headers: {
      "Accept-Language": isArabic ? "ar,en" : "en,*",
      "User-Agent": "WalkableApp/1.0 (pedestrian-routing)",
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as any[];
  return data.map((item: any) => ({
    id: item.place_id.toString(),
    name: item.display_name.split(",").slice(0, 2).join(", ").trim(),
    displayName: item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  try {
    const results = await searchPhoton(q);
    if (results.length > 0) return results;
    // Photon returned nothing — try Nominatim as fallback
    return await searchNominatim(q);
  } catch {
    try {
      return await searchNominatim(q);
    } catch {
      return [];
    }
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeoLocation> {
  try {
    const url =
      `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "WalkableApp/1.0 (pedestrian-routing)",
      },
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = (await res.json()) as any;
    return {
      id: data.place_id?.toString() ?? `${latitude},${longitude}`,
      name:
        data.display_name?.split(",").slice(0, 2).join(", ").trim() ??
        "My Location",
      displayName: data.display_name ?? "My Location",
      latitude,
      longitude,
    };
  } catch {
    return {
      id: `${latitude},${longitude}`,
      name: "My Location",
      displayName: "My Location",
      latitude,
      longitude,
    };
  }
}
