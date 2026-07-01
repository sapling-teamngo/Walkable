import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { Callout, Marker, Polyline, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRoute } from "@/context/RouteContext";
import { usePOIs } from "@/context/POIContext";
import { useColors } from "@/hooks/useColors";
import { reverseGeocode, setSearchBias } from "@/services/geocoding";
import { getIpLocation } from "@/services/ipLocation";
import { POI_CATEGORIES } from "@/services/pois";

const FALLBACK_REGION: Region = {
  latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.12, longitudeDelta: 0.12,
};

export default function MapContainer() {
  const colors = useColors();
  const { origin, destination, routes, selectedRouteId, setOrigin, setDestination } = useRoute();
  const { pois } = usePOIs();
  const mapRef = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [initialRegion, setInitialRegion] = useState<Region>(FALLBACK_REGION);

  // Initial region + search bias from IP
  useEffect(() => {
    getIpLocation().then((loc) => {
      setSearchBias(loc.latitude, loc.longitude, loc.countryCode);
      setInitialRegion({
        latitude: loc.latitude, longitude: loc.longitude,
        latitudeDelta: 0.12, longitudeDelta: 0.12,
      });
    });
  }, []);

  // Pan/fit when routes or origin/destination change
  useEffect(() => {
    if (!mapRef.current) return;
    if (routes.length > 0) {
      const route = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
      mapRef.current.fitToCoordinates(route.coordinates, {
        edgePadding: { top: 80, right: 30, bottom: 440, left: 30 }, animated: true,
      });
    } else if (origin && destination) {
      mapRef.current.fitToCoordinates(
        [{ latitude: origin.latitude, longitude: origin.longitude },
         { latitude: destination.latitude, longitude: destination.longitude }],
        { edgePadding: { top: 80, right: 30, bottom: 340, left: 30 }, animated: true },
      );
    } else if (origin) {
      mapRef.current.animateToRegion(
        { latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        600,
      );
    }
  }, [routes, selectedRouteId, origin, destination]);

  const handleLongPress = async (lat: number, lng: number) => {
    let loc: any;
    try {
      loc = await reverseGeocode(lat, lng);
    } catch {
      loc = {
        id: `${lat},${lng}`,
        name: "Selected Location",
        displayName: "Selected Location",
        latitude: lat,
        longitude: lng,
      };
    }
    Alert.alert(loc.name, "Set this location as:", [
      { text: "Set as Start",       onPress: () => setOrigin(loc) },
      { text: "Set as Destination", onPress: () => setDestination(loc) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 600,
      );
      const loc = await reverseGeocode(latitude, longitude);
      setOrigin(loc);
    } catch {
      // permission denied — silent
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
        initialRegion={initialRegion}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        onLongPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          handleLongPress(latitude, longitude);
        }}
      >
        {/* De-selected route (faded) */}
        {otherRoute && (
          <Polyline
            coordinates={otherRoute.coordinates}
            strokeColor={otherRoute.color + "40"}
            strokeWidth={4}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* Selected route */}
        {selectedRoute && (
          <>
            <Polyline coordinates={selectedRoute.coordinates} strokeColor={selectedRoute.color + "30"} strokeWidth={10} />
            <Polyline coordinates={selectedRoute.coordinates} strokeColor={selectedRoute.color} strokeWidth={5} />
          </>
        )}

        {/* Origin / destination markers */}
        {origin && (
          <Marker coordinate={{ latitude: origin.latitude, longitude: origin.longitude }} title="Start" pinColor={colors.primary} />
        )}
        {destination && (
          <Marker coordinate={{ latitude: destination.latitude, longitude: destination.longitude }} title="End" pinColor="#EF4444" />
        )}

        {/* POI dots — small coloured circles with callout */}
        {pois.map((poi) => {
          const meta = POI_CATEGORIES[poi.category];
          return (
            <Marker
              key={poi.id}
              coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
              title={poi.name}
              description={meta.label}
              tracksViewChanges={false}
            >
              <View style={[styles.poiDot, { backgroundColor: meta.color }]} />
            </Marker>
          );
        })}
      </MapView>

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
  poiDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: "#fff",
  },
  locateButton: {
    position: "absolute", right: 14, bottom: 130,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
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
