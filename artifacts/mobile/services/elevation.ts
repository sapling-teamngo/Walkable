export interface ElevationData {
  elevations: number[];
  gain: number;
  loss: number;
  maxGrade: number;
}

// Open-Topo-Data: free, more reliable than Open-Elevation, SRTM 30m resolution.
// Batch limit: 100 locations per request. We cap each route at 20 samples so
// 5 routes × 20 = 100 points fit in one request.
const OPENTOPODATA_URL = "https://api.opentopodata.org/v1/srtm30m";
const ELEVATION_TIMEOUT_MS = 12_000;
const MAX_SAMPLES_PER_ROUTE = 20;

function sampleCoordinates<T extends { latitude: number; longitude: number }>(
  coords: T[],
  numSamples: number,
): T[] {
  if (coords.length <= numSamples) return coords;
  const step = (coords.length - 1) / (numSamples - 1);
  return Array.from({ length: numSamples }, (_, i) => coords[Math.round(i * step)]);
}

function computeElevationStats(
  elevations: number[],
  totalDistanceMeters: number,
): ElevationData {
  let gain = 0;
  let loss = 0;
  let maxGrade = 0;
  const segDist = totalDistanceMeters / Math.max(elevations.length - 1, 1);

  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1];
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);
    const grade = segDist > 0 ? (Math.abs(diff) / segDist) * 100 : 0;
    if (grade > maxGrade) maxGrade = grade;
  }

  return {
    elevations,
    gain: Math.round(gain),
    loss: Math.round(loss),
    maxGrade: Math.round(maxGrade * 10) / 10,
  };
}

async function fetchElevations(
  locations: { latitude: number; longitude: number }[],
): Promise<number[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ELEVATION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENTOPODATA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        locations: locations.map((l) => ({
          latitude: l.latitude,
          longitude: l.longitude,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Open-Topo-Data error: ${response.status}`);

    const data = (await response.json()) as {
      status: string;
      results: { elevation: number }[];
    };

    if (data.status !== "OK" || !data.results?.length) {
      throw new Error("No elevation results returned");
    }

    return data.results.map((r) => r.elevation ?? 0);
  } finally {
    clearTimeout(timer);
  }
}

export async function getRouteElevation(
  coords: { latitude: number; longitude: number }[],
  totalDistanceMeters: number,
): Promise<ElevationData> {
  const sampled = sampleCoordinates(coords, Math.min(MAX_SAMPLES_PER_ROUTE, coords.length));
  const elevations = await fetchElevations(sampled);
  return computeElevationStats(elevations, totalDistanceMeters);
}

/**
 * Fetch elevation for multiple routes in a single POST request.
 * Open-Topo-Data allows max 100 locations/request; with MAX_SAMPLES_PER_ROUTE=20
 * this handles up to 5 routes per call without chunking.
 */
export async function getBatchElevation(
  routeCoords: { latitude: number; longitude: number }[][],
  routeDistances: number[],
): Promise<(ElevationData | null)[]> {
  const sampledArrays = routeCoords.map((coords) =>
    sampleCoordinates(coords, Math.min(MAX_SAMPLES_PER_ROUTE, coords.length)),
  );

  const allPoints = sampledArrays.flat();
  if (allPoints.length === 0) return routeCoords.map(() => null);

  const allElevations = await fetchElevations(allPoints);

  const results: (ElevationData | null)[] = [];
  let offset = 0;

  for (let i = 0; i < sampledArrays.length; i++) {
    const count = sampledArrays[i].length;
    const slice = allElevations.slice(offset, offset + count);
    offset += count;

    if (slice.length < 2) {
      results.push(null);
    } else {
      results.push(computeElevationStats(slice, routeDistances[i]));
    }
  }

  return results;
}
