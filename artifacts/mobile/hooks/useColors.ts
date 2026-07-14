import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

/**
 * Returns design tokens for the current colour scheme.
 *
 * Respects the user's explicit theme preference (ThemeContext) first,
 * then falls back to the device system setting when mode is "system".
 * Exposes `isDark` so components can branch on it if needed.
 */
export function useColors() {
  const { themeMode } = useTheme();
  const systemScheme = useColorScheme();

  const isDark =
    themeMode === "dark" ||
    (themeMode === "system" && systemScheme === "dark");

  // Both light and dark palettes are now defined on the colors object
  const palette = isDark ? colors.dark : colors.light;

  return { ...palette, isDark, radius: colors.radius };
}
