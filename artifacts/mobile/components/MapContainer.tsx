import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRoute } from "@/context/RouteContext";

const MAP_ID = "walkable-leaflet-map";

function loadLeaflet(onReady: () => void) {
  const win = window as any;
  const doc = document as any;

  if (win.L) {
    onReady();
    return;
  }

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
  const { origin, destination, routes, selectedRouteId } = useRoute();

  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const readyRef = useRef(false);

  useEffect(() => {
    loadLeaflet(() => {
      const L = (window as any).L;
      const container = (document as any).getElementById(MAP_ID);
      if (!container || mapInstanceRef.current) return;

      const map = L.map(container, { zoomControl: true }).setView(
        [37.7749, -122.4194],
        13,
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      readyRef.current = true;

      map.whenReady(() => {
        setTimeout(() => map.invalidateSize(), 100);
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        readyRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    const checkAndUpdate = () => {
      const L = (window as any).L;
      const map = mapInstanceRef.current;
      if (!L || !map) return;

      markersRef.current.forEach((m) => m.remove());
      polylinesRef.current.forEach((p) => p.remove());
      markersRef.current = [];
      polylinesRef.current = [];

      if (origin) {
        const marker = L.circleMarker([origin.latitude, origin.longitude], {
          radius: 10,
          color: "#1B6B3A",
          fillColor: "#1B6B3A",
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup("Start")
          .addTo(map);
        markersRef.current.push(marker);
      }

      if (destination) {
        const marker = L.circleMarker(
          [destination.latitude, destination.longitude],
          {
            radius: 10,
            color: "#EF4444",
            fillColor: "#EF4444",
            fillOpacity: 1,
            weight: 2,
          },
        )
          .bindPopup("End")
          .addTo(map);
        markersRef.current.push(marker);
      }

      routes.forEach((route) => {
        const isSelected = route.id === selectedRouteId;
        const latlngs = route.coordinates.map((c: any) => [c.latitude, c.longitude]);

        const shadow = L.polyline(latlngs, {
          color: route.color,
          weight: 10,
          opacity: isSelected ? 0.18 : 0,
        }).addTo(map);

        const line = L.polyline(latlngs, {
          color: route.color,
          weight: 5,
          opacity: isSelected ? 1 : 0.3,
          dashArray: isSelected ? null : "8, 5",
        }).addTo(map);

        polylinesRef.current.push(shadow, line);
      });

      if (routes.length > 0) {
        const allCoords = routes.flatMap((r: any) =>
          r.coordinates.map((c: any) => [c.latitude, c.longitude]),
        );
        map.fitBounds(allCoords, { padding: [50, 50], maxZoom: 15 });
      } else if (origin && destination) {
        map.fitBounds(
          [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
          { padding: [60, 60] },
        );
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], 14);
      }

      setTimeout(() => map.invalidateSize(), 50);
    };

    if (readyRef.current) {
      checkAndUpdate();
    } else {
      const interval = setInterval(() => {
        if (readyRef.current) {
          clearInterval(interval);
          checkAndUpdate();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [routes, selectedRouteId, origin, destination]);

  return (
    <View style={styles.container}>
      <View nativeID={MAP_ID} style={styles.map} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  } as any,
});
