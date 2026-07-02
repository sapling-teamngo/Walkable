import React, { createContext, useCallback, useContext, useState } from "react";
import { GeoLocation } from "@/services/geocoding";
import { getWalkingRoutes, RouteCoord, WALKING_MPS } from "@/services/routing";
import { ElevationData, getBatchElevation } from "@/services/elevation";

export interface WalkRoute {
  id: "flat" | "fast";
  label: string;
  color: string;
  coordinates: RouteCoord[];
  distance: number;
  duration: number;
  elevationData: ElevationData | null;
}

interface RouteContextType {
  origin: GeoLocation | null;
  destination: GeoLocation | null;
  routes: WalkRoute[];
  selectedRouteId: "flat" | "fast";
  isLoading: boolean;
  error: string | null;
  setOrigin: (loc: GeoLocation | null) => void;
  setDestination: (loc: GeoLocation | null) => void;
  setSelectedRouteId: (id: "flat" | "fast") => void;
  searchRoutes: () => Promise<void>;
  clearAll: () => void;
}

const RouteContext = createContext<RouteContextType | null>(null);

/**
 * Naismith's walking rule:
 *   base time  = distance / walking speed (5 km/h)
 *   climb time = 6 seconds per metre of ascent
 *
 * This gives realistic estimates like:
 *   5 km flat   → ~60 min
 *   5 km + 200m → ~82 min
 */
function naisimthDuration(distanceMeters: number, gainMeters: number): number {
  return Math.round(distanceMeters / WALKING_MPS + gainMeters * 6);
}

/** Elevation gain for a candidate, defaulting to Infinity when unknown
 *  so routes without data always sort after those with data. */
function safeGain(elev: ElevationData | null): number {
  return Number.isFinite(elev?.gain) ? elev!.gain : Infinity;
}

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState<GeoLocation | null>(null);
  const [destination, setDestination] = useState<GeoLocation | null>(null);
  const [routes, setRoutes] = useState<WalkRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<"flat" | "fast">("flat");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      };

      const candidates: Candidate[] = osrmRoutes.map((r, i) => {
        const elev = elevations[i];
        return {
          coordinates: r.coordinates,
          distance: r.distance,
          duration: elev
            ? naisimthDuration(r.distance, elev.gain)
            : Math.round(r.distance / WALKING_MPS),
          elevationData: elev,
        };
      });

      // 4. Pick the FLATTEST route: minimise elevation gain, within 1.5× the
      //    shortest distance so the flattest path doesn't become absurdly long.
      const shortestDist = Math.min(...candidates.map((c) => c.distance));
      const eligible = candidates.filter(
        (c) => c.distance <= shortestDist * 1.5,
      );
      const flattest = eligible.reduce((a, b) =>
        safeGain(a.elevationData) <= safeGain(b.elevationData) ? a : b,
      );

      // 5. Pick the SHORTEST route: minimise total walking distance.
      const shortest = candidates.reduce((a, b) =>
        a.distance <= b.distance ? a : b,
      );

      // 6. Build the two WalkRoute objects.
      //    If flattest === shortest (same candidate), both cards show it —
      //    the user asked for this explicitly so they can compare metrics.
      const flattestRoute: WalkRoute = {
        id: "flat",
        label: "Flattest",
        color: "#1B6B3A",
        coordinates: flattest.coordinates,
        distance: flattest.distance,
        duration: flattest.duration,
        elevationData: flattest.elevationData,
      };

      const shortestRoute: WalkRoute = {
        id: "fast",
        label: "Shortest",
        color: "#2563EB",
        coordinates: shortest.coordinates,
        distance: shortest.distance,
        duration: shortest.duration,
        elevationData: shortest.elevationData,
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
        setOrigin,
        setDestination,
        setSelectedRouteId,
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
