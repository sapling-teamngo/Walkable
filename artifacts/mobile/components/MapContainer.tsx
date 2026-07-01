import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRoute } from "@/context/RouteContext";
import { usePOIs } from "@/context/POIContext";
import { reverseGeocode, setSearchBias } from "@/services/geocoding";
import { getIpLocation } from "@/services/ipLocation";
import { POI_CATEGORIES } from "@/services/pois";

const MAP_ID = "walkable-leaflet-map";

function loadLeaflet(onReady: () => void) {
  const win = window as any;
  const doc = document as any;

  if (win.L) { onReady(); return; }

  if (!doc.querySelector("#leaflet-css")) {
    const link = doc.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    doc.head.appendChild(link);
  }

  if (!doc.querySelector("#leaflet-js")) {
    const script = doc.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = onReady;
    doc.head.appendChild(script);
  }
}

export default function MapContainer() {
  const { origin, destination, routes, selectedRouteId, setOrigin } = useRoute();
  const { pois } = usePOIs();
  const [locating, setLocating] = useState(false);

  const mapInstanceRef  = useRef<any>(null);
  const markersRef      = useRef<any[]>([]);
  const polylinesRef    = useRef<any[]>([]);
  const poiMarkersRef   = useRef<any[]>([]);
  const userDotRef      = useRef<any>(null);
  const readyRef        = useRef(false);

  // ── Initialise Leaflet map ──────────────────────────────────────────────
  useEffect(() => {
    const ipPromise = getIpLocation();

    loadLeaflet(async () => {
      const L = (window as any).L;
      const container = (document as any).getElementById(MAP_ID);
      if (!container || mapInstanceRef.current) return;

      const ipLoc = await ipPromise;
      setSearchBias(ipLoc.latitude, ipLoc.longitude, ipLoc.countryCode);

      const map = L.map(container, { zoomControl: true }).setView(
        [ipLoc.latitude, ipLoc.longitude], 13,
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      readyRef.current = true;
      map.whenReady(() => setTimeout(() => map.invalidateSize(), 100));
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        readyRef.current = false;
      }
    };
  }, []);

  // ── Route & waypoint markers ────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const L = (window as any).L;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      markersRef.current.forEach((m) => m.remove());
      polylinesRef.current.forEach((p) => p.remove());
      markersRef.current = [];
      polylinesRef.current = [];

      if (origin) {
        markersRef.current.push(
          L.circleMarker([origin.latitude, origin.longitude], {
            radius: 10, color: "#1B6B3A", fillColor: "#1B6B3A", fillOpacity: 1, weight: 2,
          }).bindPopup("Start").addTo(map),
        );
      }

      if (destination) {
        markersRef.current.push(
          L.circleMarker([destination.latitude, destination.longitude], {
            radius: 10, color: "#EF4444", fillColor: "#EF4444", fillOpacity: 1, weight: 2,
          }).bindPopup("End").addTo(map),
        );
      }

      routes.forEach((route) => {
        const isSelected = route.id === selectedRouteId;
        const latlngs = route.coordinates.map((c: any) => [c.latitude, c.longitude]);

        polylinesRef.current.push(
          L.polyline(latlngs, {
            color: route.color, weight: 10, opacity: isSelected ? 0.18 : 0,
          }).addTo(map),
          L.polyline(latlngs, {
            color: route.color, weight: 5,
            opacity: isSelected ? 1 : 0.3,
            dashArray: isSelected ? null : "8, 5",
          }).addTo(map),
        );
      });

      if (routes.length > 0) {
        const allCoords = routes.flatMap((r: any) =>
          r.coordinates.map((c: any) => [c.latitude, c.longitude]),
        );
        map.fitBounds(allCoords, { padding: [50, 50], maxZoom: 15 });
      } else if (origin && destination) {
        map.fitBounds(
          [[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]],
          { padding: [60, 60] },
        );
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], 15);
      }

      setTimeout(() => map.invalidateSize(), 50);
    };

    if (readyRef.current) {
      update();
    } else {
      const iv = setInterval(() => {
        if (readyRef.current) { clearInterval(iv); update(); }
      }, 200);
      return () => clearInterval(iv);
    }
  }, [routes, selectedRouteId, origin, destination]);

  // ── POI markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    poiMarkersRef.current.forEach((m) => m.remove());
    poiMarkersRef.current = [];

    for (const poi of pois) {
      const meta = POI_CATEGORIES[poi.category];
      const marker = L.circleMarker([poi.latitude, poi.longitude], {
        radius: 5,
        color: "#fff",
        fillColor: meta.color,
        fillOpacity: 0.9,
        weight: 1.5,
      })
        .bindTooltip(poi.name, { permanent: false, direction: "top", offset: [0, -6] })
        .addTo(map);

      poiMarkersRef.current.push(marker);
    }
  }, [pois]);

  // ── GPS locate ──────────────────────────────────────────────────────────
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const map = mapInstanceRef.current;
        const L = (window as any).L;
        if (map) {
          map.flyTo([latitude, longitude], 15, { duration: 1.2 });
          if (userDotRef.current) userDotRef.current.remove();
          userDotRef.current = L.circleMarker([latitude, longitude], {
            radius: 8, color: "#fff", fillColor: "#2563EB", fillOpacity: 1, weight: 3,
          }).bindPopup("You are here").addTo(map);
        }
        try {
          const loc = await reverseGeocode(latitude, longitude);
          setOrigin(loc);
        } catch {
          setOrigin({ id: `${latitude},${longitude}`, name: "My Location", displayName: "My Location", latitude, longitude });
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <View style={styles.container}>
      <View nativeID={MAP_ID} style={styles.map} />
      <TouchableOpacity
        style={styles.locateButton}
        onPress={handleLocateMe}
        activeOpacity={0.85}
        disabled={locating}
      >
        {locating ? <ActivityIndicator size="small" color="#1B6B3A" /> : <LocateIcon />}
      </TouchableOpacity>
    </View>
  );
}

function LocateIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconOuter}><View style={styles.iconInner} /></View>
      <View style={styles.iconCrosshairH} />
      <View style={styles.iconCrosshairV} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject },
  map: { flex: 1, width: "100%", height: "100%" } as any,
  locateButton: {
    position: "absolute", right: 14, bottom: 130,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5, zIndex: 10,
  },
  iconWrap: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  iconOuter: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: "#1B6B3A", alignItems: "center", justifyContent: "center",
  },
  iconInner: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#1B6B3A" },
  iconCrosshairH: { position: "absolute", width: 22, height: 2, backgroundColor: "#1B6B3A", borderRadius: 1 },
  iconCrosshairV: { position: "absolute", width: 2, height: 22, backgroundColor: "#1B6B3A", borderRadius: 1 },
});
