import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapContainer() {
  const colors = useColors();
  const { origin, destination, routes, selectedRouteId } = useRoute();
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (routes.length > 0) {
      const route = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
      mapRef.current.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 80, right: 30, bottom: 440, left: 30 },
        animated: true,
      });
    } else if (origin && destination) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        { edgePadding: { top: 80, right: 30, bottom: 340, left: 30 }, animated: true },
      );
    } else if (origin) {
      mapRef.current.animateToRegion(
        {
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        600,
      );
    }
  }, [routes, selectedRouteId, origin, destination]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
  const otherRoute = routes.find((r) => r.id !== selectedRouteId);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={DEFAULT_REGION}
      showsUserLocation
      showsCompass={false}
      showsMyLocationButton={false}
    >
      {otherRoute && (
        <Polyline
          coordinates={otherRoute.coordinates}
          strokeColor={otherRoute.color + "40"}
          strokeWidth={4}
          lineDashPattern={[8, 4]}
        />
      )}
      {selectedRoute && (
        <>
          <Polyline
            coordinates={selectedRoute.coordinates}
            strokeColor={selectedRoute.color + "30"}
            strokeWidth={10}
          />
          <Polyline
            coordinates={selectedRoute.coordinates}
            strokeColor={selectedRoute.color}
            strokeWidth={5}
          />
        </>
      )}
      {origin && (
        <Marker
          coordinate={{ latitude: origin.latitude, longitude: origin.longitude }}
          title="Start"
          pinColor={colors.primary}
        />
      )}
      {destination && (
        <Marker
          coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
          title="End"
          pinColor="#EF4444"
        />
      )}
    </MapView>
  );
}
