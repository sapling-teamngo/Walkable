export interface RouteCoord {
  latitude: number;
  longitude: number;
}

export interface OsrmRoute {
  distance: number;
  /** Walking duration in seconds — computed from distance, NOT from OSRM
   *  (the public OSRM foot endpoint returns car-speed durations ~51 km/h). */
  duration: number;
  coordinates: RouteCoord[];
}

const OSRM_BASE = "https://router.project-osrm.org";
const FETCH_TIMEOUT_MS = 8_000;

/** True walking speed used everywhere duration is computed. */
export const WALKING_MPS = 5000 / 3600; // 5 km/h ≈ 1.389 m/s

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

    return (data.routes as any[]).map((r: any) => {
      const distance = r.distance as number;
      return {
        distance,
        // OSRM public server uses car speeds for the foot profile — compute
        // the base walking duration ourselves; Naismith elevation adjustment
        // is applied later in RouteContext once elevation data is available.
        duration: Math.round(distance / WALKING_MPS),
        coordinates: (r.geometry.coordinates as [number, number][]).map(
          ([lon, lat]) => ({ latitude: lat, longitude: lon }),
        ),
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a midpoint offset perpendicular to the origin→destination line.
 * Different factors explore different sides and distances from the direct path,
 * increasing the chance of finding a genuinely flatter alternative.
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

/** Two routes are meaningfully different if their midpoints are >~45 m apart. */
function routesAreDifferent(a: OsrmRoute, b: OsrmRoute): boolean {
  const midA = a.coordinates[Math.floor(a.coordinates.length / 2)];
  const midB = b.coordinates[Math.floor(b.coordinates.length / 2)];
  return (
    Math.abs(midA.latitude - midB.latitude) > 0.0004 ||
    Math.abs(midA.longitude - midB.longitude) > 0.0004
  );
}

/**
 * Returns up to 5 meaningfully-different walking route candidates.
 *
 * Strategy:
 *  1. Ask OSRM for up to 3 built-in alternatives.
 *  2. Fire 6 perpendicular via-point detours in parallel to probe the street
 *     network on both sides and at three distance scales.
 *  3. Accept detours that are ≤ 50 % longer than the direct route and are
 *     geometrically distinct from every candidate already collected.
 *
 * The caller (RouteContext) then fetches elevation for all candidates and
 * independently picks the flattest and the shortest.
 */
export async function getWalkingRoutes(
  origin: RouteCoord,
  destination: RouteCoord,
): Promise<OsrmRoute[]> {
  // ── Step 1: built-in OSRM alternatives ──────────────────────────────────
  const primary = await fetchOsrmRoutes([origin, destination], true);
  if (primary.length === 0) throw new Error("No route found");

  const candidates: OsrmRoute[] = [primary[0]];
  for (let i = 1; i < primary.length; i++) {
    if (routesAreDifferent(candidates[0], primary[i])) {
      candidates.push(primary[i]);
    }
  }

  if (candidates.length >= 4) return candidates.slice(0, 4);

  // ── Step 2: perpendicular via-point probes (parallel) ────────────────────
  // Six factors: two distances (medium/large) on each of three sides
  const factors = [0.004, -0.004, 0.008, -0.008, 0.013, -0.013];
  const directDist = primary[0].distance;

  const attempts = await Promise.allSettled(
    factors.map((f) => {
      const via = perpendicularMidpoint(origin, destination, f);
      return fetchOsrmRoutes([origin, via, destination], false);
    }),
  );

  for (const result of attempts) {
    if (result.status !== "fulfilled" || !result.value.length) continue;
    const c = result.value[0];
    // Accept if ≤ 50 % longer than direct and distinct from all collected
    if (
      c.distance <= directDist * 1.5 &&
      candidates.every((existing) => routesAreDifferent(existing, c))
    ) {
      candidates.push(c);
      if (candidates.length >= 5) break;
    }
  }

  return candidates;
}
