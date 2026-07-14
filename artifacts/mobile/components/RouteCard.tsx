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
  if (m === 0) return `${h}h`;
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

function routeIcon(label: string): keyof typeof Feather.glyphMap {
  if (label === "Shortest") return "scissors";
  if (label === "Flattest") return "minus";
  return "award";
}

interface DifficultyResult {
  stars: number;
  label: string;
  color: string;
}

function difficultyScore(
  distM: number,
  gain: number,
  maxGrade: number,
): DifficultyResult {
  const gainPerKm = gain / Math.max(distM / 1000, 0.1);
  const distKm = distM / 1000;

  let raw = 0;

  // Distance contribution
  if (distKm > 12) raw += 2;
  else if (distKm > 8) raw += 1.5;
  else if (distKm > 4) raw += 1;
  else if (distKm > 1.5) raw += 0.5;

  // Elevation gain per km — primary difficulty driver for a walking app
  if (gainPerKm > 40) raw += 3;
  else if (gainPerKm > 25) raw += 2;
  else if (gainPerKm > 15) raw += 1.5;
  else if (gainPerKm > 8) raw += 1;
  else if (gainPerKm > 3) raw += 0.5;

  // Max grade (steepest section)
  if (maxGrade > 20) raw += 1;
  else if (maxGrade > 12) raw += 0.5;

  const stars = Math.min(5, Math.max(1, Math.round(raw + 1)));
  const labels = ["Very Easy", "Easy", "Moderate", "Hard", "Very Hard"];
  const diffColors = ["#16A34A", "#65A30D", "#CA8A04", "#EA580C", "#DC2626"];
  return { stars, label: labels[stars - 1], color: diffColors[stars - 1] };
}

/** Fixed-size icon box that kills Feather's implicit font-padding on web. */
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
  const diff = elev ? difficultyScore(route.distance, elev.gain, elev.maxGrade) : null;

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
      {/* ── Header: icon + label badge + selected tick ─────────────────── */}
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: route.color }]}>
          <Icon name={routeIcon(route.label)} size={11} color="#fff" />
          <Text style={styles.badgeText}>{route.label}</Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedDot, { backgroundColor: route.color }]}>
            <Icon name="check" size={11} color="#fff" />
          </View>
        )}
      </View>

      {/* ── Stats: distance | time ───────────────────────────────────────── */}
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
      </View>

      {/* ── Grade pill (includes elevation gain) ────────────────────────── */}
      {elev ? (
        <View style={styles.gradeRow}>
          <View style={[styles.gradePill, { backgroundColor: gradeColor(elev.maxGrade) + "18" }]}>
            <View style={[styles.gradeDot, { backgroundColor: gradeColor(elev.maxGrade) }]} />
            <Text style={[styles.gradeText, { color: gradeColor(elev.maxGrade) }]}>
              {gradeLabel(elev.maxGrade)}
            </Text>
            <Text style={[styles.gradeText, { color: gradeColor(elev.maxGrade), opacity: 0.7 }]}>
              · ↑{elev.gain}m · {elev.maxGrade}%
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.gradePlaceholder} />
      )}

      {/* ── Difficulty score ─────────────────────────────────────────────── */}
      {diff ? (
        <View style={styles.diffRow}>
          <View style={styles.diffDots}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.diffDot,
                  {
                    backgroundColor:
                      i <= diff.stars ? diff.color : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.diffLabel, { color: diff.color }]}>
            {diff.label}
          </Text>
        </View>
      ) : (
        <View style={styles.diffPlaceholder} />
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 1,
  },
  gradeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  gradeText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    includeFontPadding: false,
    flexShrink: 1,
  } as any,
  gradePlaceholder: {
    height: 24,
  },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diffDots: {
    flexDirection: "row",
    gap: 3,
  },
  diffDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  diffLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    includeFontPadding: false,
  } as any,
  diffPlaceholder: {
    height: 14,
  },
});
