export interface ElevationData {
  elevations: number[];
  gain: number;
  loss: number;
  maxGrade: number;
}

const TOPO_BASE = "https://api.opentopodata.org/v1/srtm90m";

function sampleCoordinates<T extends { latitude: number; longitude: number }>(
  coords: T[],
  numSamples: number,
): T[] {
  if (coords.length <= numSamples) return coords;
  const step = (coords.length - 1) / (numSamples - 1);
  return Array.from({ length: numSamples }, (_, i) => coords[Math.round(i * step)]);
}

export async function getRouteElevation(
  coords: { latitude: number; longitude: number }[],
  totalDistanceMeters: number,
): Promise<ElevationData> {
  const sampled = sampleCoordinates(coords, Math.min(20, coords.length));
  const locations = sampled.map((c) => `${c.latitude},${c.longitude}`).join("|");
  const url = `${TOPO_BASE}?locations=${locations}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Elevation data unavailable");

  const data = (await response.json()) as any;
  if (data.status !== "OK") throw new Error("Elevation API error");

  const elevations: number[] = data.results.map((r: any) => r.elevation as number);

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
