export interface ElevationData {
  elevations: number[];
  gain: number;
  loss: number;
  maxGrade: number;
}

const OPEN_ELEVATION_URL = "https://api.open-elevation.com/api/v1/lookup";

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
  const body = {
    locations: locations.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
    })),
  };

  const response = await fetch(OPEN_ELEVATION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Open-Elevation error: ${response.status}`);

  const data = (await response.json()) as { results: { elevation: number }[] };
  if (!data.results?.length) throw new Error("No elevation results returned");

  return data.results.map((r) => r.elevation);
}

export async function getRouteElevation(
  coords: { latitude: number; longitude: number }[],
  totalDistanceMeters: number,
): Promise<ElevationData> {
  const sampled = sampleCoordinates(coords, Math.min(25, coords.length));
  const elevations = await fetchElevations(sampled);
  return computeElevationStats(elevations, totalDistanceMeters);
}

/**
 * Fetch elevation for multiple routes in a single POST request so we avoid
 * any per-request rate limits.
 */
export async function getBatchElevation(
  routeCoords: { latitude: number; longitude: number }[][],
  routeDistances: number[],
): Promise<(ElevationData | null)[]> {
  const sampledArrays = routeCoords.map((coords) =>
    sampleCoordinates(coords, Math.min(30, coords.length)),
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
