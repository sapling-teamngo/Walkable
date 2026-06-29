export interface RouteCoord {
  latitude: number;
  longitude: number;
}

export interface OsrmRoute {
  distance: number;
  duration: number;
  coordinates: RouteCoord[];
}

const OSRM_BASE = "https://router.project-osrm.org";

export async function getWalkingRoutes(
  origin: RouteCoord,
  destination: RouteCoord,
): Promise<OsrmRoute[]> {
  const coord = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `${OSRM_BASE}/route/v1/foot/${coord}?overview=full&geometries=geojson&alternatives=true`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not connect to routing service");

  const data = (await res.json()) as any;
  if (data.code !== "Ok") {
    throw new Error(data.message || "No walking route found between these locations");
  }

  return (data.routes as any[]).map((r: any) => ({
    distance: r.distance,
    duration: r.duration,
    coordinates: (r.geometry.coordinates as [number, number][]).map(
      ([lon, lat]) => ({ latitude: lat, longitude: lon }),
    ),
  }));
}
