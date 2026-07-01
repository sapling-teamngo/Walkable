export interface IpLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2 country code, e.g. "IN", "GB", "US" */
  countryCode: string;
}

const FALLBACK: IpLocation = {
  latitude: 48.8566,
  longitude: 2.3522,
  city: "Paris",
  country: "France",
  countryCode: "FR",
};

let _cached: IpLocation | null = null;

/**
 * Returns the user's approximate location from their IP address.
 * Uses ipapi.co — free, no API key required. Result is cached after the
 * first call so subsequent callers pay no network cost.
 */
export async function getIpLocation(): Promise<IpLocation> {
  if (_cached) return _cached;

  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return (_cached = FALLBACK);

    const data = (await res.json()) as any;

    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    if (isNaN(lat) || isNaN(lon)) return (_cached = FALLBACK);

    _cached = {
      latitude: lat,
      longitude: lon,
      city: data.city ?? "",
      country: data.country_name ?? "",
      countryCode: (data.country_code ?? "").toUpperCase(),
    };
    return _cached;
  } catch {
    return (_cached = FALLBACK);
  }
}
