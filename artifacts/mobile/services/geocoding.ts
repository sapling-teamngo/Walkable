export interface GeoLocation {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

const BASE_URL = "https://nominatim.openstreetmap.org";

export async function searchPlaces(query: string): Promise<GeoLocation[]> {
  if (!query.trim() || query.length < 3) return [];
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
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
  } catch {
    return [];
  }
}
