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
  Share,
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
import { Pace, PACE_OPTIONS, useRoute } from "@/context/RouteContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { ImportResult } from "@/services/googleMapsImport";
import {
  formatDistance,
  haversineDistance,
  POI,
  POI_CATEGORIES,
  POICategory,
} from "@/services/pois";
import {
  deleteSavedRoute,
  formatSavedDate,
  loadSavedRoutes,
  SavedRoute,
  saveRoute,
} from "@/services/savedRoutes";

// ── Layout constants ──────────────────────────────────────────────────────────

const SHEET_HEIGHT   = 660;
const PEEK_HEIGHT    = 100;
const SEARCH_HEIGHT  = 460;
const RESULTS_HEIGHT = 620; // taller to fit pace selector + directions
const SAVED_HEIGHT   = 460;

const MIN_Y = SHEET_HEIGHT - RESULTS_HEIGHT;
const MAX_Y = SHEET_HEIGHT - PEEK_HEIGHT;

type SheetState = "peek" | "search" | "results" | "places" | "saved";

// ── Icon helper ───────────────────────────────────────────────────────────────

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
    <View
      style={[
        { width: size, height: size, alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      <Feather name={name} size={size} color={color} />
    </View>
  );
}

const ALL_CATEGORIES = Object.keys(POI_CATEGORIES) as POICategory[];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BottomSheet() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useTheme();

  const {
    origin, destination, routes, selectedRouteId, isLoading, error, pace,
    setOrigin, setDestination, setSelectedRouteId, setPace, searchRoutes, clearAll,
  } = useRoute();

  const {
    pois, isLoading: poisLoading, fetchPOIs,
    selectedCategory, setSelectedCategory, center,
  } = usePOIs();

  // ── Sheet state ─────────────────────────────────────────────────────────────
  const [sheetState, setSheetState]   = useState<SheetState>("peek");
  const sheetStateRef                 = useRef<SheetState>("peek");
  const [showImport, setShowImport]   = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [routeSaved, setRouteSaved]   = useState(false);

  // ── Animation ───────────────────────────────────────────────────────────────
  const translateY   = useRef(new Animated.Value(MAX_Y)).current;
  const currentYRef  = useRef(MAX_Y);
  const startYRef    = useRef(MAX_Y);
  const snapToRef    = useRef<(state: SheetState) => void>(() => {});

  const snapTo = useCallback(
    (state: SheetState) => {
      const heights: Record<SheetState, number> = {
        peek:    PEEK_HEIGHT,
        search:  SEARCH_HEIGHT,
        results: RESULTS_HEIGHT,
        places:  RESULTS_HEIGHT,
        saved:   SAVED_HEIGHT,
      };
      const toValue = SHEET_HEIGHT - heights[state];
      sheetStateRef.current = state;
      setSheetState(state);
      currentYRef.current = toValue;
      Animated.spring(translateY, {
        toValue, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    },
    [translateY],
  );

  useEffect(() => { snapToRef.current = snapTo; }, [snapTo]);
  useEffect(() => { if (routes.length > 0) snapToRef.current("results"); }, [routes.length]);

  // Reload saved routes whenever saved panel opens
  useEffect(() => {
    if (sheetState === "saved") {
      loadSavedRoutes().then(setSavedRoutes);
    }
  }, [sheetState]);

  // Also load on mount for peek preview count
  useEffect(() => { loadSavedRoutes().then(setSavedRoutes); }, []);

  // Re-fetch POIs when origin changes
  useEffect(() => {
    if (origin) fetchPOIs(origin.latitude, origin.longitude);
  }, [origin, fetchPOIs]);

  // Auto-snap to search when an endpoint is set from peek
  useEffect(() => {
    if ((origin || destination) && sheetStateRef.current === "peek") {
      snapToRef.current("search");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  // Auto-search when both endpoints are set — deduplicated so the same pair
  // doesn't re-fire on unrelated renders. Also resets on full clear (Bug #1 fix).
  const autoSearchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Bug fix: reset dedup key when both endpoints are cleared so re-entering
    // the same pair after clearAll() correctly triggers a new search
    if (!origin && !destination) {
      autoSearchKeyRef.current = null;
      return;
    }
    if (!origin || !destination) return;
    const key = `${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}|${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
    if (autoSearchKeyRef.current === key) return;
    autoSearchKeyRef.current = key;
    searchRoutes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination]);

  // ── Pan responder ───────────────────────────────────────────────────────────
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
          const clamped = Math.max(
            MIN_Y, Math.min(MAX_Y, startYRef.current + gs.dy),
          );
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

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  const handleShare = async () => {
    if (!origin || !destination) return;
    const o = `${origin.latitude},${origin.longitude}`;
    const d = `${destination.latitude},${destination.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=walking`;
    const sel = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
    const label = sel?.label ?? "Walking";
    try {
      await Share.share({
        title: `${label} route: ${origin.name} → ${destination.name}`,
        message: `${label} walk from ${origin.name} to ${destination.name}\n${url}`,
        url,
      });
    } catch {
      // User cancelled or share failed — silent
    }
  };

  const handleSaveRoute = async () => {
    if (!origin || !destination || routeSaved) return;
    await saveRoute(origin, destination);
    setRouteSaved(true);
    loadSavedRoutes().then(setSavedRoutes);
    setTimeout(() => setRouteSaved(false), 2500);
  };

  const handleDeleteSaved = async (id: string) => {
    await deleteSavedRoute(id);
    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
  };

  const handleLoadSaved = (saved: SavedRoute) => {
    setOrigin(saved.origin);
    setDestination(saved.destination);
    snapTo("search");
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
    if (origin) fetchPOIs(origin.latitude, origin.longitude, true);
  };

  const toggleTheme = () => {
    setThemeMode(colors.isDark ? "light" : "dark");
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const bottomPad    = Platform.OS === "web" ? 34 : insets.bottom;
  const canSearch    = !!origin && !!destination;
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];

  const filteredPOIs = selectedCategory
    ? pois.filter((p) => p.category === selectedCategory)
    : pois;
  const activeCats = ALL_CATEGORIES.filter((c) => pois.some((p) => p.category === c));
  const refLat = origin?.latitude  ?? center?.lat ?? 0;
  const refLon = origin?.longitude ?? center?.lon ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.background,
          height: SHEET_HEIGHT,
          transform: [{ translateY }],
          shadowColor: colors.shadow,
        },
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

          {/* Theme toggle */}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.peekIconBtn, { borderColor: colors.border }]}
            activeOpacity={0.8}
            hitSlop={4}
          >
            <FIcon
              name={colors.isDark ? "sun" : "moon"}
              size={18}
              color={colors.foreground}
            />
          </TouchableOpacity>

          {/* Saved routes */}
          <TouchableOpacity
            onPress={() => snapTo("saved")}
            style={[styles.peekIconBtn, { borderColor: colors.border }]}
            activeOpacity={0.8}
            hitSlop={4}
          >
            <FIcon name="bookmark" size={18} color={colors.foreground} />
            {savedRoutes.length > 0 && (
              <View style={[styles.savedBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.savedBadgeText}>
                  {Math.min(savedRoutes.length, 9)}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Explore */}
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
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          )}

          {canSearch && (
            <TouchableOpacity
              style={[
                styles.findButton,
                { backgroundColor: isLoading ? colors.mutedForeground : colors.primary },
              ]}
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
          contentContainerStyle={[
            styles.resultsContent,
            { paddingBottom: bottomPad + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Route cards */}
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

          {/* Pace selector */}
          <View style={[styles.paceRow, { borderColor: colors.border }]}>
            <FIcon name="user" size={13} color={colors.mutedForeground} style={{ marginRight: 6 }} />
            {(Object.keys(PACE_OPTIONS) as Pace[]).map((p) => {
              const opt = PACE_OPTIONS[p];
              const active = pace === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPace(p)}
                  activeOpacity={0.8}
                  style={[
                    styles.paceBtn,
                    active
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.muted },
                  ]}
                >
                  <Text
                    style={[
                      styles.paceBtnText,
                      { color: active ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      styles.paceBtnSub,
                      { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground },
                    ]}
                  >
                    {opt.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Elevation profile */}
          {selectedRoute ? <ElevationProfile route={selectedRoute} /> : null}

          {/* Directions accordion */}
          {selectedRoute && selectedRoute.steps.length > 0 && (
            <View style={[styles.directionsContainer, { borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setShowDirections((v) => !v)}
                style={styles.directionsHeader}
                activeOpacity={0.8}
              >
                <FIcon name="list" size={15} color={colors.foreground} />
                <Text style={[styles.directionsTitle, { color: colors.foreground }]}>
                  Directions
                </Text>
                <Text style={[styles.directionsCount, { color: colors.mutedForeground }]}>
                  {selectedRoute.steps.length} steps
                </Text>
                <FIcon
                  name={showDirections ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={colors.mutedForeground}
                  style={{ marginLeft: "auto" }}
                />
              </TouchableOpacity>

              {showDirections && (
                <View style={[styles.stepsList, { borderTopColor: colors.border }]}>
                  {selectedRoute.steps.map((step, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.stepRow,
                        idx < selectedRoute.steps.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.stepIconBox, { backgroundColor: colors.muted }]}>
                        <FIcon
                          name={step.icon as any}
                          size={13}
                          color={colors.primary}
                        />
                      </View>
                      <Text
                        style={[styles.stepInstruction, { color: colors.foreground }]}
                        numberOfLines={2}
                      >
                        {step.instruction}
                      </Text>
                      {step.distance > 0 && (
                        <Text style={[styles.stepDist, { color: colors.mutedForeground }]}>
                          {step.distance >= 1000
                            ? `${(step.distance / 1000).toFixed(1)}km`
                            : `${step.distance}m`}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Action row */}
          <View style={styles.actionRow}>
            {/* Back */}
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={() => { clearAll(); snapTo("search"); }}
              activeOpacity={0.8}
            >
              <FIcon name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <FIcon name="share" size={18} color={colors.foreground} />
            </TouchableOpacity>

            {/* Save */}
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  borderColor: routeSaved ? colors.primary : colors.border,
                  backgroundColor: routeSaved ? colors.primary + "18" : "transparent",
                },
              ]}
              onPress={handleSaveRoute}
              activeOpacity={0.8}
            >
              <FIcon
                name={routeSaved ? "bookmark" : "bookmark"}
                size={18}
                color={routeSaved ? colors.primary : colors.foreground}
              />
            </TouchableOpacity>

            {/* Navigate */}
            <TouchableOpacity
              style={[styles.navigateBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.85}
            >
              <FIcon name="navigation" size={17} color="#fff" />
              <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── Places / Explore ─────────────────────────────────────────────── */}
      {sheetState === "places" && (
        <View style={styles.panelContainer}>
          <View style={styles.panelHeader}>
            <TouchableOpacity
              onPress={() => snapTo("peek")}
              hitSlop={10}
              style={styles.panelBackBtn}
            >
              <FIcon name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              Nearby Places
            </Text>
            {poisLoading && (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            )}
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
                !!selectedCategory && {
                  borderColor: colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
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

      {/* ── Saved Routes ─────────────────────────────────────────────────── */}
      {sheetState === "saved" && (
        <View style={styles.panelContainer}>
          <View style={styles.panelHeader}>
            <TouchableOpacity
              onPress={() => snapTo("peek")}
              hitSlop={10}
              style={styles.panelBackBtn}
            >
              <FIcon name="arrow-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              Saved Routes
            </Text>
          </View>

          <FlatList
            data={savedRoutes}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.savedList, { paddingBottom: bottomPad + 16 }]}
            ItemSeparatorComponent={() => (
              <View style={[styles.poiSeparator, { backgroundColor: colors.border }]} />
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <FIcon name="bookmark" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved routes yet.{"\n"}Search a route and tap the bookmark icon.
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.savedRow}
                onPress={() => handleLoadSaved(item)}
                activeOpacity={0.75}
              >
                <View style={[styles.savedIcon, { backgroundColor: colors.secondary }]}>
                  <FIcon name="map-pin" size={15} color={colors.primary} />
                </View>
                <View style={styles.savedInfo}>
                  <Text
                    style={[styles.savedLabel, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text style={[styles.savedTime, { color: colors.mutedForeground }]}>
                    {formatSavedDate(item.savedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteSaved(item.id)}
                  hitSlop={8}
                  style={styles.savedDelete}
                >
                  <FIcon name="trash-2" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
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

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 20,
  },
  handleArea: { height: 28, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  handle:    { width: 36, height: 4, borderRadius: 2 },

  // ── Peek
  peekContent: {
    paddingHorizontal: 12, paddingTop: 4,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  peekSearchBar: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, height: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  peekText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  peekIconBtn: {
    width: 50, height: 50, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  savedBadge: {
    position: "absolute", top: 6, right: 6,
    width: 14, height: 14, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  savedBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  peekExploreBtn: {
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
  resultsScroll:  { flex: 1 },
  resultsContent: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  routeCards:     { flexDirection: "row", gap: 10 },

  // Pace selector
  paceRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12,
    padding: 6,
  },
  paceBtn: {
    flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8,
  },
  paceBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  paceBtnSub:  { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Directions
  directionsContainer: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: "hidden",
  },
  directionsHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  directionsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  directionsCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  stepsList: { borderTopWidth: StyleSheet.hairlineWidth },
  stepRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  stepIconBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepInstruction: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  stepDist: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },

  // Action row
  actionRow:    { flexDirection: "row", gap: 8, alignItems: "center" },
  iconBtn: {
    width: 50, height: 50, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center", justifyContent: "center",
  },
  navigateBtn: {
    flex: 1, height: 50, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  navigateBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // ── Panels (shared by Places + Saved)
  panelContainer: { flex: 1, overflow: "hidden" },
  panelHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  panelBackBtn: { padding: 2 },
  panelTitle:   { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // ── Places
  categoryScroll: { flexShrink: 0 },
  categoryChips:  { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  chipText:     { fontSize: 12, fontFamily: "Inter_500Medium" },
  poiList:      { paddingHorizontal: 16, paddingTop: 4 },
  poiSeparator: { height: StyleSheet.hairlineWidth },
  poiRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
  },
  poiIconBadge: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  poiInfo:    { flex: 1, minWidth: 0 },
  poiName:    { fontSize: 14, fontFamily: "Inter_500Medium" },
  poiCategory: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  poiRight:   { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  poiDist:    { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyText:  { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  // ── Saved routes
  savedList: { paddingHorizontal: 16, paddingTop: 4 },
  savedRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14,
  },
  savedIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  savedInfo:   { flex: 1, minWidth: 0 },
  savedLabel:  { fontSize: 14, fontFamily: "Inter_500Medium" },
  savedTime:   { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  savedDelete: { padding: 6 },
});
