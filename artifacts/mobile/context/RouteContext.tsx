import React, { createContext, useCallback, useContext, useState } from "react";
import { GeoLocation } from "@/services/geocoding";
import { getWalkingRoutes, RouteCoord } from "@/services/routing";
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
      const osrmRoutes = await getWalkingRoutes(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      );

      const elevations = await getBatchElevation(
        osrmRoutes.map((r) => r.coordinates),
        osrmRoutes.map((r) => r.distance),
      ).catch(() => osrmRoutes.map(() => null));

      // When only 1 route: label it "Best Route" (flat id so map highlights green)
      if (osrmRoutes.length === 1) {
        const single: WalkRoute = {
          id: "flat",
          label: "Best Route",
          color: "#1B6B3A",
          coordinates: osrmRoutes[0].coordinates,
          distance: osrmRoutes[0].distance,
          duration: osrmRoutes[0].duration,
          elevationData: elevations[0],
        };
        setRoutes([single]);
        setSelectedRouteId("flat");
        return;
      }

      // 2 routes: sort by elevation gain so the flatter one is always first
      let walkRoutes: WalkRoute[] = osrmRoutes.slice(0, 2).map((r, i) => ({
        id: i === 0 ? ("flat" as const) : ("fast" as const),
        label: i === 0 ? "Flattest" : "Fastest",
        color: i === 0 ? "#1B6B3A" : "#2563EB",
        coordinates: r.coordinates,
        distance: r.distance,
        duration: r.duration,
        elevationData: elevations[i],
      }));

      // If we have elevation data, re-sort so the lower-gain route = Flattest
      const hasElev = elevations.some((e) => e !== null);
      if (hasElev) {
        // Use Number.isFinite to guard against NaN/null gain values so sort is always stable
        const safeGain = (r: (typeof walkRoutes)[0]) =>
          Number.isFinite(r.elevationData?.gain) ? r.elevationData!.gain : Infinity;
        const sorted = [...walkRoutes].sort((a, b) => safeGain(a) - safeGain(b));
        walkRoutes = [
          { ...sorted[0], id: "flat", label: "Flattest", color: "#1B6B3A" },
          { ...sorted[1], id: "fast", label: "Fastest", color: "#2563EB" },
        ];
      }

      setRoutes(walkRoutes);
      setSelectedRouteId(walkRoutes[0].id);
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
