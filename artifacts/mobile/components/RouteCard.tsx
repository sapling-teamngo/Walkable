import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WalkRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  route: WalkRoute;
  isSelected: boolean;
  onSelect: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function gradeLabel(grade: number): string {
  if (grade < 3) return "Very flat";
  if (grade < 6) return "Gentle";
  if (grade < 10) return "Moderate";
  return "Steep";
}

function gradeColor(grade: number): string {
  if (grade < 3) return "#16A34A";
  if (grade < 6) return "#CA8A04";
  if (grade < 10) return "#EA580C";
  return "#DC2626";
}

/** Returns the Feather icon name for each route type. */
function routeIcon(label: string): keyof typeof Feather.glyphMap {
  if (label === "Fastest") return "zap";
  if (label === "Flattest") return "minus";
  return "award"; // "Best Route"
}

/** Fixed-size icon container that neutralises Feather's implicit font padding on web. */
function Icon({
  name,
  size,
  color,
}: {
  name: keyof typeof Feather.glyphMap;
  size: number;
  color: string;
}) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Feather name={name} size={size} color={color} />
    </View>
  );
}

export default function RouteCard({ route, isSelected, onSelect }: Props) {
  const colors = useColors();
  const elev = route.elevationData;

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          backgroundColor: isSelected ? colors.card : colors.background,
          borderColor: isSelected ? route.color : colors.border,
          borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Header: icon + label badge + selected checkmark */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: route.color }]}>
          <Icon name={routeIcon(route.label)} size={12} color="#fff" />
          <Text style={styles.badgeText}>{route.label}</Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: route.color }]}>
            <Icon name="check" size={12} color="#fff" />
          </View>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Icon name="map-pin" size={13} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatDistance(route.distance)}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.stat}>
          <Icon name="clock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatDuration(route.duration)}
          </Text>
        </View>

        {elev && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Icon name="trending-up" size={13} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                +{elev.gain}m
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Grade pill */}
      {elev && (
        <View style={styles.gradeRow}>
          <View
            style={[
              styles.gradePill,
              { backgroundColor: gradeColor(elev.maxGrade) + "18" },
            ]}
          >
            <View style={[styles.gradeDot, { backgroundColor: gradeColor(elev.maxGrade) }]} />
            <Text style={[styles.gradeText, { color: gradeColor(elev.maxGrade) }]}>
              {gradeLabel(elev.maxGrade)} · max {elev.maxGrade}% grade
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  selectedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "nowrap",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    includeFontPadding: false,
  } as any,
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
  },
  gradeRow: {
    flexDirection: "row",
  },
  gradePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  gradeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  gradeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    includeFontPadding: false,
  } as any,
});
