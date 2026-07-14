import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { GeoLocation } from "@/services/geocoding";
import { getWalkingRoutes, RouteCoord, RouteStep } from "@/services/routing";
import { ElevationData, getBatchElevation } from "@/services/elevation";

// ── Pace ─────────────────────────────────────────────────────────────────────

export type Pace = "slow" | "normal" | "fast";

export const PACE_OPTIONS: Record<
  Pace,
  { label: string; speedMPS: number; description: string }
> = {
  slow:   { label: "Slow",   speedMPS: 3.5 / 3.6, description: "3.5 km/h" },
  normal: { label: "Normal", speedMPS: 5.0 / 3.6, description: "5.0 km/h" },
  fast:   { label: "Fast",   speedMPS: 6.5 / 3.6, description: "6.5 km/h" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WalkRoute {
  id: "flat" | "fast";
  label: string;
  color: string;
  coordinates: RouteCoord[];
  distance: number;
  duration: number;
  elevationData: ElevationData | null;
  steps: RouteStep[];
}

interface RouteContextType {
  origin: GeoLocation | null;
  destination: GeoLocation | null;
  routes: WalkRoute[];
  selectedRouteId: "flat" | "fast";
  isLoading: boolean;
  error: string | null;
  pace: Pace;
  setOrigin: (loc: GeoLocation | null) => void;
  setDestination: (loc: GeoLocation | null) => void;
  setSelectedRouteId: (id: "flat" | "fast") => void;
  setPace: (pace: Pace) => void;
  searchRoutes: () => Promise<void>;
  clearAll: () => void;
}

const RouteContext = createContext<RouteContextType | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Naismith's walking rule adjusted for pace:
 *   base time  = distance / pace speed
 *   climb time = 6 seconds per metre of ascent
 */
function naisimthDuration(
  distanceMeters: number,
  gainMeters: number,
  pace: Pace,
): number {
  return Math.round(
    distanceMeters / PACE_OPTIONS[pace].speedMPS + gainMeters * 6,
  );
}

/** Elevation gain for a candidate, defaulting to Infinity when unknown. */
function safeGain(elev: ElevationData | null): number {
  return Number.isFinite(elev?.gain) ? elev!.gain : Infinity;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState<GeoLocation | null>(null);
  const [destination, setDestination] = useState<GeoLocation | null>(null);
  const [routes, setRoutes] = useState<WalkRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<"flat" | "fast">("flat");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pace, setPaceState] = useState<Pace>("normal");

  // Stable ref so searchRoutes always reads the latest pace without needing
  // it as a dependency (avoids retriggering ongoing searches on pace change)
  const paceRef = useRef<Pace>("normal");

  const setPace = useCallback((p: Pace) => {
    paceRef.current = p;
    setPaceState(p);
  }, []);

  // When pace changes, recompute durations for existing routes without refetching.
  // paceRef.current is synchronously updated by setPace before this effect fires.
  useEffect(() => {
    const p = paceRef.current;
    setRoutes((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((r) => ({
        ...r,
        duration: r.elevationData
          ? naisimthDuration(r.distance, r.elevationData.gain, p)
          : Math.round(r.distance / PACE_OPTIONS[p].speedMPS),
      }));
    });
  }, [pace]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchRoutes = useCallback(async () => {
    if (!origin || !destination) return;
    setIsLoading(true);
    setError(null);
    setRoutes([]);

    try {
      // 1. Get up to 5 geometrically-distinct route candidates from OSRM
      const osrmRoutes = await getWalkingRoutes(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      );

      // 2. Fetch elevation for all candidates in one batch request
      const elevations = await getBatchElevation(
        osrmRoutes.map((r) => r.coordinates),
        osrmRoutes.map((r) => r.distance),
      ).catch(() => osrmRoutes.map(() => null));

      // 3. Build enriched candidates with Naismith-corrected durations
      type Candidate = {
        coordinates: RouteCoord[];
        distance: number;
        duration: number;
        elevationData: ElevationData | null;
        steps: RouteStep[];
      };

      const activePace = paceRef.current;
      const candidates: Candidate[] = osrmRoutes.map((r, i) => {
        const elev = elevations[i];
        return {
          coordinates: r.coordinates,
          distance: r.distance,
          duration: elev
            ? naisimthDuration(r.distance, elev.gain, activePace)
            : Math.round(r.distance / PACE_OPTIONS[activePace].speedMPS),
          elevationData: elev,
          steps: r.steps,
        };
      });

      // 4. Pick the FLATTEST route: minimise elevation gain, within 1.5× shortest
      const shortestDist = Math.min(...candidates.map((c) => c.distance));
      const eligible = candidates.filter((c) => c.distance <= shortestDist * 1.5);
      const flattest = eligible.reduce((a, b) =>
        safeGain(a.elevationData) <= safeGain(b.elevationData) ? a : b,
      );

      // 5. Pick the SHORTEST route
      const shortest = candidates.reduce((a, b) =>
        a.distance <= b.distance ? a : b,
      );

      // 6. Build WalkRoute objects
      const flattestRoute: WalkRoute = {
        id: "flat",
        label: "Flattest",
        color: "#1B6B3A",
        coordinates: flattest.coordinates,
        distance: flattest.distance,
        duration: flattest.duration,
        elevationData: flattest.elevationData,
        steps: flattest.steps,
      };

      const shortestRoute: WalkRoute = {
        id: "fast",
        label: "Shortest",
        color: "#2563EB",
        coordinates: shortest.coordinates,
        distance: shortest.distance,
        duration: shortest.duration,
        elevationData: shortest.elevationData,
        steps: shortest.steps,
      };

      setRoutes([flattestRoute, shortestRoute]);
      setSelectedRouteId("flat");
    } catch (e: any) {
      setError(e.message || "Could not find a route. Try different locations.");
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination]);

  const clearAll = useCallback(() => {
    setOrigin(null);
    setDestination(null);
    setRoutes([]);
    setError(null);
  }, []);

  return (
    <RouteContext.Provider
      value={{
        origin,
        destination,
        routes,
        selectedRouteId,
        isLoading,
        error,
        pace,
        setOrigin,
        setDestination,
        setSelectedRouteId,
        setPace,
        searchRoutes,
        clearAll,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error("useRoute must be used within RouteProvider");
  return ctx;
}
