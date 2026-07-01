import { Feather } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ElevationProfile from "@/components/ElevationProfile";
import ImportModal from "@/components/ImportModal";
import RouteCard from "@/components/RouteCard";
import SearchInput from "@/components/SearchInput";
import { usePOIs } from "@/context/POIContext";
import { useRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";
import { ImportResult } from "@/services/googleMapsImport";
import {
  formatDistance,
  haversineDistance,
  POI,
  POI_CATEGORIES,
  POICategory,
} from "@/services/pois";

const SHEET_HEIGHT  = 660;
const PEEK_HEIGHT   = 100;
const SEARCH_HEIGHT = 460;
const RESULTS_HEIGHT = 560;

const MIN_Y = SHEET_HEIGHT - RESULTS_HEIGHT;
const MAX_Y = SHEET_HEIGHT - PEEK_HEIGHT;

type SheetState = "peek" | "search" | "results" | "places";

/** Fixed-size icon wrapper that neutralises Feather's font-padding on web. */
function FIcon({
  name,
  size,
  color,
  style,
}: {
  name: keyof typeof Feather.glyphMap;
  size: number;
  color: string;
  style?: object;
}) {
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Feather name={name} size={size} color={color} />
    </View>
  );
}

const ALL_CATEGORIES = Object.keys(POI_CATEGORIES) as POICategory[];

export default function BottomSheet() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const {
    origin, destination, routes, selectedRouteId, isLoading, error,
    setOrigin, setDestination, setSelectedRouteId, searchRoutes, clearAll,
  } = useRoute();
  const { pois, isLoading: poisLoading, fetchPOIs, selectedCategory, setSelectedCategory, center } = usePOIs();

  const [sheetState, setSheetState]   = useState<SheetState>("peek");
  const sheetStateRef                 = useRef<SheetState>("peek");
  const [showImport, setShowImport]   = useState(false);

  const translateY    = useRef(new Animated.Value(MAX_Y)).current;
  const currentYRef   = useRef(MAX_Y);
  const startYRef     = useRef(MAX_Y);
  const snapToRef     = useRef<(state: SheetState) => void>(() => {});

  const snapTo = useCallback((state: SheetState) => {
    const heights: Record<SheetState, number> = {
      peek: PEEK_HEIGHT, search: SEARCH_HEIGHT, results: RESULTS_HEIGHT, places: RESULTS_HEIGHT,
    };
    const toValue = SHEET_HEIGHT - heights[state];
    sheetStateRef.current = state;
    setSheetState(state);
    currentYRef.current = toValue;
    Animated.spring(translateY, { toValue, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, [translateY]);

  useEffect(() => { snapToRef.current = snapTo; }, [snapTo]);
  useEffect(() => { if (routes.length > 0) snapToRef.current("results"); }, [routes.length]);

  // When origin changes, re-fetch POIs nearby
  useEffect(() => {
    if (origin) fetchPOIs(origin.latitude, origin.longitude);
  }, [origin, fetchPOIs]);

  // Auto-snap to search sheet whenever either endpoint is set while sheet is peeked,
  // so the user can see the loading state / Find Routes button / error messages.
  useEffect(() => {
    if ((origin || destination) && sheetStateRef.current === "peek") {
      snapToRef.current("search");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  // Auto-search when both endpoints are set (deduplicated so we don't re-fire for
  // the same pair if the component re-renders for unrelated reasons).
  const autoSearchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!origin || !destination) return;
    const key = `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}|${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
    if (autoSearchKeyRef.current === key) return;
    autoSearchKeyRef.current = key;
    searchRoutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
        onPanResponderGrant: () => {
          startYRef.current = currentYRef.current;
          translateY.stopAnimation((v) => {
            currentYRef.current = v;
            startYRef.current = v;
          });
        },
        onPanResponderMove: (_, gs) => {
          const clamped = Math.max(MIN_Y, Math.min(MAX_Y, startYRef.current + gs.dy));
          currentYRef.current = clamped;
          translateY.setValue(clamped);
        },
        onPanResponderRelease: (_, gs) => {
          const projected = currentYRef.current + gs.vy * 100;
          const snapPoints: { state: SheetState; y: number }[] = [
            { state: "peek",    y: SHEET_HEIGHT - PEEK_HEIGHT },
            { state: "search",  y: SHEET_HEIGHT - SEARCH_HEIGHT },
            { state: "results", y: SHEET_HEIGHT - RESULTS_HEIGHT },
          ];
          const nearest = snapPoints.reduce((p, c) =>
            Math.abs(c.y - projected) < Math.abs(p.y - projected) ? c : p,
          );
          snapToRef.current(nearest.state);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleImportResult = (result: ImportResult) => {
    if (result.origin)      setOrigin(result.origin);
    if (result.destination) setDestination(result.destination);
    setShowImport(false);
  };

  const handleOpenGoogleMaps = () => {
    if (!origin || !destination) return;
    const sel = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
    const o = `${origin.latitude},${origin.longitude}`;
    const d = `${destination.latitude},${destination.longitude}`;
    let waypointsParam = "";
    if (sel?.coordinates.length > 4) {
      const mid = sel.coordinates[Math.floor(sel.coordinates.length / 2)];
      waypointsParam = `&waypoints=${mid.latitude},${mid.longitude}`;
    }
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}${waypointsParam}&travelmode=walking`,
    );
  };

  const handlePOISelect = (poi: POI) => {
    setDestination({
      id: poi.id,
      name: poi.name,
      displayName: `${poi.name} · ${POI_CATEGORIES[poi.category].label}`,
      latitude: poi.latitude,
      longitude: poi.longitude,
    });
    snapTo("search");
  };

  const handleExplore = () => {
    snapTo("places");
    if (origin) {
      fetchPOIs(origin.latitude, origin.longitude, true);
    }
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const canSearch = !!origin && !!destination;

  // Filtered POIs for "places" view
  const filteredPOIs = selectedCategory
    ? pois.filter((p) => p.category === selectedCategory)
    : pois;

  // Categories that actually have results
  const activeCats = ALL_CATEGORIES.filter((c) => pois.some((p) => p.category === c));

  // Distance reference point
  const refLat = origin?.latitude  ?? center?.lat ?? 0;
  const refLon = origin?.longitude ?? center?.lon ?? 0;

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: colors.background, height: SHEET_HEIGHT, transform: [{ translateY }], shadowColor: colors.shadow },
      ]}
    >
      {/* Drag handle */}
      <View {...panResponder.panHandlers} style={styles.handleArea}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </View>

      {/* ── Peek ─────────────────────────────────────────────────────────── */}
      {sheetState === "peek" && (
        <View style={styles.peekContent}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => snapTo("search")}
            style={[styles.peekSearchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <FIcon name="search" size={18} color={colors.mutedForeground} />
            <Text style={[styles.peekText, { color: colors.mutedForeground }]}>
              Where do you want to walk?
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleExplore}
            style={[styles.peekExploreBtn, { backgroundColor: colors.primary }]}
          >
            <FIcon name="compass" size={16} color="#fff" />
            <Text style={styles.peekExploreBtnText}>Explore</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search ───────────────────────────────────────────────────────── */}
      {sheetState === "search" && (
        <View style={[styles.searchContent, { paddingBottom: bottomPad + 16 }]}>
          <SearchInput
            placeholder="From"
            value={origin?.name ?? ""}
            onLocationSelect={(loc) => setOrigin(loc)}
            onClear={() => setOrigin(null)}
            iconName="circle"
            iconColor={colors.flatRoute}
            autoFocus
          />
          <View style={styles.searchDividerRow}>
            <View style={[styles.searchDividerLine, { backgroundColor: colors.border }]} />
            <FIcon name="arrow-down" size={14} color={colors.mutedForeground} />
            <View style={[styles.searchDividerLine, { backgroundColor: colors.border }]} />
          </View>
          <SearchInput
            placeholder="To"
            value={destination?.name ?? ""}
            onLocationSelect={(loc) => setDestination(loc)}
            onClear={() => setDestination(null)}
            iconName="map-pin"
            iconColor={colors.destructive}
          />
          <TouchableOpacity
            style={styles.importLink}
            onPress={() => setShowImport(true)}
            activeOpacity={0.7}
          >
            <FIcon name="download" size={14} color={colors.primary} />
            <Text style={[styles.importLinkText, { color: colors.primary }]}>
              Import from Google Maps
            </Text>
          </TouchableOpacity>

          {error && (
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          )}

          {canSearch && (
            <TouchableOpacity
              style={[styles.findButton, { backgroundColor: isLoading ? colors.mutedForeground : colors.primary }]}
              onPress={searchRoutes}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FIcon name="search" size={18} color="#fff" />
                  <Text style={styles.findButtonText}>Find Routes</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {sheetState === "results" && routes.length > 0 && (
        <ScrollView
          style={styles.resultsScroll}
          contentContainerStyle={[styles.resultsContent, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.routeCards}>
            {routes.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={selectedRouteId === route.id}
                onSelect={() => setSelectedRouteId(route.id)}
              />
            ))}
          </View>

          {(() => {
            const sel = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
            return sel ? <ElevationProfile route={sel} /> : null;
          })()}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.backBtn, { borderColor: colors.border }]}
              onPress={() => { clearAll(); snapTo("search"); }}
              activeOpacity={0.8}
            >
              <FIcon name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapsBtn, { borderColor: colors.border }]}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.85}
            >
              <FIcon name="map" size={17} color={colors.foreground} />
              <Text style={[styles.mapsBtnText, { color: colors.foreground }]}>Google Maps</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.85}
            >
              <FIcon name="navigation" size={17} color="#fff" />
              <Text style={styles.startBtnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── Places / Explore ─────────────────────────────────────────────── */}
      {sheetState === "places" && (
        <View style={styles.placesContainer}>
          {/* Header row */}
          <View style={styles.placesHeader}>
            <TouchableOpacity
              onPress={() => snapTo("peek")}
              hitSlop={10}
              style={styles.placesBackBtn}
            >
              <FIcon name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.placesTitle, { color: colors.foreground }]}>
              Nearby Places
            </Text>
            {poisLoading && <ActivityIndicator size="small" color={colors.mutedForeground} />}
          </View>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
            style={styles.categoryScroll}
          >
            <TouchableOpacity
              onPress={() => setSelectedCategory(null)}
              style={[
                styles.chip,
                !selectedCategory && { backgroundColor: colors.primary },
                !!selectedCategory && { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: !selectedCategory ? "#fff" : colors.foreground }]}>
                All
              </Text>
            </TouchableOpacity>

            {activeCats.map((cat) => {
              const meta = POI_CATEGORIES[cat];
              const isActive = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(isActive ? null : cat)}
                  style={[
                    styles.chip,
                    isActive
                      ? { backgroundColor: meta.color }
                      : { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
                  ]}
                  activeOpacity={0.8}
                >
                  <FIcon name={meta.icon as any} size={12} color={isActive ? "#fff" : meta.color} />
                  <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.foreground }]}>
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* POI list */}
          <FlatList
            data={filteredPOIs}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.poiList, { paddingBottom: bottomPad + 16 }]}
            ItemSeparatorComponent={() => (
              <View style={[styles.poiSeparator, { backgroundColor: colors.border }]} />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <FIcon name="map-pin" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {poisLoading ? "Finding places nearby…" : "No places found in this area"}
                </Text>
              </View>
            )}
            renderItem={({ item }) => {
              const meta = POI_CATEGORIES[item.category];
              const dist = haversineDistance(refLat, refLon, item.latitude, item.longitude);
              return (
                <TouchableOpacity
                  style={styles.poiRow}
                  onPress={() => handlePOISelect(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.poiIconBadge, { backgroundColor: meta.color + "20" }]}>
                    <FIcon name={meta.icon as any} size={16} color={meta.color} />
                  </View>
                  <View style={styles.poiInfo}>
                    <Text style={[styles.poiName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.poiCategory, { color: colors.mutedForeground }]}>
                      {meta.label}
                    </Text>
                  </View>
                  <View style={styles.poiRight}>
                    <Text style={[styles.poiDist, { color: colors.mutedForeground }]}>
                      {formatDistance(dist)}
                    </Text>
                    <FIcon name="chevron-right" size={14} color={colors.mutedForeground} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <ImportModal
        visible={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImportResult}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 20,
  },
  handleArea: { height: 28, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  handle:    { width: 36, height: 4, borderRadius: 2 },

  // ── Peek
  peekContent:       { paddingHorizontal: 16, paddingTop: 4, flexDirection: "row", gap: 10 },
  peekSearchBar:     {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, height: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  peekText:          { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  peekExploreBtn:    {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, height: 50, borderRadius: 14,
  },
  peekExploreBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Search
  searchContent:    { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  searchDividerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  searchDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  findButton:        {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 52, borderRadius: 14, marginTop: 8,
  },
  findButtonText:    { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  importLink:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 },
  importLinkText:    { fontSize: 14, fontFamily: "Inter_500Medium" },
  errorText:         { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 4 },

  // ── Results
  resultsScroll:   { flex: 1 },
  resultsContent:  { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
  routeCards:      { flexDirection: "row", gap: 10 },
  actionRow:       { flexDirection: "row", gap: 10, alignItems: "center" },
  backBtn:         {
    width: 50, height: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center", justifyContent: "center",
  },
  mapsBtn:         {
    flex: 1, height: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
  },
  mapsBtnText:     { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  startBtn:        {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  startBtnText:    { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Places
  placesContainer:  { flex: 1, overflow: "hidden" },
  placesHeader:     {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  placesBackBtn:    { padding: 2 },
  placesTitle:      { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  categoryScroll:   { flexShrink: 0 },
  categoryChips:    { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip:             {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  chipText:         { fontSize: 12, fontFamily: "Inter_500Medium" },
  poiList:          { paddingHorizontal: 16, paddingTop: 4 },
  poiSeparator:     { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  poiRow:           {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
  },
  poiIconBadge:     {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  poiInfo:          { flex: 1, minWidth: 0 },
  poiName:          { fontSize: 14, fontFamily: "Inter_500Medium" },
  poiCategory:      { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  poiRight:         { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  poiDist:          { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState:       { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyText:        { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
