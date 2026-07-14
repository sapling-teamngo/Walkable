import React from "react";
import { StyleSheet, View } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import MapContainer from "@/components/MapContainer";
import { POIProvider } from "@/context/POIContext";
import { RouteProvider } from "@/context/RouteContext";
import { ThemeProvider } from "@/context/ThemeContext";

function MapScreen() {
  return (
    <View style={styles.container}>
      <MapContainer />
      <BottomSheet />
    </View>
  );
}

export default function IndexScreen() {
  return (
    <ThemeProvider>
      <RouteProvider>
        <POIProvider>
          <MapScreen />
        </POIProvider>
      </RouteProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
