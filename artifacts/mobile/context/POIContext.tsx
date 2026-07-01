import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { fetchNearbyPOIs, haversineDistance, POI, POICategory } from "@/services/pois";
import { getIpLocation } from "@/services/ipLocation";

interface POIContextValue {
  pois: POI[];
  isLoading: boolean;
  /** Fetch POIs around a given centre, skipping if we're already close to last fetch. */
  fetchPOIs: (lat: number, lon: number, force?: boolean) => Promise<void>;
  selectedCategory: POICategory | null;
  setSelectedCategory: (cat: POICategory | null) => void;
  /** Last centre used for fetching — useful for distance calculations. */
  center: { lat: number; lon: number } | null;
}

const POIContext = createContext<POIContextValue | null>(null);

export function POIProvider({ children }: { children: React.ReactNode }) {
  const [pois, setPois] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<POICategory | null>(null);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const lastCenterRef = useRef<{ lat: number; lon: number } | null>(null);

  const fetchPOIs = useCallback(async (lat: number, lon: number, force = false) => {
    if (!force && lastCenterRef.current) {
      const dist = haversineDistance(lat, lon, lastCenterRef.current.lat, lastCenterRef.current.lon);
      if (dist < 400) return; // skip if centre hasn't moved >400 m
    }
    lastCenterRef.current = { lat, lon };
    setCenter({ lat, lon });
    setIsLoading(true);
    try {
      const results = await fetchNearbyPOIs(lat, lon, 1_500, 80);
      setPois(results);
    } catch {
      // POIs are supplementary — silent fail keeps the app usable
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch around IP location on first mount
  useEffect(() => {
    getIpLocation()
      .then((loc) => fetchPOIs(loc.latitude, loc.longitude))
      .catch(() => {});
  }, [fetchPOIs]);

  return (
    <POIContext.Provider
      value={{ pois, isLoading, fetchPOIs, selectedCategory, setSelectedCategory, center }}
    >
      {children}
    </POIContext.Provider>
  );
}

export function usePOIs() {
  const ctx = useContext(POIContext);
  if (!ctx) throw new Error("usePOIs must be used inside POIProvider");
  return ctx;
}
