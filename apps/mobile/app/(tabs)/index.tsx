import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { QRPayload } from "@/types/qr";

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const router = useRouter();

  function handleBarCodeScanned({ data }: { data: string }) {
    if (!scanning) return;
    setScanning(false);

    try {
      const payload: QRPayload = JSON.parse(data);

      if (!payload.sid || !payload.cid || !payload.iat || !payload.exp || !payload.hmac) {
        throw new Error("Invalid QR format");
      }

      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        Alert.alert("Expired", "This QR code has expired. Ask your teacher to refresh.", [
          { text: "OK", onPress: () => setScanning(true) },
        ]);
        return;
      }

      router.push({
        pathname: "/verify",
        params: { payload: JSON.stringify(payload) },
      });
    } catch {
      Alert.alert("Invalid QR", "This is not a valid attendance QR code.", [
        { text: "OK", onPress: () => setScanning(true) },
      ]);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera" size={48} color="#4f46e5" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionDesc}>
            We need camera access to scan QR codes for attendance marking.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      >
        <View style={styles.overlay}>
          {/* Top text */}
          <View style={styles.topSection}>
            <Text style={styles.scanTitle}>Scan QR Code</Text>
            <Text style={styles.scanHint}>
              Align the QR code within the frame
            </Text>
          </View>

          {/* Scan frame */}
          <View style={styles.frameContainer}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomSection}>
            {!scanning ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => setScanning(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.retryText}>Tap to Scan Again</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator size="small" color="#4f46e5" />
                <Text style={styles.scanningText}>Scanning...</Text>
              </View>
            )}
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const FRAME_SIZE = 260;
const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 32,
  },
  permissionCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  permissionDesc: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "space-between",
  },
  topSection: {
    alignItems: "center",
    paddingTop: 40,
  },
  scanTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  scanHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginTop: 6,
  },
  frameContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#4f46e5",
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#4f46e5",
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: "#4f46e5",
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: "#4f46e5",
    borderBottomRightRadius: 4,
  },
  bottomSection: {
    alignItems: "center",
    paddingBottom: 48,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  scanningIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  scanningText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
