export interface GeoLocation {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

interface SearchBias {
  lat: number;
  lon: number;
  /** ISO 3166-1 alpha-2, e.g. "IN". Used to restrict Nominatim fallback. */
  countryCode: string;
}

let _bias: SearchBias | null = null;

export function setSearchBias(lat: number, lon: number, countryCode = "") {
  _bias = { lat, lon, countryCode };
}

// ── Photon (primary) ─────────────────────────────────────────────────────────
// Photon uses Elasticsearch on top of OSM data.
// • Fuzzy matching built-in
// • Multilingual (Arabic, CJK, Hebrew, transliterations, …)
// • lat/lon + zoom bias: zoom ≈ 10 gives country-scale locality preference
//   while still showing world results when nothing local matches.
// • Every result is a real OSM node/way, so it always renders on the map.

async function searchPhoton(query: string): Promise<GeoLocation[]> {
  const params = new URLSearchParams({ q: query, limit: "8" });

  if (_bias) {
    params.set("lat", _bias.lat.toString());
    params.set("lon", _bias.lon.toString());
    // zoom 10 ≈ city/region scale — local results float to the top without
    // hiding genuinely better matches from other countries.
    params.set("zoom", "10");
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

// ── Nominatim (fallback) ──────────────────────────────────────────────────────

async function searchNominatim(query: string): Promise<GeoLocation[]> {
  const isArabic = /[\u0600-\u06FF]/.test(query);

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "7",
    addressdetails: "0",
  });

  // Bias toward user's country so local results rank first
  if (_bias?.countryCode) {
    params.set("countrycodes", _bias.countryCode.toLowerCase());
  }

  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: {
      "Accept-Language": isArabic ? "ar,en" : "en,*",
      "User-Agent": "WalkableApp/1.0 (pedestrian-routing)",
    },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as any[];

  // If countrycodes filter returned nothing, retry without restriction
  if (data.length === 0 && _bias?.countryCode) {
    params.delete("countrycodes");
    const retry = await fetch(`${NOMINATIM_URL}/search?${params}`, {
      headers: {
        "Accept-Language": isArabic ? "ar,en" : "en,*",
        "User-Agent": "WalkableApp/1.0 (pedestrian-routing)",
      },
    });
    if (!retry.ok) return [];
    const retryData = (await retry.json()) as any[];
    return retryData.map((item: any) => nominatimToGeo(item));
  }

  return data.map((item: any) => nominatimToGeo(item));
}

function nominatimToGeo(item: any): GeoLocation {
  return {
    id: item.place_id.toString(),
    name: item.display_name.split(",").slice(0, 2).join(", ").trim(),
    displayName: item.display_name,
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  try {
    const results = await searchPhoton(q);
    if (results.length > 0) return results;
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
    const url = `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json`;
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
