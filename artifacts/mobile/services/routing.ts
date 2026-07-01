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

function toOsrmCoord(p: RouteCoord) {
  return `${p.longitude},${p.latitude}`;
}

async function fetchOsrmRoutes(
  waypoints: RouteCoord[],
  alternatives: boolean,
): Promise<OsrmRoute[]> {
  const coordStr = waypoints.map(toOsrmCoord).join(";");
  const altParam = alternatives ? "&alternatives=3" : "";
  const url =
    `${OSRM_BASE}/route/v1/foot/${coordStr}` +
    `?overview=full&geometries=geojson${altParam}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");

  const data = (await res.json()) as any;
  if (data.code !== "Ok") {
    throw new Error(data.message ?? "No walking route found between these locations");
  }

  return (data.routes as any[]).map((r: any) => ({
    distance: r.distance as number,
    duration: r.duration as number,
    coordinates: (r.geometry.coordinates as [number, number][]).map(
      ([lon, lat]) => ({ latitude: lat, longitude: lon }),
    ),
  }));
}

/**
 * Returns a midpoint offset perpendicular to the origin→destination line.
 * This forces OSRM to route via a different corridor, producing a genuine
 * second route even when the direct path has no OSRM alternatives.
 */
function perpendicularMidpoint(
  o: RouteCoord,
  d: RouteCoord,
  factor: number,
): RouteCoord {
  const midLat = (o.latitude + d.latitude) / 2;
  const midLon = (o.longitude + d.longitude) / 2;
  // Rotate the direction vector 90° and scale by factor
  const dx = d.longitude - o.longitude;
  const dy = d.latitude - o.latitude;
  return {
    latitude: midLat + dx * factor,
    longitude: midLon - dy * factor,
  };
}

function coordsAreDifferent(a: OsrmRoute, b: OsrmRoute): boolean {
  // Routes are meaningfully different if their midpoints differ by > ~50m
  const midA = a.coordinates[Math.floor(a.coordinates.length / 2)];
  const midB = b.coordinates[Math.floor(b.coordinates.length / 2)];
  const dlat = Math.abs(midA.latitude - midB.latitude);
  const dlon = Math.abs(midA.longitude - midB.longitude);
  return dlat > 0.0004 || dlon > 0.0004; // ~44m in each axis
}

export async function getWalkingRoutes(
  origin: RouteCoord,
  destination: RouteCoord,
): Promise<OsrmRoute[]> {
  // ── Step 1: ask OSRM for up to 3 alternatives ────────────────────────────
  const primary = await fetchOsrmRoutes([origin, destination], true);

  const unique = primary.filter(
    (r, i) => i === 0 || coordsAreDifferent(primary[0], r),
  );

  if (unique.length >= 2) return unique.slice(0, 2);

  // ── Step 2: force a second path via perpendicular via-points ─────────────
  const factors = [0.005, -0.005, 0.01, -0.01];

  for (const factor of factors) {
    try {
      const via = perpendicularMidpoint(origin, destination, factor);
      const alt = await fetchOsrmRoutes([origin, via, destination], false);

      if (alt.length > 0) {
        const candidate = alt[0];
        const directDist = primary[0].distance;

        // Accept if the alternate is at most 60% longer than the direct route
        if (
          candidate.distance <= directDist * 1.6 &&
          coordsAreDifferent(primary[0], candidate)
        ) {
          return [primary[0], candidate];
        }
      }
    } catch {
      // Try next factor
    }
  }

  // ── Step 3: return what we have (may be just 1 route) ────────────────────
  return primary.slice(0, 1);
}
