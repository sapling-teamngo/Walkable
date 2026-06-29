import React from "react";
import { StyleSheet, View } from "react-native";
import BottomSheet from "@/components/BottomSheet";
import MapContainer from "@/components/MapContainer";
import { RouteProvider } from "@/context/RouteContext";

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
    <RouteProvider>
      <MapScreen />
    </RouteProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
