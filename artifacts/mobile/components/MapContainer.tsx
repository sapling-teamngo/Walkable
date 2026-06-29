import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function MapContainer() {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.secondary }]}>
      <View style={styles.inner}>
        <Feather name="map" size={48} color={colors.primary} style={styles.icon} />
        <Text style={[styles.title, { color: colors.foreground }]}>Interactive Map</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Scan the QR code with Expo Go on your phone to see the live map and find
          flat walking routes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  icon: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
