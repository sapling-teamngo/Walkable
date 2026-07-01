import { GeoLocation, reverseGeocode, searchPlaces } from "./geocoding";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export interface ImportResult {
  origin: GeoLocation | null;
  destination: GeoLocation | null;
}

async function expandShortUrl(shortUrl: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/expand-url?url=${encodeURIComponent(shortUrl)}`,
  );
  if (!res.ok) throw new Error("Could not expand URL");
  const data = (await res.json()) as { url: string };
  return data.url;
}

function isCoordinates(str: string): boolean {
  return /^-?\d{1,3}\.?\d*,-?\d{1,3}\.?\d*$/.test(str.trim());
}

async function resolveLocation(raw: string): Promise<GeoLocation> {
  const decoded = decodeURIComponent(raw.replace(/\+/g, " ")).trim();

  if (!decoded || decoded === "") throw new Error("Empty location string");

  if (isCoordinates(decoded)) {
    const [lat, lon] = decoded.split(",").map(Number);
    return reverseGeocode(lat, lon);
  }

  const results = await searchPlaces(decoded);
  if (results.length === 0)
    throw new Error(`Could not find location: "${decoded}"`);
  return results[0];
}

export async function parseGoogleMapsUrl(rawUrl: string): Promise<ImportResult> {
  let urlStr = rawUrl.trim();

  if (!urlStr.startsWith("http")) {
    throw new Error("Please paste a full Google Maps link starting with https://");
  }

  // Expand short links via the API server
  if (
    urlStr.includes("maps.app.goo.gl") ||
    urlStr.includes("goo.gl/maps")
  ) {
    urlStr = await expandShortUrl(urlStr);
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new Error("Not a valid URL");
  }

  // ── Format 1: ?api=1&origin=...&destination=... ──────────────────────────
  const originParam = url.searchParams.get("origin");
  const destParam = url.searchParams.get("destination");

  if (originParam && destParam) {
    const [origin, destination] = await Promise.all([
      resolveLocation(originParam),
      resolveLocation(destParam),
    ]);
    return { origin, destination };
  }

  // ── Format 2: /maps/dir/ORIGIN/DESTINATION/ ──────────────────────────────
  const pathParts = url.pathname.split("/").filter(Boolean);
  // ["maps", "dir", "Origin", "Destination"]
  if (
    pathParts[0] === "maps" &&
    pathParts[1] === "dir" &&
    pathParts.length >= 4
  ) {
    const rawOrigin = pathParts[2];
    const rawDest = pathParts[3];

    const skip = (s: string) => !s || s.startsWith("@") || s === "data";

    if (!skip(rawOrigin) && !skip(rawDest)) {
      const [origin, destination] = await Promise.all([
        resolveLocation(rawOrigin),
        resolveLocation(rawDest),
      ]);
      return { origin, destination };
    }

    // One side missing — try to get destination only
    if (!skip(rawDest)) {
      const destination = await resolveLocation(rawDest);
      return { origin: null, destination };
    }
    if (!skip(rawOrigin)) {
      const origin = await resolveLocation(rawOrigin);
      return { origin, destination: null };
    }
  }

  // ── Format 3: /maps/place/NAME/@lat,lon,zoom ─────────────────────────────
  const coordMatch = url.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    const destination = await reverseGeocode(lat, lon);
    return { origin: null, destination };
  }

  throw new Error(
    "Couldn't read this link. In Google Maps, tap Share → Copy link on a directions search.",
  );
}
