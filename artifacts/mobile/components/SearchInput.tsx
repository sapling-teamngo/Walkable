import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GeoLocation, searchPlaces } from "@/services/geocoding";
import { useColors } from "@/hooks/useColors";

interface Props {
  placeholder: string;
  value: string;
  onLocationSelect: (loc: GeoLocation) => void;
  onClear: () => void;
  iconName: keyof typeof Feather.glyphMap;
  iconColor: string;
  autoFocus?: boolean;
}

export default function SearchInput({
  placeholder,
  value,
  onLocationSelect,
  onClear,
  iconName,
  iconColor,
  autoFocus = false,
}: Props) {
  const colors = useColors();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchPlaces(text);
      setSuggestions(results);
      setLoading(false);
    }, 350);
  }, []);

  const handleSelect = useCallback(
    (loc: GeoLocation) => {
      setQuery(loc.name);
      setSuggestions([]);
      onLocationSelect(loc);
    },
    [onLocationSelect],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    onClear();
  }, [onClear]);

  return (
    <View>
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <Feather name={iconName} size={16} color={iconColor} style={styles.icon} />
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={handleChange}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.mutedForeground} style={styles.action} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} style={styles.action} hitSlop={12}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {suggestions.length > 0 && (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          style={[styles.suggestions, { borderColor: colors.border }]}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.suggestion,
                index < suggestions.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Feather name="map-pin" size={14} color={colors.mutedForeground} style={styles.suggestionIcon} />
              <View style={styles.suggestionText}>
                <Text style={[styles.suggestionName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.suggestionSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.displayName}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: "transparent",
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  action: {
    padding: 4,
  },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  suggestionIcon: {
    marginRight: 10,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  suggestionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
