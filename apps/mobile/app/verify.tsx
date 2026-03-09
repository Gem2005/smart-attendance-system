import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { QRPayload } from "shared";
import {
  runVerification,
  VerificationState,
} from "@/lib/verification";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";

const STEP_LABELS: Record<keyof Omit<VerificationState, "error">, string> = {
  qr: "QR Code Validation",
  timing: "Class Schedule Check",
  geofence: "GPS Location Check",
  wifi: "WiFi Proximity Check",
  photo: "Photo Capture",
};

const STATUS_ICONS: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  pending: { name: "ellipse-outline", color: "#ccc" },
  checking: { name: "hourglass-outline", color: "#f0ad4e" },
  passed: { name: "checkmark-circle", color: "#4CAF50" },
  failed: { name: "close-circle", color: "#f44336" },
};

export default function VerifyScreen() {
  const { payload: payloadStr } = useLocalSearchParams<{ payload: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<VerificationState>({
    qr: "pending",
    timing: "pending",
    geofence: "pending",
    wifi: "pending",
    photo: "pending",
  });
  const [verificationData, setVerificationData] = useState<any>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!payloadStr) return;

    const payload: QRPayload = JSON.parse(payloadStr);

    runVerification(payload, (newState) => {
      setState({ ...newState });
    })
      .then((data) => {
        setVerificationData(data);
        setState((prev) => ({ ...prev, photo: "checking" }));
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          error: err.message,
        }));
      });
  }, [payloadStr]);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission", "Camera permission is required for photo verification.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submitAttendance() {
    if (!verificationData || !photoUri || !user) return;

    setSubmitting(true);

    try {
      // Upload photo
      const fileName = `${user.id}/${verificationData.sessionId}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      // Submit attendance record
      const { error: insertError } = await supabase
        .from("attendance_records")
        .insert({
          session_id: verificationData.sessionId,
          class_id: verificationData.classId,
          student_id: user.id,
          status: "present",
          scanned_at: new Date().toISOString(),
          gps_latitude: verificationData.gpsLatitude,
          gps_longitude: verificationData.gpsLongitude,
          geofence_passed: verificationData.geofencePassed,
          wifi_ssid_found: verificationData.wifiSsidFound,
          wifi_signal_dbm: verificationData.wifiSignalDbm,
          wifi_passed: verificationData.wifiPassed,
          photo_url: fileName,
          marked_by: "system",
        });

      if (insertError) throw insertError;

      setState((prev) => ({ ...prev, photo: "passed" }));
      setDone(true);
      Alert.alert("Success", "Your attendance has been recorded!");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Verification Steps</Text>

      {(Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>).map(
        (step) => {
          const status = state[step] ?? "pending";
          const icon = STATUS_ICONS[status];

          return (
            <View key={step} style={styles.stepRow}>
              <Ionicons name={icon.name} size={24} color={icon.color} />
              <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>
            </View>
          );
        }
      )}

      {state.error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={20} color="#f44336" />
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}

      {state.photo === "checking" && !photoUri && (
        <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.photoButtonText}>Take Selfie</Text>
        </TouchableOpacity>
      )}

      {photoUri && (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
          {!done && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.retakeBtn]}
                onPress={takePhoto}
              >
                <Text style={styles.actionText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.submitBtn]}
                onPress={submitAttendance}
                disabled={submitting}
              >
                <Text style={styles.actionText}>
                  {submitting ? "Submitting..." : "Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {done && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.back()}
        >
          <Text style={styles.doneText}>Back to Scanner</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  stepLabel: {
    fontSize: 16,
    flex: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: "#c62828",
    fontSize: 14,
    flex: 1,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  photoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  photoPreview: {
    marginTop: 24,
    alignItems: "center",
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 16,
  },
  photoActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retakeBtn: {
    backgroundColor: "#eee",
  },
  submitBtn: {
    backgroundColor: "#4CAF50",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  doneButton: {
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  doneText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
