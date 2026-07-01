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
const FETCH_TIMEOUT_MS = 8_000;

function toCoordStr(p: RouteCoord) {
  return `${p.longitude},${p.latitude}`;
}

async function fetchOsrmRoutes(
  waypoints: RouteCoord[],
  alternatives: boolean,
): Promise<OsrmRoute[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const coordStr = waypoints.map(toCoordStr).join(";");
    const altParam = alternatives ? "&alternatives=3" : "";
    const url =
      `${OSRM_BASE}/route/v1/foot/${coordStr}` +
      `?overview=full&geometries=geojson${altParam}`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("Routing service unavailable");

    const data = (await res.json()) as any;
    if (data.code !== "Ok") {
      throw new Error(
        data.message ?? "No walking route found between these locations",
      );
    }

    return (data.routes as any[]).map((r: any) => ({
      distance: r.distance as number,
      duration: r.duration as number,
      coordinates: (r.geometry.coordinates as [number, number][]).map(
        ([lon, lat]) => ({ latitude: lat, longitude: lon }),
      ),
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a midpoint offset perpendicular to the origin→destination line.
 * Rotating the direction vector 90° and scaling by `factor` gives a corridor
 * that forces OSRM through a genuinely different part of the street network.
 */
function perpendicularMidpoint(
  o: RouteCoord,
  d: RouteCoord,
  factor: number,
): RouteCoord {
  const midLat = (o.latitude + d.latitude) / 2;
  const midLon = (o.longitude + d.longitude) / 2;
  const dx = d.longitude - o.longitude;
  const dy = d.latitude - o.latitude;
  return {
    latitude: midLat + dx * factor,
    longitude: midLon - dy * factor,
  };
}

/** True when two routes diverge enough to be worth showing separately (~50 m). */
function routesAreDifferent(a: OsrmRoute, b: OsrmRoute): boolean {
  const midA = a.coordinates[Math.floor(a.coordinates.length / 2)];
  const midB = b.coordinates[Math.floor(b.coordinates.length / 2)];
  return (
    Math.abs(midA.latitude - midB.latitude) > 0.0004 ||
    Math.abs(midA.longitude - midB.longitude) > 0.0004
  );
}

export async function getWalkingRoutes(
  origin: RouteCoord,
  destination: RouteCoord,
): Promise<OsrmRoute[]> {
  // ── Step 1: ask OSRM for up to 3 built-in alternatives ───────────────────
  const primary = await fetchOsrmRoutes([origin, destination], true);
  const uniquePrimary = primary.filter(
    (r, i) => i === 0 || routesAreDifferent(primary[0], r),
  );
  if (uniquePrimary.length >= 2) return uniquePrimary.slice(0, 2);

  // ── Step 2: fire all 4 perpendicular via-point attempts in parallel ───────
  // (sequential retries were too slow; parallel cuts wait time by ~75 %)
  const factors = [0.005, -0.005, 0.01, -0.01];
  const directDist = primary[0]?.distance ?? Infinity;

  const attempts = await Promise.allSettled(
    factors.map((f) => {
      const via = perpendicularMidpoint(origin, destination, f);
      return fetchOsrmRoutes([origin, via, destination], false);
    }),
  );

  for (const result of attempts) {
    if (result.status !== "fulfilled" || result.value.length === 0) continue;
    const candidate = result.value[0];
    // Accept if ≤ 60 % longer than direct and genuinely different
    if (
      candidate.distance <= directDist * 1.6 &&
      (!primary[0] || routesAreDifferent(primary[0], candidate))
    ) {
      return [primary[0], candidate].filter(Boolean);
    }
  }

  // ── Step 3: graceful single-route fallback ────────────────────────────────
  return primary.slice(0, 1);
}
