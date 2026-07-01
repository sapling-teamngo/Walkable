import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { parseGoogleMapsUrl, ImportResult } from "@/services/googleMapsImport";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  onImport: (result: ImportResult) => void;
}

const STEPS = [
  "Open Google Maps and search a route",
  'Tap Share  →  Copy link',
  "Paste the link below",
];

export default function ImportModal({ visible, onClose, onImport }: Props) {
  const colors = useColors();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseGoogleMapsUrl(url.trim());
      onImport(result);
      setUrl("");
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Could not parse this link.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setUrl("");
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kvView}
        >
          <Pressable
            style={[styles.card, { backgroundColor: colors.background }]}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="map-pin" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Import from Google Maps
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Steps */}
            <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {STEPS.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.foreground }]}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            {/* URL input */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? "#EF4444" : colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="https://maps.app.goo.gl/..."
              placeholderTextColor={colors.mutedForeground}
              value={url}
              onChangeText={(t) => { setUrl(t); setError(null); }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleImport}
              editable={!loading}
              multiline={false}
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={handleClose}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelText, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.importBtn,
                  {
                    backgroundColor:
                      !url.trim() || loading
                        ? colors.mutedForeground
                        : colors.primary,
                  },
                ]}
                onPress={handleImport}
                disabled={!url.trim() || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="download" size={16} color="#fff" />
                    <Text style={styles.importText}>Import Route</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kvView: {
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  stepsCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  stepText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  importBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  importText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
