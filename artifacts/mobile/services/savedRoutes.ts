import AsyncStorage from "@react-native-async-storage/async-storage";
import { GeoLocation } from "@/services/geocoding";

export interface SavedRoute {
  id: string;
  label: string;
  origin: GeoLocation;
  destination: GeoLocation;
  savedAt: number;
}

const STORAGE_KEY = "walkable:saved_routes";
const MAX_SAVED = 20;

export async function loadSavedRoutes(): Promise<SavedRoute[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRoute[];
  } catch {
    return [];
  }
}

export async function saveRoute(
  origin: GeoLocation,
  destination: GeoLocation,
): Promise<SavedRoute> {
  const existing = await loadSavedRoutes();
  const route: SavedRoute = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: `${origin.name} → ${destination.name}`,
    origin,
    destination,
    savedAt: Date.now(),
  };
  const updated = [route, ...existing].slice(0, MAX_SAVED);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return route;
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const existing = await loadSavedRoutes();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(existing.filter((r) => r.id !== id)),
  );
}

export function formatSavedDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
