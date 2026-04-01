import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import type { QRPayload } from "@/types/qr";
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

const STEP_ICONS: Record<keyof Omit<VerificationState, "error">, keyof typeof Ionicons.glyphMap> = {
  qr: "qr-code",
  timing: "time",
  geofence: "location",
  wifi: "wifi",
  photo: "camera",
};

const STATUS_CONFIG: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  pending: { name: "ellipse-outline", color: "#d1d5db", bg: "#f9fafb", label: "Waiting" },
  checking: { name: "hourglass-outline", color: "#f59e0b", bg: "#fffbeb", label: "Checking" },
  passed: { name: "checkmark-circle", color: "#059669", bg: "#ecfdf5", label: "Passed" },
  failed: { name: "close-circle", color: "#ef4444", bg: "#fef2f2", label: "Failed" },
  skipped: { name: "remove-circle", color: "#8b5cf6", bg: "#f5f3ff", label: "Skipped" },
};

function getMimeTypeFromUri(uri: string): string {
  const normalized = uri.split("?")[0].toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function getExtensionFromMimeType(mimeType: string): string {
  const ext = mimeType.split("/")[1];
  if (!ext) return "jpg";
  if (ext === "jpeg") return "jpg";
  return ext;
}

async function fileUriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const file = new FileSystem.File(uri);
  return file.arrayBuffer();
}

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
      const classId = verificationData.classId;
      const sessionId = verificationData.sessionId;
      if (!classId || !sessionId) {
        throw new Error("Missing class/session context for photo upload.");
      }

      // Upload photo
      const contentType = getMimeTypeFromUri(photoUri);
      const extension = getExtensionFromMimeType(contentType);
      const fileName = `${classId}/${sessionId}/${user.id}/${Date.now()}.${extension}`;
      const imageBuffer = await fileUriToArrayBuffer(photoUri);

      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, imageBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        const debug = JSON.stringify(uploadError);
        console.error("attendance-photos upload error", { fileName, uploadError });
        throw new Error(uploadError.message ? `${uploadError.message} (${debug})` : debug);
      }

      // Submit attendance record
      const { error: insertError } = await supabase
        .from("attendance_records")
        .insert({
          session_id: sessionId,
          class_id: classId,
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

  // Count completed steps
  const steps = Object.keys(STEP_LABELS) as Array<keyof typeof STEP_LABELS>;
  
  // A step is considered "progressed past" if it's passed, skipped, or failed (since some checks are non-blocking).
  const completedCount = steps.filter(
    (s) => state[s] === "passed" || state[s] === "skipped" || state[s] === "failed" || (s === "photo" && done)
  ).length;

  // We enforce 100% fill if done is true just in case.
  const displayCount = done ? steps.length : completedCount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name={done ? "shield-checkmark" : "shield-half"} size={32} color="#4f46e5" />
        </View>
        <Text style={styles.title}>
          {done ? "Verification Complete" : "Verifying Attendance"}
        </Text>
        <Text style={styles.subtitle}>
          {done
            ? "All checks passed — attendance recorded"
            : `Step ${displayCount} of ${steps.length}`}
        </Text>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(displayCount / steps.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* Steps */}
      <View style={styles.stepsCard}>
        {steps.map((step, idx) => {
          const status = state[step] ?? "pending";
          const config = STATUS_CONFIG[status];
          const isLast = idx === steps.length - 1;

          return (
            <View key={step}>
              <View style={styles.stepRow}>
                <View style={[styles.stepIconCircle, { backgroundColor: config.bg }]}>
                  <Ionicons name={STEP_ICONS[step]} size={18} color={config.color} />
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>{STEP_LABELS[step]}</Text>
                  <Text style={[styles.stepStatus, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>
                <Ionicons name={config.name} size={22} color={config.color} />
              </View>
              {!isLast && <View style={styles.stepDivider} />}
            </View>
          );
        })}
      </View>

      {/* Error */}
      {state.error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={22} color="#ef4444" />
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Verification Error</Text>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        </View>
      )}

      {/* Photo prompt */}
      {state.photo === "checking" && !photoUri && (
        <TouchableOpacity style={styles.photoButton} onPress={takePhoto} activeOpacity={0.8}>
          <View style={styles.photoButtonIcon}>
            <Ionicons name="camera" size={28} color="#4f46e5" />
          </View>
          <View>
            <Text style={styles.photoButtonTitle}>Take a Selfie</Text>
            <Text style={styles.photoButtonDesc}>Required for attendance verification</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      )}

      {/* Photo preview */}
      {photoUri && (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.photo} />
          {!done && (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={takePhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={18} color="#4f46e5" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={submitAttendance}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.submitText}>Submit Attendance</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Done button */}
      {done && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace("/")}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.doneText}>Back to Scanner</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4f46e5",
    borderRadius: 3,
  },
  stepsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    overflow: "hidden",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  stepIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  stepContent: { flex: 1 },
  stepLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  stepStatus: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  stepDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 70,
  },
  errorBox: {
    flexDirection: "row",
    backgroundColor: "#fef2f2",
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorContent: { flex: 1, marginLeft: 12 },
  errorTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#dc2626",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    lineHeight: 18,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
    borderWidth: 2,
    borderColor: "#eef2ff",
    borderStyle: "dashed",
  },
  photoButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  photoButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  photoButtonDesc: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  photoPreview: {
    marginTop: 20,
    alignItems: "center",
  },
  photo: {
    width: 180,
    height: 180,
    borderRadius: 90,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: "#e5e7eb",
  },
  photoActions: {
    flexDirection: "row",
    width: "100%",
  },
  retakeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#eef2ff",
    marginRight: 6,
  },
  retakeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4f46e5",
    marginLeft: 6,
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#4f46e5",
    marginLeft: 6,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 6,
  },
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
  },
  doneText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
  },
});
