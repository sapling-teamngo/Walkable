import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { useRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";
import { reverseGeocode } from "@/services/geocoding";

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapContainer() {
  const colors = useColors();
  const { origin, destination, routes, selectedRouteId, setOrigin } = useRoute();
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);

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

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = pos.coords;

      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 },
        600,
      );

      const loc = await reverseGeocode(latitude, longitude);
      setOrigin(loc);
    } catch {
      // permission denied or location unavailable — silently ignore
    } finally {
      setLocating(false);
    }
  };

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
  const otherRoute = routes.find((r) => r.id !== selectedRouteId);

  return (
    <View style={StyleSheet.absoluteFillObject}>
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

      <TouchableOpacity
        style={styles.locateButton}
        onPress={handleLocateMe}
        activeOpacity={0.85}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator size="small" color="#1B6B3A" />
        ) : (
          <LocateIcon />
        )}
      </TouchableOpacity>
    </View>
  );
}

function LocateIcon() {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconOuter}>
        <View style={styles.iconInner} />
      </View>
      <View style={styles.iconCrosshairH} />
      <View style={styles.iconCrosshairV} />
    </View>
  );
}

const styles = StyleSheet.create({
  locateButton: {
    position: "absolute",
    right: 14,
    bottom: 130,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  iconWrap: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#1B6B3A",
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#1B6B3A",
  },
  iconCrosshairH: {
    position: "absolute",
    width: 22,
    height: 2,
    backgroundColor: "#1B6B3A",
    borderRadius: 1,
  },
  iconCrosshairV: {
    position: "absolute",
    width: 2,
    height: 22,
    backgroundColor: "#1B6B3A",
    borderRadius: 1,
  },
});
