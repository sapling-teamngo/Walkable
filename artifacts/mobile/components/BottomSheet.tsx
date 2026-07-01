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
import RouteCard from "@/components/RouteCard";
import SearchInput from "@/components/SearchInput";
import { useRoute } from "@/context/RouteContext";
import { useColors } from "@/hooks/useColors";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = 660;
const PEEK_HEIGHT = 100;
const SEARCH_HEIGHT = 460;
const RESULTS_HEIGHT = 560;

const MIN_Y = SHEET_HEIGHT - RESULTS_HEIGHT;
const MAX_Y = SHEET_HEIGHT - PEEK_HEIGHT;

type SheetState = "peek" | "search" | "results";

export default function BottomSheet() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    origin,
    destination,
    routes,
    selectedRouteId,
    isLoading,
    error,
    setOrigin,
    setDestination,
    setSelectedRouteId,
    searchRoutes,
    clearAll,
  } = useRoute();

  const [sheetState, setSheetState] = useState<SheetState>("peek");
  const sheetStateRef = useRef<SheetState>("peek");

  const translateY = useRef(new Animated.Value(MAX_Y)).current;
  const currentYRef = useRef(MAX_Y);
  const startYRef = useRef(MAX_Y);

  const snapToRef = useRef<(state: SheetState) => void>(() => {});

  const snapTo = useCallback((state: SheetState) => {
    const heights: Record<SheetState, number> = {
      peek: PEEK_HEIGHT,
      search: SEARCH_HEIGHT,
      results: RESULTS_HEIGHT,
    };
    const toValue = SHEET_HEIGHT - heights[state];
    sheetStateRef.current = state;
    setSheetState(state);
    currentYRef.current = toValue;
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [translateY]);

  useEffect(() => {
    snapToRef.current = snapTo;
  }, [snapTo]);

  useEffect(() => {
    if (routes.length > 0) snapToRef.current("results");
  }, [routes.length]);

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
          const newY = startYRef.current + gs.dy;
          const clamped = Math.max(MIN_Y, Math.min(MAX_Y, newY));
          currentYRef.current = clamped;
          translateY.setValue(clamped);
        },
        onPanResponderRelease: (_, gs) => {
          const projected = currentYRef.current + gs.vy * 100;
          const snapPoints: { state: SheetState; y: number }[] = [
            { state: "peek", y: SHEET_HEIGHT - PEEK_HEIGHT },
            { state: "search", y: SHEET_HEIGHT - SEARCH_HEIGHT },
            { state: "results", y: SHEET_HEIGHT - RESULTS_HEIGHT },
          ];
          const nearest = snapPoints.reduce((prev, curr) =>
            Math.abs(curr.y - projected) < Math.abs(prev.y - projected) ? curr : prev,
          );
          snapToRef.current(nearest.state);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleFindRoute = async () => {
    await searchRoutes();
  };

  const handleOpenGoogleMaps = () => {
    if (!origin || !destination) return;
    const sel = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
    const o = `${origin.latitude},${origin.longitude}`;
    const d = `${destination.latitude},${destination.longitude}`;

    let waypointsParam = "";
    if (sel && sel.coordinates.length > 4) {
      const mid = sel.coordinates[Math.floor(sel.coordinates.length / 2)];
      waypointsParam = `&waypoints=${mid.latitude},${mid.longitude}`;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${o}` +
      `&destination=${d}` +
      waypointsParam +
      `&travelmode=walking`;

    Linking.openURL(url);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const canSearch = !!origin && !!destination;

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

      {/* Peek content */}
      {sheetState === "peek" && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => snapTo("search")}
          style={styles.peekContent}
        >
          <View
            style={[
              styles.peekBar,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <Text style={[styles.peekText, { color: colors.mutedForeground }]}>
              Where do you want to walk?
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Search content */}
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
            <View
              style={[styles.searchDividerLine, { backgroundColor: colors.border }]}
            />
            <Feather name="arrow-down" size={14} color={colors.mutedForeground} />
            <View
              style={[styles.searchDividerLine, { backgroundColor: colors.border }]}
            />
          </View>
          <SearchInput
            placeholder="To"
            value={destination?.name ?? ""}
            onLocationSelect={(loc) => setDestination(loc)}
            onClear={() => setDestination(null)}
            iconName="map-pin"
            iconColor={colors.destructive}
          />

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
              onPress={handleFindRoute}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="search" size={18} color="#fff" />
                  <Text style={styles.findButtonText}>Find Routes</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results content */}
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
              onPress={() => {
                clearAll();
                snapTo("search");
              }}
              activeOpacity={0.8}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mapsBtn, { borderColor: colors.border }]}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.85}
            >
              <Feather name="map" size={17} color={colors.foreground} />
              <Text style={[styles.mapsBtnText, { color: colors.foreground }]}>
                Google Maps
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenGoogleMaps}
              activeOpacity={0.85}
            >
              <Feather name="navigation" size={17} color="#fff" />
              <Text style={styles.startBtnText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 20,
  },
  handleArea: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  peekContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  peekBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  peekText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  searchContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
  },
  searchDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  searchDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  findButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 14,
    marginTop: 8,
  },
  findButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 16,
  },
  routeCards: {
    flexDirection: "row",
    gap: 10,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  backBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  mapsBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  mapsBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  startBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
