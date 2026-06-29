import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { WalkRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  route: WalkRoute;
}

const CHART_HEIGHT = 80;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 4;
const INNER_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export default function ElevationProfile({ route }: Props) {
  const colors = useColors();
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 48;

  const elevations = route.elevationData?.elevations;

  if (!elevations || elevations.length < 2) {
    return (
      <View style={[styles.unavailable, { borderColor: colors.border }]}>
        <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>
          Elevation profile unavailable
        </Text>
      </View>
    );
  }

  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);
  const range = maxElev - minElev || 1;

  const points = elevations.map((e, i) => {
    const x = (i / (elevations.length - 1)) * chartWidth;
    const y = PADDING_TOP + INNER_HEIGHT - ((e - minElev) / range) * INNER_HEIGHT;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${chartWidth} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  const gradId = `grad-${route.id}`;
  const gradColor = route.color;

  const totalGain = route.elevationData?.gain ?? 0;
  const totalLoss = route.elevationData?.loss ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Elevation Profile</Text>
        <View style={styles.statsRow}>
          <Text style={[styles.statText, { color: colors.foreground }]}>
            ↑ {totalGain}m
          </Text>
          <Text style={[styles.statSep, { color: colors.mutedForeground }]}> · </Text>
          <Text style={[styles.statText, { color: colors.foreground }]}>
            ↓ {totalLoss}m
          </Text>
        </View>
      </View>

      <View style={[styles.chartContainer, { borderColor: colors.border }]}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={gradColor} stopOpacity={0.3} />
              <Stop offset="100%" stopColor={gradColor} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill={`url(#${gradId})`} />
          <Path d={linePath} stroke={gradColor} strokeWidth={2} fill="none" />
        </Svg>

        <View style={styles.elevLabels}>
          <Text style={[styles.elevLabel, { color: colors.mutedForeground }]}>
            {Math.round(maxElev)}m
          </Text>
          <Text style={[styles.elevLabel, { color: colors.mutedForeground }]}>
            {Math.round(minElev)}m
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statSep: {
    fontSize: 13,
  },
  chartContainer: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  elevLabels: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  elevLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  unavailable: {
    height: 60,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
