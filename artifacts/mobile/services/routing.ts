export interface RouteCoord {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  instruction: string;
  distance: number; // metres
  icon: string; // Feather icon name
}

export interface OsrmRoute {
  distance: number;
  /** Walking duration in seconds — computed from distance, NOT from OSRM
   *  (the public OSRM foot endpoint returns car-speed durations ~51 km/h). */
  duration: number;
  coordinates: RouteCoord[];
  steps: RouteStep[];
}

const OSRM_BASE = "https://router.project-osrm.org";
const FETCH_TIMEOUT_MS = 8_000;

/** True walking speed used everywhere duration is computed. */
export const WALKING_MPS = 5000 / 3600; // 5 km/h ≈ 1.389 m/s

function toCoordStr(p: RouteCoord) {
  return `${p.longitude},${p.latitude}`;
}

// ── Step parsing ──────────────────────────────────────────────────────────────

function parseOsrmStep(step: any): RouteStep {
  const maneuver = step.maneuver ?? {};
  const type: string = maneuver.type ?? "";
  const modifier: string = maneuver.modifier ?? "";
  const name: string = step.name ?? "";
  const distance = Math.round(step.distance ?? 0);

  let instruction: string;
  let icon = "arrow-up";

  if (type === "depart") {
    instruction = name ? `Head towards ${name}` : "Depart";
    icon = "navigation";
  } else if (type === "arrive") {
    instruction = "Arrive at destination";
    icon = "map-pin";
  } else if (type === "turn" || type === "end of road") {
    if (modifier === "sharp left" || modifier === "left") {
      instruction = name ? `Turn left onto ${name}` : "Turn left";
      icon = "corner-up-left";
    } else if (modifier === "sharp right" || modifier === "right") {
      instruction = name ? `Turn right onto ${name}` : "Turn right";
      icon = "corner-up-right";
    } else if (modifier === "slight left") {
      instruction = name ? `Bear left onto ${name}` : "Bear left";
      icon = "corner-up-left";
    } else if (modifier === "slight right") {
      instruction = name ? `Bear right onto ${name}` : "Bear right";
      icon = "corner-up-right";
    } else if (modifier === "uturn") {
      instruction = "Make a U-turn";
      icon = "repeat";
    } else {
      instruction = name ? `Continue onto ${name}` : "Continue straight";
      icon = "arrow-up";
    }
  } else if (type === "continue" || type === "new name") {
    instruction = name ? `Continue on ${name}` : "Continue straight";
    icon = "arrow-up";
  } else if (type === "merge") {
    instruction = name ? `Merge onto ${name}` : "Merge";
    icon = "git-merge";
  } else if (type === "roundabout" || type === "rotary") {
    const exit = maneuver.exit ? ` (exit ${maneuver.exit})` : "";
    instruction = name ? `Take the roundabout onto ${name}${exit}` : `Take the roundabout${exit}`;
    icon = "refresh-cw";
  } else if (type === "fork") {
    if (modifier?.includes("left")) {
      instruction = name ? `Keep left onto ${name}` : "Keep left";
      icon = "corner-up-left";
    } else {
      instruction = name ? `Keep right onto ${name}` : "Keep right";
      icon = "corner-up-right";
    }
  } else {
    instruction = name ? `Continue on ${name}` : "Continue";
    icon = "arrow-up";
  }

  return { instruction, distance, icon };
}

function extractSteps(legs: any[]): RouteStep[] {
  const raw: any[] = [];

  for (let legIdx = 0; legIdx < legs.length; legIdx++) {
    const legSteps: any[] = legs[legIdx]?.steps ?? [];
    for (const step of legSteps) {
      const mType = step.maneuver?.type ?? "";
      // Skip intermediate arrive/depart at via-points (only keep first depart + last arrive)
      if (mType === "arrive" && legIdx < legs.length - 1) continue;
      if (mType === "depart" && legIdx > 0) continue;
      // Skip very short steps (< 10m) except depart/arrive
      if (step.distance < 10 && mType !== "depart" && mType !== "arrive") continue;
      raw.push(step);
    }
  }

  return raw.map(parseOsrmStep);
}

// ── Core fetch ────────────────────────────────────────────────────────────────

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
      `?overview=full&geometries=geojson&steps=true${altParam}`;

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
      const legs: any[] = r.legs ?? [];
      return {
        distance,
        duration: Math.round(distance / WALKING_MPS),
        coordinates: (r.geometry.coordinates as [number, number][]).map(
          ([lon, lat]) => ({ latitude: lat, longitude: lon }),
        ),
        steps: extractSteps(legs),
      };
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Returns a midpoint offset perpendicular to the origin→destination line.
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns up to 5 meaningfully-different walking route candidates.
 *
 * Strategy:
 *  1. Ask OSRM for up to 3 built-in alternatives.
 *  2. Fire 6 perpendicular via-point detours in parallel to probe the street
 *     network on both sides and at three distance scales.
 *  3. Accept detours that are ≤ 50 % longer than the direct route and are
 *     geometrically distinct from every candidate already collected.
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
