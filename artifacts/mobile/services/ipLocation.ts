export interface IpLocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

const FALLBACK: IpLocation = {
  latitude: 48.8566,
  longitude: 2.3522,
  city: "Paris",
  country: "France",
};

/**
 * Returns the approximate location of the user based on their IP address.
 * Uses ipapi.co — free, no API key required.
 * Falls back to Paris if the request fails.
 */
export async function getIpLocation(): Promise<IpLocation> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return FALLBACK;

    const data = (await res.json()) as any;

    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);

    if (isNaN(lat) || isNaN(lon)) return FALLBACK;

    return {
      latitude: lat,
      longitude: lon,
      city: data.city ?? "",
      country: data.country_name ?? "",
    };
  } catch {
    return FALLBACK;
  }
}
