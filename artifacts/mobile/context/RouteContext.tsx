import React, { createContext, useCallback, useContext, useState } from "react";
import { GeoLocation } from "@/services/geocoding";
import { getWalkingRoutes, RouteCoord } from "@/services/routing";
import { ElevationData, getRouteElevation } from "@/services/elevation";

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

      const elevationPromises = osrmRoutes.map((r) =>
        getRouteElevation(r.coordinates, r.distance).catch(() => null),
      );
      const elevations = await Promise.all(elevationPromises);

      let walkRoutes: WalkRoute[] = osrmRoutes.map((r, i) => ({
        id: i === 0 ? ("fast" as const) : ("flat" as const),
        label: i === 0 ? "Fastest" : "Flattest",
        color: i === 0 ? "#2563EB" : "#1B6B3A",
        coordinates: r.coordinates,
        distance: r.distance,
        duration: r.duration,
        elevationData: elevations[i],
      }));

      if (walkRoutes.length >= 2) {
        const sorted = [...walkRoutes].sort((a, b) => {
          const gainA = a.elevationData?.gain ?? Infinity;
          const gainB = b.elevationData?.gain ?? Infinity;
          return gainA - gainB;
        });
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
