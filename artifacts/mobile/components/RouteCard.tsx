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
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: route.color }]}>
          <Text style={styles.badgeText}>{route.label}</Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: route.color }]}>
            <Feather name="check" size={12} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Feather name="map" size={14} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatDistance(route.distance)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatDuration(route.duration)}
          </Text>
        </View>
        {elev && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Feather name="trending-up" size={14} color={colors.mutedForeground} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                +{elev.gain}m
              </Text>
            </View>
          </>
        )}
      </View>

      {elev && (
        <View style={styles.gradeRow}>
          <View
            style={[
              styles.gradePill,
              { backgroundColor: gradeColor(elev.maxGrade) + "18" },
            ]}
          >
            <View
              style={[styles.gradeDot, { backgroundColor: gradeColor(elev.maxGrade) }]}
            />
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
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
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
  },
});
